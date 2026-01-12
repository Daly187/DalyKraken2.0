/**
 * Global Price Manager
 *
 * Singleton service that manages live cryptocurrency prices across the entire application.
 * Runs continuously in the background after login, providing real-time price updates
 * to all components without requiring page-specific WebSocket connections.
 */

import { livePriceService } from './livePriceService';
import type { LivePrice } from '@/types';

// All Kraken-supported crypto pairs from our top 200 asset mappings
// This ensures the Crypto Market page can show live data for all available assets
const GLOBAL_CRYPTO_PAIRS = [
  // Top 30 - Mega/Large caps
  'BTC/USD', 'ETH/USD', 'USDT/USD', 'XRP/USD', 'BNB/USD',
  'SOL/USD', 'USDC/USD', 'DOGE/USD', 'TON/USD', 'ADA/USD',
  'TRX/USD', 'AVAX/USD', 'SHIB/USD', 'WBTC/USD', 'DOT/USD',
  'LINK/USD', 'BCH/USD', 'POL/USD', 'LTC/USD', 'DAI/USD',
  'UNI/USD', 'NEAR/USD', 'ICP/USD', 'KAS/USD', 'ETC/USD',
  'XLM/USD', 'ATOM/USD', 'XMR/USD', 'FIL/USD',

  // 31-60 - Large caps
  'LDO/USD', 'APT/USD', 'HBAR/USD', 'ARB/USD', 'VET/USD',
  'IMX/USD', 'CRO/USD', 'RNDR/USD', 'INJ/USD', 'OP/USD',
  'MNT/USD', 'GRT/USD', 'QNT/USD', 'AAVE/USD', 'FTM/USD',
  'SUI/USD', 'MKR/USD', 'THETA/USD', 'ALGO/USD', 'TIA/USD',
  'XTZ/USD', 'EOS/USD', 'FLOW/USD', 'AXS/USD', 'NEO/USD',
  'KAVA/USD', 'MINA/USD', 'IOTA/USD', 'CRV/USD',

  // 61-100 - Mid caps
  'CHZ/USD', 'GALA/USD', 'CAKE/USD', 'ZEC/USD', 'DASH/USD',
  'ENJ/USD', 'WAVES/USD', 'BAT/USD', 'LRC/USD', '1INCH/USD',
  'GMX/USD', 'SNX/USD', 'COMP/USD', 'ROSE/USD', 'YFI/USD',
  'DYDX/USD', 'RON/USD', 'BLUR/USD', 'ILV/USD', 'HNT/USD',
  'KLAY/USD', 'AUDIO/USD', 'CVX/USD', 'AR/USD', 'FET/USD',
  'AGIX/USD', 'CELO/USD', 'STX/USD', 'ONE/USD', 'OCEAN/USD',
  'BAND/USD', 'GNO/USD', 'RLC/USD', 'ANKR/USD', 'LSK/USD',
  'SNT/USD', 'STORJ/USD', 'NMR/USD', 'OXT/USD', 'GLM/USD',

  // 101-140 - Mid/Small caps on Kraken
  'BAL/USD', 'KSM/USD', 'ZIL/USD', 'ZRX/USD', 'LPT/USD',
  'SUSHI/USD', 'API3/USD', 'CTSI/USD', 'MASK/USD', 'MANA/USD',
  'SAND/USD', 'REN/USD', 'BNT/USD', 'NKN/USD', 'REQ/USD',
  'ASTR/USD', 'EGLD/USD', 'PEPE/USD', 'BONK/USD', 'FLOKI/USD',
  'WIF/USD', 'SEI/USD', 'RUNE/USD', 'TAO/USD', 'WLD/USD',
  'JUP/USD', 'PYTH/USD', 'ONDO/USD', 'ENA/USD', 'NOT/USD',
  'PENGU/USD', 'TRUMP/USD', 'APE/USD', 'RAY/USD', 'RBN/USD',
  'PERP/USD', 'SPELL/USD', 'ALICE/USD', 'OGN/USD', 'SKL/USD',

  // 141-180 - Additional Kraken-supported assets
  'RARE/USD', 'PHA/USD', 'BADGER/USD', 'KNC/USD', 'DODO/USD',
  'CVC/USD', 'POWR/USD', 'MOVR/USD', 'SC/USD', 'OMG/USD',
  'IOTX/USD', 'JASMY/USD', 'GLMR/USD', 'QTUM/USD', 'AMP/USD',
  'PAXG/USD', 'CFG/USD', 'RSR/USD', 'EWT/USD', 'AKT/USD',
  'T/USD', 'KILT/USD', 'SDN/USD', 'KINT/USD', 'AIR/USD',
  'XRT/USD', 'RPL/USD', 'ORCA/USD', 'MNGO/USD', 'SRM/USD',
  'KEEP/USD', 'RARI/USD', 'ANT/USD', 'ICX/USD', 'GHST/USD',
  'TBTC/USD', 'ENS/USD', 'MIR/USD', 'POLY/USD', 'ROOK/USD',

  // 181-200 - Remaining Kraken assets
  'TRIBE/USD', 'AUCTION/USD', 'WNXM/USD', 'BOND/USD', 'FARM/USD',
  'BERA/USD', 'BEAM/USD', 'ALCX/USD', 'REP/USD', 'MLN/USD',
  'BABY/USD', 'ETH2/USD',
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
