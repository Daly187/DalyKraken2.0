/**
 * Kraken Symbol Resolver
 *
 * Resolves canonical asset symbols to Kraken WebSocket pair keys.
 * Uses multiple matching strategies to maximize successful joins between
 * our ASSET_MAPPINGS and live Kraken price data.
 *
 * Matching strategies (in order):
 * A. Direct match - exact canonical symbol (e.g., BTC -> BTC/USD)
 * B. Kraken aliases - XBT, XDG, STR etc. (e.g., BTC -> XBT/USD)
 * C. Quote currency variants - USD, USDT, USDC, EUR
 * D. Normalized formats - strip common prefixes (X, Z, XX, XZ)
 */

import type { LivePrice } from '@/types';

// Kraken-specific symbol aliases
// Maps canonical symbols to Kraken's internal symbols
const KRAKEN_ALIASES: Record<string, string[]> = {
  'BTC': ['XBT', 'XXBT'],
  'DOGE': ['XDG', 'XXDG'],
  'XLM': ['STR', 'XSTR'],
  'VET': ['VET'],
  'REP': ['XREP'],
};

// Reverse lookup: Kraken symbol -> canonical
const ALIAS_TO_CANONICAL: Record<string, string> = {};
Object.entries(KRAKEN_ALIASES).forEach(([canonical, aliases]) => {
  aliases.forEach(alias => {
    ALIAS_TO_CANONICAL[alias] = canonical;
  });
});

// Quote currencies to try (in order of preference)
const QUOTE_CURRENCIES = ['USD', 'USDT', 'USDC', 'EUR'];

// Common Kraken prefixes to strip
const KRAKEN_PREFIXES = ['XX', 'XZ', 'X', 'Z'];

// Resolution result cache (symbol -> resolved pair key)
const resolutionCache = new Map<string, string | null>();

export interface ResolvedSymbol {
  pair: string;       // The matching pair key (e.g., "BTC/USD")
  liveData: LivePrice;
  strategy: string;   // Which strategy matched (for debugging)
}

/**
 * Resolve a canonical symbol to a Kraken pair key
 *
 * @param canonical - The canonical symbol (e.g., "BTC", "ETH")
 * @param livePrices - Map of live prices keyed by pair (e.g., "BTC/USD")
 * @returns ResolvedSymbol with match info, or null if no match
 */
export function resolveKrakenSymbol(
  canonical: string,
  livePrices: Map<string, LivePrice>
): ResolvedSymbol | null {
  const normalizedCanonical = canonical.toUpperCase().trim();

  // Check cache first
  const cacheKey = normalizedCanonical;
  const cachedResult = resolutionCache.get(cacheKey);

  if (cachedResult !== undefined) {
    if (cachedResult === null) return null;
    const liveData = livePrices.get(cachedResult);
    if (liveData) {
      return { pair: cachedResult, liveData, strategy: 'cached' };
    }
  }

  // Build a set of candidate pairs to try
  const candidates = generateCandidates(normalizedCanonical);

  // Try each candidate against live prices
  for (const { pair, strategy } of candidates) {
    const liveData = livePrices.get(pair);
    if (liveData) {
      // Cache the successful resolution
      resolutionCache.set(cacheKey, pair);
      return { pair, liveData, strategy };
    }
  }

  // Also try reverse lookup: scan livePrices for matches
  const reverseMatch = findReverseMatch(normalizedCanonical, livePrices);
  if (reverseMatch) {
    resolutionCache.set(cacheKey, reverseMatch.pair);
    return reverseMatch;
  }

  // No match found - cache the failure
  resolutionCache.set(cacheKey, null);
  return null;
}

/**
 * Generate candidate pair keys to try for a given canonical symbol
 */
function generateCandidates(canonical: string): Array<{ pair: string; strategy: string }> {
  const candidates: Array<{ pair: string; strategy: string }> = [];

  // Strategy A: Direct match with different quote currencies
  for (const quote of QUOTE_CURRENCIES) {
    candidates.push({
      pair: `${canonical}/${quote}`,
      strategy: `direct:${quote}`
    });
  }

  // Strategy B: Kraken aliases (BTC -> XBT, DOGE -> XDG, etc.)
  const aliases = KRAKEN_ALIASES[canonical];
  if (aliases) {
    for (const alias of aliases) {
      for (const quote of QUOTE_CURRENCIES) {
        candidates.push({
          pair: `${alias}/${quote}`,
          strategy: `alias:${alias}/${quote}`
        });
      }
    }
  }

  // Strategy C: Try without common Kraken prefixes (if canonical has one)
  for (const prefix of KRAKEN_PREFIXES) {
    if (canonical.startsWith(prefix)) {
      const stripped = canonical.substring(prefix.length);
      for (const quote of QUOTE_CURRENCIES) {
        candidates.push({
          pair: `${stripped}/${quote}`,
          strategy: `prefix-stripped:${stripped}/${quote}`
        });
      }
    }
  }

  // Strategy D: Try adding common Kraken prefixes
  for (const prefix of ['X']) {
    const prefixed = `${prefix}${canonical}`;
    for (const quote of QUOTE_CURRENCIES) {
      candidates.push({
        pair: `${prefixed}/${quote}`,
        strategy: `prefix-added:${prefixed}/${quote}`
      });
    }
  }

  return candidates;
}

/**
 * Reverse match: scan all live prices to find a match for canonical
 * This catches cases where the pair key has unexpected formatting
 */
function findReverseMatch(
  canonical: string,
  livePrices: Map<string, LivePrice>
): ResolvedSymbol | null {
  // Get all aliases for this canonical symbol
  const symbolVariants = [canonical, ...(KRAKEN_ALIASES[canonical] || [])];

  for (const [pairKey, liveData] of livePrices) {
    // Extract base symbol from pair (e.g., "BTC/USD" -> "BTC")
    const base = pairKey.split('/')[0]?.toUpperCase();

    if (!base) continue;

    // Direct match
    if (symbolVariants.includes(base)) {
      return { pair: pairKey, liveData, strategy: `reverse:${base}` };
    }

    // Try stripping prefixes from the live price base
    for (const prefix of KRAKEN_PREFIXES) {
      if (base.startsWith(prefix)) {
        const stripped = base.substring(prefix.length);
        if (symbolVariants.includes(stripped)) {
          return { pair: pairKey, liveData, strategy: `reverse-prefix:${stripped}` };
        }
      }
    }

    // Check if canonical is in alias mapping
    if (ALIAS_TO_CANONICAL[base] === canonical) {
      return { pair: pairKey, liveData, strategy: `reverse-alias:${base}` };
    }
  }

  return null;
}

/**
 * Batch resolve multiple symbols at once
 * More efficient than calling resolveKrakenSymbol repeatedly
 */
export function resolveKrakenSymbols(
  canonicals: string[],
  livePrices: Map<string, LivePrice>
): Map<string, ResolvedSymbol | null> {
  const results = new Map<string, ResolvedSymbol | null>();

  for (const canonical of canonicals) {
    results.set(canonical, resolveKrakenSymbol(canonical, livePrices));
  }

  return results;
}

/**
 * Clear the resolution cache
 * Call this when live prices are refreshed or you want fresh resolutions
 */
export function clearResolutionCache(): void {
  resolutionCache.clear();
}

/**
 * Get cache stats for debugging
 */
export function getResolutionCacheStats(): { size: number; hits: number; misses: number } {
  let hits = 0;
  let misses = 0;

  resolutionCache.forEach(value => {
    if (value !== null) hits++;
    else misses++;
  });

  return { size: resolutionCache.size, hits, misses };
}

/**
 * Debug helper: get all available pair keys from live prices
 */
export function getAvailablePairs(livePrices: Map<string, LivePrice>): string[] {
  return Array.from(livePrices.keys()).sort();
}

/**
 * Debug helper: try to resolve a symbol and return detailed info
 */
export function debugResolve(
  canonical: string,
  livePrices: Map<string, LivePrice>
): {
  canonical: string;
  candidates: Array<{ pair: string; strategy: string; found: boolean }>;
  result: ResolvedSymbol | null;
} {
  const normalizedCanonical = canonical.toUpperCase().trim();
  const candidates = generateCandidates(normalizedCanonical);

  const candidatesWithResults = candidates.map(c => ({
    ...c,
    found: livePrices.has(c.pair)
  }));

  // Temporarily clear cache for accurate debugging
  const oldCached = resolutionCache.get(normalizedCanonical);
  resolutionCache.delete(normalizedCanonical);

  const result = resolveKrakenSymbol(canonical, livePrices);

  // Restore cache state
  if (oldCached !== undefined) {
    resolutionCache.set(normalizedCanonical, oldCached);
  }

  return {
    canonical: normalizedCanonical,
    candidates: candidatesWithResults,
    result
  };
}
