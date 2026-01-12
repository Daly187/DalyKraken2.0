/**
 * Market Cap Service
 * Fetches market cap data from CoinGecko API (free, no API key required)
 */

interface MarketCapData {
  symbol: string;
  marketCap: number;
  lastUpdated: number;
}

class MarketCapService {
  private cache: Map<string, MarketCapData> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
  private lastFetchTime = 0;
  private fetchCooldown = 60 * 1000; // 1 minute between API calls

  // Map of canonical symbols to CoinGecko IDs
  private coinGeckoIds: { [key: string]: string } = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LINK': 'chainlink',
    'ATOM': 'cosmos',
    'UNI': 'uniswap',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'NEAR': 'near',
    'APT': 'aptos',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'DOGE': 'dogecoin',
    'TRX': 'tron',
    'SHIB': 'shiba-inu',
    'TON': 'the-open-network',
    'ETC': 'ethereum-classic',
    'XLM': 'stellar',
    'FIL': 'filecoin',
    'INJ': 'injective-protocol',
    'AAVE': 'aave',
    'MKR': 'maker',
    'GRT': 'the-graph',
    'SNX': 'havven',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'AXS': 'axie-infinity',
    'FLOW': 'flow',
    'XTZ': 'tezos',
    'EOS': 'eos',
    'FTM': 'fantom',
    'APE': 'apecoin',
    'CRV': 'curve-dao-token',
    'LDO': 'lido-dao',
    'RUNE': 'thorchain',
    'KAVA': 'kava',
    'CHZ': 'chiliz',
    'ROSE': 'oasis-network',
    'BONK': 'bonk',
    'PEPE': 'pepe',
    'WIF': 'dogwifcoin',
    'FLOKI': 'floki',
    'SUI': 'sui',
    'SEI': 'sei-network',
    'TIA': 'celestia',
    'PYTH': 'pyth-network',
    'JUP': 'jupiter-exchange-solana',
    'RENDER': 'render-token',
    'FET': 'fetch-ai',
    'AR': 'arweave',
    'IMX': 'immutable-x',
    'ALGO': 'algorand',
    'HBAR': 'hedera-hashgraph',
    'VET': 'vechain',
    'XMR': 'monero',
    'THETA': 'theta-token',
    'QNT': 'quant-network',
    'EGLD': 'elrond-erd-2',
    'ICP': 'internet-computer',
    'STX': 'blockstack',
    'ENS': 'ethereum-name-service',
    'SUSHI': 'sushi',
    'YFI': 'yearn-finance',
    'COMP': 'compound-governance-token',
    '1INCH': '1inch',
    'GALA': 'gala',
    'BLUR': 'blur',
    'ANKR': 'ankr',
    'BAT': 'basic-attention-token',
    'ENJ': 'enjincoin',
    'MINA': 'mina-protocol',
    'STORJ': 'storj',
    'OCEAN': 'ocean-protocol',
    'GLM': 'golem',
    'ZIL': 'zilliqa',
    'WAVES': 'waves',
    'DASH': 'dash',
    'ZEC': 'zcash',
    'NEO': 'neo',
    'CELO': 'celo',
    'ZRX': '0x',
    'BNT': 'bancor',
    'OMG': 'omisego',
    'ONE': 'harmony',
    'IOTX': 'iotex',
    'JASMY': 'jasmycoin',
    'KSM': 'kusama',
    'GLMR': 'moonbeam',
    'QTUM': 'qtum',
    'SC': 'siacoin',
    'AMP': 'amp-token',
    'LPT': 'livepeer',
    'BAL': 'balancer',
    'BAND': 'band-protocol',
    'API3': 'api3',
    'AUDIO': 'audius',
    'RLC': 'iexec-rlc',
    'NMR': 'numeraire',
    'CTSI': 'cartesi',
    'ALICE': 'my-neighbor-alice',
    'PAXG': 'pax-gold',
    'AGIX': 'singularitynet',
    'REQ': 'request-network',
    'PHA': 'pha',
    'ASTR': 'astar',
    'PERP': 'perpetual-protocol',
    'BEAM': 'beam-2',
    'BERA': 'berachain-bera',
    'AI16Z': 'ai16z',
    'FARTCOIN': 'fartcoin',
    'TRUMP': 'trump',
    'POPCAT': 'popcat',
    'LAYER': 'layer',
    'ZEREBRO': 'zerebro',
    'ARC': 'arc',
    'SONIC': 'sonic-svm',
    'ME': 'magic-eden',
    'AIXBT': 'aixbt',
    'MELANIA': 'melania',
    'MOG': 'mog-coin',
    'BRETT': 'brett',
    'PENGU': 'pengu',
    'SPX': 'spx6900',
    'GRIFFAIN': 'griffain',
    'SWARMS': 'swarms',
    'ONDO': 'ondo-finance',
    'RAY': 'raydium',
    'GOAT': 'goat',
    'SCR': 'scroll',
    'MOVE': 'movement',
    'ENA': 'ethena',
    'EIGEN': 'eigenlayer',
    'ZK': 'zksync',
    'W': 'wormhole',
    'WLD': 'worldcoin-wld',
    'STRK': 'starknet',
    'DYM': 'dymension',
    'ALT': 'altlayer',
    'MANTA': 'manta-network',
    'DEGEN': 'degen-base',
    'NOT': 'notcoin',
    'G': 'gravity',
    'S': 'sonic-labs',
    'MYRO': 'myro',
    'NEIRO': 'neiro-on-eth',
    'MOODENG': 'moo-deng',
    'ACT': 'act-i-the-ai-prophecy',
    'PNUT': 'peanut-the-squirrel',
    'CHILLGUY': 'chillguy',
    'VINE': 'vine',
    'TURBO': 'turbo',
    'DOG': 'dog-go-to-the-moon',
    'BOME': 'book-of-meme',
    'COW': 'cow-protocol',
    'DOGS': 'dogs-2',
    'TAO': 'bittensor',
    'OMNI': 'omni-network',
    'TNSR': 'tensor',
    'MERL': 'merlin-chain',
  };

  /**
   * Fetch market cap data for all supported coins from CoinGecko
   */
  async fetchAllMarketCaps(): Promise<void> {
    const now = Date.now();

    // Respect cooldown to avoid rate limiting
    if (now - this.lastFetchTime < this.fetchCooldown) {
      console.log('[MarketCapService] Cooldown active, using cached data');
      return;
    }

    try {
      const coinIds = Object.values(this.coinGeckoIds).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_market_cap=true`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      // Update cache with new data
      for (const [symbol, geckoId] of Object.entries(this.coinGeckoIds)) {
        const coinData = data[geckoId];
        if (coinData && coinData.usd_market_cap) {
          this.cache.set(symbol, {
            symbol,
            marketCap: coinData.usd_market_cap,
            lastUpdated: now,
          });
        }
      }

      this.lastFetchTime = now;
      console.log(`[MarketCapService] Updated market caps for ${this.cache.size} coins`);
    } catch (error) {
      console.error('[MarketCapService] Error fetching market caps:', error);
    }
  }

  /**
   * Get market cap for a single symbol
   */
  getMarketCap(symbol: string): number | null {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const cached = this.cache.get(normalizedSymbol);

    if (cached && Date.now() - cached.lastUpdated < this.cacheExpiry) {
      return cached.marketCap;
    }

    return null;
  }

  /**
   * Get all cached market caps
   */
  getAllMarketCaps(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [symbol, data] of this.cache) {
      result.set(symbol, data.marketCap);
    }
    return result;
  }

  /**
   * Normalize symbol to canonical form
   */
  private normalizeSymbol(symbol: string): string {
    // Remove common suffixes
    let normalized = symbol.toUpperCase()
      .replace(/USDT$/i, '')
      .replace(/PERP$/i, '')
      .replace(/-USD$/i, '')
      .replace(/-PERP$/i, '')
      .replace(/USD$/i, '');

    // Handle 1000PEPE -> PEPE type mappings
    if (normalized.startsWith('1000')) {
      normalized = normalized.substring(4);
    }
    if (normalized.startsWith('K')) {
      // kPEPE -> PEPE
      const rest = normalized.substring(1);
      if (this.coinGeckoIds[rest]) {
        normalized = rest;
      }
    }

    return normalized;
  }

  /**
   * Format market cap for display
   */
  formatMarketCap(marketCap: number | null): string {
    if (marketCap === null) return 'N/A';

    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else if (marketCap >= 1e3) {
      return `$${(marketCap / 1e3).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  }
}

export const marketCapService = new MarketCapService();
