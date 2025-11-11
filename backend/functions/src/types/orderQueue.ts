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
  volume: string; // Crypto amount
  amount?: number; // USD amount
  price?: string; // Expected market price or limit price

  // Idempotency & tracing
  clientOrderId: string; // Unique deterministic ID for deduplication
  executionId?: string; // Trace ID for debugging entire flow
  userref?: number; // Kraken's user reference field (32-bit int)

  // Status tracking
  status: OrderStatus;
  reason?: string; // Reason why order is pending/not executed
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
    executionId?: string;
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

  // Entry Log fields - Track why entry was created/blocked
  entryConditionsMet?: boolean; // Did the entry meet all requirements?
  entryChecks?: {
    trendAlignment?: { met: boolean; score?: number; reason?: string };
    priceCondition?: { met: boolean; currentPrice?: number; targetPrice?: number; reason?: string };
    balanceCheck?: { met: boolean; available?: number; required?: number; reason?: string };
    delayCheck?: { met: boolean; lastEntry?: string; delay?: number; reason?: string };
    reEntryLimit?: { met: boolean; currentCount?: number; maxCount?: number; reason?: string };
  };
  blockedReason?: string; // If entry was blocked, why?
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
    maxConcurrentPerApiKey: number; // Limit per API key
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number; // Failures before opening circuit
    resetTimeout: number; // Seconds before trying half-open
    failureWindow: number; // Window to count failures (seconds)
  };
  stuckOrderTimeout: number; // Seconds before resetting stuck PROCESSING orders
}

export const DEFAULT_ORDER_QUEUE_CONFIG: OrderQueueConfig = {
  maxAttempts: 5,
  initialRetryDelay: 10, // 10 seconds
  maxRetryDelay: 3600, // 1 hour
  retryBackoffMultiplier: 2,
  rateLimit: {
    maxOrdersPerSecond: 2,
    maxConcurrentOrders: 5,
    maxConcurrentPerApiKey: 2, // Max 2 concurrent orders per API key
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 3, // Open circuit after 3 failures
    resetTimeout: 300, // Try again after 5 minutes
    failureWindow: 300, // Count failures in 5-minute window
  },
  stuckOrderTimeout: 120, // Reset orders stuck in PROCESSING for >2 minutes
};

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',   // Normal operation
  OPEN = 'open',       // Circuit open, reject requests
  HALF_OPEN = 'half_open', // Testing if service recovered
}

export interface CircuitBreakerState {
  keyId: string;
  state: CircuitState;
  failures: number;
  lastFailureTime?: string;
  openedAt?: string;
  lastSuccessTime?: string;
}
