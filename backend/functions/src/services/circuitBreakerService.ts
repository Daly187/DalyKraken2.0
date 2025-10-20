/**
 * Circuit Breaker Service
 * Prevents cascading failures by tracking API key health
 */

import { CircuitState, CircuitBreakerState, OrderQueueConfig } from '../types/orderQueue.js';

export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreakerState> = new Map();
  private config: OrderQueueConfig['circuitBreaker'];

  constructor(config: OrderQueueConfig['circuitBreaker']) {
    this.config = config;
  }

  /**
   * Check if circuit is open for a key
   */
  isOpen(keyId: string): boolean {
    if (!this.config.enabled) return false;

    const breaker = this.breakers.get(keyId);
    if (!breaker) return false;

    if (breaker.state === CircuitState.OPEN) {
      // Check if we should transition to half-open
      const now = Date.now();
      const openedAt = new Date(breaker.openedAt!).getTime();
      const elapsed = (now - openedAt) / 1000;

      if (elapsed >= this.config.resetTimeout) {
        console.log(`[CircuitBreaker] Key ${keyId}: Transitioning to HALF_OPEN after ${elapsed}s`);
        this.transitionToHalfOpen(keyId);
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Record a successful execution
   */
  recordSuccess(keyId: string, executionId?: string): void {
    if (!this.config.enabled) return;

    const breaker = this.breakers.get(keyId);
    const now = new Date().toISOString();

    if (!breaker) {
      // Initialize breaker on first success
      this.breakers.set(keyId, {
        keyId,
        state: CircuitState.CLOSED,
        failures: 0,
        lastSuccessTime: now,
      });
      return;
    }

    // Reset failures on success
    breaker.failures = 0;
    breaker.lastSuccessTime = now;

    if (breaker.state === CircuitState.HALF_OPEN) {
      console.log(`[CircuitBreaker] Key ${keyId}: Success in HALF_OPEN, closing circuit (${executionId || 'no-trace'})`);
      breaker.state = CircuitState.CLOSED;
      breaker.openedAt = undefined;
    }

    this.breakers.set(keyId, breaker);
  }

  /**
   * Record a failure
   */
  recordFailure(keyId: string, error: string, executionId?: string): void {
    if (!this.config.enabled) return;

    const breaker = this.breakers.get(keyId) || {
      keyId,
      state: CircuitState.CLOSED,
      failures: 0,
    };

    const now = new Date().toISOString();
    breaker.lastFailureTime = now;

    // Only count failures within the window
    if (breaker.lastFailureTime) {
      const lastFailureMs = new Date(breaker.lastFailureTime).getTime();
      const windowMs = this.config.failureWindow * 1000;
      const elapsed = Date.now() - lastFailureMs;

      if (elapsed > windowMs) {
        // Outside window, reset count
        breaker.failures = 1;
      } else {
        breaker.failures++;
      }
    } else {
      breaker.failures = 1;
    }

    console.log(`[CircuitBreaker] Key ${keyId}: Failure recorded (${breaker.failures}/${this.config.failureThreshold}) - ${error.substring(0, 100)} (${executionId || 'no-trace'})`);

    // Check if we should open the circuit
    if (breaker.failures >= this.config.failureThreshold && breaker.state === CircuitState.CLOSED) {
      console.warn(`[CircuitBreaker] Key ${keyId}: OPENING circuit after ${breaker.failures} failures (${executionId || 'no-trace'})`);
      breaker.state = CircuitState.OPEN;
      breaker.openedAt = now;
    }

    // If in half-open and failure, reopen
    if (breaker.state === CircuitState.HALF_OPEN) {
      console.warn(`[CircuitBreaker] Key ${keyId}: Failure in HALF_OPEN, reopening circuit (${executionId || 'no-trace'})`);
      breaker.state = CircuitState.OPEN;
      breaker.openedAt = now;
    }

    this.breakers.set(keyId, breaker);
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(keyId: string): void {
    const breaker = this.breakers.get(keyId);
    if (breaker) {
      breaker.state = CircuitState.HALF_OPEN;
      breaker.failures = 0; // Reset failure count for testing
      this.breakers.set(keyId, breaker);
    }
  }

  /**
   * Get breaker state for monitoring
   */
  getState(keyId: string): CircuitBreakerState | null {
    return this.breakers.get(keyId) || null;
  }

  /**
   * Get all breaker states
   */
  getAllStates(): CircuitBreakerState[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Manually reset a circuit (admin operation)
   */
  reset(keyId: string): void {
    const breaker = this.breakers.get(keyId);
    if (breaker) {
      console.log(`[CircuitBreaker] Key ${keyId}: Manual reset`);
      breaker.state = CircuitState.CLOSED;
      breaker.failures = 0;
      breaker.openedAt = undefined;
      this.breakers.set(keyId, breaker);
    }
  }

  /**
   * Clear all breakers (testing/debugging)
   */
  clearAll(): void {
    console.log('[CircuitBreaker] Clearing all circuit breakers');
    this.breakers.clear();
  }
}
