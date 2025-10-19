/**
 * Order Queue Types
 * Defines the structure for the pending orders queue system
 */

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
}

export interface PendingOrder {
  id: string;
  userId: string;
  botId: string;

  // Order details
  pair: string;
  type: OrderType;
  side: 'buy' | 'sell';
  volume: string;
  price?: string; // For limit orders

  // Status tracking
  status: OrderStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;

  // Error tracking
  lastError?: string;
  errors: Array<{
    timestamp: string;
    error: string;
    apiKeyUsed?: string;
  }>;

  // API key tracking
  apiKeyUsed?: string;
  failedApiKeys: string[]; // List of API key IDs that have failed

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // Result
  krakenOrderId?: string;
  executedPrice?: string;
  executedVolume?: string;
}

export interface OrderExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  shouldRetry: boolean;
  retryAfter?: number; // seconds
}

export interface OrderQueueConfig {
  maxAttempts: number;
  initialRetryDelay: number; // seconds
  maxRetryDelay: number; // seconds
  retryBackoffMultiplier: number;
  rateLimit: {
    maxOrdersPerSecond: number;
    maxConcurrentOrders: number;
  };
}

export const DEFAULT_ORDER_QUEUE_CONFIG: OrderQueueConfig = {
  maxAttempts: 5,
  initialRetryDelay: 10, // 10 seconds
  maxRetryDelay: 3600, // 1 hour
  retryBackoffMultiplier: 2,
  rateLimit: {
    maxOrdersPerSecond: 2,
    maxConcurrentOrders: 5,
  },
};
