/**
 * Shared Trend Lookup Utility
 *
 * Provides consistent trend/tech score lookups across DalyDCA and Crypto Trends pages.
 * Uses the SAME data source and normalization logic to ensure matching results.
 */

import { getCommonName } from './assetNames';

// Debug flag - set to true in development to log trend lookups
// Use localStorage flag for runtime debugging: localStorage.setItem('DEBUG_TRENDS', 'true')
const DEBUG_TREND_LOOKUP = typeof window !== 'undefined' && localStorage.getItem('DEBUG_TRENDS') === 'true';

/**
 * Enhanced trend data structure matching backend output
 * Same interface as CryptoTrends page uses
 */
export interface EnhancedTrendData {
  symbol: string;
  commonName?: string;
  price: number;
  change_24h_percent: number;
  volume_24h: number;
  trend_score: number;
  technical_score: number;
  support_level: number;
  resistance_level: number;
  momentum: number;
  volatility: number;
  rsi?: number;
  macd_state?: 'bullish' | 'bearish' | 'neutral';
  trend_signal?: 'bullish' | 'bearish' | 'neutral';
  sma_50?: number;
  sma_200?: number;
  golden_cross?: boolean;
  isLivePrice?: boolean;
}

/**
 * Market trend display result
 */
export interface MarketTrendDisplay {
  score: number | null;
  label: 'BULL' | 'BEAR' | 'NEUTRAL' | 'MISSING';
  color: string;
  bgColor: string;
}

/**
 * Normalizes a symbol/pair to a canonical lookup key
 * Handles various formats: "BTC/USD", "BTCUSD", "BTC-USD", "BTC", "XXBT", etc.
 *
 * @param symbol - The symbol/pair to normalize
 * @returns Normalized symbol in uppercase base asset format (e.g., "BTC")
 */
export function normalizeSymbolKey(symbol: string): string {
  if (!symbol) return '';

  let normalized = symbol.toUpperCase().trim();

  // Remove common quote currencies and delimiters
  // Handle: "BTC/USD" -> "BTC", "BTCUSD" -> "BTC", "BTC-USD" -> "BTC"
  normalized = normalized
    .replace(/[\/\-_]/g, '') // Remove delimiters
    .replace(/(USD|USDT|USDC|EUR|GBP|CAD|JPY)$/, ''); // Remove quote currency suffix

  // Convert Kraken-specific names to common names
  normalized = getCommonName(normalized);

  return normalized;
}

/**
 * Builds a lookup map from enhanced trend data array
 * Keys are normalized symbols for consistent lookups
 *
 * @param trends - Array of enhanced trend data from API
 * @returns Map keyed by normalized symbol
 */
export function buildTrendLookupMap(trends: EnhancedTrendData[]): Map<string, EnhancedTrendData> {
  const lookupMap = new Map<string, EnhancedTrendData>();

  for (const trend of trends) {
    if (!trend?.symbol) continue;

    // Primary key: normalized symbol
    const normalizedKey = normalizeSymbolKey(trend.symbol);
    lookupMap.set(normalizedKey, trend);

    // Also store by raw symbol (uppercase) as fallback
    lookupMap.set(trend.symbol.toUpperCase(), trend);

    // Store by symbol with /USD suffix
    lookupMap.set(`${normalizedKey}/USD`, trend);

    if (DEBUG_TREND_LOOKUP) {
      console.log(`[TrendLookup] Mapped: ${trend.symbol} -> ${normalizedKey} (trend: ${trend.trend_score}, tech: ${trend.technical_score})`);
    }
  }

  return lookupMap;
}

/**
 * Looks up trend data for a given symbol/pair
 * Uses multiple key variations for maximum match rate
 *
 * @param symbol - The symbol/pair to look up (e.g., "BTC/USD", "ADA/USD")
 * @param lookupMap - The trend lookup map
 * @returns The trend data if found, undefined otherwise
 */
export function lookupTrendData(
  symbol: string,
  lookupMap: Map<string, EnhancedTrendData>
): EnhancedTrendData | undefined {
  if (!symbol || !lookupMap || lookupMap.size === 0) {
    if (DEBUG_TREND_LOOKUP) {
      console.log(`[TrendLookup] Lookup failed: symbol=${symbol}, mapSize=${lookupMap?.size || 0}`);
    }
    return undefined;
  }

  // Generate candidate keys to try
  const normalizedKey = normalizeSymbolKey(symbol);
  const candidateKeys = [
    normalizedKey,                          // "BTC"
    `${normalizedKey}/USD`,                 // "BTC/USD"
    symbol.toUpperCase(),                   // Original uppercase
    symbol.toUpperCase().replace('/', ''),  // "BTCUSD"
  ];

  // Try each candidate key
  for (const key of candidateKeys) {
    const trend = lookupMap.get(key);
    if (trend) {
      if (DEBUG_TREND_LOOKUP) {
        console.log(`[TrendLookup] Found: ${symbol} -> ${key} (trend: ${trend.trend_score}, tech: ${trend.technical_score})`);
      }
      return trend;
    }
  }

  if (DEBUG_TREND_LOOKUP) {
    console.log(`[TrendLookup] Not found: ${symbol} (tried: ${candidateKeys.join(', ')})`);
  }

  return undefined;
}

/**
 * Calculates market trend score and display info from trend/tech scores
 * Uses the SAME logic as required:
 * - Score = (trendScore + techScore) / 2
 * - > 65 => BULL (green)
 * - < 35 => BEAR (red)
 * - 35-65 => NEUTRAL (gray)
 * - Missing/invalid => MISSING (yellow)
 *
 * @param trendScore - The trend score (0-100)
 * @param techScore - The technical score (0-100)
 * @param hasTrendData - Whether trend data was found
 * @returns Market trend display info
 */
export function calculateMarketTrendDisplay(
  trendScore: number | undefined | null,
  techScore: number | undefined | null,
  hasTrendData: boolean = true
): MarketTrendDisplay {
  // Validate that both scores exist and are numeric
  const trendNum = typeof trendScore === 'number' && !isNaN(trendScore) ? trendScore : null;
  const techNum = typeof techScore === 'number' && !isNaN(techScore) ? techScore : null;

  // If either score is missing/invalid, or no trend data found, show MISSING
  if (!hasTrendData || trendNum === null || techNum === null) {
    return {
      score: null,
      label: 'MISSING',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    };
  }

  // Calculate average score (rounded to whole number for consistency)
  const avgScore = Math.round((trendNum + techNum) / 2);

  if (avgScore > 65) {
    return {
      score: avgScore,
      label: 'BULL',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    };
  } else if (avgScore < 35) {
    return {
      score: avgScore,
      label: 'BEAR',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    };
  } else {
    return {
      score: avgScore,
      label: 'NEUTRAL',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
    };
  }
}

/**
 * Gets market trend display for a bot/symbol using the shared lookup
 * This is the main function DalyDCA should use
 *
 * @param symbol - The bot's symbol (e.g., "BTC/USD")
 * @param lookupMap - The trend lookup map
 * @param debugBotId - Optional bot ID for debug logging
 * @returns Market trend display info with scores
 */
export function getMarketTrendForSymbol(
  symbol: string,
  lookupMap: Map<string, EnhancedTrendData>,
  debugBotId?: string
): MarketTrendDisplay & { trendScore: number | null; techScore: number | null; foundInLookup: boolean } {
  const trendData = lookupTrendData(symbol, lookupMap);

  const trendScore = trendData?.trend_score ?? null;
  const techScore = trendData?.technical_score ?? null;
  const foundInLookup = !!trendData;

  if (DEBUG_TREND_LOOKUP && debugBotId) {
    console.log(`[TrendLookup] Bot ${debugBotId} (${symbol}):`, {
      normalizedKey: normalizeSymbolKey(symbol),
      foundInLookup,
      trendScore,
      techScore,
      computed: foundInLookup && trendScore !== null && techScore !== null
        ? Math.round((trendScore + techScore) / 2)
        : 'MISSING',
    });
  }

  const display = calculateMarketTrendDisplay(trendScore, techScore, foundInLookup);

  return {
    ...display,
    trendScore,
    techScore,
    foundInLookup,
  };
}

/**
 * Debug helper to log all lookup map keys
 * Only runs when DEBUG_TREND_LOOKUP is true
 */
export function debugLogLookupMap(lookupMap: Map<string, EnhancedTrendData>): void {
  if (!DEBUG_TREND_LOOKUP) return;

  console.log(`[TrendLookup] Lookup map contains ${lookupMap.size} entries`);
  const uniqueSymbols = new Set<string>();
  lookupMap.forEach((trend) => uniqueSymbols.add(trend.symbol));
  console.log(`[TrendLookup] Unique symbols: ${Array.from(uniqueSymbols).join(', ')}`);
}
