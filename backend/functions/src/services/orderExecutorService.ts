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
    console.log('========================================');
    console.log('[OrderExecutor] ⚡ STARTING ORDER EXECUTION CYCLE');
    console.log(`[OrderExecutor] Timestamp: ${new Date().toISOString()}`);
    if (directApiKey && directApiSecret) {
      console.log('[OrderExecutor] Using API keys from HTTP headers (same as manual trades)');
    } else {
      console.log('[OrderExecutor] Using API keys from Firestore (scheduled execution)');
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let stuckReset = 0;

    try {
      // First, reset any stuck PROCESSING orders
      console.log('[OrderExecutor] Checking for stuck orders...');
      stuckReset = await orderQueueService.resetStuckOrders();
      if (stuckReset > 0) {
        console.log(`[OrderExecutor] ✅ Reset ${stuckReset} stuck orders`);
      } else {
        console.log(`[OrderExecutor] No stuck orders found`);
      }

      // Check concurrent execution limit
      console.log(`[OrderExecutor] Current concurrency: ${this.executingOrders.size}/${this.config.rateLimit.maxConcurrentOrders}`);
      if (this.executingOrders.size >= this.config.rateLimit.maxConcurrentOrders) {
        console.log(`[OrderExecutor] ⚠️  Max concurrent orders limit reached: ${this.executingOrders.size}`);
        return { processed, successful, failed, stuckReset };
      }

      // Get orders ready for execution
      const availableSlots = this.config.rateLimit.maxConcurrentOrders - this.executingOrders.size;
      console.log(`[OrderExecutor] Fetching up to ${availableSlots} orders ready for execution...`);
      const orders = await orderQueueService.getOrdersReadyForExecution(availableSlots);

      console.log(`[OrderExecutor] 📋 Found ${orders.length} orders ready for execution (${this.executingOrders.size} currently executing)`);

      if (orders.length === 0) {
        console.log('[OrderExecutor] No orders to process - queue is empty');
      }

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
          console.error(`[OrderExecutor] [${execId}] CRITICAL: Unhandled error executing order ${order.id}:`, error.message);

          // CRITICAL FIX: Mark order as failed if uncaught exception occurs
          // This prevents infinite PROCESSING -> RETRY loops
          try {
            await orderQueueService.markAsFailed(
              order.id,
              `Unhandled exception: ${error.message}`,
              undefined,
              true // Allow retry
            );
          } catch (markFailedError: any) {
            console.error(`[OrderExecutor] [${execId}] Failed to mark order as failed:`, markFailedError.message);
          }

          failed++;
        } finally {
          this.executingOrders.delete(order.id);
        }
      }

      console.log(`[OrderExecutor] Execution cycle complete: ${processed} processed, ${successful} successful, ${failed} failed, ${stuckReset} stuck reset`);
    } catch (error: any) {
      console.error('[OrderExecutor] Error in execution cycle:', error.message);
      console.error('[OrderExecutor] Error stack:', error.stack);
    }

    return { processed, successful, failed, stuckReset };
  }

  /**
   * Validate that order requirements are still met before retry
   * For buy orders: Check if bullish trend still exists
   * For sell orders: Check if price is still above min TP and bearish trend exists
   */
  private async validateOrderRequirements(
    order: PendingOrder,
    directApiKey?: string,
    directApiSecret?: string
  ): Promise<{ valid: boolean; reason: string }> {
    try {
      // Get bot data
      const botDoc = await db.collection('dcaBots').doc(order.botId).get();

      if (!botDoc.exists) {
        return { valid: false, reason: 'Bot not found' };
      }

      const bot = botDoc.data();

      if (!bot) {
        return { valid: false, reason: 'Bot data unavailable' };
      }

      // Get API keys for market data
      const apiKey = directApiKey || undefined;
      const apiSecret = directApiSecret || undefined;

      // Import services (avoid circular dependency)
      const { DCABotService } = await import('./dcaBotService.js');
      const { KrakenService } = await import('./krakenService.js');
      const { MarketAnalysisService } = await import('./marketAnalysisService.js');

      // Create services
      const krakenService = new KrakenService(apiKey, apiSecret);
      const marketAnalysis = new MarketAnalysisService();

      // Get current price
      const ticker = await krakenService.getTicker(order.pair);
      const currentPrice = ticker.price;

      console.log(`[OrderExecutor] Validating ${order.side} order for ${order.pair} at current price $${currentPrice.toFixed(2)}`);

      if (order.side === 'buy') {
        // ENTRY VALIDATION: Only cancel if trend turned bearish (not just neutral)
        // Neutral trends are acceptable for queued buy orders
        const analysis = await marketAnalysis.analyzeTrend(order.pair);

        console.log(`[OrderExecutor] Entry validation - trend: ${analysis.recommendation}, tech: ${analysis.techScore.toFixed(0)}, trend: ${analysis.trendScore.toFixed(0)}`);

        if (analysis.recommendation === 'bearish') {
          return {
            valid: false,
            reason: `Trend turned bearish (tech: ${analysis.techScore.toFixed(0)}, trend: ${analysis.trendScore.toFixed(0)}), canceling entry order`,
          };
        }

        return { valid: true, reason: `Trend acceptable (${analysis.recommendation}), entry still valid` };
      } else {
        // EXIT VALIDATION: Check if price is still above min TP and bearish trend exists
        const averagePrice = bot.averageEntryPrice || bot.averagePurchasePrice || 0;
        const tpTarget = bot.tpTarget || 3;
        const minTpPrice = averagePrice * (1 + tpTarget / 100);

        console.log(`[OrderExecutor] Exit validation - current: $${currentPrice.toFixed(2)}, minTP: $${minTpPrice.toFixed(2)}, avg: $${averagePrice.toFixed(2)}`);

        // Check if price is still above min TP
        if (currentPrice < minTpPrice) {
          return {
            valid: false,
            reason: `Price dropped below min TP ($${currentPrice.toFixed(2)} < $${minTpPrice.toFixed(2)}), canceling exit order`,
          };
        }

        // Check if trend is still bearish
        const analysis = await marketAnalysis.analyzeTrend(order.pair);

        console.log(`[OrderExecutor] Exit validation - trend: ${analysis.recommendation}, tech: ${analysis.techScore.toFixed(0)}, trend: ${analysis.trendScore.toFixed(0)}`);

        if (analysis.recommendation !== 'bearish') {
          return {
            valid: false,
            reason: `Trend no longer bearish (${analysis.recommendation}), canceling exit order to let position ride`,
          };
        }

        return { valid: true, reason: 'Bearish trend confirmed and price above TP, exit still valid' };
      }
    } catch (error: any) {
      console.error(`[OrderExecutor] Error validating order requirements:`, error.message);
      // On validation error, allow the order to proceed (fail safe)
      return { valid: true, reason: 'Validation error, proceeding with order' };
    }
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

    // CRITICAL FIX: Check for excessive retries (infinite loop protection)
    // If order has more than 50 error entries, it's stuck in an infinite loop
    if (order.errors && order.errors.length > 50) {
      const errorMsg = `Order abandoned after ${order.errors.length} failed attempts. Likely stuck in infinite retry loop.`;
      console.error(`[OrderExecutor] ${errorMsg} Order: ${order.id}`);

      await orderQueueService.markAsFailed(order.id, errorMsg, undefined, false); // Don't retry

      // If this is an exit order, reset the bot back to active
      if (order.side === 'sell') {
        await this.handleFailedExitOrder(order, errorMsg);
      }

      return {
        success: false,
        error: errorMsg,
        shouldRetry: false,
      };
    }

    // NEW: Re-validate entry/exit requirements before executing retry attempts
    // This ensures conditions are still met before placing the order
    if (order.attempts > 0) {
      console.log(`[OrderExecutor] This is retry attempt ${order.attempts + 1}, validating requirements...`);

      const validationResult = await this.validateOrderRequirements(order, directApiKey, directApiSecret);

      if (!validationResult.valid) {
        console.log(`[OrderExecutor] Order ${order.id} requirements no longer met: ${validationResult.reason}`);

        await orderQueueService.markAsFailed(
          order.id,
          `Requirements no longer met: ${validationResult.reason}`,
          undefined,
          false // Don't retry - conditions changed
        );

        // If this is an exit order, reset the bot back to active
        if (order.side === 'sell') {
          await this.handleFailedExitOrder(order, validationResult.reason);
        }

        return {
          success: false,
          error: validationResult.reason,
          shouldRetry: false,
        };
      }

      console.log(`[OrderExecutor] Requirements still met, proceeding with retry`);
    }

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

          // Update live bot when order completes and get profit data
          let profitData = undefined;
          try {
            profitData = await this.updateBotAfterOrderCompletion(order, result);
          } catch (error: any) {
            console.warn('[OrderExecutor] Failed to update bot after order completion:', error.message);
          }

          // Send Telegram notification with profit data
          try {
            await this.sendTelegramNotification(order, result, directKeyInfo, profitData);
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
      console.warn(`[OrderExecutor] No available API keys for user ${order.userId} - all keys have been tried`);

      // CRITICAL FIX: Clear failedApiKeys to give them another chance on next retry
      // This handles temporary failures like rate limits, network issues, etc.
      console.log(`[OrderExecutor] Clearing failedApiKeys list to retry all keys on next attempt`);

      await db.collection('pendingOrders').doc(order.id).update({
        failedApiKeys: [], // Reset the failed keys list
        lastError: 'All API keys failed on this attempt - will retry all keys next time',
        updatedAt: new Date().toISOString(),
      });

      await orderQueueService.markAsFailed(
        order.id,
        'All API keys temporarily failed. Cleared failed list and will retry.',
        undefined,
        true // DO retry - this is likely a temporary issue
      );
      return { success: false, error: 'All API keys temporarily failed', shouldRetry: true };
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

          // Update live bot when order completes and get profit data
          let profitData = undefined;
          try {
            profitData = await this.updateBotAfterOrderCompletion(order, result);
          } catch (error: any) {
            console.warn('[OrderExecutor] Failed to update bot after order completion:', error.message);
            // Don't fail the order if bot update fails
          }

          // Send Telegram notification with profit data
          try {
            await this.sendTelegramNotification(order, result, apiKey, profitData);
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
        const txid = response.txid[0];
        console.log(`[OrderExecutor] [${execId}] Order placed successfully: ${txid}`);

        // CRITICAL FIX: Verify order execution (Issue #4 from professional review)
        let executedPrice: string | undefined;
        let executedVolume: string | undefined;
        let orderStatus: string | undefined;

        try {
          console.log(`[OrderExecutor] [${execId}] Verifying order execution for ${txid}...`);

          // Use the new checkOrderStatus method with retry logic
          const statusCheck = await krakenService.checkOrderStatus(txid, 3, 2000);

          orderStatus = statusCheck.status;
          executedPrice = statusCheck.executedPrice;
          executedVolume = statusCheck.executedVolume;

          console.log(`[OrderExecutor] [${execId}] Order verification: status=${orderStatus}, price=${executedPrice}, volume=${executedVolume}`);

          // For market orders, verify it actually executed
          if (orderStatus === 'open' || orderStatus === 'pending') {
            console.warn(`[OrderExecutor] [${execId}] Market order ${txid} still ${orderStatus} after 6 seconds - may need manual review`);
            // Still consider it success since order was placed, but log the warning
          } else if (orderStatus === 'canceled' || orderStatus === 'expired') {
            console.error(`[OrderExecutor] [${execId}] Order ${txid} was ${orderStatus}!`);
            this.circuitBreaker.recordFailure(apiKey.id, `Order ${orderStatus}`, execId);
            return {
              success: false,
              error: `Order was ${orderStatus}`,
              shouldRetry: true,
            };
          }
        } catch (error: any) {
          console.warn(`[OrderExecutor] [${execId}] Error verifying order execution:`, error.message);
          // Continue without execution details - updateBotAfterOrderCompletion will use order params as fallback
        }

        // Record success in circuit breaker
        this.circuitBreaker.recordSuccess(apiKey.id, execId);

        return {
          success: true,
          orderId: txid,
          executedPrice,
          executedVolume,
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

    // IMPORTANT: Insufficient funds should be retryable (user may deposit more funds)
    // The order should stay in RETRY state, not FAILED, so it can be retried later
    if (errorLower.includes('insufficient funds') || errorLower.includes('insufficient balance')) {
      console.log('[OrderExecutor] Insufficient funds error - marking as RETRYABLE (waiting for user deposit)');
      return true;
    }

    // Non-retryable errors (permanent failures)
    const nonRetryableErrors = [
      // Volume issues
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
    console.log(`[OrderExecutor] ========== GETTING API KEYS ==========`);
    console.log(`[OrderExecutor] User ID: ${userId}`);
    console.log(`[OrderExecutor] Failed key IDs: ${JSON.stringify(failedKeyIds)}`);

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    console.log(`[OrderExecutor] User document exists: ${userDoc.exists}`);

    if (!userDoc.exists) {
      console.error(`[OrderExecutor] ❌ User document does NOT exist for user ${userId}`);
      console.error(`[OrderExecutor] This means the user was never created or userId is wrong`);
      return [];
    }

    console.log(`[OrderExecutor] User data keys: ${Object.keys(userData || {}).join(', ')}`);
    console.log(`[OrderExecutor] Has krakenKeys: ${!!userData?.krakenKeys}`);

    if (userData?.krakenKeys) {
      console.log(`[OrderExecutor] krakenKeys is array: ${Array.isArray(userData.krakenKeys)}`);
      console.log(`[OrderExecutor] krakenKeys length: ${userData.krakenKeys.length}`);
    }

    if (!userData || !userData.krakenKeys || !Array.isArray(userData.krakenKeys) || userData.krakenKeys.length === 0) {
      console.error(`[OrderExecutor] ❌ No Kraken API keys found for user ${userId}`);
      console.error(`[OrderExecutor] Please add API keys in the Settings page`);
      return [];
    }

    const allKeys = userData.krakenKeys as KrakenApiKey[];
    console.log(`[OrderExecutor] Found ${allKeys.length} total Kraken keys`);

    // Log each key (masked)
    allKeys.forEach((key, index) => {
      console.log(`[OrderExecutor] Key ${index + 1}: ${key.name} - Active: ${key.isActive} - ID: ${key.id}`);
    });

    // Filter out inactive keys and failed keys
    const availableKeys = allKeys.filter((key) => {
      if (!key.isActive) {
        console.log(`[OrderExecutor] ❌ Skipping inactive key: ${key.name}`);
        return false;
      }
      if (failedKeyIds.includes(key.id || key.name)) {
        console.log(`[OrderExecutor] ❌ Skipping previously failed key: ${key.name}`);
        return false;
      }
      console.log(`[OrderExecutor] ✅ Key ${key.name} is available`);
      return true;
    });

    console.log(`[OrderExecutor] RESULT: ${availableKeys.length} available keys after filtering`);
    console.log(`[OrderExecutor] ========================================`);
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
   * Handle failed exit order - reset bot to active to prevent permanent "exiting" state
   */
  private async handleFailedExitOrder(order: PendingOrder, error: string): Promise<void> {
    try {
      console.log(`[OrderExecutor] Handling failed exit order for bot ${order.botId}`);

      const botDoc = await db.collection('dcaBots').doc(order.botId).get();
      if (!botDoc.exists) {
        console.warn(`[OrderExecutor] Bot ${order.botId} not found, cannot reset from exiting state`);
        return;
      }

      const bot = botDoc.data();
      if (!bot) return;

      // Only reset if bot is stuck in 'exiting' status
      if (bot.status === 'exiting') {
        // Determine if this is a retryable error
        const isRetryable = this.isRetryableError(error);
        const exitAttempts = (bot.exitAttempts || 0) + 1;

        if (isRetryable) {
          // RETRYABLE ERROR: Keep in 'exiting' status, order queue will auto-retry
          console.log(`[OrderExecutor] Bot ${order.botId} exit failed with RETRYABLE error (attempt ${exitAttempts}). Will auto-retry.`);
          console.log(`[OrderExecutor] Error: ${error}`);

          // Update bot with retry info but keep status as 'exiting'
          await db.collection('dcaBots').doc(order.botId).update({
            exitFailureReason: error,
            exitFailureTime: new Date().toISOString(),
            exitAttempts: exitAttempts,
            lastExitAttempt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Keep status as 'exiting' - order will auto-retry
          });

          console.log(`[OrderExecutor] ✅ Bot ${order.botId} will auto-retry exit (retryable error). Order remains in queue for retry.`);
        } else {
          // NON-RETRYABLE ERROR: Mark as permanently failed
          console.log(`[OrderExecutor] Bot ${order.botId} exit failed with NON-RETRYABLE error (attempt ${exitAttempts}). Setting to 'exit_failed'.`);
          console.log(`[OrderExecutor] Error: ${error}`);

          // Set bot to exit_failed status - requires manual intervention
          await db.collection('dcaBots').doc(order.botId).update({
            status: 'exit_failed',
            exitFailureReason: error,
            exitFailureTime: new Date().toISOString(),
            exitAttempts: exitAttempts,
            lastExitAttempt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          console.log(`[OrderExecutor] ✅ Bot ${order.botId} set to 'exit_failed' (non-retryable). UI will show diagnostic with manual retry button.`);
        }

        // Log the failed exit in bot executions
        await db.collection('botExecutions').add({
          id: `${order.botId}_failed_exit_${Date.now()}`,
          botId: order.botId,
          action: 'exit_failed',
          symbol: order.pair,
          price: parseFloat(order.price || '0'),
          quantity: parseFloat(order.volume),
          amount: order.amount || 0,
          reason: `Exit order failed and bot was reset to active: ${error}`,
          timestamp: new Date().toISOString(),
          success: false,
          error,
          orderId: order.id,
        });
      }
    } catch (error: any) {
      console.error(`[OrderExecutor] Error handling failed exit order for bot ${order.botId}:`, error.message);
      // Don't throw - we don't want to fail the order marking because of bot update issues
    }
  }

  /**
   * Update bot after order completion
   * Returns profit data for exit orders to use in Telegram notifications
   */
  private async updateBotAfterOrderCompletion(
    order: PendingOrder,
    result: OrderExecutionResult & { executedPrice?: string; executedVolume?: string }
  ): Promise<{ profit: number; profitPercent: number; averageEntryPrice: number; totalInvested: number } | undefined> {
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

        // Find and update the existing pending entry (created by dcaBotService.executeEntry)
        // The pending entry has orderId matching this order.id
        const entriesSnapshot = await db
          .collection('dcaBots')
          .doc(order.botId)
          .collection('entries')
          .where('orderId', '==', order.id)
          .where('status', '==', 'pending')
          .limit(1)
          .get();

        if (!entriesSnapshot.empty) {
          // Update existing pending entry
          const entryDoc = entriesSnapshot.docs[0];
          await entryDoc.ref.update({
            orderAmount: newOrderCost,
            quantity: executedVolume,
            price: executedPrice,
            status: 'filled',
            txid: result.orderId, // Kraken transaction ID
            updatedAt: new Date().toISOString(),
          });
          console.log(`[OrderExecutor] Updated pending entry ${entryDoc.id} to filled for bot ${order.botId}`);
        } else {
          // Fallback: create new entry if no pending entry found (shouldn't happen but safe fallback)
          const entryData = {
            botId: order.botId,
            entryNumber: newEntryCount,
            id: `${order.botId}_entry_${newEntryCount}`,
            orderAmount: newOrderCost,
            quantity: executedVolume,
            price: executedPrice,
            status: 'filled',
            timestamp: new Date().toISOString(),
            orderId: order.id,
            txid: result.orderId,
          };

          await db
            .collection('dcaBots')
            .doc(order.botId)
            .collection('entries')
            .doc(entryData.id)
            .set(entryData);

          console.log(`[OrderExecutor] Created new entry ${newEntryCount} for bot ${order.botId} (no pending entry found)`);
        }

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

        return undefined; // No profit data for entry orders
      } else {
        // For sell orders, reset the bot to restart the cycle
        console.log(`[OrderExecutor] Processing SELL order completion for bot ${order.botId}`);

        // Get current bot data to save cycle history AND calculate profit
        const botDoc = await db.collection('dcaBots').doc(order.botId).get();
        const currentBot = botDoc.data();

        if (!currentBot) {
          const errorMsg = `Bot ${order.botId} not found during exit processing`;
          console.error(`[OrderExecutor] CRITICAL: ${errorMsg}`);

          // Log the error but don't fail the order completion
          // The order was executed successfully on Kraken, so we can't rollback
          await db.collection('botExecutions').add({
            id: `${order.botId}_exit_error_${Date.now()}`,
            botId: order.botId,
            action: 'exit',
            symbol: order.pair,
            price: parseFloat(order.price || '0'),
            quantity: parseFloat(order.volume),
            amount: order.amount || 0,
            reason: errorMsg,
            timestamp: new Date().toISOString(),
            success: false,
            error: errorMsg,
            orderId: order.id,
          });

          // Don't throw - order was placed successfully, just bot update failed
          console.warn(`[OrderExecutor] Sell order ${order.id} completed on Kraken but bot ${order.botId} update failed. Manual intervention required.`);
          return;
        }

        // First, delete all entries to ensure clean restart
        const entriesSnapshot = await db
          .collection('dcaBots')
          .doc(order.botId)
          .collection('entries')
          .get();

        console.log(`[OrderExecutor] Found ${entriesSnapshot.size} entries to delete for bot ${order.botId}`);

        const batch = db.batch();
        entriesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        console.log(`[OrderExecutor] Successfully deleted ${entriesSnapshot.size} entries for bot ${order.botId}`);

        // Calculate cycle profit BEFORE resetting bot (for Telegram notification)
        const exitPrice = result.executedPrice ? parseFloat(result.executedPrice) : parseFloat(order.price || '0');
        const totalInvested = currentBot.totalInvested || 0;
        const totalVolume = currentBot.totalVolume || 0;
        const averageEntryPrice = currentBot.averageEntryPrice || 0;
        const exitValue = exitPrice * totalVolume;
        const profit = exitValue - totalInvested;
        const profitPercent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        // Save profit data to return for Telegram notification
        const profitData = {
          profit,
          profitPercent,
          averageEntryPrice,
          totalInvested,
        };

        // Create cycle history record
        const completedCycle = {
          cycleId: currentBot.cycleId || `cycle_${Date.now()}`,
          cycleNumber: currentBot.cycleNumber || 1,
          cycleStartTime: currentBot.cycleStartTime || currentBot.createdAt,
          cycleEndTime: new Date().toISOString(),
          entryCount: currentBot.currentEntryCount || 0,
          totalInvested,
          totalVolume,
          averageEntryPrice: currentBot.averageEntryPrice || 0,
          exitPrice,
          exitTime: new Date().toISOString(),
          profit,
          profitPercent,
        };

        // Add to previousCycles array
        const previousCycles = currentBot.previousCycles || [];
        previousCycles.push(completedCycle);

        console.log(`[OrderExecutor] Cycle ${completedCycle.cycleNumber} completed: Profit ${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);

        // Generate new cycle ID for next cycle
        const newCycleId = `cycle_${Date.now()}`;
        const newCycleNumber = (currentBot.cycleNumber || 1) + 1;
        const now = new Date().toISOString();

        // Reset bot to active status to restart the cycle
        const resetData = {
          status: 'active', // Keep bot active to restart the cycle
          currentEntryCount: 0,
          averageEntryPrice: 0,
          averagePurchasePrice: 0,
          totalVolume: 0,
          totalInvested: 0,
          lastExitPrice: exitPrice,
          lastExitTime: now,
          updatedAt: now,
          // Start new cycle
          cycleId: newCycleId,
          cycleStartTime: now,
          cycleNumber: newCycleNumber,
          previousCycles,
        };

        console.log(`[OrderExecutor] Resetting bot ${order.botId} to start cycle ${newCycleNumber}`);

        await db.collection('dcaBots').doc(order.botId).update(resetData);

        console.log(`[OrderExecutor] ✅ Bot ${order.botId} successfully reset to active, starting cycle ${newCycleNumber} (${newCycleId})`);

        // Return profit data for Telegram notification
        return profitData;
      }
    } catch (error: any) {
      console.error(`[OrderExecutor] CRITICAL: Error updating bot ${order.botId} after order completion:`, error.message);
      console.error(`[OrderExecutor] Stack trace:`, error.stack);

      // Log the error to botExecutions for visibility
      try {
        await db.collection('botExecutions').add({
          id: `${order.botId}_update_error_${Date.now()}`,
          botId: order.botId,
          action: order.side === 'buy' ? 'entry' : 'exit',
          symbol: order.pair,
          price: parseFloat(order.price || '0'),
          quantity: parseFloat(order.volume),
          amount: order.amount || 0,
          reason: `Bot update failed after successful ${order.side} order: ${error.message}`,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message,
          orderId: order.id,
        });
      } catch (logError: any) {
        console.error(`[OrderExecutor] Failed to log bot update error:`, logError.message);
      }

      // If this is a sell order and the error occurred, reset bot from 'exiting' to 'active'
      // This prevents the bot from being stuck in 'exiting' status forever
      if (order.side === 'sell') {
        try {
          await this.handleFailedExitOrder(order, `Bot update failed: ${error.message}`);
        } catch (resetError: any) {
          console.error(`[OrderExecutor] Failed to reset bot after exit failure:`, resetError.message);
        }
      }

      // Don't throw - order was executed successfully on Kraken
      // Throwing here would cause the order to be marked as failed even though it succeeded
      console.warn(`[OrderExecutor] Order ${order.id} completed on Kraken but bot update failed. Bot may require manual intervention.`);

      return undefined; // No profit data if update failed
    }
  }

  /**
   * Send Telegram notification for completed order
   */
  private async sendTelegramNotification(
    order: PendingOrder,
    result: OrderExecutionResult & { executedPrice?: string; executedVolume?: string },
    apiKey: KrakenApiKey,
    profitData?: { profit: number; profitPercent: number; averageEntryPrice: number; totalInvested: number }
  ): Promise<void> {
    try {
      // Get balance for notification
      const decryptedApiKey = apiKey.encrypted ? decryptKey(apiKey.apiKey) : apiKey.apiKey;
      const decryptedApiSecret = apiKey.encrypted ? decryptKey(apiKey.apiSecret) : apiKey.apiSecret;
      const krakenService = new KrakenService(decryptedApiKey, decryptedApiSecret);

      // Build top holdings array for Telegram notification
      const topHoldings: Array<{ asset: string; value: number }> = [];
      let accountBalanceData: Record<string, any> = {};

      try {
        console.log('[OrderExecutor] ===== FETCHING BALANCE FOR TELEGRAM NOTIFICATION =====');
        const accountBalance = await krakenService.getBalance(decryptedApiKey, decryptedApiSecret);
        accountBalanceData = accountBalance || {};

        console.log('[OrderExecutor] Raw balance data:', JSON.stringify(accountBalance, null, 2));
        console.log('[OrderExecutor] Number of assets:', Object.keys(accountBalance || {}).length);

        if (!accountBalance || Object.keys(accountBalance).length === 0) {
          console.error('[OrderExecutor] ❌ No balance data received from Kraken!');
        } else {
          // Get current prices for all non-stable assets
          const stablecoins = ['ZUSD', 'USD', 'USDT', 'USDC', 'DAI', 'BUSD'];
          const prices: Record<string, number> = {};

          // Fetch prices individually to avoid batch failures
          for (const asset of Object.keys(accountBalance)) {
            const amountNum = parseFloat(String(accountBalance[asset]));

            if (amountNum > 0 && !stablecoins.includes(asset)) {
              let baseAsset = asset.replace(/\.F$/, '');
              // Strip X/Z prefix for pair construction
              let cleanAsset = baseAsset;
              if (cleanAsset.startsWith('X') || cleanAsset.startsWith('Z')) {
                cleanAsset = cleanAsset.substring(1);
              }

              // Try different pair formats
              const pairFormats = [
                `${baseAsset}ZUSD`,  // e.g., XXBTZUSD
                `${baseAsset}USD`,   // e.g., SCUSD
                `${cleanAsset}USD`,  // e.g., BTCUSD
              ];

              for (const pair of pairFormats) {
                try {
                  const rawPrices = await krakenService.getCurrentPrices([pair]);
                  // Check multiple possible keys in response
                  const possibleKeys = [baseAsset, cleanAsset, `X${cleanAsset}`, `XX${cleanAsset}`];
                  for (const key of possibleKeys) {
                    if (rawPrices[key] !== undefined) {
                      prices[asset] = rawPrices[key];
                      console.log(`[OrderExecutor] Got price for ${asset} via ${pair}: $${rawPrices[key]}`);
                      break;
                    }
                  }
                  if (prices[asset]) break;
                } catch (e) {
                  // Try next format
                }
              }

              if (!prices[asset]) {
                console.warn(`[OrderExecutor] Could not fetch price for ${asset}`);
              }
            }
          }

          // Build holdings array with USD values
          for (const [asset, amount] of Object.entries(accountBalance)) {
            const amountNum = parseFloat(String(amount));
            if (amountNum <= 0) continue;

            const isStable = stablecoins.includes(asset);
            const currentPrice = isStable ? 1 : (prices[asset] || 0);
            const assetValue = amountNum * currentPrice;

            if (assetValue > 0.01) {
              // Clean up asset name for display
              let displayName = asset.replace(/\.F$/, '');
              if (displayName.startsWith('X') || displayName.startsWith('Z')) {
                displayName = displayName.substring(1);
              }
              topHoldings.push({ asset: displayName, value: assetValue });
            }
          }

          // Sort by value descending and take top 10
          topHoldings.sort((a, b) => b.value - a.value);

          console.log(`[OrderExecutor] Top holdings: ${topHoldings.slice(0, 10).map(h => `${h.asset}: $${h.value.toFixed(2)}`).join(', ')}`);
        }
      } catch (error: any) {
        console.error('[OrderExecutor] ❌ CRITICAL ERROR fetching balance:', error?.message || error);
      }

      // Calculate price
      const price = result.executedPrice ? parseFloat(result.executedPrice) : parseFloat(order.price || '0');
      const volume = result.executedVolume ? parseFloat(result.executedVolume) : parseFloat(order.volume);

      // Determine if this is entry or exit
      const isExit = order.side === 'sell';

      if (isExit) {
        // Use profit data passed from updateBotAfterOrderCompletion
        const profit = profitData?.profit || 0;
        const profitPercent = profitData?.profitPercent || 0;
        const totalInvested = profitData?.totalInvested || 0;
        const totalSold = price * volume;

        // Extract symbol from pair (e.g., "SNXUSD" -> "SNX")
        const pairStr = order.pair;
        let symbol = pairStr.replace(/USD$|ZUSD$/, '');
        if (symbol.startsWith('X') || symbol.startsWith('Z')) {
          symbol = symbol.substring(1);
        }

        // Find remaining balance for this asset
        let remainingBalance: number | undefined;
        for (const [asset, amount] of Object.entries(accountBalanceData)) {
          let assetSymbol = asset.replace(/\.F$/, '');
          if (assetSymbol.startsWith('X') || assetSymbol.startsWith('Z')) {
            assetSymbol = assetSymbol.substring(1);
          }
          if (assetSymbol === symbol) {
            remainingBalance = parseFloat(String(amount));
            break;
          }
        }

        console.log(`[OrderExecutor] Exit notification: totalInvested $${totalInvested.toFixed(2)}, totalSold $${totalSold.toFixed(2)}, profit $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%), ${symbol} remaining: ${remainingBalance?.toFixed(8) || '0'}`);

        // Trade closure notification
        await telegramService.sendTradeClosure({
          pair: order.pair,
          price,
          totalPurchased: totalInvested,
          totalSold,
          profit,
          profitPercent,
          symbol,
          remainingBalance,
          topHoldings,
        });
      } else {
        // Get bot data for total purchased and remaining value
        let totalPurchased = 0;
        let remainingValue = 0;

        try {
          const botDoc = await db.collection('dcaBots').doc(order.botId).get();
          if (botDoc.exists) {
            const bot = botDoc.data();
            totalPurchased = (bot?.totalInvested || 0);
            const totalVolume = bot?.totalVolume || 0;
            remainingValue = totalVolume * price;
          }
        } catch (error: any) {
          console.warn('[OrderExecutor] Failed to fetch bot data for entry notification:', error.message);
        }

        // Trade entry notification
        await telegramService.sendTradeEntry({
          pair: order.pair,
          price,
          totalPurchased,
          remainingValue,
          topHoldings,
        });
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
