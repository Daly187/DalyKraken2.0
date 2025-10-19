import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { dataStore } from './dataStore.js';

/**
 * Kraken API Integration Service
 * Handles all interactions with Kraken exchange API
 */
class KrakenService {
  constructor() {
    this.apiUrl = 'https://api.kraken.com';
    this.apiKey = process.env.KRAKEN_API_KEY;
    this.apiSecret = process.env.KRAKEN_API_SECRET;
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
  }

  /**
   * Rate limiting helper
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Generate authentication signature for private endpoints
   */
  getMessageSignature(path, request, secret, nonce) {
    const message = nonce + request;
    const hash = crypto.createHash('sha256').update(message).digest();
    const hmac = crypto.createHmac('sha512', Buffer.from(secret, 'base64'));
    const signatureHash = hmac.update(path + hash.toString('binary'), 'binary').digest('base64');
    return signatureHash;
  }

  /**
   * Make authenticated API call to Kraken
   * @param {string} endpoint - API endpoint
   * @param {object} params - Request parameters
   * @param {string} apiKey - Override API key (optional)
   * @param {string} apiSecret - Override API secret (optional)
   */
  async privateRequest(endpoint, params = {}, apiKey = null, apiSecret = null) {
    await this.rateLimit();

    const path = `/0/private/${endpoint}`;
    const nonce = Date.now() * 1000;

    const postData = new URLSearchParams({
      nonce: nonce.toString(),
      ...params,
    }).toString();

    // Use provided keys or fall back to instance keys
    const useApiKey = apiKey || this.apiKey;
    const useApiSecret = apiSecret || this.apiSecret;

    const signature = this.getMessageSignature(
      path,
      postData,
      useApiSecret,
      nonce
    );

    try {
      const response = await axios.post(
        `${this.apiUrl}${path}`,
        postData,
        {
          headers: {
            'API-Key': useApiKey,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
      }

      return response.data.result;
    } catch (error) {
      logger.error(`Kraken private API error (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Make public API call to Kraken
   */
  async publicRequest(endpoint, params = {}) {
    await this.rateLimit();

    const queryString = new URLSearchParams(params).toString();
    const url = `${this.apiUrl}/0/public/${endpoint}${queryString ? '?' + queryString : ''}`;

    try {
      const response = await axios.get(url);

      if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
      }

      return response.data.result;
    } catch (error) {
      logger.error(`Kraken public API error (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Get account balance
   * @param {string} apiKey - Override API key (optional, from frontend)
   * @param {string} apiSecret - Override API secret (optional, from frontend)
   */
  async getBalance(apiKey = null, apiSecret = null) {
    try {
      logger.info('Fetching account balance from Kraken');

      // Determine which keys to use
      const useApiKey = apiKey || this.apiKey;
      const useApiSecret = apiSecret || this.apiSecret;

      // Check cache first (only if using default keys)
      if (!apiKey && !apiSecret) {
        const cached = dataStore.get('kraken_balance');
        if (cached && Date.now() - cached.timestamp < 30000) {
          logger.debug('Returning cached balance');
          return cached.data;
        }
      }

      // Mock data for development (only if no keys provided at all)
      if (!useApiKey || !useApiSecret) {
        logger.warn('Kraken API keys not configured, returning mock data');
        const mockBalance = {
          ZUSD: '10000.00',
          XXBT: '0.5',
          XETH: '2.5',
          SOL: '15.0',
        };
        if (!apiKey && !apiSecret) {
          dataStore.set('kraken_balance', mockBalance, 30000);
        }
        return mockBalance;
      }

      const balance = await this.privateRequest('Balance', {}, useApiKey, useApiSecret);

      // Only cache if using default keys
      if (!apiKey && !apiSecret) {
        dataStore.set('kraken_balance', balance, 30000);
      }

      return balance;
    } catch (error) {
      logger.error('Error fetching balance:', error);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    try {
      logger.info('Fetching account info from Kraken');

      if (!this.apiKey || !this.apiSecret) {
        return {
          balance: await this.getBalance(),
          tradeBalance: await this.getTradeBalance(),
        };
      }

      const [balance, tradeBalance] = await Promise.all([
        this.getBalance(),
        this.getTradeBalance(),
      ]);

      return { balance, tradeBalance };
    } catch (error) {
      logger.error('Error fetching account info:', error);
      throw error;
    }
  }

  /**
   * Get trade balance
   */
  async getTradeBalance() {
    try {
      logger.info('Fetching trade balance from Kraken');

      if (!this.apiKey || !this.apiSecret) {
        return {
          eb: '10000.00',
          tb: '10000.00',
          m: '0.00',
          n: '0.00',
          c: '0.00',
          v: '0.00',
          e: '10000.00',
          mf: '10000.00',
        };
      }

      return await this.privateRequest('TradeBalance');
    } catch (error) {
      logger.error('Error fetching trade balance:', error);
      throw error;
    }
  }

  /**
   * Get trading volume
   */
  async getTradingVolume() {
    try {
      logger.info('Fetching trading volume from Kraken');

      if (!this.apiKey || !this.apiSecret) {
        return {
          currency: 'ZUSD',
          volume: '50000.00',
          fees: {
            fee: '0.16',
          },
        };
      }

      return await this.privateRequest('TradeVolume');
    } catch (error) {
      logger.error('Error fetching trading volume:', error);
      throw error;
    }
  }

  /**
   * Get current prices for pairs
   */
  async getCurrentPrices(pairs = null) {
    try {
      logger.info('Fetching current prices');

      const cached = dataStore.get('kraken_prices');
      if (cached && Date.now() - cached.timestamp < 10000) {
        return cached.data;
      }

      // Default pairs if none specified
      const defaultPairs = [
        'XXBTZUSD', 'XETHZUSD', 'SOLUSD', 'ADAUSD',
        'DOTUSD', 'MATICUSD', 'LINKUSD', 'AVAXUSD'
      ];

      const pairList = pairs || defaultPairs;
      const ticker = await this.publicRequest('Ticker', {
        pair: pairList.join(','),
      });

      // Map response back to asset names
      const prices = {};
      for (const [pair, data] of Object.entries(ticker)) {
        // Extract the base asset from the pair name
        // Examples: XXBTZUSD -> XXBT, SOLUSD -> SOL, XETHZUSD -> XETH
        let asset = pair.replace(/ZUSD$/, '').replace(/USD$/, '').replace(/ZEUR$/, '').replace(/EUR$/, '');

        // Store the price with the asset name as key
        prices[asset] = parseFloat(data.c[0]); // Last price
      }

      dataStore.set('kraken_prices', prices, 10000);
      return prices;
    } catch (error) {
      logger.error('Error fetching prices:', error);

      // Return mock data on error
      return {
        XXBT: 45000.50,
        XETH: 2500.75,
        SOL: 120.30,
        ADA: 0.65,
        DOT: 8.50,
        MATIC: 1.25,
        LINK: 18.50,
        AVAX: 42.00,
      };
    }
  }

  /**
   * Get ticker information for a pair
   */
  async getTicker(pair) {
    try {
      logger.info(`Fetching ticker for ${pair}`);
      const result = await this.publicRequest('Ticker', { pair });
      return result[Object.keys(result)[0]];
    } catch (error) {
      logger.error(`Error fetching ticker for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Get OHLC data
   */
  async getOHLC(pair, interval = 60) {
    try {
      logger.info(`Fetching OHLC for ${pair}`);
      return await this.publicRequest('OHLC', { pair, interval });
    } catch (error) {
      logger.error(`Error fetching OHLC for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(pair, count = 10) {
    try {
      logger.info(`Fetching order book for ${pair}`);
      return await this.publicRequest('Depth', { pair, count });
    } catch (error) {
      logger.error(`Error fetching order book for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(pair, since = null) {
    try {
      logger.info(`Fetching recent trades for ${pair}`);
      const params = { pair };
      if (since) params.since = since;
      return await this.publicRequest('Trades', params);
    } catch (error) {
      logger.error(`Error fetching trades for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Get spread data
   */
  async getSpread(pair) {
    try {
      logger.info(`Fetching spread for ${pair}`);
      return await this.publicRequest('Spread', { pair });
    } catch (error) {
      logger.error(`Error fetching spread for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Get market overview
   */
  async getMarketOverview() {
    try {
      logger.info('Fetching market overview');

      const prices = await this.getCurrentPrices();

      return {
        prices,
        timestamp: new Date().toISOString(),
        marketCap: 1500000000000, // Mock
        volume24h: 50000000000, // Mock
        dominance: {
          BTC: 45.2,
          ETH: 18.5,
        },
      };
    } catch (error) {
      logger.error('Error fetching market overview:', error);
      throw error;
    }
  }

  /**
   * Get top 20 assets
   */
  async getTop20Assets() {
    try {
      logger.info('Fetching top 20 assets');

      const cached = dataStore.get('kraken_top20');
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.data;
      }

      const prices = await this.getCurrentPrices();

      // Mock data with real prices
      const top20 = Object.entries(prices).map(([asset, price]) => ({
        asset,
        price,
        change24h: (Math.random() - 0.5) * 10,
        volume24h: Math.random() * 1000000000,
      }));

      dataStore.set('kraken_top20', top20, 60000);
      return top20;
    } catch (error) {
      logger.error('Error fetching top 20 assets:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(options = {}) {
    try {
      logger.info('Fetching transaction history');

      if (!this.apiKey || !this.apiSecret) {
        // Return mock data
        return [
          {
            txid: 'TX1234',
            type: 'deposit',
            asset: 'USD',
            amount: 10000,
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            txid: 'TX1235',
            type: 'buy',
            asset: 'BTC',
            amount: 0.5,
            timestamp: new Date(Date.now() - 43200000).toISOString(),
          },
        ];
      }

      return await this.privateRequest('Ledgers', options);
    } catch (error) {
      logger.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(options = {}) {
    try {
      logger.info('Fetching trade history', options);

      if (!this.apiKey || !this.apiSecret) {
        logger.warn('Kraken API keys not configured - cannot fetch trade history');
        // Return empty object with descriptive structure matching Kraken's response
        return {
          trades: {},
          count: 0
        };
      }

      const result = await this.privateRequest('TradesHistory', options);

      // Kraken returns { trades: { txid: {...}, ... }, count: N }
      return result;
    } catch (error) {
      logger.error('Error fetching trade history:', error);

      // Check if it's an authentication error
      if (error.message?.includes('Invalid key') || error.message?.includes('Permission denied')) {
        logger.error('Kraken API key authentication failed. Please verify API key permissions include "Query Funds" and "Query Closed Orders and Trades"');
      }

      throw error;
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(options = {}) {
    try {
      logger.info('Fetching order history');

      if (!this.apiKey || !this.apiSecret) {
        return { open: {}, closed: {} };
      }

      return await this.privateRequest('OrdersHistory', options);
    } catch (error) {
      logger.error('Error fetching order history:', error);
      throw error;
    }
  }

  /**
   * Sync transaction data
   */
  async syncTransactionData() {
    try {
      logger.info('Syncing transaction data');

      const [transactions, trades] = await Promise.all([
        this.getTransactionHistory({ limit: 100 }),
        this.getTradeHistory({ limit: 100 }),
      ]);

      return {
        transactionCount: Array.isArray(transactions) ? transactions.length : 0,
        tradeCount: Array.isArray(trades) ? trades.length : 0,
        syncedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error syncing transaction data:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(txId) {
    try {
      logger.info(`Fetching transaction details: ${txId}`);

      if (!this.apiKey || !this.apiSecret) {
        return null;
      }

      return await this.privateRequest('QueryLedgers', { id: txId });
    } catch (error) {
      logger.error(`Error fetching transaction ${txId}:`, error);
      throw error;
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(pair, type, volume) {
    try {
      logger.info(`Placing ${type} market order: ${volume} ${pair}`);

      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API keys not configured');
      }

      return await this.privateRequest('AddOrder', {
        pair,
        type,
        ordertype: 'market',
        volume,
      });
    } catch (error) {
      logger.error('Error placing market order:', error);
      throw error;
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(pair, type, volume, price) {
    try {
      logger.info(`Placing ${type} limit order: ${volume} ${pair} at ${price}`);

      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API keys not configured');
      }

      return await this.privateRequest('AddOrder', {
        pair,
        type,
        ordertype: 'limit',
        volume,
        price,
      });
    } catch (error) {
      logger.error('Error placing limit order:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const krakenService = new KrakenService();

// Export class for testing
export { KrakenService };
