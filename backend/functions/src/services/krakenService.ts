/**
 * Kraken API Integration Service
 */

import KrakenClient from 'kraken-api';
import crypto from 'crypto';
import { MarketData } from '../types.js';

export class KrakenService {
  private client: any;

  constructor(apiKey?: string, apiSecret?: string) {
    if (apiKey && apiSecret) {
      this.client = new KrakenClient(apiKey, apiSecret);
    } else {
      // Public API only
      this.client = new KrakenClient();
    }
  }

  /**
   * Get current market price for a symbol
   */
  async getTicker(pair: string): Promise<MarketData> {
    try {
      // Normalize pair format: Remove slash (BTC/USD -> BTCUSD, BCH/USD -> BCHUSD)
      const normalizedPair = pair.replace('/', '');

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
      // Normalize pair format: Remove slash (BTC/USD -> BTCUSD, BCH/USD -> BCHUSD)
      const normalizedPair = pair.replace('/', '');

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
      // Normalize pair format: Remove slash (BTC/USD -> BTCUSD, BCH/USD -> BCHUSD)
      const normalizedPair = pair.replace('/', '');

      const orderParams: any = {
        pair: normalizedPair,
        type: 'buy',
        ordertype: orderType,
        volume: volume.toString(),
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

      // Normalize pair format: Remove slash (BTC/USD -> BTCUSD, BCH/USD -> BCHUSD)
      const normalizedPair = pair.replace('/', '');
      console.log(`[KrakenService] Normalized pair: "${normalizedPair}"`);

      const orderParams: any = {
        pair: normalizedPair,
        type: 'sell',
        ordertype: orderType,
        volume: volume.toString(),
        // Note: reduce_only is only valid for leveraged/margin orders, not spot trading
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

      console.log(`[KrakenService] SUCCESS - Kraken response:`, JSON.stringify(response));

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

      // Return mock data if no API keys configured
      if (!apiKey && !apiSecret && !process.env.KRAKEN_API_KEY) {
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
      console.error('[KrakenService] Error fetching balance:', error);
      // Return mock data on error
      return {
        'ZUSD': 10000,
        'XXBT': 0.5,
        'XETH': 2.5,
      };
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
      // Normalize pair format: Remove slash (BTC/USD -> BTCUSD, BCH/USD -> BCHUSD)
      const normalizedPair = pair.replace('/', '');

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
