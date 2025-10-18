/**
 * Global Price Manager
 *
 * Singleton service that manages live cryptocurrency prices across the entire application.
 * Runs continuously in the background after login, providing real-time price updates
 * to all components without requiring page-specific WebSocket connections.
 */

import { livePriceService } from './livePriceService';
import type { LivePrice } from '@/types';

// All major crypto pairs to track (only pairs supported by Kraken)
const GLOBAL_CRYPTO_PAIRS = [
  // Major cryptocurrencies
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD',
  'DOGE/USD', 'DOT/USD', 'AVAX/USD', 'LINK/USD',

  // DeFi & Layer 1/2
  'UNI/USD', 'ATOM/USD', 'LTC/USD', 'BCH/USD', 'ETC/USD',
  'AAVE/USD', 'COMP/USD', 'SNX/USD', 'CRV/USD',

  // Additional popular tokens
  'SUSHI/USD', 'YFI/USD', 'ALGO/USD', 'XLM/USD', 'XTZ/USD',
  'MANA/USD', 'SAND/USD', 'GRT/USD', 'FIL/USD', 'NEAR/USD',
  'OP/USD', 'ARB/USD', 'LDO/USD', 'APE/USD', 'IMX/USD',
];

type PriceUpdateCallback = (prices: Map<string, LivePrice>) => void;

class GlobalPriceManager {
  private static instance: GlobalPriceManager;
  private isInitialized = false;
  private priceUpdateCallbacks: Set<PriceUpdateCallback> = new Set();
  private currentPrices: Map<string, LivePrice> = new Map();
  private unsubscribe: (() => void) | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): GlobalPriceManager {
    if (!GlobalPriceManager.instance) {
      GlobalPriceManager.instance = new GlobalPriceManager();
    }
    return GlobalPriceManager.instance;
  }

  /**
   * Initialize the global price manager
   * Should be called once after user login
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[GlobalPriceManager] Already initialized');
      return;
    }

    console.log('[GlobalPriceManager] Initializing with', GLOBAL_CRYPTO_PAIRS.length, 'pairs');

    // Subscribe to live price updates from the service
    this.unsubscribe = livePriceService.subscribe((prices) => {
      this.currentPrices = new Map(prices);
      this.notifySubscribers(prices);
    });

    // Load cached prices first
    livePriceService.loadCachedPrices();

    // Connect to Kraken WebSocket for all major pairs
    livePriceService.connectKraken(GLOBAL_CRYPTO_PAIRS);

    this.isInitialized = true;
    console.log('[GlobalPriceManager] Initialized successfully');
  }

  /**
   * Cleanup and disconnect
   * Should be called on user logout
   */
  cleanup(): void {
    if (!this.isInitialized) {
      return;
    }

    console.log('[GlobalPriceManager] Cleaning up');

    // Unsubscribe from price updates
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Disconnect from WebSocket
    livePriceService.disconnectKraken();

    // Clear callbacks and prices
    this.priceUpdateCallbacks.clear();
    this.currentPrices.clear();

    this.isInitialized = false;
    console.log('[GlobalPriceManager] Cleanup complete');
  }

  /**
   * Subscribe to price updates
   * Returns an unsubscribe function
   */
  subscribeToPrices(callback: PriceUpdateCallback): () => void {
    this.priceUpdateCallbacks.add(callback);

    // Immediately call with current prices if available
    if (this.currentPrices.size > 0) {
      callback(new Map(this.currentPrices));
    }

    return () => {
      this.priceUpdateCallbacks.delete(callback);
    };
  }

  /**
   * Get current prices
   */
  getCurrentPrices(): Map<string, LivePrice> {
    return new Map(this.currentPrices);
  }

  /**
   * Get price for a specific symbol
   */
  getPrice(symbol: string): LivePrice | undefined {
    return this.currentPrices.get(symbol);
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Notify all subscribers of price updates
   */
  private notifySubscribers(prices: Map<string, LivePrice>): void {
    this.priceUpdateCallbacks.forEach(callback => {
      try {
        callback(new Map(prices));
      } catch (error) {
        console.error('[GlobalPriceManager] Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Add additional symbols to track
   * Useful for tracking user's portfolio assets
   */
  addSymbols(symbols: string[]): void {
    if (!this.isInitialized) {
      console.warn('[GlobalPriceManager] Not initialized, cannot add symbols');
      return;
    }

    const newSymbols = symbols.filter(s => !GLOBAL_CRYPTO_PAIRS.includes(s));

    if (newSymbols.length > 0) {
      console.log('[GlobalPriceManager] Adding additional symbols:', newSymbols);
      livePriceService.connectKraken([...GLOBAL_CRYPTO_PAIRS, ...newSymbols]);
    }
  }
}

// Export singleton instance
export const globalPriceManager = GlobalPriceManager.getInstance();
