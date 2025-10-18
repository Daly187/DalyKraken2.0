/**
 * Kraken API Integration Service
 */

import KrakenClient from 'kraken-api';
import crypto from 'crypto';
import { MarketData } from '../types';

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
      const response = await this.client.api('Ticker', { pair });
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
      const response = await this.client.api('OHLC', { pair, interval });
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
    price?: number
  ): Promise<any> {
    try {
      const orderParams: any = {
        pair,
        type: 'buy',
        ordertype: orderType,
        volume: volume.toString(),
      };

      if (orderType === 'limit' && price) {
        orderParams.price = price.toString();
      }

      const response = await this.client.api('AddOrder', orderParams);
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error placing buy order:', error);
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
    price?: number
  ): Promise<any> {
    try {
      const orderParams: any = {
        pair,
        type: 'sell',
        ordertype: orderType,
        volume: volume.toString(),
      };

      if (orderType === 'limit' && price) {
        orderParams.price = price.toString();
      }

      const response = await this.client.api('AddOrder', orderParams);
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error placing sell order:', error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<Record<string, number>> {
    try {
      const response = await this.client.api('Balance');
      return response.result;
    } catch (error) {
      console.error('[KrakenService] Error fetching balance:', error);
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
