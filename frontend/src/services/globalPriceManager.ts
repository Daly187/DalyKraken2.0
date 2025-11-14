/**
 * Global Price Manager
 *
 * Singleton service that manages live cryptocurrency prices across the entire application.
 * Runs continuously in the background after login, providing real-time price updates
 * to all components without requiring page-specific WebSocket connections.
 */

import { livePriceService } from './livePriceService';
import type { LivePrice } from '@/types';

// Top 100 crypto pairs to track globally (all supported by Kraken)
const GLOBAL_CRYPTO_PAIRS = [
  // Top 20 - Mega caps
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD',
  'ADA/USD', 'AVAX/USD', 'DOT/USD', 'MATIC/USD', 'LINK/USD',
  'ATOM/USD', 'UNI/USD', 'LTC/USD', 'BCH/USD', 'NEAR/USD',
  'APT/USD', 'ARB/USD', 'OP/USD', 'IMX/USD', 'ALGO/USD',

  // 21-40 - Large caps
  'AAVE/USD', 'GRT/USD', 'FIL/USD', 'LDO/USD', 'MKR/USD',
  'SNX/USD', 'SAND/USD', 'MANA/USD', 'AXS/USD', 'FLOW/USD',
  'XTZ/USD', 'EOS/USD', 'DOGE/USD', 'TRX/USD', 'ETC/USD',
  'XLM/USD', 'FTM/USD', 'MINA/USD', 'APE/USD', 'ENJ/USD',

  // 41-60 - Mid caps
  'CRV/USD', 'SUSHI/USD', 'YFI/USD', 'COMP/USD', 'BAL/USD',
  '1INCH/USD', 'GALA/USD', 'BLUR/USD', 'ANKR/USD', 'BAT/USD',
  'BAND/USD', 'AUDIO/USD', 'API3/USD', 'INJ/USD', 'RUNE/USD',
  'GLMR/USD', 'KSM/USD', 'KAVA/USD', 'CHZ/USD', 'ROSE/USD',

  // 61-80 - Popular/Emerging
  'BONK/USD', 'PEPE/USD', 'WIF/USD', 'FLOKI/USD', 'JASMY/USD',
  'ZIL/USD', 'WAVES/USD', 'DASH/USD', 'ZEC/USD', 'IOTX/USD',
  'HBAR/USD', 'VET/USD', 'ONE/USD', 'CELO/USD', 'QTUM/USD',
  'ZRX/USD', 'BNT/USD', 'OMG/USD', 'SUI/USD', 'SEI/USD',

  // 81-100 - Additional Popular Assets
  'TIA/USD', 'PYTH/USD', 'JUP/USD', 'BERA/USD', 'BEAM/USD',
  'AR/USD', 'STORJ/USD', 'RENDER/USD', 'FET/USD', 'AGIX/USD',
  'RLC/USD', 'NMR/USD', 'CTSI/USD', 'AMP/USD', 'REQ/USD',
  'PHA/USD', 'ASTR/USD', 'ALICE/USD', 'ALCX/USD', 'PAXG/USD',

  // User Portfolio & DCA Bot Assets - Additional coverage
  'ICP/USD', 'ICX/USD', 'REP/USD', 'MLN/USD', 'USDT/USD', 'USDC/USD', 'DAI/USD',
  'RAY/USD', 'ORCA/USD', 'MNGO/USD', 'SRM/USD', // Solana ecosystem
  'MOVR/USD', 'SDN/USD', 'CFG/USD', 'KILT/USD', 'KINT/USD', // Polkadot ecosystem
  'KNC/USD', 'RPL/USD', 'PERP/USD', 'RARI/USD', 'LPT/USD', // DeFi
  'BADGER/USD', 'KEEP/USD', 'REN/USD', 'SPELL/USD', 'OXT/USD',
  'EWT/USD', 'OCEAN/USD', 'GHST/USD', 'GLM/USD', 'SC/USD',
  'AKT/USD', 'ANT/USD', 'AIR/USD', 'T/USD', 'TBTC/USD',
  'ETH2/USD', 'XRT/USD', 'LSK/USD',
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
