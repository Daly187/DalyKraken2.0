/**
 * Three-Way Funding Rate Arbitrage Service
 * Compares funding rates across AsterDEX, HyperLiquid, and Lighter
 *
 * Strategy: Identify funding rate spreads and execute long/short positions
 * to capture the delta between exchanges.
 */

import {
  unifiedSymbolMapper,
  type ExchangeSymbolMap,
  type FundingRateData,
  type ThreeWayArbitrageOpportunity,
} from './unifiedSymbolMapping';
import type { LighterFundingData } from './lighterService';

export interface ArbitrageMetrics {
  totalOpportunities: number;
  avgSpread: number;
  maxSpread: number;
  bestOpportunity: ThreeWayArbitrageOpportunity | null;
  byExchangePair: {
    'aster-hyperliquid': number;
    'aster-lighter': number;
    'hyperliquid-lighter': number;
  };
}

export interface ExchangeFundingRates {
  aster: Map<string, any>; // Symbol -> funding data
  hyperliquid: Map<string, any>;
  lighter: Map<string, LighterFundingData>;
}

class ThreeWayArbitrageService {
  private opportunities: Map<string, ThreeWayArbitrageOpportunity>;
  private lastUpdate: number = 0;
  private updateInterval: number = 60000; // 1 minute

  constructor() {
    this.opportunities = new Map();
  }

  /**
   * Analyze funding rates across all three exchanges
   */
  analyzeOpportunities(
    asterRates: Map<string, any>,
    hlRates: Map<string, any>,
    lighterRates: Map<string, LighterFundingData>
  ): ThreeWayArbitrageOpportunity[] {
    const opportunities: ThreeWayArbitrageOpportunity[] = [];
    const now = Date.now();

    // Get all mappings
    const allMappings = unifiedSymbolMapper.getAllMappings();

    allMappings.forEach((mapping: ExchangeSymbolMap) => {
      const opportunity: ThreeWayArbitrageOpportunity = {
        canonical: mapping.canonical,
        name: mapping.name,
        allPairs: [],
      };

      // Collect funding data from each exchange
      if (mapping.aster) {
        const asterData = asterRates.get(mapping.aster);
        if (asterData) {
          // AsterDEX pays every 8 hours, normalize to hourly
          const hourlyRate = asterData.fundingRate / 8;
          opportunity.aster = {
            symbol: mapping.aster,
            exchange: 'aster',
            fundingRate: hourlyRate,
            annualRate: hourlyRate * 24 * 365 * 100,
            markPrice: asterData.markPrice || 0,
            indexPrice: asterData.indexPrice,
            nextFundingTime: asterData.nextFundingTime || now + 8 * 60 * 60 * 1000,
            paymentFrequency: '8hourly',
            rawRate: asterData.fundingRate,
          };
        }
      }

      if (mapping.hyperliquid) {
        const hlData = hlRates.get(mapping.hyperliquid);
        if (hlData) {
          // HyperLiquid pays hourly
          opportunity.hyperliquid = {
            symbol: mapping.hyperliquid,
            exchange: 'hyperliquid',
            fundingRate: hlData.funding_rate || 0,
            annualRate: (hlData.funding_rate || 0) * 24 * 365 * 100,
            markPrice: hlData.mark_price || 0,
            indexPrice: hlData.index_price,
            nextFundingTime: hlData.next_funding_time || now + 60 * 60 * 1000,
            paymentFrequency: 'hourly',
            rawRate: hlData.funding_rate || 0,
          };
        }
      }

      if (mapping.lighter) {
        const lighterData = lighterRates.get(mapping.lighter);
        if (lighterData) {
          // Lighter pays hourly
          opportunity.lighter = {
            symbol: mapping.lighter,
            exchange: 'lighter',
            fundingRate: lighterData.fundingRate,
            annualRate: lighterData.fundingRate * 24 * 365 * 100,
            markPrice: lighterData.markPrice,
            indexPrice: lighterData.indexPrice,
            nextFundingTime: lighterData.nextFundingTime,
            paymentFrequency: 'hourly',
            rawRate: lighterData.fundingRate,
          };
        }
      }

      // Calculate all possible arbitrage pairs
      const exchanges = ['aster', 'hyperliquid', 'lighter'] as const;
      let bestSpread = 0;
      let bestPair: ThreeWayArbitrageOpportunity['bestOpportunity'] = undefined;

      for (let i = 0; i < exchanges.length; i++) {
        for (let j = i + 1; j < exchanges.length; j++) {
          const ex1 = exchanges[i];
          const ex2 = exchanges[j];

          const rate1 = opportunity[ex1]?.fundingRate;
          const rate2 = opportunity[ex2]?.fundingRate;

          if (rate1 !== undefined && rate2 !== undefined) {
            const spread = Math.abs(rate1 - rate2);
            const spreadApr = spread * 24 * 365 * 100;

            // Determine which should be long and which should be short
            // Long the exchange with lower (more negative) funding
            // Short the exchange with higher (more positive) funding
            const longExchange = rate1 < rate2 ? ex1 : ex2;
            const shortExchange = rate1 < rate2 ? ex2 : ex1;
            const longRate = rate1 < rate2 ? rate1 : rate2;
            const shortRate = rate1 < rate2 ? rate2 : rate1;

            // Net funding received per hour
            // If long rate is negative, we receive |longRate|
            // If short rate is positive, we receive shortRate
            const netReceive = (shortRate > 0 ? shortRate : 0) + (longRate < 0 ? Math.abs(longRate) : 0);

            opportunity.allPairs.push({
              long: longExchange,
              short: shortExchange,
              spread,
              apr: spreadApr,
            });

            // Update best opportunity if this spread is larger
            if (spread > bestSpread) {
              bestSpread = spread;
              bestPair = {
                longExchange,
                shortExchange,
                spreadHourly: spread,
                spreadApr,
                netReceive,
                confidence: this.calculateConfidence(spread, opportunity),
              };
            }
          }
        }
      }

      // Only include opportunities where we have data from at least 2 exchanges
      const exchangeCount = [
        opportunity.aster,
        opportunity.hyperliquid,
        opportunity.lighter,
      ].filter(Boolean).length;

      if (exchangeCount >= 2) {
        opportunity.bestOpportunity = bestPair;
        opportunities.push(opportunity);
        this.opportunities.set(mapping.canonical, opportunity);
      }
    });

    // Sort by best spread
    opportunities.sort((a, b) => {
      const spreadA = a.bestOpportunity?.spreadApr || 0;
      const spreadB = b.bestOpportunity?.spreadApr || 0;
      return spreadB - spreadA;
    });

    this.lastUpdate = now;
    return opportunities;
  }

  /**
   * Calculate confidence level based on spread size and data quality
   */
  private calculateConfidence(
    spread: number,
    opportunity: ThreeWayArbitrageOpportunity
  ): 'high' | 'medium' | 'low' {
    // High confidence: large spread, data from all 3 exchanges
    const exchangeCount = [
      opportunity.aster,
      opportunity.hyperliquid,
      opportunity.lighter,
    ].filter(Boolean).length;

    const spreadApr = spread * 24 * 365 * 100;

    if (exchangeCount === 3 && spreadApr > 10) {
      return 'high';
    } else if (exchangeCount >= 2 && spreadApr > 5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get metrics summary
   */
  getMetrics(opportunities: ThreeWayArbitrageOpportunity[]): ArbitrageMetrics {
    const metrics: ArbitrageMetrics = {
      totalOpportunities: opportunities.length,
      avgSpread: 0,
      maxSpread: 0,
      bestOpportunity: null,
      byExchangePair: {
        'aster-hyperliquid': 0,
        'aster-lighter': 0,
        'hyperliquid-lighter': 0,
      },
    };

    if (opportunities.length === 0) {
      return metrics;
    }

    let totalSpread = 0;
    let maxSpread = 0;
    let bestOpp: ThreeWayArbitrageOpportunity | null = null;

    opportunities.forEach(opp => {
      if (opp.bestOpportunity) {
        const spread = opp.bestOpportunity.spreadApr;
        totalSpread += spread;

        if (spread > maxSpread) {
          maxSpread = spread;
          bestOpp = opp;
        }

        // Count by exchange pair
        const pair = `${opp.bestOpportunity.longExchange}-${opp.bestOpportunity.shortExchange}`;
        if (pair === 'aster-hyperliquid' || pair === 'hyperliquid-aster') {
          metrics.byExchangePair['aster-hyperliquid']++;
        } else if (pair === 'aster-lighter' || pair === 'lighter-aster') {
          metrics.byExchangePair['aster-lighter']++;
        } else if (pair === 'hyperliquid-lighter' || pair === 'lighter-hyperliquid') {
          metrics.byExchangePair['hyperliquid-lighter']++;
        }
      }
    });

    metrics.avgSpread = totalSpread / opportunities.length;
    metrics.maxSpread = maxSpread;
    metrics.bestOpportunity = bestOpp;

    return metrics;
  }

  /**
   * Filter opportunities by minimum spread
   */
  filterByMinSpread(
    opportunities: ThreeWayArbitrageOpportunity[],
    minAprSpread: number
  ): ThreeWayArbitrageOpportunity[] {
    return opportunities.filter(
      opp => (opp.bestOpportunity?.spreadApr || 0) >= minAprSpread
    );
  }

  /**
   * Filter opportunities by exchange availability
   */
  filterByExchanges(
    opportunities: ThreeWayArbitrageOpportunity[],
    requiredExchanges: Array<'aster' | 'hyperliquid' | 'lighter'>
  ): ThreeWayArbitrageOpportunity[] {
    return opportunities.filter(opp => {
      return requiredExchanges.every(ex => opp[ex] !== undefined);
    });
  }

  /**
   * Get opportunities for a specific asset
   */
  getOpportunityByCanonical(canonical: string): ThreeWayArbitrageOpportunity | undefined {
    return this.opportunities.get(canonical);
  }

  /**
   * Get all current opportunities
   */
  getAllOpportunities(): ThreeWayArbitrageOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  /**
   * Calculate position size recommendation based on available capital
   */
  calculatePositionSize(
    opportunity: ThreeWayArbitrageOpportunity,
    availableCapital: number,
    maxLeverage: number = 5
  ): {
    longExchange: string;
    shortExchange: string;
    notionalSize: number;
    requiredMargin: number;
    expectedHourlyReturn: number;
    expectedDailyReturn: number;
  } | null {
    if (!opportunity.bestOpportunity) return null;

    const { longExchange, shortExchange, spreadHourly, netReceive } = opportunity.bestOpportunity;

    // Calculate notional size based on available capital and leverage
    const notionalSize = availableCapital * maxLeverage;

    // Required margin (assuming 2x positions across both exchanges)
    const requiredMargin = notionalSize / maxLeverage * 2;

    // Expected returns
    const expectedHourlyReturn = notionalSize * netReceive;
    const expectedDailyReturn = expectedHourlyReturn * 24;

    return {
      longExchange,
      shortExchange,
      notionalSize,
      requiredMargin,
      expectedHourlyReturn,
      expectedDailyReturn,
    };
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate(): number {
    return this.lastUpdate;
  }

  /**
   * Check if update is needed
   */
  needsUpdate(): boolean {
    return Date.now() - this.lastUpdate > this.updateInterval;
  }
}

// Export singleton instance
export const threeWayArbitrageService = new ThreeWayArbitrageService();
export default threeWayArbitrageService;
