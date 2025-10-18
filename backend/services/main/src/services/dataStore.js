import { logger } from '../utils/logger.js';

/**
 * In-memory data store for caching
 * Provides a simple key-value store with TTL support
 */
class DataStore {
  constructor() {
    this.store = new Map();
    this.timestamps = new Map();
    this.ttls = new Map();

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Set a value in the store with optional TTL
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    this.store.set(key, value);
    this.timestamps.set(key, Date.now());

    if (ttl) {
      this.ttls.set(key, ttl);
    }

    logger.debug(`DataStore: Set ${key}${ttl ? ` with TTL ${ttl}ms` : ''}`);
  }

  /**
   * Get a value from the store
   * @param {string} key - Storage key
   * @returns {any} Stored value or null if not found/expired
   */
  get(key) {
    if (!this.store.has(key)) {
      return null;
    }

    // Check if expired
    if (this.isExpired(key)) {
      this.delete(key);
      logger.debug(`DataStore: ${key} expired`);
      return null;
    }

    const value = this.store.get(key);
    logger.debug(`DataStore: Retrieved ${key}`);

    return {
      data: value,
      timestamp: this.timestamps.get(key),
    };
  }

  /**
   * Check if a key exists and is not expired
   * @param {string} key - Storage key
   * @returns {boolean}
   */
  has(key) {
    if (!this.store.has(key)) {
      return false;
    }

    if (this.isExpired(key)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a value from the store
   * @param {string} key - Storage key
   */
  delete(key) {
    this.store.delete(key);
    this.timestamps.delete(key);
    this.ttls.delete(key);
    logger.debug(`DataStore: Deleted ${key}`);
  }

  /**
   * Clear all data from the store
   */
  clear() {
    const count = this.store.size;
    this.store.clear();
    this.timestamps.clear();
    this.ttls.clear();
    logger.info(`DataStore: Cleared ${count} items`);
  }

  /**
   * Get all keys in the store
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.store.keys()).filter(key => !this.isExpired(key));
  }

  /**
   * Get the number of items in the store
   * @returns {number}
   */
  size() {
    // Clean expired items first
    this.cleanup();
    return this.store.size;
  }

  /**
   * Check if a key is expired
   * @param {string} key - Storage key
   * @returns {boolean}
   */
  isExpired(key) {
    if (!this.ttls.has(key)) {
      return false; // No TTL set
    }

    const timestamp = this.timestamps.get(key);
    const ttl = this.ttls.get(key);
    return Date.now() - timestamp > ttl;
  }

  /**
   * Get all data as an object (for debugging)
   * @returns {Object}
   */
  getAll() {
    const result = {};
    for (const key of this.keys()) {
      const item = this.get(key);
      if (item) {
        result[key] = item;
      }
    }
    return result;
  }

  /**
   * Get statistics about the store
   * @returns {Object}
   */
  getStats() {
    return {
      totalItems: this.store.size,
      activeItems: this.keys().length,
      keysWithTTL: this.ttls.size,
      oldestTimestamp: Math.min(...Array.from(this.timestamps.values())),
      newestTimestamp: Math.max(...Array.from(this.timestamps.values())),
    };
  }

  /**
   * Clean up expired items
   */
  cleanup() {
    const expiredKeys = [];

    for (const key of this.store.keys()) {
      if (this.isExpired(key)) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => this.delete(key));
      logger.debug(`DataStore: Cleaned up ${expiredKeys.length} expired items`);
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('DataStore: Periodic cleanup started');
  }

  /**
   * Get or set a value (lazy loading pattern)
   * @param {string} key - Storage key
   * @param {Function} factory - Function to generate value if not found
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {Promise<any>}
   */
  async getOrSet(key, factory, ttl = null) {
    const existing = this.get(key);
    if (existing) {
      return existing.data;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment a numeric value
   * @param {string} key - Storage key
   * @param {number} amount - Amount to increment by (default 1)
   * @returns {number} New value
   */
  increment(key, amount = 1) {
    const current = this.get(key);
    const currentValue = current ? current.data : 0;
    const newValue = currentValue + amount;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement a numeric value
   * @param {string} key - Storage key
   * @param {number} amount - Amount to decrement by (default 1)
   * @returns {number} New value
   */
  decrement(key, amount = 1) {
    return this.increment(key, -amount);
  }

  /**
   * Push a value to an array
   * @param {string} key - Storage key
   * @param {any} value - Value to push
   * @param {number} maxLength - Maximum array length (optional)
   */
  push(key, value, maxLength = null) {
    const current = this.get(key);
    const array = current ? current.data : [];

    if (!Array.isArray(array)) {
      throw new Error(`Key ${key} is not an array`);
    }

    array.push(value);

    // Trim to max length if specified
    if (maxLength && array.length > maxLength) {
      array.splice(0, array.length - maxLength);
    }

    this.set(key, array);
    return array;
  }

  /**
   * Update an object value
   * @param {string} key - Storage key
   * @param {Object} updates - Updates to merge
   */
  update(key, updates) {
    const current = this.get(key);
    const currentValue = current ? current.data : {};

    if (typeof currentValue !== 'object' || Array.isArray(currentValue)) {
      throw new Error(`Key ${key} is not an object`);
    }

    const newValue = { ...currentValue, ...updates };
    this.set(key, newValue);
    return newValue;
  }
}

// Export singleton instance
export const dataStore = new DataStore();

// Export class for testing
export { DataStore };
