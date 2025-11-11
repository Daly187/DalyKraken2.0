import config from '../config/env';
import { getCommonName, getKrakenPair } from '../utils/assetNames';

interface Balance {
  asset: string;
  symbol: string;
  amount: number;
  availableBalance: number;
  lockedBalance: number;
}

interface RateLimitInfo {
  lastRequestTime: number;
  requestCount: number;
  resetTime: number;
}

class KrakenApiService {
  private readonly backendUrl = config.api.mainUrl.replace('/api', '');
  private rateLimit: RateLimitInfo = {
    lastRequestTime: 0,
    requestCount: 0,
    resetTime: Date.now() + 60000, // Reset every minute
  };
  private readonly MAX_REQUESTS_PER_MINUTE = 15;
  private readonly MIN_REQUEST_INTERVAL = 4000; // 4 seconds between requests

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter if reset time has passed
    if (now >= this.rateLimit.resetTime) {
      this.rateLimit.requestCount = 0;
      this.rateLimit.resetTime = now + 60000;
    }

    // Check if we've exceeded rate limit
    if (this.rateLimit.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = this.rateLimit.resetTime - now;
      console.warn(`[KrakenApiService] Rate limit exceeded. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimit.requestCount = 0;
      this.rateLimit.resetTime = Date.now() + 60000;
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now - this.rateLimit.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[KrakenApiService] Waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimit.lastRequestTime = Date.now();
    this.rateLimit.requestCount++;
  }

  /**
   * Get mock balance data as fallback
   */
  private getMockBalances(): Balance[] {
    return [
      {
        asset: 'USD',
        symbol: 'USD',
        amount: 1000.00,
        availableBalance: 1000.00,
        lockedBalance: 0,
      },
      {
        asset: 'BTC',
        symbol: 'BTC/USD',
        amount: 0.05,
        availableBalance: 0.05,
        lockedBalance: 0,
      },
      {
        asset: 'ETH',
        symbol: 'ETH/USD',
        amount: 0.5,
        availableBalance: 0.5,
        lockedBalance: 0,
      },
      {
        asset: 'SOL',
        symbol: 'SOL/USD',
        amount: 10,
        availableBalance: 10,
        lockedBalance: 0,
      },
    ];
  }

  /**
   * Get API keys from localStorage
   * Tries primary key first, then fallbacks
   */
  private getApiKeys(): { apiKey: string; apiSecret: string } | null {
    try {
      const keysJson = localStorage.getItem('kraken_api_keys');
      if (!keysJson) {
        console.warn('[KrakenApiService] No API keys found in localStorage');
        return null;
      }

      const keys = JSON.parse(keysJson);

      // Keys are stored as an array of objects with type property
      if (!Array.isArray(keys)) {
        console.error('[KrakenApiService] Invalid API keys format');
        return null;
      }

      // Try primary key first
      const primaryKey = keys.find((k) => k.type === 'primary');
      if (primaryKey?.apiKey && primaryKey?.apiSecret && primaryKey.isActive) {
        console.log('[KrakenApiService] Using primary API key');
        return {
          apiKey: primaryKey.apiKey,
          apiSecret: primaryKey.apiSecret,
        };
      }

      // Try fallback1
      const fallback1Key = keys.find((k) => k.type === 'fallback1');
      if (fallback1Key?.apiKey && fallback1Key?.apiSecret && fallback1Key.isActive) {
        console.log('[KrakenApiService] Using fallback #1 API key');
        return {
          apiKey: fallback1Key.apiKey,
          apiSecret: fallback1Key.apiSecret,
        };
      }

      // Try fallback2
      const fallback2Key = keys.find((k) => k.type === 'fallback2');
      if (fallback2Key?.apiKey && fallback2Key?.apiSecret && fallback2Key.isActive) {
        console.log('[KrakenApiService] Using fallback #2 API key');
        return {
          apiKey: fallback2Key.apiKey,
          apiSecret: fallback2Key.apiSecret,
        };
      }

      console.warn('[KrakenApiService] No valid API keys found (all inactive or empty)');
      return null;
    } catch (error) {
      console.error('[KrakenApiService] Error reading API keys:', error);
      return null;
    }
  }

  /**
   * Make a request to the backend API
   * The backend handles all Kraken API authentication and CORS issues
   */
  private async makeBackendRequest(endpoint: string, useRateLimit: boolean = true): Promise<any> {
    try {
      // Enforce rate limiting if enabled
      if (useRateLimit) {
        await this.checkRateLimit();
      }

      console.log(`[KrakenApiService] Requesting ${endpoint} from backend`);

      // Get API keys from localStorage
      const credentials = this.getApiKeys();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add JWT token for authentication
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Add API keys to headers if available
      if (credentials) {
        headers['x-kraken-api-key'] = credentials.apiKey;
        headers['x-kraken-api-secret'] = credentials.apiSecret;
        console.log('[KrakenApiService] Sending API keys in headers');
      } else {
        console.warn('[KrakenApiService] No API keys available, backend will return mock data');
      }

      const response = await fetch(`${this.backendUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Backend request failed');
      }

      return data.data;
    } catch (error: any) {
      // Check if it's a rate limit or lockout error
      if (error.message?.includes('Temporary lockout') || error.message?.includes('rate limit')) {
        // Don't spam console with rate limit errors - just throw silently
        const rateLimitError = new Error('Kraken API Error: Rate limit reached');
        (rateLimitError as any).isRateLimit = true;
        throw rateLimitError;
      }

      // Log other errors normally
      console.error('[KrakenApiService] Backend request error:', error);
      throw error;
    }
  }

  async getAccountBalance(): Promise<Balance[]> {
    const CACHE_KEY = 'kraken_balance_cache';
    const CACHE_DURATION = 30000; // 30 seconds

    try {
      // Try to get from cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          if (age < CACHE_DURATION) {
            console.log(`[KrakenApiService] Using cached balance (age: ${(age / 1000).toFixed(1)}s)`);
            return data;
          }
        } catch (e) {
          console.warn('[KrakenApiService] Invalid cache data, will fetch fresh');
        }
      }

      // Fetch balance from backend
      const balances = await this.makeBackendRequest('/api/account/balance');

      // Check if balances data is valid
      if (!balances || typeof balances !== 'object') {
        console.warn('[KrakenApiService] No valid balance data received');
        return [];
      }

      // Convert Kraken balance format to our format
      const balanceArray: Balance[] = Object.entries(balances)
        .map(([asset, amount]) => {
          const numAmount = parseFloat(amount as string);

          // Skip zero or near-zero balances
          if (numAmount < 0.00000001) return null;

          // Format asset names (Kraken uses XXBT for BTC, ZEUR for EUR, etc.)
          // For futures (e.g., ZRX.F), strip .F and use spot symbol (ZRX/USD)
          const formattedAsset = this.formatAssetName(asset);
          const symbol = this.getSymbol(formattedAsset);

          return {
            asset: formattedAsset,
            symbol,
            amount: numAmount,
            availableBalance: numAmount, // Kraken Balance endpoint doesn't split these
            lockedBalance: 0,
          };
        })
        .filter((b): b is Balance => b !== null);

      console.log('[KrakenApiService] Fetched balances:', balanceArray);

      // Cache the result
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: balanceArray,
        timestamp: Date.now(),
      }));

      return balanceArray;
    } catch (error: any) {
      const isRateLimit = error.message?.includes('rate limit') || (error as any).isRateLimit;

      // If it's a rate limit error, try to return cached data even if expired
      if (isRateLimit) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const { data } = JSON.parse(cached);
            console.warn('[KrakenApiService] Rate limited - using cached data');
            return data;
          } catch (e) {
            // Cache is corrupted, throw error
            console.error('[KrakenApiService] Rate limited and cache corrupted');
          }
        }

        // If no cache, throw the error instead of returning mock data
        console.error('[KrakenApiService] Rate limited with no cache available');
        throw new Error('Rate limited by Kraken API. Please wait a moment and refresh.');
      }

      // For other errors, log and try cache as last resort
      console.error('[KrakenApiService] Error fetching balance:', error.message);

      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          console.warn('[KrakenApiService] Using cached data as fallback');
          return data;
        } catch (e) {
          // Cache is corrupted
        }
      }

      throw error;
    }
  }

  private formatAssetName(krakenAsset: string): string {
    // Use centralized asset name mapping
    return getCommonName(krakenAsset);
  }

  private getSymbol(asset: string): string {
    // Use centralized pair mapping
    return getKrakenPair(asset);
  }

  async getTradeBalance(): Promise<any> {
    try {
      return await this.makeBackendRequest('/api/account/tradebalance');
    } catch (error) {
      console.error('[KrakenApiService] Error fetching trade balance:', error);
      throw error;
    }
  }

  /**
   * Place a market order on Kraken
   * @param pair Trading pair (e.g., "XBTUSD" for BTC/USD)
   * @param type Order type: "buy" or "sell"
   * @param volume Amount to buy/sell
   * @param price Optional price (for market orders, this is just for reference)
   */
  async placeMarketOrder(
    pair: string,
    type: 'buy' | 'sell',
    volume: number,
    price?: number
  ): Promise<any> {
    try {
      console.log(`[KrakenApiService] Placing ${type} market order for ${volume} ${pair}`);

      // Get API keys from localStorage
      const credentials = this.getApiKeys();

      if (!credentials) {
        throw new Error('No API keys configured. Please add your Kraken API keys in Settings.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-kraken-api-key': credentials.apiKey,
        'x-kraken-api-secret': credentials.apiSecret,
      };

      // Add JWT token for authentication
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const orderData = {
        pair,
        type,
        ordertype: 'market', // Market order executes immediately at best available price
        volume: volume.toString(),
      };

      const response = await fetch(`${this.backendUrl}/api/trading/addorder`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(15000), // 15 second timeout for order placement
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to place order');
      }

      console.log('[KrakenApiService] Order placed successfully:', data.data);
      return data.data;
    } catch (error: any) {
      console.error('[KrakenApiService] Error placing market order:', error);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<any> {
    try {
      return await this.makeBackendRequest('/api/trading/openorders');
    } catch (error) {
      console.error('[KrakenApiService] Error fetching open orders:', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   * @param txid Transaction ID of the order to cancel
   */
  async cancelOrder(txid: string): Promise<any> {
    try {
      const credentials = this.getApiKeys();

      if (!credentials) {
        throw new Error('No API keys configured');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-kraken-api-key': credentials.apiKey,
        'x-kraken-api-secret': credentials.apiSecret,
      };

      // Add JWT token for authentication
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.backendUrl}/api/trading/cancelorder`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ txid }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel order');
      }

      return data.data;
    } catch (error: any) {
      console.error('[KrakenApiService] Error canceling order:', error);
      throw error;
    }
  }

  /**
   * Get ticker information for a trading pair
   * @param pair Trading pair (e.g., "XBTUSD")
   */
  async getTicker(pair: string): Promise<any> {
    try {
      return await this.makeBackendRequest(`/api/market/ticker?pair=${pair}`, false);
    } catch (error) {
      console.error('[KrakenApiService] Error fetching ticker:', error);
      throw error;
    }
  }
}

export const krakenApiService = new KrakenApiService();
