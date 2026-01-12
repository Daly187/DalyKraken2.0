/**
 * Market Trend Service
 * Calculates and manages the market_trend field for DCA bots
 *
 * Uses Crypto Trends page data (trendScore and technicalScore) to determine:
 * - bullish: combined >= 60 (matching Crypto Trends page logic)
 * - bearish: combined <= 40
 * - neutral: otherwise (40 < combined < 60)
 *
 * This matches the existing recommendation logic in marketAnalysisService.ts
 */

export type MarketTrend = 'bullish' | 'bearish' | 'neutral';

export interface MarketTrendResult {
  market_trend: MarketTrend;
  trendScore: number;
  technicalScore: number;
  combinedScore: number;
  calculatedAt: string;
}

/**
 * Calculate market trend from trend and technical scores
 * This is the single source of truth for market_trend calculation
 *
 * Formula: combined = (trendScore * 0.6) + (technicalScore * 0.4)
 *
 * Rules (matching marketAnalysisService.ts recommendation logic):
 * - bullish: combined >= 60
 * - bearish: combined <= 40
 * - neutral: 40 < combined < 60
 *
 * Edge cases:
 * - If either score is missing/NaN, returns neutral with a warning logged
 * - Scores are clamped to 0-100 range
 */
export function calculateMarketTrend(
  trendScore: number | undefined | null,
  technicalScore: number | undefined | null
): MarketTrendResult {
  const now = new Date().toISOString();

  // Handle missing/invalid scores
  if (
    trendScore === undefined ||
    trendScore === null ||
    isNaN(trendScore) ||
    technicalScore === undefined ||
    technicalScore === null ||
    isNaN(technicalScore)
  ) {
    console.warn('[MarketTrendService] Missing or invalid scores - returning neutral', {
      trendScore,
      technicalScore,
    });

    return {
      market_trend: 'neutral',
      trendScore: trendScore ?? 50,
      technicalScore: technicalScore ?? 50,
      combinedScore: 50,
      calculatedAt: now,
    };
  }

  // Clamp scores to 0-100 range
  const clampedTrendScore = Math.max(0, Math.min(100, trendScore));
  const clampedTechnicalScore = Math.max(0, Math.min(100, technicalScore));

  // Calculate combined score: 60% trend, 40% technical
  const combinedScore = (clampedTrendScore * 0.6) + (clampedTechnicalScore * 0.4);

  let market_trend: MarketTrend = 'neutral';

  // Matching marketAnalysisService.ts recommendation logic:
  // avgScore >= 60 → bullish
  // avgScore <= 40 → bearish
  // otherwise → neutral
  if (combinedScore >= 60) {
    market_trend = 'bullish';
  } else if (combinedScore <= 40) {
    market_trend = 'bearish';
  }
  // Otherwise neutral (40 < combined < 60)

  return {
    market_trend,
    trendScore: clampedTrendScore,
    technicalScore: clampedTechnicalScore,
    combinedScore,
    calculatedAt: now,
  };
}

/**
 * Get trend scores for a symbol from market analysis data
 * Handles symbol normalization (e.g., "BTC/USD" -> "BTC")
 */
export function normalizeSymbolForTrends(symbol: string): string {
  // Remove /USD suffix and normalize
  return symbol
    .replace('/USD', '')
    .replace('XXBTZ', 'BTC')
    .replace('XETHZ', 'ETH')
    .replace(/^X/, '')
    .toUpperCase();
}

export default {
  calculateMarketTrend,
  normalizeSymbolForTrends,
};
