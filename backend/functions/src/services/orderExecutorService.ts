/**
 * Order Executor Service
 * Executes pending orders with rate limiting and API key failover
 */

import { db } from '../db.js';
import { KrakenService } from './krakenService.js';
import { orderQueueService } from './orderQueueService.js';
import { telegramService } from './telegramService.js';
import { CircuitBreakerService } from './circuitBreakerService.js';
import {
  PendingOrder,
  OrderExecutionResult,
  OrderQueueConfig,
  DEFAULT_ORDER_QUEUE_CONFIG,
} from '../types/orderQueue.js';
import { decryptKey } from './settingsStore.js';

interface KrakenApiKey {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  encrypted: boolean;
  isActive: boolean;
}

export class OrderExecutorService {
  private config: OrderQueueConfig;
  private executingOrders: Set<string> = new Set();
  private executingOrdersByKey: Map<string, Set<string>> = new Map(); // Track per-key concurrency
  private lastExecutionTime: number = 0;
  private circuitBreaker: CircuitBreakerService;

  constructor(config: OrderQueueConfig = DEFAULT_ORDER_QUEUE_CONFIG) {
    this.config = config;
    this.circuitBreaker = new CircuitBreakerService(config.circuitBreaker);
  }

  /**
   * Execute pending orders with rate limiting
   * @param directApiKey - Optional API key from HTTP headers (same as manual trades)
   * @param directApiSecret - Optional API secret from HTTP headers (same as manual trades)
   */
  async executePendingOrders(
    directApiKey?: string,
    directApiSecret?: string
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    stuckReset: number;
  }> {
    console.log('[OrderExecutor] Starting order execution cycle');
    if (directApiKey && directApiSecret) {
      console.log('[OrderExecutor] Using API keys from HTTP headers (same as manual trades)');
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let stuckReset = 0;

    try {
      // First, reset any stuck PROCESSING orders
      stuckReset = await orderQueueService.resetStuckOrders();
      if (stuckReset > 0) {
        console.log(`[OrderExecutor] Reset ${stuckReset} stuck orders`);
      }

      // Check concurrent execution limit
      if (this.executingOrders.size >= this.config.rateLimit.maxConcurrentOrders) {
        console.log(`[OrderExecutor] Max concurrent orders limit reached: ${this.executingOrders.size}`);
        return { processed, successful, failed, stuckReset };
      }

      // Get orders ready for execution
      const availableSlots = this.config.rateLimit.maxConcurrentOrders - this.executingOrders.size;
      const orders = await orderQueueService.getOrdersReadyForExecution(availableSlots);

      console.log(`[OrderExecutor] Found ${orders.length} orders ready for execution (${this.executingOrders.size} currently executing)`);

      for (const order of orders) {
        const execId = order.executionId || 'no-trace';

        // Check if already executing
        if (this.executingOrders.has(order.id)) {
          console.log(`[OrderExecutor] [${execId}] Order ${order.id} already executing, skipping`);
          continue;
        }

        // Apply rate limiting
        await this.applyRateLimit();

        // Execute order
        this.executingOrders.add(order.id);
        processed++;

        try {
          const result = await this.executeOrder(order, directApiKey, directApiSecret);

          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        } catch (error: any) {
          console.error(`[OrderExecutor] [${execId}] Error executing order ${order.id}:`, error.message);
          failed++;
        } finally {
          this.executingOrders.delete(order.id);
        }
      }

      console.log(`[OrderExecutor] Execution cycle complete: ${processed} processed, ${successful} successful, ${failed} failed, ${stuckReset} stuck reset`);
    } catch (error: any) {
      console.error('[OrderExecutor] Error in execution cycle:', error.message);
    }

    return { processed, successful, failed, stuckReset };
  }

  /**
   * Execute a single order with API key failover
   * @param directApiKey - Optional API key from HTTP headers (same as manual trades)
   * @param directApiSecret - Optional API secret from HTTP headers (same as manual trades)
   */
  private async executeOrder(
    order: PendingOrder,
    directApiKey?: string,
    directApiSecret?: string
  ): Promise<OrderExecutionResult> {
    console.log(`[OrderExecutor] Executing order ${order.id}: ${order.side} ${order.volume} ${order.pair}`);

    // Mark as processing
    await orderQueueService.markAsProcessing(order.id);

    // If direct API keys provided (from HTTP headers), use them directly like manual trades
    if (directApiKey && directApiSecret) {
      console.log(`[OrderExecutor] Using direct API keys from headers for order ${order.id}`);

      const directKeyInfo = {
        id: 'direct',
        name: 'Direct from Headers',
        apiKey: directApiKey,
        apiSecret: directApiSecret,
        encrypted: false,
        isActive: true,
      };

      try {
        const result = await this.placeOrderWithApiKey(order, directKeyInfo);

        if (result.success) {
          await orderQueueService.markAsCompleted(order.id, {
            krakenOrderId: result.orderId!,
            executedPrice: result.executedPrice,
            executedVolume: result.executedVolume,
          });

          console.log(`[OrderExecutor] Order ${order.id} executed successfully with Kraken order ID: ${result.orderId}`);

          // Update live bot when order completes
          try {
            await this.updateBotAfterOrderCompletion(order, result);
          } catch (error: any) {
            console.warn('[OrderExecutor] Failed to update bot after order completion:', error.message);
          }

          // Send Telegram notification
          try {
            await this.sendTelegramNotification(order, result, directKeyInfo);
          } catch (error: any) {
            console.warn('[OrderExecutor] Failed to send Telegram notification:', error.message);
          }

          return result;
        } else {
          // Order failed with direct keys
          await orderQueueService.markAsFailed(order.id, result.error!, 'direct', result.shouldRetry);
          return result;
        }
      } catch (error: any) {
        console.error(`[OrderExecutor] Error with direct API keys:`, error.message);
        await orderQueueService.markAsFailed(order.id, error.message, 'direct', true);
        return { success: false, error: error.message, shouldRetry: true };
      }
    }

    // Fallback to Firestore keys (for scheduled execution)
    const apiKeys = await this.getAvailableApiKeys(order.userId, order.failedApiKeys);

    if (apiKeys.length === 0) {
      console.error(`[OrderExecutor] No available API keys for user ${order.userId}`);
      await orderQueueService.markAsFailed(
        order.id,
        'No available API keys. All configured keys have failed or are inactive.',
        undefined,
        false // Don't retry if no keys available
      );
      return { success: false, error: 'No available API keys', shouldRetry: false };
    }

    // Try each available API key
    for (const apiKey of apiKeys) {
      try {
        console.log(`[OrderExecutor] Trying API key: ${apiKey.name} for order ${order.id}`);

        const result = await this.placeOrderWithApiKey(order, apiKey);

        if (result.success) {
          // Order successful
          await orderQueueService.markAsCompleted(order.id, {
            krakenOrderId: result.orderId!,
            executedPrice: result.executedPrice,
            executedVolume: result.executedVolume,
          });

          console.log(`[OrderExecutor] Order ${order.id} executed successfully with Kraken order ID: ${result.orderId}`);

          // Update live bot when order completes
          try {
            await this.updateBotAfterOrderCompletion(order, result);
          } catch (error: any) {
            console.warn('[OrderExecutor] Failed to update bot after order completion:', error.message);
            // Don't fail the order if bot update fails
          }

          // Send Telegram notification
          try {
            await this.sendTelegramNotification(order, result, apiKey);
          } catch (error: any) {
            console.warn('[OrderExecutor] Failed to send Telegram notification:', error.message);
            // Don't fail the order if notification fails
          }

          return result;
        } else if (!result.shouldRetry) {
          // Permanent failure (e.g., insufficient funds)
          await orderQueueService.markAsFailed(order.id, result.error!, apiKey.id, false);
          return result;
        }

        // This key failed, try next one
        console.warn(`[OrderExecutor] API key ${apiKey.name} failed for order ${order.id}: ${result.error}`);
      } catch (error: any) {
        console.error(`[OrderExecutor] Error with API key ${apiKey.name}:`, error.message);
      }
    }

    // All API keys failed
    const error = `All ${apiKeys.length} API keys failed`;
    await orderQueueService.markAsFailed(order.id, error, apiKeys[apiKeys.length - 1].id, true);

    return {
      success: false,
      error,
      shouldRetry: true,
      retryAfter: this.config.initialRetryDelay,
    };
  }

  /**
   * Place order using specific API key
   */
  private async placeOrderWithApiKey(
    order: PendingOrder,
    apiKey: KrakenApiKey
  ): Promise<OrderExecutionResult & { executedPrice?: string; executedVolume?: string }> {
    const execId = order.executionId || 'no-trace';

    try {
      // Check circuit breaker
      if (this.circuitBreaker.isOpen(apiKey.id)) {
        console.warn(`[OrderExecutor] [${execId}] Circuit breaker OPEN for key ${apiKey.name}, skipping`);
        return {
          success: false,
          error: 'Circuit breaker open for this API key',
          shouldRetry: true,
        };
      }

      // Decrypt API key if needed
      const decryptedApiKey = apiKey.encrypted ? decryptKey(apiKey.apiKey) : apiKey.apiKey;
      const decryptedApiSecret = apiKey.encrypted ? decryptKey(apiKey.apiSecret) : apiKey.apiSecret;

      // Create Kraken service with the API keys
      const krakenService = new KrakenService(decryptedApiKey, decryptedApiSecret);

      // Place order on Kraken with userref for idempotency
      const volume = parseFloat(order.volume);
      const orderType = order.type === 'market' ? 'market' : 'limit';
      const price = order.price ? parseFloat(order.price) : undefined;
      const userref = order.userref;

      console.log(`[OrderExecutor] [${execId}] Placing ${order.side} order on Kraken (userref: ${userref})`);

      let response;
      if (order.side === 'buy') {
        response = await krakenService.placeBuyOrder(order.pair, volume, orderType as any, price, userref);
      } else {
        response = await krakenService.placeSellOrder(order.pair, volume, orderType as any, price, userref);
      }

      // KrakenService returns the result directly
      if (response && response.txid && response.txid.length > 0) {
        console.log(`[OrderExecutor] [${execId}] Order placed successfully: ${response.txid[0]}`);

        // Record success in circuit breaker
        this.circuitBreaker.recordSuccess(apiKey.id, execId);

        return {
          success: true,
          orderId: response.txid[0],
          shouldRetry: false,
        };
      }

      // No txid returned
      const error = 'Unknown error: No transaction ID returned';
      this.circuitBreaker.recordFailure(apiKey.id, error, execId);

      return {
        success: false,
        error,
        shouldRetry: true,
      };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`[OrderExecutor] [${execId}] Error placing order with key ${apiKey.name}:`, errorMsg);

      // Record failure in circuit breaker
      this.circuitBreaker.recordFailure(apiKey.id, errorMsg, execId);

      return {
        success: false,
        error: errorMsg,
        shouldRetry: this.isRetryableError(errorMsg),
      };
    }
  }

  /**
   * Determine if an error is retryable (Kraken-specific error classification)
   */
  private isRetryableError(error: string): boolean {
    const errorLower = error.toLowerCase();

    // Non-retryable errors (permanent failures)
    const nonRetryableErrors = [
      // Insufficient balance
      'insufficient funds',
      'insufficient balance',
      'egeneral:invalid arguments:volume',

      // Invalid parameters
      'invalid arguments',
      'invalid pair',
      'invalid volume',
      'unknown asset pair',
      'eorder:invalid price',
      'eorder:invalid volume',
      'eorder:invalid order',

      // Auth issues
      'permission denied',
      'invalid api key',
      'invalid signature',
      'eapi:invalid key',
      'egeneral:permission denied',

      // Nonce issues (usually indicates duplicate request)
      'invalid nonce',
      'eapi:invalid nonce',
    ];

    for (const nonRetryable of nonRetryableErrors) {
      if (errorLower.includes(nonRetryable)) {
        return false;
      }
    }

    // Retryable errors (temporary failures)
    const retryableErrors = [
      // Rate limiting
      'rate limit',
      'eapi:rate limit exceeded',
      '429',

      // Service issues
      'service unavailable',
      'service:unavailable',
      'eservice:unavailable',
      'eservice:busy',
      'egeneral:temporary lockout',
      '502', '503', '504', // Gateway errors
      '520', '521', '522', '523', '524', '525', // Cloudflare errors

      // Network issues
      'timeout',
      'etimedout',
      'econnreset',
      'econnrefused',
      'network error',
    ];

    for (const retryable of retryableErrors) {
      if (errorLower.includes(retryable)) {
        return true;
      }
    }

    // Default: treat unknown errors as retryable (safe default)
    console.warn(`[OrderExecutor] Unknown error type, treating as retryable: ${error.substring(0, 100)}`);
    return true;
  }

  /**
   * Get available API keys for user (excluding failed ones)
   */
  private async getAvailableApiKeys(
    userId: string,
    failedKeyIds: string[]
  ): Promise<KrakenApiKey[]> {
    console.log(`[OrderExecutor] Getting API keys for user ${userId}`);
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    console.log(`[OrderExecutor] User document exists: ${userDoc.exists}`);
    console.log(`[OrderExecutor] Has krakenKeys: ${!!userData?.krakenKeys}`);

    if (!userData || !userData.krakenKeys) {
      console.warn(`[OrderExecutor] No Kraken API keys found for user ${userId}`);
      return [];
    }

    const allKeys = userData.krakenKeys as KrakenApiKey[];
    console.log(`[OrderExecutor] Found ${allKeys.length} total Kraken keys`);

    // Filter out inactive keys and failed keys
    const availableKeys = allKeys.filter((key) => {
      if (!key.isActive) {
        console.log(`[OrderExecutor] Skipping inactive key: ${key.name}`);
        return false;
      }
      if (failedKeyIds.includes(key.id || key.name)) {
        console.log(`[OrderExecutor] Skipping failed key: ${key.name}`);
        return false;
      }
      return true;
    });

    console.log(`[OrderExecutor] ${availableKeys.length} available keys after filtering`);
    return availableKeys;
  }

  /**
   * Apply rate limiting between orders
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.config.rateLimit.maxOrdersPerSecond;
    const timeSinceLastExecution = now - this.lastExecutionTime;

    if (timeSinceLastExecution < minInterval) {
      const waitTime = minInterval - timeSinceLastExecution;
      console.log(`[OrderExecutor] Rate limiting: waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastExecutionTime = Date.now();
  }

  /**
   * Update bot after order completion
   */
  private async updateBotAfterOrderCompletion(
    order: PendingOrder,
    result: OrderExecutionResult & { executedPrice?: string; executedVolume?: string }
  ): Promise<void> {
    try {
      console.log(`[OrderExecutor] Updating bot ${order.botId} after order completion`);

      // Get the bot from Firestore
      const botDoc = await db.collection('dcaBots').doc(order.botId).get();

      if (!botDoc.exists) {
        console.warn(`[OrderExecutor] Bot ${order.botId} not found, skipping update`);
        return;
      }

      const bot = botDoc.data();
      if (!bot) return;

      // Only update bots for buy orders (entries)
      if (order.side === 'buy') {
        const newEntryCount = (bot.currentEntryCount || 0) + 1;
        const executedPrice = result.executedPrice ? parseFloat(result.executedPrice) : parseFloat(order.price || '0');
        const executedVolume = result.executedVolume ? parseFloat(result.executedVolume) : parseFloat(order.volume);

        // Calculate average entry price
        const totalPreviousCost = (bot.averageEntryPrice || 0) * (bot.totalVolume || 0);
        const newOrderCost = executedPrice * executedVolume;
        const newTotalVolume = (bot.totalVolume || 0) + executedVolume;
        const newAverageEntryPrice = (totalPreviousCost + newOrderCost) / newTotalVolume;

        // Calculate total invested amount
        const newTotalInvested = (bot.totalInvested || 0) + newOrderCost;

        // Update bot fields
        await db.collection('dcaBots').doc(order.botId).update({
          currentEntryCount: newEntryCount,
          averageEntryPrice: newAverageEntryPrice,
          averagePurchasePrice: newAverageEntryPrice, // Frontend compatibility
          totalVolume: newTotalVolume,
          totalInvested: newTotalInvested, // Total USD invested
          lastEntryPrice: executedPrice,
          lastEntryTime: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.log(`[OrderExecutor] Bot ${order.botId} updated: entry count ${newEntryCount}, avg price ${newAverageEntryPrice.toFixed(2)}, total volume ${newTotalVolume.toFixed(8)}, total invested $${newTotalInvested.toFixed(2)}`);
      } else {
        // For sell orders, reset the bot
        await db.collection('dcaBots').doc(order.botId).update({
          currentEntryCount: 0,
          averageEntryPrice: 0,
          averagePurchasePrice: 0,
          totalVolume: 0,
          totalInvested: 0,
          lastExitPrice: result.executedPrice ? parseFloat(result.executedPrice) : parseFloat(order.price || '0'),
          lastExitTime: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.log(`[OrderExecutor] Bot ${order.botId} reset after exit`);
      }
    } catch (error: any) {
      console.error(`[OrderExecutor] Error updating bot ${order.botId}:`, error.message);
      throw error;
    }
  }

  /**
   * Send Telegram notification for completed order
   */
  private async sendTelegramNotification(
    order: PendingOrder,
    result: OrderExecutionResult & { executedPrice?: string; executedVolume?: string },
    apiKey: KrakenApiKey
  ): Promise<void> {
    try {
      // Get balance for notification
      const decryptedApiKey = apiKey.encrypted ? decryptKey(apiKey.apiKey) : apiKey.apiKey;
      const decryptedApiSecret = apiKey.encrypted ? decryptKey(apiKey.apiSecret) : apiKey.apiSecret;
      const krakenService = new KrakenService(decryptedApiKey, decryptedApiSecret);

      let balance = { total: 0, stables: 0 };
      try {
        const accountBalance = await krakenService.getBalance(decryptedApiKey, decryptedApiSecret);
        if (accountBalance) {
          // Calculate total balance
          balance.total = Object.entries(accountBalance).reduce((sum, [asset, amount]) => {
            const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
            return sum + amountNum;
          }, 0);

          // Calculate stables (USD, USDT, USDC, etc.)
          balance.stables = Object.entries(accountBalance).reduce((sum, [asset, amount]) => {
            if (asset.includes('USD') || asset.includes('USDT') || asset.includes('USDC')) {
              const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
              return sum + amountNum;
            }
            return sum;
          }, 0);
        }
      } catch (error) {
        console.warn('[OrderExecutor] Failed to fetch balance for Telegram notification:', error);
      }

      // Calculate price and amount
      const price = result.executedPrice ? parseFloat(result.executedPrice) : parseFloat(order.price || '0');
      const volume = result.executedVolume ? parseFloat(result.executedVolume) : parseFloat(order.volume);
      const amount = price * volume;

      // Determine if this is entry or exit
      const isExit = order.side === 'sell';

      if (isExit) {
        // Trade closure notification
        await telegramService.sendTradeClosure(
          {
            pair: order.pair,
            type: order.side,
            volume: volume.toString(),
            price,
            amount,
            profit: 0, // We don't have entry price to calculate profit
            profitPercent: 0,
            orderResult: { txid: [result.orderId || 'N/A'] },
          },
          balance
        );
      } else {
        // Trade entry notification
        await telegramService.sendTradeEntry(
          {
            pair: order.pair,
            type: order.side,
            volume: volume.toString(),
            price,
            amount,
            orderResult: { txid: [result.orderId || 'N/A'] },
          },
          balance
        );
      }

      console.log('[OrderExecutor] Telegram notification sent successfully');
    } catch (error: any) {
      console.error('[OrderExecutor] Error sending Telegram notification:', error.message);
      // Don't throw - we don't want to fail the order if notification fails
    }
  }

  /**
   * Get executor status for monitoring
   */
  getStatus(): {
    executingOrders: number;
    maxConcurrentOrders: number;
    maxOrdersPerSecond: number;
  } {
    return {
      executingOrders: this.executingOrders.size,
      maxConcurrentOrders: this.config.rateLimit.maxConcurrentOrders,
      maxOrdersPerSecond: this.config.rateLimit.maxOrdersPerSecond,
    };
  }

  /**
   * Get circuit breaker status (admin)
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getAllStates();
  }

  /**
   * Reset a circuit breaker (admin)
   */
  resetCircuitBreaker(keyId: string): void {
    this.circuitBreaker.reset(keyId);
  }

  /**
   * Clear all circuit breakers (admin)
   */
  clearAllCircuitBreakers(): void {
    this.circuitBreaker.clearAll();
  }
}

export const orderExecutorService = new OrderExecutorService();
