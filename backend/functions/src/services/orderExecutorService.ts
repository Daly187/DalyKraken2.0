/**
 * Order Executor Service
 * Executes pending orders with rate limiting and API key failover
 */

import { db } from '../index.js';
import { KrakenService } from './krakenService.js';
import { orderQueueService } from './orderQueueService.js';
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
  private lastExecutionTime: number = 0;

  constructor(config: OrderQueueConfig = DEFAULT_ORDER_QUEUE_CONFIG) {
    this.config = config;
  }

  /**
   * Execute pending orders with rate limiting
   */
  async executePendingOrders(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    console.log('[OrderExecutor] Starting order execution cycle');

    let processed = 0;
    let successful = 0;
    let failed = 0;

    try {
      // Check concurrent execution limit
      if (this.executingOrders.size >= this.config.rateLimit.maxConcurrentOrders) {
        console.log(`[OrderExecutor] Max concurrent orders limit reached: ${this.executingOrders.size}`);
        return { processed, successful, failed };
      }

      // Get orders ready for execution
      const availableSlots = this.config.rateLimit.maxConcurrentOrders - this.executingOrders.size;
      const orders = await orderQueueService.getOrdersReadyForExecution(availableSlots);

      console.log(`[OrderExecutor] Found ${orders.length} orders ready for execution`);

      for (const order of orders) {
        // Check if already executing
        if (this.executingOrders.has(order.id)) {
          continue;
        }

        // Apply rate limiting
        await this.applyRateLimit();

        // Execute order
        this.executingOrders.add(order.id);
        processed++;

        try {
          const result = await this.executeOrder(order);

          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        } catch (error: any) {
          console.error(`[OrderExecutor] Error executing order ${order.id}:`, error.message);
          failed++;
        } finally {
          this.executingOrders.delete(order.id);
        }
      }

      console.log(`[OrderExecutor] Execution cycle complete: ${processed} processed, ${successful} successful, ${failed} failed`);
    } catch (error: any) {
      console.error('[OrderExecutor] Error in execution cycle:', error.message);
    }

    return { processed, successful, failed };
  }

  /**
   * Execute a single order with API key failover
   */
  private async executeOrder(order: PendingOrder): Promise<OrderExecutionResult> {
    console.log(`[OrderExecutor] Executing order ${order.id}: ${order.side} ${order.volume} ${order.pair}`);

    // Mark as processing
    await orderQueueService.markAsProcessing(order.id);

    // Get available API keys for this user
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
    try {
      // Decrypt API key if needed
      const decryptedApiKey = apiKey.encrypted ? decryptKey(apiKey.apiKey) : apiKey.apiKey;
      const decryptedApiSecret = apiKey.encrypted ? decryptKey(apiKey.apiSecret) : apiKey.apiSecret;

      // Create Kraken service with the API keys
      const krakenService = new KrakenService(decryptedApiKey, decryptedApiSecret);

      // Place order on Kraken
      const volume = parseFloat(order.volume);
      const orderType = order.type === 'market' ? 'market' : 'limit';
      const price = order.price ? parseFloat(order.price) : undefined;

      let response;
      if (order.side === 'buy') {
        response = await krakenService.placeBuyOrder(order.pair, volume, orderType as any, price);
      } else {
        response = await krakenService.placeSellOrder(order.pair, volume, orderType as any, price);
      }

      // KrakenService returns the result directly
      if (response && response.txid && response.txid.length > 0) {
        return {
          success: true,
          orderId: response.txid[0],
          shouldRetry: false,
        };
      }

      return {
        success: false,
        error: 'Unknown error: No transaction ID returned',
        shouldRetry: true,
      };
    } catch (error: any) {
      console.error('[OrderExecutor] Error placing order:', error.message);

      return {
        success: false,
        error: error.message,
        shouldRetry: this.isRetryableError(error.message),
      };
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: string): boolean {
    const nonRetryableErrors = [
      'Insufficient funds',
      'Invalid arguments',
      'Permission denied',
      'Invalid API key',
      'Invalid signature',
      'Invalid nonce',
      'Unknown asset pair',
    ];

    const errorLower = error.toLowerCase();

    for (const nonRetryable of nonRetryableErrors) {
      if (errorLower.includes(nonRetryable.toLowerCase())) {
        return false;
      }
    }

    // Errors like rate limit, timeout, service unavailable are retryable
    return true;
  }

  /**
   * Get available API keys for user (excluding failed ones)
   */
  private async getAvailableApiKeys(
    userId: string,
    failedKeyIds: string[]
  ): Promise<KrakenApiKey[]> {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.krakenKeys) {
      return [];
    }

    const allKeys = userData.krakenKeys as KrakenApiKey[];

    // Filter out inactive keys and failed keys
    return allKeys.filter((key) => {
      if (!key.isActive) return false;
      if (failedKeyIds.includes(key.id || key.name)) return false;
      return true;
    });
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
}

export const orderExecutorService = new OrderExecutorService();
