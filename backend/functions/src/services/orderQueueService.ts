/**
 * Order Queue Service
 * Manages the pending orders queue with retry logic and API key failover
 */

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
   * Create a new pending order
   */
  async createOrder(params: {
    userId: string;
    botId: string;
    pair: string;
    type: OrderType;
    side: 'buy' | 'sell';
    volume: string;
    price?: string;
  }): Promise<PendingOrder> {
    const orderId = db.collection('pendingOrders').doc().id;
    const now = new Date().toISOString();

    const order: PendingOrder = {
      id: orderId,
      userId: params.userId,
      botId: params.botId,
      pair: params.pair,
      type: params.type,
      side: params.side,
      volume: params.volume,
      price: params.price,
      status: OrderStatus.PENDING,
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      errors: [],
      failedApiKeys: [],
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('pendingOrders').doc(orderId).set(order);

    console.log(`[OrderQueue] Created order ${orderId} for ${params.side} ${params.volume} ${params.pair}`);

    return order;
  }

  /**
   * Get pending orders ready for execution
   */
  async getOrdersReadyForExecution(limit: number = 10): Promise<PendingOrder[]> {
    const now = new Date();

    const snapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', [OrderStatus.PENDING, OrderStatus.RETRY])
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    const orders: PendingOrder[] = [];

    snapshot.forEach((doc) => {
      const order = doc.data() as PendingOrder;

      // Check if order is ready for retry
      if (order.status === OrderStatus.RETRY && order.nextRetryAt) {
        const retryTime = new Date(order.nextRetryAt);
        if (retryTime > now) {
          return; // Not ready yet
        }
      }

      orders.push(order);
    });

    return orders;
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
    const errors = [
      ...order.errors,
      {
        timestamp: now,
        error,
        apiKeyUsed,
      },
    ];

    // Track failed API keys
    const failedApiKeys = apiKeyUsed && !order.failedApiKeys.includes(apiKeyUsed)
      ? [...order.failedApiKeys, apiKeyUsed]
      : order.failedApiKeys;

    // Check if we should retry
    if (shouldRetry && attempts < this.config.maxAttempts) {
      const retryDelay = this.calculateRetryDelay(attempts);
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000).toISOString();

      await db.collection('pendingOrders').doc(orderId).update({
        status: OrderStatus.RETRY,
        attempts,
        lastError: error,
        errors,
        failedApiKeys,
        apiKeyUsed,
        lastAttemptAt: now,
        nextRetryAt,
        updatedAt: now,
      });

      console.log(`[OrderQueue] Order ${orderId} will retry in ${retryDelay}s (attempt ${attempts}/${this.config.maxAttempts})`);
    } else {
      // Max attempts reached or should not retry
      await db.collection('pendingOrders').doc(orderId).update({
        status: OrderStatus.FAILED,
        attempts,
        lastError: error,
        errors,
        failedApiKeys,
        apiKeyUsed,
        lastAttemptAt: now,
        updatedAt: now,
      });

      console.error(`[OrderQueue] Order ${orderId} permanently failed after ${attempts} attempts: ${error}`);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.config.initialRetryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxRetryDelay);
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
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const orders: PendingOrder[] = [];
    snapshot.forEach((doc) => orders.push(doc.data() as PendingOrder));

    return orders;
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
