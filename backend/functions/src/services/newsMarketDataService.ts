/**
 * News Market Data Service
 * Fetches Fear & Greed Index, top movers, and market overview for news page
 */

import { Firestore } from 'firebase-admin/firestore';

export interface FearGreedData {
  value: number;
  label: string;
  timestamp: string;
  previousClose?: number;
  change?: number;
}

export interface TopMover {
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number;
  volume24h: number;
  image?: string;
}

export interface MarketOverview {
  fearGreedIndex: number;
  fearGreedLabel: string;
  btcDominance: number;
  totalMarketCap: number;
  totalVolume24h: number;
  marketCapChange24h: number;
  topGainers: TopMover[];
  topLosers: TopMover[];
  timestamp: string;
}

export class NewsMarketDataService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Fetch Fear & Greed Index from Alternative.me API
   */
  async getFearGreedIndex(): Promise<FearGreedData> {
    console.log('[MarketData] Fetching Fear & Greed Index...');

    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=2');
      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error('No Fear & Greed data returned');
      }

      const current = data.data[0];
      const previous = data.data[1];

      const value = parseInt(current.value, 10);
      const previousValue = previous ? parseInt(previous.value, 10) : value;

      return {
        value,
        label: current.value_classification,
        timestamp: new Date(parseInt(current.timestamp, 10) * 1000).toISOString(),
        previousClose: previousValue,
        change: value - previousValue,
      };
    } catch (error: any) {
      console.error('[MarketData] Error fetching Fear & Greed:', error.message);
      // Return default values on error
      return {
        value: 50,
        label: 'Neutral',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get top gainers and losers from CoinGecko
   */
  async getTopMovers(limit: number = 5): Promise<{ gainers: TopMover[], losers: TopMover[] }> {
    console.log('[MarketData] Fetching top movers from CoinGecko (top 200 by market cap)...');

    try {
      // Fetch top 200 coins by market cap (CoinGecko allows up to 250 per page)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?' +
        'vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false&price_change_percentage=24h'
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const coins = await response.json();

      // Sort by 24h change
      const sortedByChange = [...coins].sort(
        (a: any, b: any) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
      );

      const mapCoin = (coin: any): TopMover => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price || 0,
        changePercent24h: coin.price_change_percentage_24h || 0,
        volume24h: coin.total_volume || 0,
        image: coin.image,
      });

      const gainers = sortedByChange.slice(0, limit).map(mapCoin);
      const losers = sortedByChange.slice(-limit).reverse().map(mapCoin);

      return { gainers, losers };
    } catch (error: any) {
      console.error('[MarketData] Error fetching top movers:', error.message);
      return { gainers: [], losers: [] };
    }
  }

  /**
   * Get overall market data from CoinGecko
   */
  async getGlobalMarketData(): Promise<{
    btcDominance: number;
    totalMarketCap: number;
    totalVolume24h: number;
    marketCapChange24h: number;
  }> {
    console.log('[MarketData] Fetching global market data...');

    try {
      const response = await fetch('https://api.coingecko.com/api/v3/global');

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const globalData = data.data;

      return {
        btcDominance: globalData.market_cap_percentage?.btc || 0,
        totalMarketCap: globalData.total_market_cap?.usd || 0,
        totalVolume24h: globalData.total_volume?.usd || 0,
        marketCapChange24h: globalData.market_cap_change_percentage_24h_usd || 0,
      };
    } catch (error: any) {
      console.error('[MarketData] Error fetching global data:', error.message);
      return {
        btcDominance: 0,
        totalMarketCap: 0,
        totalVolume24h: 0,
        marketCapChange24h: 0,
      };
    }
  }

  /**
   * Get complete market overview
   */
  async getMarketOverview(): Promise<MarketOverview> {
    console.log('[MarketData] Fetching complete market overview...');

    // Fetch all data in parallel
    const [fearGreed, movers, globalData] = await Promise.all([
      this.getFearGreedIndex(),
      this.getTopMovers(),
      this.getGlobalMarketData(),
    ]);

    return {
      fearGreedIndex: fearGreed.value,
      fearGreedLabel: fearGreed.label,
      btcDominance: globalData.btcDominance,
      totalMarketCap: globalData.totalMarketCap,
      totalVolume24h: globalData.totalVolume24h,
      marketCapChange24h: globalData.marketCapChange24h,
      topGainers: movers.gainers,
      topLosers: movers.losers,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Store market overview for a specific date
   */
  async storeMarketData(date: string, data: MarketOverview): Promise<void> {
    console.log(`[MarketData] Storing market data for ${date}`);

    await this.db.collection('dailyNews').doc(date).set({
      date,
      marketOverview: data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  /**
   * Get stored market data for a date
   */
  async getStoredMarketData(date: string): Promise<MarketOverview | null> {
    const doc = await this.db.collection('dailyNews').doc(date).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data()?.marketOverview || null;
  }
}
