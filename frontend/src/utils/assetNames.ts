/**
 * Asset Name Utilities
 *
 * Centralized asset name mapping between Kraken's internal naming
 * and common/user-friendly cryptocurrency names.
 */

/**
 * Comprehensive mapping of Kraken asset names to common names
 */
const KRAKEN_TO_COMMON_NAME: Record<string, string> = {
  // Bitcoin variations
  'XXBT': 'BTC',
  'XBT': 'BTC',
  'BTC': 'BTC',
  'BTC.F': 'BTC',  // Futures

  // Ethereum
  'XETH': 'ETH',
  'ETH': 'ETH',
  'ETH.F': 'ETH',  // Futures

  // XRP
  'XXRP': 'XRP',
  'XRP': 'XRP',
  'XRP.F': 'XRP',  // Futures

  // Litecoin
  'XLTC': 'LTC',
  'LTC': 'LTC',
  'LTC.F': 'LTC',  // Futures

  // Stellar
  'XXLM': 'XLM',
  'XLM': 'XLM',

  // Dogecoin
  'XXDG': 'DOGE',
  'XDG': 'DOGE',
  'DOGE': 'DOGE',

  // Ethereum Classic
  'XETC': 'ETC',
  'ETC': 'ETC',

  // Monero
  'XXMR': 'XMR',
  'XMR': 'XMR',

  // Zcash
  'XZEC': 'ZEC',
  'ZEC': 'ZEC',

  // Melon
  'XMLN': 'MLN',
  'MLN': 'MLN',

  // Augur
  'XREP': 'REP',
  'REP': 'REP',

  // DAO
  'XDAO': 'DAO',
  'DAO': 'DAO',

  // Tether
  'USDT': 'USDT',

  // USD Coin
  'USDC': 'USDC',

  // Dai
  'DAI': 'DAI',

  // Fiat currencies
  'ZEUR': 'EUR',
  'EUR': 'EUR',
  'ZUSD': 'USD',
  'USD': 'USD',
  'ZGBP': 'GBP',
  'GBP': 'GBP',
  'ZCAD': 'CAD',
  'CAD': 'CAD',
  'ZJPY': 'JPY',
  'JPY': 'JPY',

  // Other major cryptocurrencies (already in common format)
  'SOL': 'SOL',
  'ADA': 'ADA',
  'DOT': 'DOT',
  'MATIC': 'MATIC',
  'AVAX': 'AVAX',
  'LINK': 'LINK',
  'UNI': 'UNI',
  'ATOM': 'ATOM',
  'BCH': 'BCH',
  'AAVE': 'AAVE',
  'COMP': 'COMP',
  'MKR': 'MKR',
  'SNX': 'SNX',
  'CRV': 'CRV',
  'SUSHI': 'SUSHI',
  'YFI': 'YFI',
  'ALGO': 'ALGO',
  'XTZ': 'XTZ',
  'MANA': 'MANA',
  'SAND': 'SAND',
  'GRT': 'GRT',
  'FIL': 'FIL',
  'NEAR': 'NEAR',
  'OP': 'OP',
  'ARB': 'ARB',
  'LDO': 'LDO',
  'APE': 'APE',
  'IMX': 'IMX',
  'BLUR': 'BLUR',
  'AXS': 'AXS',
  'ENJ': 'ENJ',
  'GALA': 'GALA',
  'BAND': 'BAND',
  'FTM': 'FTM',
  'MINA': 'MINA',
  'FLOW': 'FLOW',
  'EOS': 'EOS',
  'TRX': 'TRX',
  '1INCH': '1INCH',
  'BAL': 'BAL',
  'BUSD': 'BUSD',
};

/**
 * Mapping of common names to Kraken trading pairs
 */
const COMMON_NAME_TO_PAIR: Record<string, string> = {
  'BTC': 'BTC/USD',
  'ETH': 'ETH/USD',
  'XRP': 'XRP/USD',
  'LTC': 'LTC/USD',
  'XLM': 'XLM/USD',
  'DOGE': 'DOGE/USD',
  'ETC': 'ETC/USD',
  'XMR': 'XMR/USD',
  'ZEC': 'ZEC/USD',
  'MLN': 'MLN/USD',
  'REP': 'REP/USD',
  'SOL': 'SOL/USD',
  'ADA': 'ADA/USD',
  'DOT': 'DOT/USD',
  'MATIC': 'MATIC/USD',
  'AVAX': 'AVAX/USD',
  'LINK': 'LINK/USD',
  'UNI': 'UNI/USD',
  'ATOM': 'ATOM/USD',
  'BCH': 'BCH/USD',
  'AAVE': 'AAVE/USD',
  'COMP': 'COMP/USD',
  'MKR': 'MKR/USD',
  'SNX': 'SNX/USD',
  'CRV': 'CRV/USD',
  'SUSHI': 'SUSHI/USD',
  'YFI': 'YFI/USD',
  'ALGO': 'ALGO/USD',
  'XTZ': 'XTZ/USD',
  'MANA': 'MANA/USD',
  'SAND': 'SAND/USD',
  'GRT': 'GRT/USD',
  'FIL': 'FIL/USD',
  'NEAR': 'NEAR/USD',
  'OP': 'OP/USD',
  'ARB': 'ARB/USD',
  'LDO': 'LDO/USD',
  'APE': 'APE/USD',
  'IMX': 'IMX/USD',
  'BLUR': 'BLUR/USD',
  'AXS': 'AXS/USD',
  'ENJ': 'ENJ/USD',
  'GALA': 'GALA/USD',
  'BAND': 'BAND/USD',
  'FTM': 'FTM/USD',
  'MINA': 'MINA/USD',
  'FLOW': 'FLOW/USD',
  'EOS': 'EOS/USD',
  'TRX': 'TRX/USD',
  '1INCH': '1INCH/USD',
  'BAL': 'BAL/USD',

  // Stablecoins
  'USDT': 'USDT/USD',
  'USDC': 'USDC/USD',
  'DAI': 'DAI/USD',
  'BUSD': 'BUSD/USD',

  // Fiat
  'USD': 'USD',
  'EUR': 'EUR/USD',
  'GBP': 'GBP/USD',
  'CAD': 'CAD/USD',
  'JPY': 'JPY/USD',
};

/**
 * Convert Kraken asset name to common name
 * Handles all Kraken naming conventions including prefixes and futures suffixes
 *
 * @param krakenAsset - Kraken's internal asset name (e.g., 'XXBT', 'XRP.F', 'XETH')
 * @returns Common asset name (e.g., 'BTC', 'XRP', 'ETH')
 *
 * @example
 * getCommonName('XXBT') // Returns 'BTC'
 * getCommonName('XRP.F') // Returns 'XRP'
 * getCommonName('SOL') // Returns 'SOL'
 */
export function getCommonName(krakenAsset: string): string {
  if (!krakenAsset) return krakenAsset;

  // Try direct lookup first
  const commonName = KRAKEN_TO_COMMON_NAME[krakenAsset];
  if (commonName) {
    return commonName;
  }

  // Handle futures suffix (.F) for any asset
  if (krakenAsset.endsWith('.F')) {
    const baseAsset = krakenAsset.slice(0, -2);
    const baseName = KRAKEN_TO_COMMON_NAME[baseAsset];
    if (baseName) {
      return baseName;
    }
  }

  // If no mapping found, return the asset as-is
  // This handles new assets that haven't been added to the mapping yet
  return krakenAsset;
}

/**
 * Convert common asset name to Kraken trading pair
 *
 * @param commonName - Common asset name (e.g., 'BTC', 'ETH')
 * @returns Kraken trading pair (e.g., 'BTC/USD', 'ETH/USD')
 *
 * @example
 * getKrakenPair('BTC') // Returns 'BTC/USD'
 * getKrakenPair('ETH') // Returns 'ETH/USD'
 */
export function getKrakenPair(commonName: string): string {
  const pair = COMMON_NAME_TO_PAIR[commonName];
  if (pair) {
    return pair;
  }

  // Default to USD pair if not in mapping
  return `${commonName}/USD`;
}

/**
 * Check if asset is a stablecoin
 *
 * @param asset - Asset name (common or Kraken format)
 * @returns true if asset is a stablecoin
 */
export function isStablecoin(asset: string): boolean {
  const commonName = getCommonName(asset);
  return ['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'EUR', 'GBP', 'CAD', 'JPY'].includes(commonName);
}

/**
 * Check if asset is a fiat currency
 *
 * @param asset - Asset name (common or Kraken format)
 * @returns true if asset is fiat currency
 */
export function isFiat(asset: string): boolean {
  const commonName = getCommonName(asset);
  return ['USD', 'EUR', 'GBP', 'CAD', 'JPY'].includes(commonName);
}

/**
 * Format asset name for display
 * Returns the common name with proper formatting
 *
 * @param asset - Asset name in any format
 * @returns Formatted display name
 */
export function formatAssetForDisplay(asset: string): string {
  return getCommonName(asset);
}
