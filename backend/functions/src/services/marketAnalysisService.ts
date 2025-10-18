/**
 * Market Analysis Service
 * Provides technical analysis and trend scoring
 */

import { TrendAnalysis } from '../types';
import { KrakenService } from './krakenService';

export class MarketAnalysisService {
  private krakenService: KrakenService;

  constructor() {
    this.krakenService = new KrakenService();
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * Calculate Moving Average
   */
  private calculateMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = this.calculateMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // For signal line, we'd need to calculate EMA of MACD values
    // Simplified version for now
    const signal = macd * 0.9;
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  /**
   * Detect support and resistance levels
   */
  private detectSupportResistance(ohlcData: any[]): { support: number | null; resistance: number | null } {
    if (ohlcData.length < 20) {
      return { support: null, resistance: null };
    }

    const lows = ohlcData.map((d) => parseFloat(d[3]));
    const highs = ohlcData.map((d) => parseFloat(d[2]));

    // Simple support/resistance detection
    // Look for recent lows and highs
    const recentLows = lows.slice(-20);
    const recentHighs = highs.slice(-20);

    const support = Math.min(...recentLows);
    const resistance = Math.max(...recentHighs);

    return { support, resistance };
  }

  /**
   * Calculate technical score (0-100)
   */
  private calculateTechnicalScore(
    currentPrice: number,
    prices: number[],
    ohlcData: any[]
  ): number {
    let score = 50; // Neutral start

    // RSI Analysis (30 points max)
    const rsi = this.calculateRSI(prices);
    if (rsi < 30) {
      score += 15; // Oversold - bullish
    } else if (rsi > 70) {
      score -= 15; // Overbought - bearish
    } else if (rsi >= 40 && rsi <= 60) {
      score += 5; // Neutral zone - slightly bullish
    }

    // Moving Average Analysis (30 points max)
    const ma20 = this.calculateMA(prices, 20);
    const ma50 = this.calculateMA(prices, 50);

    if (currentPrice > ma20 && ma20 > ma50) {
      score += 15; // Strong uptrend
    } else if (currentPrice > ma20) {
      score += 10; // Mild uptrend
    } else if (currentPrice < ma20 && ma20 < ma50) {
      score -= 15; // Strong downtrend
    } else if (currentPrice < ma20) {
      score -= 10; // Mild downtrend
    }

    // MACD Analysis (20 points max)
    const { macd, signal, histogram } = this.calculateMACD(prices);
    if (histogram > 0 && macd > signal) {
      score += 10; // Bullish momentum
    } else if (histogram < 0 && macd < signal) {
      score -= 10; // Bearish momentum
    }

    // Volume trend (20 points max)
    if (ohlcData.length >= 2) {
      const currentVolume = parseFloat(ohlcData[ohlcData.length - 1][6]);
      const avgVolume = ohlcData.slice(-10).reduce((sum, d) => sum + parseFloat(d[6]), 0) / 10;

      if (currentVolume > avgVolume * 1.5) {
        score += 10; // High volume - strong signal
      } else if (currentVolume < avgVolume * 0.5) {
        score -= 5; // Low volume - weak signal
      }
    }

    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate trend score (0-100)
   */
  private calculateTrendScore(prices: number[]): number {
    if (prices.length < 20) return 50;

    let score = 50;

    // Short-term trend (last 5 periods)
    const shortTerm = prices.slice(-5);
    const shortTrendUp = shortTerm.every((price, i) => i === 0 || price >= shortTerm[i - 1]);
    const shortTrendDown = shortTerm.every((price, i) => i === 0 || price <= shortTerm[i - 1]);

    if (shortTrendUp) score += 20;
    else if (shortTrendDown) score -= 20;

    // Medium-term trend (last 20 periods)
    const mediumStart = prices[prices.length - 20];
    const mediumEnd = prices[prices.length - 1];
    const mediumChange = ((mediumEnd - mediumStart) / mediumStart) * 100;

    if (mediumChange > 5) score += 15;
    else if (mediumChange > 2) score += 10;
    else if (mediumChange < -5) score -= 15;
    else if (mediumChange < -2) score -= 10;

    // Price position relative to recent range
    const recentHigh = Math.max(...prices.slice(-20));
    const recentLow = Math.min(...prices.slice(-20));
    const currentPosition = (prices[prices.length - 1] - recentLow) / (recentHigh - recentLow);

    if (currentPosition > 0.8) score += 15;
    else if (currentPosition > 0.6) score += 10;
    else if (currentPosition < 0.2) score -= 15;
    else if (currentPosition < 0.4) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get comprehensive trend analysis for a symbol
   */
  async analyzeTrend(symbol: string): Promise<TrendAnalysis> {
    try {
      // Get OHLC data (1-hour intervals, last 100 periods)
      const ohlcData = await this.krakenService.getOHLC(symbol, 60);

      // Extract closing prices
      const closingPrices = ohlcData.map((d) => parseFloat(d[4]));
      const currentPrice = closingPrices[closingPrices.length - 1];

      // Calculate technical and trend scores
      const techScore = this.calculateTechnicalScore(currentPrice, closingPrices, ohlcData);
      const trendScore = this.calculateTrendScore(closingPrices);

      // Detect support and resistance
      const { support, resistance } = this.detectSupportResistance(ohlcData);

      // Determine overall recommendation
      let recommendation: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      const avgScore = (techScore + trendScore) / 2;

      if (avgScore >= 60) {
        recommendation = 'bullish';
      } else if (avgScore <= 40) {
        recommendation = 'bearish';
      }

      return {
        symbol,
        techScore,
        trendScore,
        support,
        resistance,
        recommendation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[MarketAnalysisService] Error analyzing trend:', error);

      // Return neutral analysis on error
      return {
        symbol,
        techScore: 50,
        trendScore: 50,
        support: null,
        resistance: null,
        recommendation: 'neutral',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if conditions are met for entry
   */
  async shouldEnter(
    symbol: string,
    currentPrice: number,
    supportResistanceEnabled: boolean,
    trendAlignmentEnabled: boolean,
    lastSupport: number | null
  ): Promise<{ shouldEnter: boolean; reason: string; analysis: TrendAnalysis }> {
    const analysis = await this.analyzeTrend(symbol);

    // Check trend alignment if enabled
    if (trendAlignmentEnabled) {
      if (analysis.techScore < 50 || analysis.trendScore < 50) {
        return {
          shouldEnter: false,
          reason: 'Trend alignment not bullish',
          analysis,
        };
      }
    }

    // Check support/resistance if enabled
    if (supportResistanceEnabled && analysis.support) {
      if (lastSupport === null) {
        // First entry - need to cross support first
        if (currentPrice > analysis.support) {
          return {
            shouldEnter: false,
            reason: 'Waiting for support cross',
            analysis,
          };
        }
      }
    }

    return {
      shouldEnter: true,
      reason: 'All entry conditions met',
      analysis,
    };
  }

  /**
   * Check if conditions are met for exit
   */
  async shouldExit(
    symbol: string,
    currentPrice: number,
    averagePrice: number,
    tpTarget: number,
    minTpPrice: number
  ): Promise<{ shouldExit: boolean; reason: string; analysis: TrendAnalysis }> {
    const analysis = await this.analyzeTrend(symbol);

    // Check if price is above minimum TP
    if (currentPrice >= minTpPrice) {
      // Price is above min TP, check if trend is turning bearish
      if (analysis.techScore < 40 && analysis.trendScore < 40) {
        return {
          shouldExit: true,
          reason: 'Price above TP and trend turning bearish',
          analysis,
        };
      }

      // Price dropped back to min TP
      if (currentPrice <= minTpPrice * 1.005) {
        // Within 0.5% of min TP
        return {
          shouldExit: true,
          reason: 'Price dropped back to minimum TP',
          analysis,
        };
      }

      return {
        shouldExit: false,
        reason: 'Price above TP but trend still bullish',
        analysis,
      };
    }

    return {
      shouldExit: false,
      reason: 'Price below minimum TP target',
      analysis,
    };
  }
}

export default MarketAnalysisService;
