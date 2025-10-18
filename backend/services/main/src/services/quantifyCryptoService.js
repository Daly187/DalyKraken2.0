import axios from 'axios';
import { logger } from '../utils/logger.js';
import { settingsStore } from './settingsStore.js';

/**
 * Service for interacting with Quantify Crypto API
 * Provides enhanced crypto market data with technical analysis
 */
class QuantifyCryptoService {
  constructor() {
    this.baseUrl = 'https://api.quantifycrypto.com/v1';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get API key from settings store or environment variable
   */
  getApiKey() {
    // Try settings store first (from UI settings)
    const settingsKey = settingsStore.getActiveQuantifyCryptoKey();
    if (settingsKey) {
      logger.debug('Using Quantify Crypto API key from settings');
      return settingsKey;
    }

    // Fall back to environment variable
    if (process.env.QUANTIFY_CRYPTO_API_KEY) {
      logger.debug('Using Quantify Crypto API key from environment');
      return process.env.QUANTIFY_CRYPTO_API_KEY;
    }

    return null;
  }

  /**
   * Get enhanced trend data with technical analysis
   * @param {number} limit - Number of cryptocurrencies to fetch
   * @returns {Promise<Object>} Enhanced trend data
   */
  async getEnhancedTrends(limit = 20) {
    try {
      const apiKey = this.getApiKey();

      if (!apiKey) {
        logger.warn('Quantify Crypto API key not configured, using mock data');
        return this.getMockEnhancedTrends(limit);
      }

      const response = await this.client.get('/trends/enhanced', {
        params: { limit },
        headers: {
          'X-API-Key': apiKey,
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Error fetching enhanced trends from Quantify Crypto:', error.message);

      // Fallback to mock data if API fails
      logger.info('Falling back to mock enhanced trends data');
      return this.getMockEnhancedTrends(limit);
    }
  }

  /**
   * Generate mock enhanced trend data for testing/development
   * @param {number} limit - Number of mock entries to generate
   * @returns {Object} Mock enhanced trend data
   */
  getMockEnhancedTrends(limit = 20) {
    const symbols = [
      'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK',
      'UNI', 'ATOM', 'ALGO', 'XLM', 'VET', 'FIL', 'AAVE', 'SNX',
      'SAND', 'MANA', 'CRV', 'COMP', 'YFI', 'SUSHI', 'GRT', 'ENJ'
    ];

    const trends = symbols.slice(0, limit).map((symbol, index) => {
      const basePrice = Math.random() * 1000 + 10;
      const change24h = (Math.random() - 0.5) * 20; // -10% to +10%
      const rsi = Math.random() * 100;
      const volatility = Math.random() * 100;

      // Calculate trend score based on RSI and momentum
      const trendScore = Math.min(100, Math.max(0,
        (rsi * 0.5) +
        ((change24h + 10) * 2) +
        (Math.random() * 10)
      ));

      // Calculate technical score
      const technicalScore = Math.min(100, Math.max(0,
        (rsi * 0.4) +
        ((change24h + 10) * 2.5) +
        (Math.random() * 20)
      ));

      // Determine trend signal
      let trendSignal = 'neutral';
      if (change24h > 2) trendSignal = 'bullish';
      else if (change24h < -2) trendSignal = 'bearish';

      // Determine MACD state
      let macdState = 'neutral';
      if (trendScore > 60) macdState = 'bullish';
      else if (trendScore < 40) macdState = 'bearish';

      return {
        symbol,
        price: basePrice,
        change_24h_percent: change24h,
        volume_24h: Math.random() * 1000000000,
        trend_score: trendScore,
        technical_score: technicalScore,
        support_level: basePrice * (0.9 - Math.random() * 0.1),
        resistance_level: basePrice * (1.1 + Math.random() * 0.2),
        momentum: rsi,
        volatility: volatility,
        rsi: rsi,
        macd_state: macdState,
        trend_signal: trendSignal,
        sma_50: basePrice * (0.95 + Math.random() * 0.1),
        sma_200: basePrice * (0.9 + Math.random() * 0.15),
        golden_cross: Math.random() > 0.8,
      };
    });

    // Sort by trend score descending
    trends.sort((a, b) => b.trend_score - a.trend_score);

    // Calculate market overview
    const totalMarketCap = trends.reduce((sum, t) => sum + (t.price * Math.random() * 1000000), 0);
    const totalVolume24h = trends.reduce((sum, t) => sum + t.volume_24h, 0);

    // Get top gainers and losers
    const sortedByChange = [...trends].sort((a, b) => b.change_24h_percent - a.change_24h_percent);
    const topGainers = sortedByChange.slice(0, 5).map(t => ({
      symbol: t.symbol,
      name: `${t.symbol} Token`,
      price: t.price,
      change_24h_percent: t.change_24h_percent,
      volume_24h: t.volume_24h,
    }));

    const topLosers = sortedByChange.slice(-5).reverse().map(t => ({
      symbol: t.symbol,
      name: `${t.symbol} Token`,
      price: t.price,
      change_24h_percent: t.change_24h_percent,
      volume_24h: t.volume_24h,
    }));

    return {
      success: true,
      data: {
        trends,
        overview: {
          total_market_cap: totalMarketCap,
          total_volume_24h: totalVolume24h,
          btc_dominance: 45 + Math.random() * 10,
          active_cryptos: limit,
          sentiment: 'neutral',
        },
        top_gainers: topGainers,
        top_losers: topLosers,
      },
    };
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      const apiKey = this.getApiKey();

      if (!apiKey) {
        return {
          success: false,
          error: 'API key not configured',
        };
      }

      const response = await this.client.get('/health', {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      return {
        success: true,
        message: 'Connection successful',
        data: response.data,
      };
    } catch (error) {
      logger.error('Quantify Crypto API test failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const quantifyCryptoService = new QuantifyCryptoService();
