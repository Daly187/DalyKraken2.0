import { logger } from '../utils/logger.js';
import { krakenService } from './krakenService.js';
import { dataStore } from './dataStore.js';

/**
 * Market Scanner Service
 * Analyzes market data and scores potential DCA candidates
 */
class ScannerService {
  constructor() {
    this.scoringWeights = {
      volatility: 0.25,
      volume: 0.20,
      trend: 0.25,
      momentum: 0.15,
      support: 0.15,
    };
  }

  /**
   * Scan market for DCA opportunities
   */
  async scanForDCAOpportunities(criteria = {}) {
    try {
      logger.info('Scanning market for DCA opportunities');

      const {
        minScore = 60,
        maxAssets = 20,
        excludeAssets = [],
        includeOnlyAssets = null,
      } = criteria;

      // Get market data
      const prices = await krakenService.getCurrentPrices();
      const top20 = await krakenService.getTop20Assets();

      // Score each asset
      const opportunities = [];

      for (const asset of top20) {
        // Skip excluded assets
        if (excludeAssets.includes(asset.asset)) {
          continue;
        }

        // If includeOnly is specified, only score those
        if (includeOnlyAssets && !includeOnlyAssets.includes(asset.asset)) {
          continue;
        }

        const score = await this.scoreAsset(asset);

        if (score.total >= minScore) {
          opportunities.push({
            asset: asset.asset,
            price: asset.price,
            score: score.total,
            breakdown: score.breakdown,
            recommendation: this.getRecommendation(score.total),
            suggestedAmount: this.calculateSuggestedAmount(asset, score.total),
          });
        }
      }

      // Sort by score
      opportunities.sort((a, b) => b.score - a.score);

      // Limit results
      const results = opportunities.slice(0, maxAssets);

      logger.info(`Found ${results.length} DCA opportunities`);

      return {
        opportunities: results,
        scannedAt: new Date().toISOString(),
        criteria: {
          minScore,
          maxAssets,
          excludeAssets,
        },
      };
    } catch (error) {
      logger.error('Error scanning for DCA opportunities:', error);
      throw error;
    }
  }

  /**
   * Get bot scores for potential DCA candidates
   */
  async getBotScores(limit = 20) {
    try {
      logger.info('Fetching bot scores');

      // Check cache
      const cached = dataStore.get('bot_scores');
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
        return cached.data;
      }

      const top20 = await krakenService.getTop20Assets();
      const scores = [];

      for (const asset of top20.slice(0, limit)) {
        const score = await this.scoreAsset(asset);

        scores.push({
          asset: asset.asset,
          price: asset.price,
          change24h: asset.change24h,
          volume24h: asset.volume24h,
          botScore: score.total,
          breakdown: score.breakdown,
          signals: this.generateSignals(score),
          recommendation: this.getRecommendation(score.total),
        });
      }

      // Sort by bot score
      scores.sort((a, b) => b.botScore - a.botScore);

      const result = {
        scores,
        generatedAt: new Date().toISOString(),
      };

      // Cache results
      dataStore.set('bot_scores', result, 300000);

      return result;
    } catch (error) {
      logger.error('Error fetching bot scores:', error);
      throw error;
    }
  }

  /**
   * Score an individual asset
   */
  async scoreAsset(asset) {
    try {
      // Calculate component scores
      const volatilityScore = this.calculateVolatilityScore(asset);
      const volumeScore = this.calculateVolumeScore(asset);
      const trendScore = await this.calculateTrendScore(asset);
      const momentumScore = this.calculateMomentumScore(asset);
      const supportScore = this.calculateSupportScore(asset);

      // Calculate weighted total
      const total = Math.round(
        (volatilityScore * this.scoringWeights.volatility) +
        (volumeScore * this.scoringWeights.volume) +
        (trendScore * this.scoringWeights.trend) +
        (momentumScore * this.scoringWeights.momentum) +
        (supportScore * this.scoringWeights.support)
      );

      return {
        total: Math.min(100, Math.max(0, total)),
        breakdown: {
          volatility: Math.round(volatilityScore),
          volume: Math.round(volumeScore),
          trend: Math.round(trendScore),
          momentum: Math.round(momentumScore),
          support: Math.round(supportScore),
        },
      };
    } catch (error) {
      logger.error(`Error scoring asset ${asset.asset}:`, error);
      // Return neutral score on error
      return {
        total: 50,
        breakdown: {
          volatility: 50,
          volume: 50,
          trend: 50,
          momentum: 50,
          support: 50,
        },
      };
    }
  }

  /**
   * Calculate volatility score
   * Lower volatility = better for DCA
   */
  calculateVolatilityScore(asset) {
    const change = Math.abs(asset.change24h || 0);

    if (change < 2) return 90;
    if (change < 5) return 75;
    if (change < 10) return 60;
    if (change < 15) return 45;
    if (change < 20) return 30;
    return 20;
  }

  /**
   * Calculate volume score
   * Higher volume = better liquidity
   */
  calculateVolumeScore(asset) {
    const volume = asset.volume24h || 0;

    if (volume > 1000000000) return 95; // $1B+
    if (volume > 500000000) return 85;  // $500M+
    if (volume > 100000000) return 75;  // $100M+
    if (volume > 50000000) return 65;   // $50M+
    if (volume > 10000000) return 50;   // $10M+
    return 30;
  }

  /**
   * Calculate trend score
   * Upward trend = better for DCA
   */
  async calculateTrendScore(asset) {
    // In production, this would analyze historical price data
    // For now, use 24h change as a proxy
    const change = asset.change24h || 0;

    if (change > 10) return 95;
    if (change > 5) return 85;
    if (change > 2) return 75;
    if (change > 0) return 65;
    if (change > -2) return 55;
    if (change > -5) return 40;
    return 25;
  }

  /**
   * Calculate momentum score
   */
  calculateMomentumScore(asset) {
    // Mock calculation - in production, use RSI, MACD, etc.
    const change = asset.change24h || 0;

    // Positive momentum
    if (change > 5) return 85;
    if (change > 2) return 75;
    if (change > 0) return 65;

    // Negative momentum (can be good for DCA entry)
    if (change > -2) return 70; // Slight dip = good entry
    if (change > -5) return 60;
    return 45;
  }

  /**
   * Calculate support score
   * Price near support levels = better entry
   */
  calculateSupportScore(asset) {
    // Mock calculation - in production, analyze support/resistance levels
    // For now, return a value between 40-90
    return 50 + Math.random() * 40;
  }

  /**
   * Generate trading signals
   */
  generateSignals(score) {
    const signals = [];

    if (score.breakdown.volatility > 70) {
      signals.push({
        type: 'positive',
        indicator: 'Low Volatility',
        message: 'Stable price action favorable for DCA',
      });
    }

    if (score.breakdown.volume > 70) {
      signals.push({
        type: 'positive',
        indicator: 'High Volume',
        message: 'Good liquidity for entries',
      });
    }

    if (score.breakdown.trend > 70) {
      signals.push({
        type: 'positive',
        indicator: 'Uptrend',
        message: 'Positive price momentum',
      });
    }

    if (score.breakdown.momentum > 70) {
      signals.push({
        type: 'positive',
        indicator: 'Strong Momentum',
        message: 'Building bullish momentum',
      });
    }

    if (score.breakdown.support > 70) {
      signals.push({
        type: 'positive',
        indicator: 'Near Support',
        message: 'Good entry point near support level',
      });
    }

    // Warning signals
    if (score.breakdown.volatility < 40) {
      signals.push({
        type: 'warning',
        indicator: 'High Volatility',
        message: 'Increased price volatility',
      });
    }

    if (score.breakdown.volume < 40) {
      signals.push({
        type: 'warning',
        indicator: 'Low Volume',
        message: 'Lower liquidity may affect execution',
      });
    }

    return signals;
  }

  /**
   * Get recommendation based on score
   */
  getRecommendation(score) {
    if (score >= 80) return 'STRONG_BUY';
    if (score >= 70) return 'BUY';
    if (score >= 60) return 'MODERATE_BUY';
    if (score >= 50) return 'HOLD';
    if (score >= 40) return 'CAUTION';
    return 'AVOID';
  }

  /**
   * Calculate suggested DCA amount based on score and asset
   */
  calculateSuggestedAmount(asset, score) {
    // Base amount on score
    let baseAmount = 100; // $100 default

    if (score >= 80) {
      baseAmount = 200;
    } else if (score >= 70) {
      baseAmount = 150;
    } else if (score >= 60) {
      baseAmount = 100;
    } else {
      baseAmount = 50;
    }

    return {
      suggested: baseAmount,
      min: baseAmount * 0.5,
      max: baseAmount * 2,
      currency: 'USD',
    };
  }

  /**
   * Analyze specific asset for DCA suitability
   */
  async analyzeAsset(assetSymbol) {
    try {
      logger.info(`Analyzing asset: ${assetSymbol}`);

      const prices = await krakenService.getCurrentPrices([assetSymbol]);
      const top20 = await krakenService.getTop20Assets();

      const asset = top20.find(a => a.asset === assetSymbol);

      if (!asset) {
        throw new Error(`Asset ${assetSymbol} not found`);
      }

      const score = await this.scoreAsset(asset);
      const signals = this.generateSignals(score);
      const recommendation = this.getRecommendation(score.total);
      const suggestedAmount = this.calculateSuggestedAmount(asset, score.total);

      return {
        asset: assetSymbol,
        price: asset.price,
        change24h: asset.change24h,
        volume24h: asset.volume24h,
        score: score.total,
        breakdown: score.breakdown,
        signals,
        recommendation,
        suggestedAmount,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error analyzing asset ${assetSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Get market sentiment
   */
  async getMarketSentiment() {
    try {
      logger.info('Analyzing market sentiment');

      const top20 = await krakenService.getTop20Assets();

      // Calculate overall sentiment metrics
      const positiveAssets = top20.filter(a => (a.change24h || 0) > 0).length;
      const negativeAssets = top20.filter(a => (a.change24h || 0) < 0).length;
      const avgChange = top20.reduce((sum, a) => sum + (a.change24h || 0), 0) / top20.length;

      let sentiment;
      if (avgChange > 5) sentiment = 'VERY_BULLISH';
      else if (avgChange > 2) sentiment = 'BULLISH';
      else if (avgChange > -2) sentiment = 'NEUTRAL';
      else if (avgChange > -5) sentiment = 'BEARISH';
      else sentiment = 'VERY_BEARISH';

      return {
        sentiment,
        metrics: {
          avgChange: avgChange.toFixed(2),
          positiveAssets,
          negativeAssets,
          neutralAssets: top20.length - positiveAssets - negativeAssets,
        },
        recommendation: this.getSentimentRecommendation(sentiment),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error analyzing market sentiment:', error);
      throw error;
    }
  }

  /**
   * Get recommendation based on sentiment
   */
  getSentimentRecommendation(sentiment) {
    const recommendations = {
      VERY_BULLISH: 'Strong market - consider increasing DCA amounts',
      BULLISH: 'Positive market - good time for DCA',
      NEUTRAL: 'Mixed market - maintain regular DCA schedule',
      BEARISH: 'Negative market - DCA can accumulate at lower prices',
      VERY_BEARISH: 'Very negative market - DCA provides strong accumulation opportunity',
    };

    return recommendations[sentiment] || 'Monitor market conditions';
  }
}

// Export singleton instance
export const scannerService = new ScannerService();

// Export class for testing
export { ScannerService };
