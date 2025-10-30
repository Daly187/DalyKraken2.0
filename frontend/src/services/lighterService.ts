/**
 * Lighter.xyz Exchange Integration
 * REST API client for funding rates and market data
 *
 * Features:
 * - Hourly funding payments (like HyperLiquid)
 * - Zero fees on standard accounts
 * - ZK-rollup based (lower gas costs)
 * - USDC-margined perpetuals
 */

export interface LighterMarket {
  symbol: string; // e.g., "BTC-USDC"
  baseAsset: string;
  quoteAsset: string;
  minOrderSize: number;
  maxOrderSize: number;
  priceStep: number;
  sizeStep: number;
}

export interface LighterFundingData {
  symbol: string;
  fundingRate: number; // Hourly rate
  markPrice: number;
  indexPrice: number;
  premium: number;
  timestamp: number;
  nextFundingTime: number;
}

export interface LighterOrderBook {
  symbol: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
}

export interface LighterTrade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface LighterMarketStats {
  symbol: string;
  lastPrice: number;
  volume24h: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  trades24h: number;
}

class LighterService {
  private baseUrl: string;
  private wsUrl: string;
  private markets: Map<string, LighterMarket>;
  private fundingCache: Map<string, LighterFundingData>;
  private cacheExpiry: number = 60000; // 1 minute cache

  constructor() {
    this.baseUrl = 'https://mainnet.zklighter.elliot.ai';
    this.wsUrl = 'wss://mainnet.zklighter.elliot.ai/ws';
    this.markets = new Map();
    this.fundingCache = new Map();
  }

  /**
   * Initialize service and fetch market data
   */
  async initialize(): Promise<void> {
    try {
      await this.fetchMarkets();
      console.log(`[Lighter] Initialized with ${this.markets.size} markets`);
    } catch (error) {
      console.error('[Lighter] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Fetch all available markets
   */
  async fetchMarkets(): Promise<Map<string, LighterMarket>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orderBooks`);
      if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.order_books && Array.isArray(data.order_books)) {
        data.order_books.forEach((book: any) => {
          if (book.status !== 'active') return;

          const symbol = book.symbol;
          const quoteAsset = 'USDC'; // All Lighter perps are USDC-margined

          this.markets.set(symbol, {
            symbol: symbol,
            baseAsset: symbol,
            quoteAsset,
            minOrderSize: parseFloat(book.min_base_amount || '0'),
            maxOrderSize: 0, // Not provided in API
            priceStep: Math.pow(10, -book.supported_price_decimals),
            sizeStep: Math.pow(10, -book.supported_size_decimals),
          });
        });
      }

      console.log(`[Lighter] Loaded ${this.markets.size} markets`);
      return this.markets;
    } catch (error) {
      console.error('[Lighter] Error fetching markets:', error);
      throw error;
    }
  }

  /**
   * Get all funding rates
   * Uses the /api/v1/funding-rates endpoint which returns funding rates from multiple exchanges
   * We filter for only "lighter" exchange rates
   */
  async getAllFundingRates(): Promise<Map<string, LighterFundingData>> {
    const fundingRates = new Map<string, LighterFundingData>();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/funding-rates`);
      if (!response.ok) {
        throw new Error(`Failed to fetch funding rates: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.funding_rates && Array.isArray(data.funding_rates)) {
        // Filter for only Lighter exchange rates
        const lighterRates = data.funding_rates.filter((rate: any) => rate.exchange === 'lighter');

        // Also get prices from exchangeStats
        const statsResponse = await fetch(`${this.baseUrl}/api/v1/exchangeStats`);
        const statsData = statsResponse.ok ? await statsResponse.json() : null;

        lighterRates.forEach((rate: any) => {
          const symbol = rate.symbol;
          const now = Date.now();

          // Find mark price from stats
          let markPrice = 0;
          if (statsData && statsData.order_book_stats) {
            const stat = statsData.order_book_stats.find((s: any) => s.symbol === symbol);
            if (stat) {
              markPrice = parseFloat(stat.last_trade_price || '0');
            }
          }

          const fundingData: LighterFundingData = {
            symbol,
            fundingRate: rate.rate, // Hourly rate
            markPrice,
            indexPrice: markPrice,
            premium: 0,
            timestamp: now,
            nextFundingTime: now + (3600000 - (now % 3600000)), // Next hour mark
          };

          fundingRates.set(symbol, fundingData);
          this.fundingCache.set(symbol, fundingData);
        });

        console.log(`[Lighter] Fetched ${fundingRates.size} funding rates`);
      }
    } catch (error) {
      console.error('[Lighter] Error fetching all funding rates:', error);
    }

    return fundingRates;
  }

  /**
   * Get funding rate for a specific market
   * Uses the /api/v1/funding-rates endpoint and filters for the specific symbol
   */
  async getFundingRate(symbol: string): Promise<LighterFundingData | null> {
    try {
      // Check cache first
      const cached = this.fundingCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached;
      }

      // Fetch all funding rates (they're all returned in one call anyway)
      const response = await fetch(`${this.baseUrl}/api/v1/funding-rates`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.funding_rates && Array.isArray(data.funding_rates)) {
        // Find the funding rate for this symbol on Lighter exchange
        const lighterRate = data.funding_rates.find(
          (rate: any) => rate.exchange === 'lighter' && rate.symbol === symbol
        );

        if (!lighterRate) {
          return null;
        }

        // Get mark price from exchange stats
        const statsResponse = await fetch(`${this.baseUrl}/api/v1/exchangeStats`);
        let markPrice = 0;

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          const stat = statsData.order_book_stats?.find((s: any) => s.symbol === symbol);
          if (stat) {
            markPrice = parseFloat(stat.last_trade_price || '0');
          }
        }

        const now = Date.now();
        const fundingData: LighterFundingData = {
          symbol,
          fundingRate: lighterRate.rate, // Hourly rate
          markPrice,
          indexPrice: markPrice,
          premium: 0,
          timestamp: now,
          nextFundingTime: now + (3600000 - (now % 3600000)), // Next hour mark
        };

        // Cache the result
        this.fundingCache.set(symbol, fundingData);
        return fundingData;
      }

      return null;
    } catch (error) {
      console.error(`[Lighter] Error fetching funding for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get historical funding rates
   */
  async getHistoricalFunding(
    symbol: string,
    hours: number = 24
  ): Promise<LighterFundingData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/fundings?market=${symbol}&limit=${hours}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch historical funding: ${response.statusText}`);
      }

      const data = await response.json();
      const history: LighterFundingData[] = [];

      if (data.fundings && Array.isArray(data.fundings)) {
        data.fundings.forEach((funding: any) => {
          history.push({
            symbol,
            fundingRate: parseFloat(funding.funding_rate),
            markPrice: parseFloat(funding.mark_price),
            indexPrice: parseFloat(funding.index_price),
            premium: parseFloat(funding.premium || '0'),
            timestamp: funding.timestamp,
            nextFundingTime: funding.timestamp + 3600000,
          });
        });
      }

      return history;
    } catch (error) {
      console.error(`[Lighter] Error fetching historical funding for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get order book for a market
   */
  async getOrderBook(symbol: string, depth: number = 20): Promise<LighterOrderBook | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/orderbook?market=${symbol}&depth=${depth}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        symbol,
        bids: data.bids?.map((b: any) => ({
          price: parseFloat(b.price),
          size: parseFloat(b.size),
        })) || [],
        asks: data.asks?.map((a: any) => ({
          price: parseFloat(a.price),
          size: parseFloat(a.size),
        })) || [],
        timestamp: data.timestamp || Date.now(),
      };
    } catch (error) {
      console.error(`[Lighter] Error fetching order book for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(symbol: string, limit: number = 100): Promise<LighterTrade[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/trades?market=${symbol}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trades: ${response.statusText}`);
      }

      const data = await response.json();
      const trades: LighterTrade[] = [];

      if (data.trades && Array.isArray(data.trades)) {
        data.trades.forEach((trade: any) => {
          trades.push({
            price: parseFloat(trade.price),
            size: parseFloat(trade.size),
            side: trade.is_bid ? 'buy' : 'sell',
            timestamp: trade.timestamp,
          });
        });
      }

      return trades;
    } catch (error) {
      console.error(`[Lighter] Error fetching trades for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get market statistics
   */
  async getMarketStats(symbol: string): Promise<LighterMarketStats | null> {
    try {
      // Get order book for current price
      const orderBook = await this.getOrderBook(symbol, 1);

      // Get recent trades for 24h stats
      const trades = await this.getRecentTrades(symbol, 1000);

      if (!orderBook || trades.length === 0) {
        return null;
      }

      const lastPrice = trades[0]?.price || 0;
      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const trades24h = trades.filter(t => t.timestamp >= cutoff24h);

      const volume24h = trades24h.reduce((sum, t) => sum + t.price * t.size, 0);
      const prices24h = trades24h.map(t => t.price);
      const high24h = Math.max(...prices24h);
      const low24h = Math.min(...prices24h);
      const firstPrice = trades24h[trades24h.length - 1]?.price || lastPrice;
      const priceChange24h = lastPrice - firstPrice;

      return {
        symbol,
        lastPrice,
        volume24h,
        priceChange24h,
        high24h,
        low24h,
        trades24h: trades24h.length,
      };
    } catch (error) {
      console.error(`[Lighter] Error fetching market stats for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate funding APR
   */
  async calculateFundingAPR(symbol: string, hours: number = 24): Promise<number> {
    try {
      const history = await this.getHistoricalFunding(symbol, hours);

      if (history.length === 0) {
        return 0;
      }

      // Calculate average hourly rate
      const avgHourly = history.reduce((sum, h) => sum + h.fundingRate, 0) / history.length;

      // Annualize: hourly * 24 hours * 365 days
      const apr = avgHourly * 24 * 365 * 100; // Convert to percentage

      return apr;
    } catch (error) {
      console.error(`[Lighter] Error calculating APR for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Get exchange-wide statistics
   */
  async getExchangeStats(): Promise<{
    totalVolume24h: number;
    totalTrades24h: number;
    activeMarkets: number;
  }> {
    try {
      const stats = {
        totalVolume24h: 0,
        totalTrades24h: 0,
        activeMarkets: this.markets.size,
      };

      // Aggregate stats from all markets (sample a few major ones for performance)
      const majorMarkets = ['BTC-USDC', 'ETH-USDC', 'SOL-USDC', 'ARB-USDC', 'OP-USDC'];

      for (const symbol of majorMarkets) {
        if (this.markets.has(symbol)) {
          const marketStats = await this.getMarketStats(symbol);
          if (marketStats) {
            stats.totalVolume24h += marketStats.volume24h;
            stats.totalTrades24h += marketStats.trades24h;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('[Lighter] Error fetching exchange stats:', error);
      return {
        totalVolume24h: 0,
        totalTrades24h: 0,
        activeMarkets: this.markets.size,
      };
    }
  }

  /**
   * Get all markets
   */
  getMarkets(): Map<string, LighterMarket> {
    return this.markets;
  }

  /**
   * Get market info
   */
  getMarket(symbol: string): LighterMarket | undefined {
    return this.markets.get(symbol);
  }

  /**
   * Check if market exists
   */
  hasMarket(symbol: string): boolean {
    return this.markets.has(symbol);
  }

  /**
   * Clear funding cache
   */
  clearCache(): void {
    this.fundingCache.clear();
  }
}

// Export singleton instance
export const lighterService = new LighterService();
export default lighterService;
