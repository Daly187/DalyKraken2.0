/**
 * Order Queue Service
 * Manages the pending orders queue with retry logic and API key failover
 */

import crypto from 'crypto';
import { db } from '../db.js';
import {
  PendingOrder,
  OrderStatus,
  OrderType,
  OrderExecutionResult,
  OrderQueueConfig,
  DEFAULT_ORDER_QUEUE_CONFIG,
} from '../types/orderQueue.js';

export class OrderQueueService {
  private config: OrderQueueConfig;

  constructor(config: OrderQueueConfig = DEFAULT_ORDER_QUEUE_CONFIG) {
    this.config = config;
  }

  /**
   * Generate a deterministic clientOrderId for idempotency
   */
  private generateClientOrderId(params: {
    userId: string;
    botId: string;
    pair: string;
    side: 'buy' | 'sell';
    volume: string;
    timestamp: string;
  }): string {
    const data = `${params.userId}|${params.botId}|${params.pair}|${params.side}|${params.volume}|${params.timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Generate a userref (32-bit signed int) from clientOrderId for Kraken
   * Kraken requires userref to be a 32-bit SIGNED integer (max: 2147483647)
   */
  private generateUserref(clientOrderId: string): number {
    // Convert first 8 hex chars to a 32-bit int
    const hex = clientOrderId.substring(0, 8);
    const unsigned = parseInt(hex, 16) >>> 0; // Unsigned 32-bit

    // Convert to signed 32-bit by using bitwise OR with 0
    // This ensures the value fits within Kraken's signed 32-bit integer range
    const signed = unsigned | 0;

    // If negative, convert to positive by taking absolute value and reducing to fit
    // This ensures we always have a positive number within the signed 32-bit range
    return Math.abs(signed) % 2147483647;
  }

  /**
   * Generate an executionId for tracing
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create a new pending order
   */
  async createOrder(params: {
    userId: string;
    botId: string;
    pair: string;
    type: OrderType;
    side: 'buy' | 'sell';
    volume: string;
    amount?: number;
    price?: string;
    reason?: string;
    entryConditionsMet?: boolean;
    entryChecks?: any;
    blockedReason?: string;
    status?: OrderStatus; // Allow setting initial status (for blocked entries)
  }): Promise<PendingOrder> {
    const now = new Date().toISOString();

    // For blocked entries (entryConditionsMet = false), skip duplicate checks
    // We want to log every blocked attempt for audit purposes
    const isBlockedEntry = params.entryConditionsMet === false;

    if (!isBlockedEntry) {
      // CRITICAL: First check if bot already has ANY active order (prevents duplicates)
      // Only check PENDING, PROCESSING, and RETRY status
      // FAILED orders should NOT block new orders - they serve as audit log only
      const existingBotOrders = await db
        .collection('pendingOrders')
        .where('botId', '==', params.botId)
        .where('status', 'in', [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.RETRY])
        .limit(1)
        .get();

      if (!existingBotOrders.empty) {
        const existingOrder = existingBotOrders.docs[0].data() as PendingOrder;
        console.log(`[OrderQueue] Bot ${params.botId} already has a ${existingOrder.side} order in status '${existingOrder.status}' (${existingOrder.id}). Skipping duplicate.`);
        return existingOrder;
      }

      // Generate clientOrderId for idempotency
      const clientOrderId = this.generateClientOrderId({
        userId: params.userId,
        botId: params.botId,
        pair: params.pair,
        side: params.side,
        volume: params.volume,
        timestamp: now,
      });

      // Check for duplicate orders by clientOrderId (secondary check)
      const duplicateCheck = await db
        .collection('pendingOrders')
        .where('clientOrderId', '==', clientOrderId)
        .where('status', 'in', [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.RETRY, OrderStatus.COMPLETED])
        .limit(1)
        .get();

      if (!duplicateCheck.empty) {
        const existingOrder = duplicateCheck.docs[0].data() as PendingOrder;
        console.log(`[OrderQueue] Duplicate order detected: ${clientOrderId} (existing: ${existingOrder.id}, status: ${existingOrder.status})`);
        return existingOrder;
      }
    }

    const orderId = db.collection('pendingOrders').doc().id;
    const executionId = this.generateExecutionId();
    const clientOrderId = this.generateClientOrderId({
      userId: params.userId,
      botId: params.botId,
      pair: params.pair,
      side: params.side,
      volume: params.volume,
      timestamp: now,
    });
    const userref = this.generateUserref(clientOrderId);

    const order: PendingOrder = {
      id: orderId,
      userId: params.userId,
      botId: params.botId,
      pair: params.pair,
      type: params.type,
      side: params.side,
      volume: params.volume,
      clientOrderId,
      executionId,
      userref,
      ...(params.amount !== undefined && { amount: params.amount }), // Include amount if defined
      ...(params.price && { price: params.price }), // Only include price if defined
      ...(params.reason && { reason: params.reason }), // Include reason if defined
      ...(params.entryConditionsMet !== undefined && { entryConditionsMet: params.entryConditionsMet }),
      ...(params.entryChecks && { entryChecks: params.entryChecks }),
      ...(params.blockedReason && { blockedReason: params.blockedReason }),
      status: params.status || OrderStatus.PENDING,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      errors: [],
      failedApiKeys: [],
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('pendingOrders').doc(orderId).set(order);

    const logType = isBlockedEntry ? 'BLOCKED' : 'PENDING';
    console.log(`[OrderQueue] [${executionId}] Created ${logType} order ${orderId} (client: ${clientOrderId}, userref: ${userref}) for ${params.side} ${params.volume} ${params.pair} (amount: $${params.amount || 0})`);

    return order;
  }

  /**
   * Get pending orders ready for execution
   */
  async getOrdersReadyForExecution(limit: number = 10): Promise<PendingOrder[]> {
    const now = new Date();

    // Query without orderBy to avoid composite index requirement
    const snapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', [OrderStatus.PENDING, OrderStatus.RETRY])
      .limit(100) // Get more than needed, will filter and sort in memory
      .get();

    const orders: PendingOrder[] = [];

    snapshot.forEach((doc) => {
      const order = doc.data() as PendingOrder;

      // CRITICAL FIX: Ensure document ID is set on the order object
      order.id = doc.id;

      // Check if order is ready for retry
      if (order.status === OrderStatus.RETRY && order.nextRetryAt) {
        try {
          const retryTime = new Date(order.nextRetryAt);
          // Validate the date is valid
          if (isNaN(retryTime.getTime())) {
            console.warn(`[OrderQueue] Order ${order.id} has invalid nextRetryAt: ${order.nextRetryAt}, allowing execution`);
          } else if (retryTime > now) {
            return; // Not ready yet
          }
        } catch (error: any) {
          console.warn(`[OrderQueue] Error parsing nextRetryAt for order ${order.id}: ${error.message}, allowing execution`);
        }
      }

      orders.push(order);
    });

    // Sort by createdAt in memory (oldest first) and limit
    return orders
      .sort((a, b) => {
        try {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          // Handle invalid dates by pushing them to the end
          if (isNaN(timeA)) return 1;
          if (isNaN(timeB)) return -1;
          return timeA - timeB;
        } catch (error) {
          return 0; // Keep original order if comparison fails
        }
      })
      .slice(0, limit);
  }

  /**
   * Mark order as processing
   */
  async markAsProcessing(orderId: string): Promise<void> {
    await db.collection('pendingOrders').doc(orderId).update({
      status: OrderStatus.PROCESSING,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Mark order as completed
   */
  async markAsCompleted(
    orderId: string,
    result: {
      krakenOrderId: string;
      executedPrice?: string;
      executedVolume?: string;
    }
  ): Promise<void> {
    const now = new Date().toISOString();

    await db.collection('pendingOrders').doc(orderId).update({
      status: OrderStatus.COMPLETED,
      krakenOrderId: result.krakenOrderId,
      executedPrice: result.executedPrice,
      executedVolume: result.executedVolume,
      completedAt: now,
      updatedAt: now,
    });

    console.log(`[OrderQueue] Order ${orderId} completed with Kraken order ID: ${result.krakenOrderId}`);
  }

  /**
   * Mark order as failed or retry
   */
  async markAsFailed(
    orderId: string,
    error: string,
    apiKeyUsed?: string,
    shouldRetry: boolean = true
  ): Promise<void> {
    const orderDoc = await db.collection('pendingOrders').doc(orderId).get();
    const order = orderDoc.data() as PendingOrder;

    if (!order) {
      console.error(`[OrderQueue] Order ${orderId} not found`);
      return;
    }

    const now = new Date().toISOString();
    const attempts = order.attempts + 1;

    // Add error to history
    const errorEntry: any = {
      timestamp: now,
      error,
    };

    // Only add apiKeyUsed if it's defined (Firestore doesn't allow undefined values)
    if (apiKeyUsed !== undefined) {
      errorEntry.apiKeyUsed = apiKeyUsed;
    }

    const errors = [
      ...order.errors,
      errorEntry,
    ];

    // Track failed API keys
    const failedApiKeys = apiKeyUsed && !order.failedApiKeys.includes(apiKeyUsed)
      ? [...order.failedApiKeys, apiKeyUsed]
      : order.failedApiKeys;

    // Check if we should retry
    if (shouldRetry && attempts < this.config.maxAttempts) {
      const retryDelay = this.calculateRetryDelay(attempts);
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000).toISOString();

      const updateData: any = {
        status: OrderStatus.RETRY,
        attempts,
        lastError: error,
        errors,
        failedApiKeys,
        lastAttemptAt: now,
        nextRetryAt,
        updatedAt: now,
      };

      // Only add apiKeyUsed if it's defined
      if (apiKeyUsed !== undefined) {
        updateData.apiKeyUsed = apiKeyUsed;
      }

      await db.collection('pendingOrders').doc(orderId).update(updateData);

      console.log(`[OrderQueue] Order ${orderId} will retry in ${retryDelay}s (attempt ${attempts}/${this.config.maxAttempts})`);
    } else {
      // Max attempts reached or should not retry
      const updateData: any = {
        status: OrderStatus.FAILED,
        attempts,
        lastError: error,
        errors,
        failedApiKeys,
        lastAttemptAt: now,
        updatedAt: now,
      };

      // Only add apiKeyUsed if it's defined
      if (apiKeyUsed !== undefined) {
        updateData.apiKeyUsed = apiKeyUsed;
      }

      await db.collection('pendingOrders').doc(orderId).update(updateData);

      console.error(`[OrderQueue] Order ${orderId} permanently failed after ${attempts} attempts: ${error}`);
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.initialRetryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(baseDelay, this.config.maxRetryDelay);

    // Add ±20% jitter to prevent thundering herd
    const jitter = cappedDelay * 0.2 * (Math.random() - 0.5) * 2;
    const delayWithJitter = Math.max(1, cappedDelay + jitter);

    return Math.floor(delayWithJitter);
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<PendingOrder | null> {
    const doc = await db.collection('pendingOrders').doc(orderId).get();
    return doc.exists ? (doc.data() as PendingOrder) : null;
  }

  /**
   * Get orders by bot ID
   */
  async getOrdersByBot(botId: string): Promise<PendingOrder[]> {
    const snapshot = await db
      .collection('pendingOrders')
      .where('botId', '==', botId)
      .orderBy('createdAt', 'desc')
      .get();

    const orders: PendingOrder[] = [];
    snapshot.forEach((doc) => orders.push(doc.data() as PendingOrder));

    return orders;
  }

  /**
   * Get orders by user ID
   */
  async getOrdersByUser(userId: string): Promise<PendingOrder[]> {
    const snapshot = await db
      .collection('pendingOrders')
      .where('userId', '==', userId)
      .limit(100)
      .get();

    const orders: PendingOrder[] = [];
    snapshot.forEach((doc) => orders.push(doc.data() as PendingOrder));

    // Sort in memory instead of Firestore to avoid needing composite index
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get pending orders count for monitoring
   */
  async getPendingOrdersCount(): Promise<{
    pending: number;
    processing: number;
    retry: number;
    total: number;
  }> {
    const pendingSnapshot = await db
      .collection('pendingOrders')
      .where('status', '==', OrderStatus.PENDING)
      .count()
      .get();

    const processingSnapshot = await db
      .collection('pendingOrders')
      .where('status', '==', OrderStatus.PROCESSING)
      .count()
      .get();

    const retrySnapshot = await db
      .collection('pendingOrders')
      .where('status', '==', OrderStatus.RETRY)
      .count()
      .get();

    const pending = pendingSnapshot.data().count;
    const processing = processingSnapshot.data().count;
    const retry = retrySnapshot.data().count;

    return {
      pending,
      processing,
      retry,
      total: pending + processing + retry,
    };
  }

  /**
   * Execute a pending order
   * Follows the same pattern as manual trades with market orders
   */
  async executeOrder(
    order: PendingOrder,
    krakenService: any
  ): Promise<OrderExecutionResult> {
    try {
      console.log(`[OrderQueue] Executing order ${order.id}: ${order.side} ${order.volume} ${order.pair}`);

      // Mark as processing
      await this.markAsProcessing(order.id);

      let orderResult;

      // Execute market order (following manual trade pattern)
      if (order.side === 'buy') {
        orderResult = await krakenService.placeBuyOrder(
          order.pair,
          parseFloat(order.volume),
          'market' // Always use market orders
        );
      } else {
        orderResult = await krakenService.placeSellOrder(
          order.pair,
          parseFloat(order.volume),
          'market'
        );
      }

      // Get the executed price from the order result
      let executedPrice = order.price; // Fallback to estimated price
      if (orderResult && orderResult.descr && orderResult.descr.price) {
        executedPrice = orderResult.descr.price;
      }

      // Mark as completed
      await this.markAsCompleted(order.id, {
        krakenOrderId: orderResult.txid[0] || 'unknown',
        executedPrice: executedPrice,
        executedVolume: order.volume,
      });

      console.log(`[OrderQueue] Order ${order.id} executed successfully: ${orderResult.txid[0]}`);

      return {
        success: true,
        orderId: orderResult.txid[0],
        shouldRetry: false,
      };
    } catch (error: any) {
      console.error(`[OrderQueue] Error executing order ${order.id}:`, error.message);

      // Determine if error is retryable
      const isRetryable = this.isRetryableError(error.message);

      await this.markAsFailed(order.id, error.message, undefined, isRetryable);

      return {
        success: false,
        error: error.message,
        shouldRetry: isRetryable,
        retryAfter: isRetryable ? this.calculateRetryDelay(order.attempts + 1) : undefined,
      };
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(errorMessage: string): boolean {
    const nonRetryableErrors = [
      'Insufficient funds',
      'Invalid pair',
      'Invalid volume',
      'Permission denied',
      'Invalid API key',
    ];

    return !nonRetryableErrors.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Reset ALL PROCESSING orders back to RETRY immediately
   * Used when user manually clicks "Execute Now" to retry all stuck orders
   */
  async resetAllProcessingOrders(): Promise<number> {
    const snapshot = await db
      .collection('pendingOrders')
      .where('status', '==', OrderStatus.PROCESSING)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    const now = new Date().toISOString();

    snapshot.forEach((doc) => {
      const order = doc.data() as PendingOrder;
      const retryDelay = this.calculateRetryDelay(order.attempts + 1);
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000).toISOString();

      console.log(`[OrderQueue] Force-resetting order ${order.id} from PROCESSING to RETRY`);

      batch.update(doc.ref, {
        status: OrderStatus.RETRY,
        nextRetryAt,
        updatedAt: now,
        lastError: 'Manually reset via Execute Now button',
        errors: [
          ...order.errors,
          {
            timestamp: now,
            error: 'Force-reset from PROCESSING to RETRY (manual execution)',
          },
        ],
      });
    });

    await batch.commit();

    console.log(`[OrderQueue] Force-reset ${snapshot.size} PROCESSING orders to RETRY`);
    return snapshot.size;
  }

  /**
   * Reset stuck PROCESSING orders back to RETRY
   * Orders stuck in PROCESSING for longer than stuckOrderTimeout
   */
  async resetStuckOrders(): Promise<number> {
    const cutoffTime = new Date(Date.now() - this.config.stuckOrderTimeout * 1000).toISOString();

    // Query without compound index - filter in memory to avoid index requirement
    const snapshot = await db
      .collection('pendingOrders')
      .where('status', '==', OrderStatus.PROCESSING)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    // Filter stuck orders in memory
    const stuckOrders = snapshot.docs.filter((doc) => {
      const order = doc.data() as PendingOrder;
      return order.updatedAt < cutoffTime;
    });

    if (stuckOrders.length === 0) {
      return 0;
    }

    const batch = db.batch();
    const now = new Date().toISOString();

    stuckOrders.forEach((doc) => {
      const order = doc.data() as PendingOrder;

      // CRITICAL FIX: Skip orders with invalid/missing IDs (corrupted data)
      if (!order.id || typeof order.id !== 'string') {
        console.warn(`[OrderQueue] Skipping corrupted stuck order with invalid ID (docId: ${doc.id}, stuck since: ${order.updatedAt}). Deleting from database.`);
        batch.delete(doc.ref); // Clean up corrupted order
        return;
      }

      // CRITICAL FIX: Ensure attempts is a valid number, default to 0 if undefined/null
      const attempts = typeof order.attempts === 'number' && !isNaN(order.attempts) ? order.attempts : 0;
      const retryDelay = this.calculateRetryDelay(attempts + 1);
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000).toISOString();

      console.log(`[OrderQueue] Resetting stuck order ${order.id} (stuck since ${order.updatedAt}, attempts: ${attempts})`);

      batch.update(doc.ref, {
        status: OrderStatus.RETRY,
        nextRetryAt,
        updatedAt: now,
        lastError: 'Order was stuck in PROCESSING state and was automatically reset',
        errors: [
          ...order.errors,
          {
            timestamp: now,
            error: 'Stuck in PROCESSING, auto-reset to RETRY',
          },
        ],
      });
    });

    await batch.commit();

    console.log(`[OrderQueue] Reset ${stuckOrders.length} stuck orders`);
    return stuckOrders.length;
  }

  /**
   * Clear failedApiKeys from all pending/retry orders
   * This allows orders to retry with all available API keys after fixes
   */
  async clearAllFailedApiKeys(): Promise<number> {
    const snapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', [OrderStatus.PENDING, OrderStatus.RETRY])
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    const now = new Date().toISOString();
    let count = 0;

    snapshot.forEach((doc) => {
      const order = doc.data() as PendingOrder;

      // Only update if there are failed keys
      if (order.failedApiKeys && order.failedApiKeys.length > 0) {
        console.log(`[OrderQueue] Clearing ${order.failedApiKeys.length} failed API keys from order ${order.id}`);

        batch.update(doc.ref, {
          failedApiKeys: [],
          updatedAt: now,
          lastError: 'Cleared failed API keys - ready to retry',
          'errors': [...(order.errors || []), {
            timestamp: now,
            error: 'Cleared failed API keys for manual retry',
          }],
        });

        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[OrderQueue] Cleared failed API keys from ${count} orders`);
    }

    return count;
  }

  /**
   * Clean up old completed/failed orders
   */
  async cleanupOldOrders(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const snapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', [OrderStatus.COMPLETED, OrderStatus.FAILED])
      .where('updatedAt', '<', cutoffDate.toISOString())
      .get();

    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`[OrderQueue] Cleaned up ${snapshot.size} old orders`);
    return snapshot.size;
  }
}

export const orderQueueService = new OrderQueueService();
