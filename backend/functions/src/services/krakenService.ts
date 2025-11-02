/**
 * Kraken API Integration Service
 */

import KrakenClient from 'kraken-api';
import crypto from 'crypto';
import { MarketData } from '../types.js';

export class KrakenService {
  private client: any;

  // Kraken pair mappings: Display format → Kraken API format
  // Critical: Kraken uses specific internal pair formats (e.g., XXBTZUSD not BTCUSD)
  private static readonly PAIR_MAPPINGS: Record<string, string> = {
    'BTC/USD': 'XXBTZUSD',
    'ETH/USD': 'XETHZUSD',
    'XRP/USD': 'XXRPZUSD',
    'SOL/USD': 'SOLUSD',
    'ADA/USD': 'ADAUSD',
    'DOGE/USD': 'XDGUSD',
    'DOT/USD': 'DOTUSD',
    'MATIC/USD': 'MATICUSD',
    'LINK/USD': 'LINKUSD',
    'UNI/USD': 'UNIUSD',
    'ATOM/USD': 'ATOMUSD',
    'LTC/USD': 'XLTCZUSD',
    'BCH/USD': 'BCHUSD',
    'XLM/USD': 'XXLMZUSD',
    'AVAX/USD': 'AVAXUSD',
    'ALGO/USD': 'ALGOUSD',
    'TRX/USD': 'TRXUSD',
    'MANA/USD': 'MANAUSD',
    'SAND/USD': 'SANDUSD',
    'APE/USD': 'APEUSD',
  };

  // Asset precision limits (lot_decimals)
  private static readonly PRECISION_LIMITS: Record<string, number> = {
    'XXBT': 8,  // BTC
    'XBT': 8,
    'BTC': 8,
    'XETH': 8,  // ETH
    'ETH': 8,
    'XXRP': 6,  // XRP
    'XRP': 6,
    'SOL': 8,
    'ADA': 6,
    'DOGE': 2,
    'DOT': 8,
    'MATIC': 6,
    'LINK': 8,
    'UNI': 8,
    'ATOM': 8,
    'XLTC': 8,  // LTC
    'LTC': 8,
    'BCH': 8,
    'XXLM': 6,  // XLM
    'XLM': 6,
    'AVAX': 8,
    'ALGO': 6,
    'TRX': 2,
    'MANA': 6,
    'SAND': 6,
    'APE': 8,
    'ZUSD': 2,  // USD
    'USD': 2,
    'ZEUR': 2,  // EUR
    'EUR': 2,
  };

  // Asset name mappings: Display format → Kraken balance format
  private static readonly ASSET_MAPPINGS: Record<string, string> = {
    'BTC': 'XXBT',
    'ETH': 'XETH',
    'XRP': 'XXRP',
    'LTC': 'XLTC',
    'XLM': 'XXLM',
    'USD': 'ZUSD',
    'EUR': 'ZEUR',
    // Others use their display name in balances
  };

  constructor(apiKey?: string, apiSecret?: string) {
    if (apiKey && apiSecret) {
      this.client = new KrakenClient(apiKey, apiSecret);
    } else {
      // Public API only
      this.client = new KrakenClient();
    }
  }

  /**
   * Convert display pair format to Kraken API format
   * CRITICAL: This fixes Issue #1 from the professional review
   * Example: BTC/USD → XXBTZUSD (not BTCUSD)
   */
  private normalizeKrakenPair(pair: string): string {
    // Check if we have a direct mapping
    if (KrakenService.PAIR_MAPPINGS[pair]) {
      return KrakenService.PAIR_MAPPINGS[pair];
    }

    // Fallback: remove slash (for pairs that don't need special mapping)
    const fallback = pair.replace('/', '');
    console.warn(`[KrakenService] No mapping found for pair "${pair}", using fallback: "${fallback}"`);
    return fallback;
  }

  /**
   * Extract base asset from pair and convert to Kraken balance format
   * Example: BTC/USD → XXBT (for balance lookups)
   */
  public static extractKrakenAsset(pair: string): string {
    const displayAsset = pair.split('/')[0];
    return KrakenService.ASSET_MAPPINGS[displayAsset] || displayAsset;
  }

  /**
   * Get precision for an asset
   */
  public static getAssetPrecision(asset: string): number {
    return KrakenService.PRECISION_LIMITS[asset] || 8; // Default to 8 decimals
  }

  /**
   * Get current market price for a symbol
   */
  async getTicker(pair: string): Promise<MarketData> {
    try {
      // Normalize pair format to Kraken API format
      const normalizedPair = this.normalizeKrakenPair(pair);

      const response = await this.client.api('Ticker', { pair: normalizedPair });
      const pairData = response.result[Object.keys(response.result)[0]];

      return {
        symbol: pair,
        price: parseFloat(pairData.c[0]),
        bid: parseFloat(pairData.b[0]),
        ask: parseFloat(pairData.a[0]),
        high24h: parseFloat(pairData.h[1]),
        low24h: parseFloat(pairData.l[1]),
        volume24h: parseFloat(pairData.v[1]),
        change24h: parseFloat(pairData.c[0]) - parseFloat(pairData.o),
        changePercent24h: ((parseFloat(pairData.c[0]) - parseFloat(pairData.o)) / parseFloat(pairData.o)) * 100,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[KrakenService] Error fetching ticker:', error);
      throw error;
    }
  }

  /**
   * Get OHLC data for technical analysis
   */
  async getOHLC(pair: string, interval: number = 60): Promise<any[]> {
    try {
      // Normalize pair format to Kraken API format
      const normalizedPair = this.normalizeKrakenPair(pair);

      const response = await this.client.api('OHLC', { pair: normalizedPair, interval });
      const pairData = response.result[Object.keys(response.result)[0]];
      return pairData;
    } catch (error) {
      console.error('[KrakenService] Error fetching OHLC:', error);
      throw error;
    }
  }

  /**
   * Place a market buy order
   */
  async placeBuyOrder(
    pair: string,
    volume: number,
    orderType: 'market' | 'limit' = 'market',
    price?: number,
    userref?: number
  ): Promise<any> {
    try {
      // Normalize pair format to Kraken API format
      const normalizedPair = this.normalizeKrakenPair(pair);

      const orderParams: any = {
        pair: normalizedPair,
        type: 'buy',
        ordertype: orderType,
        volume: volume.toString(),
        oflags: 'fcib',  // Fee in base currency for buys
      };

      if (orderType === 'limit' && price) {
        orderParams.price = price.toString();
      }

      if (userref !== undefined) {
        orderParams.userref = userref;
      }

      console.log(`[KrakenService] Placing buy order:`, JSON.stringify(orderParams));

      const response = await this.client.api('AddOrder', orderParams);

      console.log(`[KrakenService] Kraken response received:`, JSON.stringify(response));

      if (!response || !response.result) {
        throw new Error('Invalid response from Kraken API - no result field');
      }

      if (response.error && response.error.length > 0) {
        throw new Error(`Kraken API error: ${response.error.join(', ')}`);
      }

      return response.result;
    } catch (error: any) {
      console.error('[KrakenService] Error placing buy order:', error?.message || error);
      if (error.response) {
        console.error('[KrakenService] Error response:', JSON.stringify(error.response));
      }
      throw error;
    }
  }

  /**
   * Place a market sell order
   */
  async placeSellOrder(
    pair: string,
    volume: number,
    orderType: 'market' | 'limit' = 'market',
    price?: number,
    userref?: number
  ): Promise<any> {
    try {
      console.log(`[KrakenService] SELL ORDER START - Original pair: "${pair}", volume: ${volume}, orderType: ${orderType}`);

      // CRITICAL FIX: Use proper Kraken pair format (e.g., BTC/USD → XXBTZUSD)
      const normalizedPair = this.normalizeKrakenPair(pair);
      console.log(`[KrakenService] Kraken API pair format: "${normalizedPair}"`);

      // Get asset precision and apply it
      const asset = KrakenService.extractKrakenAsset(pair);
      const precision = KrakenService.getAssetPrecision(asset);
      const preciseVolume = parseFloat(volume.toFixed(precision));

      console.log(`[KrakenService] Asset: ${asset}, Precision: ${precision}, Volume: ${volume} → ${preciseVolume}`);

      const orderParams: any = {
        pair: normalizedPair,
        type: 'sell',
        ordertype: orderType,
        volume: preciseVolume.toString(),
        validate: false,  // Execute immediately (not validation mode)
        oflags: 'fciq',   // Fee in quote currency (USD) for sells - CRITICAL for proper execution
      };

      if (orderType === 'limit' && price) {
        orderParams.price = price.toString();
      }

      if (userref !== undefined) {
        orderParams.userref = userref;
      }

      console.log(`[KrakenService] FINAL ORDER PARAMS:`, JSON.stringify(orderParams));
      console.log(`[KrakenService] Calling Kraken AddOrder API...`);

      const response = await this.client.api('AddOrder', orderParams);

      console.log(`[KrakenService] Kraken API Response:`, JSON.stringify(response, null, 2));

      if (!response || !response.result) {
        throw new Error('Invalid response from Kraken API - no result field');
      }

      if (response.error && response.error.length > 0) {
        throw new Error(`Kraken API error: ${response.error.join(', ')}`);
      }

      return response.result;
    } catch (error: any) {
      console.error('[KrakenService] ❌ SELL ORDER FAILED');
      console.error('[KrakenService] Error message:', error?.message || error);
      console.error('[KrakenService] Error type:', typeof error);
      if (error.response) {
        console.error('[KrakenService] Error response:', JSON.stringify(error.response));
      }
      if (error.error) {
        console.error('[KrakenService] Kraken error array:', JSON.stringify(error.error));
      }
      console.error('[KrakenService] Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  /**
   * Get account balance
   * @param apiKey - Optional API key override
   * @param apiSecret - Optional API secret override
   */
  async getBalance(apiKey?: string, apiSecret?: string): Promise<Record<string, number>> {
    try {
      // If API keys provided, create a new client instance
      const client = (apiKey && apiSecret) ? new KrakenClient(apiKey, apiSecret) : this.client;

      // Check if this.client has keys by checking if it was created with keys in constructor
      // this.client.config.key exists if keys were provided, otherwise it's undefined
      const hasKeys = apiKey || apiSecret || (this.client && this.client.config && this.client.config.key) || process.env.KRAKEN_API_KEY;

      // Return mock data if no API keys configured
      if (!hasKeys) {
        console.warn('[KrakenService] No API keys configured, returning mock data');
        return {
          'ZUSD': 10000,
          'XXBT': 0.5,
          'XETH': 2.5,
        };
      }

      const response = await client.api('Balance');
      return response.result;
    } catch (error) {
      console.error('[KrakenService] ❌ Error fetching balance:', error);
      // THROW the error instead of returning mock data so we can see what's failing
      throw error;
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(): Promise<any> {
    try {
      const balance = await this.getBalance();
      return {
        balance,
        accountType: 'standard',
        verified: true,
      };
    } catch (error) {
      console.error('[KrakenService] Error fetching account info:', error);
      throw error;
    }
  }

  /**
   * Get asset pair info including precision and minimum order size
   */
  async getAssetPairs(pair: string): Promise<any> {
    try {
      // Normalize pair format to Kraken API format
      const normalizedPair = this.normalizeKrakenPair(pair);

      const response = await this.client.api('AssetPairs', { pair: normalizedPair });

      if (response.result && Object.keys(response.result).length > 0) {
        // Return the first (and usually only) pair info
        const pairInfo = Object.values(response.result)[0] as any;
        return {
          pair_decimals: pairInfo.pair_decimals || 1,  // Price decimals
          lot_decimals: pairInfo.lot_decimals || 8,    // Volume decimals
          lot_multiplier: pairInfo.lot_multiplier || 1,
          ordermin: parseFloat(pairInfo.ordermin || '0'), // Minimum order size
          costmin: parseFloat(pairInfo.costmin || '0'),   // Minimum order cost
          fee_volume_currency: pairInfo.fee_volume_currency,
          margin_call: pairInfo.margin_call,
          margin_stop: pairInfo.margin_stop,
          base: pairInfo.base || null,  // Base asset code (e.g., "XXBT", "XETH", "ADA")
          quote: pairInfo.quote || null, // Quote asset code (e.g., "ZUSD", "ZEUR")
        };
      }

      // Return defaults if not found
      return {
        pair_decimals: 1,
        lot_decimals: 8,
        lot_multiplier: 1,
        ordermin: 0,
        costmin: 0,
      };
    } catch (error) {
      console.error(`[KrakenService] Error fetching asset pair info for ${pair}:`, error);
      // Return safe defaults
      return {
        pair_decimals: 1,
        lot_decimals: 8,
        lot_multiplier: 1,
        ordermin: 0,
        costmin: 0,
      };
    }
  }

  /**
   * Get current prices for multiple pairs
   */
  async getCurrentPrices(pairs?: string[]): Promise<Record<string, number>> {
    try {
      // Default pairs if none specified
      const defaultPairs = ['XXBTZUSD', 'XETHZUSD', 'XLTCZUSD'];
      const pairsToFetch = pairs || defaultPairs;

      const response = await this.client.api('Ticker', { pair: pairsToFetch.join(',') });

      // Map response back to asset names
      const prices: Record<string, number> = {};
      for (const [pair, data] of Object.entries(response.result)) {
        // Extract the base asset from the pair name
        // Examples: XXBTZUSD -> XXBT, SOLUSD -> SOL, XETHZUSD -> XETH
        let asset = pair.replace(/ZUSD$/, '').replace(/USD$/, '').replace(/ZEUR$/, '').replace(/EUR$/, '');

        // Store the price with the asset name as key
        prices[asset] = parseFloat((data as any).c[0]);
      }

      return prices;
    } catch (error) {
      console.error('[KrakenService] Error fetching prices:', error);
      // Return mock prices on error (using asset names, not pair names)
      return {
        'XXBT': 45000,
        'XETH': 2500,
        'XLTC': 80,
      };
    }
  }

  /**
   * Get market overview
   */
  async getMarketOverview(): Promise<any> {
    try {
      const prices = await this.getCurrentPrices();

      return {
        prices,
        marketCap: 1000000000,
        volume24h: 50000000,
        dominance: {
          BTC: 45,
          ETH: 18,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[KrakenService] Error fetching market overview:', error);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<any> {
    try {
      const response = await this.client.api('OpenOrders');
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error fetching open orders:', error);
      throw error;
    }
  }

  /**
   * Get order status
   */
  async queryOrders(txids: string[]): Promise<any> {
    try {
      const response = await this.client.api('QueryOrders', {
        txid: txids.join(','),
      });
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error querying orders:', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(txid: string): Promise<any> {
    try {
      const response = await this.client.api('CancelOrder', { txid });
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error canceling order:', error);
      throw error;
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(start?: number, end?: number): Promise<any> {
    try {
      const params: any = {};
      if (start) params.start = start;
      if (end) params.end = end;

      const response = await this.client.api('TradesHistory', params);
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error fetching trade history:', error);
      throw error;
    }
  }

  /**
   * Query specific trades by transaction IDs
   * This is used to get actual execution details for orders
   */
  async queryTrades(txids: string[]): Promise<any> {
    try {
      const response = await this.client.api('QueryTrades', {
        txid: txids.join(','),
      });
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error querying trades:', error);
      throw error;
    }
  }

  /**
   * Get available balance for selling (accounting for holds and fees)
   * CRITICAL: This fixes Issue #5 from the professional review
   */
  async getAvailableBalanceForSell(pair: string, targetAmount: number): Promise<{
    available: number;
    actualBalance: number;
    canSell: boolean;
    reason?: string;
  }> {
    try {
      const asset = KrakenService.extractKrakenAsset(pair);

      // Get actual balance
      const balances = await this.getBalance();
      const actualBalance = balances[asset] || 0;

      console.log(`[KrakenService] Balance check for ${asset}: actual=${actualBalance}, target=${targetAmount}`);

      // Account for 0.2% fee buffer (Kraken's maker/taker fees)
      const feeBuffer = 0.998; // Keep 0.2% buffer for fees
      const availableWithFees = actualBalance * feeBuffer;

      // Check if we have enough
      if (actualBalance === 0) {
        return {
          available: 0,
          actualBalance: 0,
          canSell: false,
          reason: `No ${asset} balance available`,
        };
      }

      if (availableWithFees < targetAmount) {
        return {
          available: availableWithFees,
          actualBalance,
          canSell: false,
          reason: `Insufficient balance: available ${availableWithFees.toFixed(8)} < target ${targetAmount.toFixed(8)}`,
        };
      }

      return {
        available: Math.min(availableWithFees, targetAmount),
        actualBalance,
        canSell: true,
      };
    } catch (error: any) {
      console.error('[KrakenService] Error checking available balance:', error);
      throw error;
    }
  }

  /**
   * Check order status and verify execution
   * CRITICAL: This fixes Issue #4 from the professional review
   */
  async checkOrderStatus(orderId: string, maxAttempts: number = 3, delayMs: number = 2000): Promise<{
    status: 'closed' | 'open' | 'pending' | 'canceled' | 'expired' | 'unknown';
    executedVolume?: string;
    executedPrice?: string;
    error?: string;
  }> {
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[KrakenService] Checking order status (attempt ${attempt}/${maxAttempts}): ${orderId}`);

        // Wait before checking (except first attempt)
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const response = await this.queryOrders([orderId]);

        if (response && response[orderId]) {
          const order = response[orderId];
          const status = order.status || 'unknown';

          console.log(`[KrakenService] Order ${orderId} status: ${status}, vol_exec: ${order.vol_exec}`);

          return {
            status: status as any,
            executedVolume: order.vol_exec,
            executedPrice: order.price || order.avg_price,
          };
        }

        console.warn(`[KrakenService] Order ${orderId} not found in response, retrying...`);
      }

      return {
        status: 'unknown',
        error: 'Could not retrieve order status after max attempts',
      };
    } catch (error: any) {
      console.error('[KrakenService] Error checking order status:', error);
      return {
        status: 'unknown',
        error: error.message,
      };
    }
  }

  /**
   * Validate sell order before placement
   * Combines all critical checks from professional review
   */
  async validateSellOrder(pair: string, volume: number): Promise<{
    valid: boolean;
    adjustedVolume?: number;
    error?: string;
  }> {
    try {
      // Check 1: Validate pair format
      const krakenPair = this.normalizeKrakenPair(pair);
      if (!krakenPair) {
        return { valid: false, error: `Invalid pair format: ${pair}` };
      }

      // Check 2: Get pair info for min order size
      const pairInfo = await this.getAssetPairs(pair);
      const minOrderSize = pairInfo.ordermin || 0;

      if (volume < minOrderSize) {
        return {
          valid: false,
          error: `Volume ${volume} below minimum ${minOrderSize} for ${pair}`
        };
      }

      // Check 3: Check available balance
      const balanceCheck = await this.getAvailableBalanceForSell(pair, volume);

      if (!balanceCheck.canSell) {
        return {
          valid: false,
          error: balanceCheck.reason || 'Insufficient balance',
        };
      }

      // Check 4: Apply precision
      const asset = KrakenService.extractKrakenAsset(pair);
      const precision = KrakenService.getAssetPrecision(asset);
      const adjustedVolume = parseFloat(balanceCheck.available.toFixed(precision));

      console.log(`[KrakenService] Sell order validation passed: ${pair}, volume: ${adjustedVolume}`);

      return {
        valid: true,
        adjustedVolume,
      };
    } catch (error: any) {
      console.error('[KrakenService] Error validating sell order:', error);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.api('Time');
      return response.error.length === 0;
    } catch (error) {
      return false;
    }
  }
}

export default KrakenService;
