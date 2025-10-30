/**
 * Unified Symbol Mapping for Three-Way Funding Rate Arbitrage
 * Supports: AsterDEX (USDT), HyperLiquid (USD), Lighter (USDC)
 *
 * Convention: <Asset>-PERP for normalized format
 */

export interface ExchangeSymbolMap {
  canonical: string; // Unified format: BTC-PERP
  name: string;
  aster?: string; // AsterDEX format: BTCUSDT
  hyperliquid?: string; // HyperLiquid format: BTC
  lighter?: string; // Lighter format: BTC-USDC
  multiplier: number; // 1 or 1000 for contracts
}

export interface FundingRateData {
  symbol: string;
  exchange: 'aster' | 'hyperliquid' | 'lighter';
  fundingRate: number; // Normalized to hourly rate
  annualRate: number; // APR
  markPrice: number;
  indexPrice?: number;
  nextFundingTime: number;
  paymentFrequency: 'hourly' | '8hourly'; // For APR calculation
  rawRate: number; // Original rate before normalization
}

export interface ThreeWayArbitrageOpportunity {
  canonical: string;
  name: string;

  // Funding data from each exchange
  aster?: FundingRateData;
  hyperliquid?: FundingRateData;
  lighter?: FundingRateData;

  // Best arbitrage opportunity
  bestOpportunity?: {
    longExchange: 'aster' | 'hyperliquid' | 'lighter';
    shortExchange: 'aster' | 'hyperliquid' | 'lighter';
    spreadHourly: number; // Hourly spread
    spreadApr: number; // Annualized spread
    netReceive: number; // Net funding received per hour
    confidence: 'high' | 'medium' | 'low';
  };

  // All possible pairs
  allPairs: Array<{
    long: 'aster' | 'hyperliquid' | 'lighter';
    short: 'aster' | 'hyperliquid' | 'lighter';
    spread: number;
    apr: number;
  }>;
}

/**
 * Complete symbol mapping for all three exchanges
 * Based on actual market availability
 */
export const UNIFIED_SYMBOL_MAP: ExchangeSymbolMap[] = [
  // Top 10 by Market Cap
  {
    canonical: 'BTC-PERP',
    name: 'Bitcoin',
    aster: 'BTCUSDT',
    hyperliquid: 'BTC',
    lighter: 'BTC-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ETH-PERP',
    name: 'Ethereum',
    aster: 'ETHUSDT',
    hyperliquid: 'ETH',
    lighter: 'ETH-USDC',
    multiplier: 1,
  },
  {
    canonical: 'BNB-PERP',
    name: 'BNB',
    aster: 'BNBUSDT',
    hyperliquid: 'BNB',
    lighter: 'BNB-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SOL-PERP',
    name: 'Solana',
    aster: 'SOLUSDT',
    hyperliquid: 'SOL',
    lighter: 'SOL-USDC',
    multiplier: 1,
  },
  {
    canonical: 'XRP-PERP',
    name: 'Ripple',
    aster: 'XRPUSDT',
    hyperliquid: 'XRP',
    lighter: 'XRP-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ADA-PERP',
    name: 'Cardano',
    aster: 'ADAUSDT',
    hyperliquid: 'ADA',
    lighter: 'ADA-USDC',
    multiplier: 1,
  },
  {
    canonical: 'DOGE-PERP',
    name: 'Dogecoin',
    aster: 'DOGEUSDT',
    hyperliquid: 'DOGE',
    lighter: 'DOGE-USDC',
    multiplier: 1,
  },
  {
    canonical: 'AVAX-PERP',
    name: 'Avalanche',
    aster: 'AVAXUSDT',
    hyperliquid: 'AVAX',
    lighter: 'AVAX-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SHIB-PERP',
    name: 'Shiba Inu',
    aster: '1000SHIBUSDT',
    hyperliquid: 'kSHIB',
    lighter: 'SHIB-USDC',
    multiplier: 1000,
  },
  {
    canonical: 'DOT-PERP',
    name: 'Polkadot',
    aster: 'DOTUSDT',
    hyperliquid: 'DOT',
    lighter: 'DOT-USDC',
    multiplier: 1,
  },

  // Layer 1 & Layer 2
  {
    canonical: 'LINK-PERP',
    name: 'Chainlink',
    aster: 'LINKUSDT',
    hyperliquid: 'LINK',
    lighter: 'LINK-USDC',
    multiplier: 1,
  },
  {
    canonical: 'MATIC-PERP',
    name: 'Polygon',
    aster: 'MATICUSDT',
    hyperliquid: 'POL',
    lighter: 'MATIC-USDC',
    multiplier: 1,
  },
  {
    canonical: 'UNI-PERP',
    name: 'Uniswap',
    aster: 'UNIUSDT',
    hyperliquid: 'UNI',
    lighter: 'UNI-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ATOM-PERP',
    name: 'Cosmos',
    aster: 'ATOMUSDT',
    hyperliquid: 'ATOM',
    lighter: 'ATOM-USDC',
    multiplier: 1,
  },
  {
    canonical: 'LTC-PERP',
    name: 'Litecoin',
    aster: 'LTCUSDT',
    hyperliquid: 'LTC',
    lighter: 'LTC-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ETC-PERP',
    name: 'Ethereum Classic',
    aster: 'ETCUSDT',
    hyperliquid: 'ETC',
    lighter: 'ETC-USDC',
    multiplier: 1,
  },
  {
    canonical: 'BCH-PERP',
    name: 'Bitcoin Cash',
    aster: 'BCHUSDT',
    hyperliquid: 'BCH',
    lighter: 'BCH-USDC',
    multiplier: 1,
  },
  {
    canonical: 'NEAR-PERP',
    name: 'NEAR Protocol',
    aster: 'NEARUSDT',
    hyperliquid: 'NEAR',
    lighter: 'NEAR-USDC',
    multiplier: 1,
  },
  {
    canonical: 'TRX-PERP',
    name: 'TRON',
    aster: 'TRXUSDT',
    hyperliquid: 'TRX',
    lighter: 'TRX-USDC',
    multiplier: 1,
  },

  // Layer 2 Networks
  {
    canonical: 'ARB-PERP',
    name: 'Arbitrum',
    aster: 'ARBUSDT',
    hyperliquid: 'ARB',
    lighter: 'ARB-USDC',
    multiplier: 1,
  },
  {
    canonical: 'OP-PERP',
    name: 'Optimism',
    aster: 'OPUSDT',
    hyperliquid: 'OP',
    lighter: 'OP-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SEI-PERP',
    name: 'Sei',
    aster: 'SEIUSDT',
    hyperliquid: 'SEI',
    lighter: 'SEI-USDC',
    multiplier: 1,
  },
  {
    canonical: 'TIA-PERP',
    name: 'Celestia',
    aster: 'TIAUSDT',
    hyperliquid: 'TIA',
    lighter: 'TIA-USDC',
    multiplier: 1,
  },
  {
    canonical: 'STRK-PERP',
    name: 'Starknet',
    aster: 'STRKUSDT',
    hyperliquid: 'STRK',
    lighter: 'STRK-USDC',
    multiplier: 1,
  },
  {
    canonical: 'MNT-PERP',
    name: 'Mantle',
    aster: 'MNTUSDT',
    hyperliquid: 'MNT',
    lighter: 'MNT-USDC',
    multiplier: 1,
  },

  // DeFi Protocols
  {
    canonical: 'AAVE-PERP',
    name: 'Aave',
    aster: 'AAVEUSDT',
    hyperliquid: 'AAVE',
    lighter: 'AAVE-USDC',
    multiplier: 1,
  },
  {
    canonical: 'CRV-PERP',
    name: 'Curve DAO',
    aster: 'CRVUSDT',
    hyperliquid: 'CRV',
    lighter: 'CRV-USDC',
    multiplier: 1,
  },
  {
    canonical: 'MKR-PERP',
    name: 'Maker',
    aster: 'MKRUSDT',
    hyperliquid: 'MKR',
    lighter: 'MKR-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SUSHI-PERP',
    name: 'SushiSwap',
    aster: 'SUSHIUSDT',
    hyperliquid: 'SUSHI',
    lighter: 'SUSHI-USDC',
    multiplier: 1,
  },
  {
    canonical: 'COMP-PERP',
    name: 'Compound',
    aster: 'COMPUSDT',
    hyperliquid: 'COMP',
    lighter: 'COMP-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SNX-PERP',
    name: 'Synthetix',
    aster: 'SNXUSDT',
    hyperliquid: 'SNX',
    lighter: 'SNX-USDC',
    multiplier: 1,
  },
  {
    canonical: 'LDO-PERP',
    name: 'Lido DAO',
    aster: 'LDOUSDT',
    hyperliquid: 'LDO',
    lighter: 'LDO-USDC',
    multiplier: 1,
  },
  {
    canonical: 'RNDR-PERP',
    name: 'Render',
    aster: 'RNDRUSDT',
    hyperliquid: 'RNDR',
    lighter: 'RNDR-USDC',
    multiplier: 1,
  },

  // Meme Coins & Trending
  {
    canonical: 'PEPE-PERP',
    name: 'Pepe',
    aster: '1000PEPEUSDT',
    hyperliquid: 'kPEPE',
    lighter: 'PEPE-USDC',
    multiplier: 1000,
  },
  {
    canonical: 'WIF-PERP',
    name: 'dogwifhat',
    aster: 'WIFUSDT',
    hyperliquid: 'WIF',
    lighter: 'WIF-USDC',
    multiplier: 1,
  },
  {
    canonical: 'BONK-PERP',
    name: 'Bonk',
    aster: '1000BONKUSDT',
    hyperliquid: 'kBONK',
    lighter: 'BONK-USDC',
    multiplier: 1000,
  },

  // New Ecosystems
  {
    canonical: 'APT-PERP',
    name: 'Aptos',
    aster: 'APTUSDT',
    hyperliquid: 'APT',
    lighter: 'APT-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SUI-PERP',
    name: 'Sui',
    aster: 'SUIUSDT',
    hyperliquid: 'SUI',
    lighter: 'SUI-USDC',
    multiplier: 1,
  },
  {
    canonical: 'INJ-PERP',
    name: 'Injective',
    aster: 'INJUSDT',
    hyperliquid: 'INJ',
    lighter: 'INJ-USDC',
    multiplier: 1,
  },
  {
    canonical: 'JUP-PERP',
    name: 'Jupiter',
    aster: 'JUPUSDT',
    hyperliquid: 'JUP',
    lighter: 'JUP-USDC',
    multiplier: 1,
  },
  {
    canonical: 'PYTH-PERP',
    name: 'Pyth Network',
    aster: 'PYTHUSDT',
    hyperliquid: 'PYTH',
    lighter: 'PYTH-USDC',
    multiplier: 1,
  },
  {
    canonical: 'W-PERP',
    name: 'Wormhole',
    aster: 'WUSDT',
    hyperliquid: 'W',
    lighter: 'W-USDC',
    multiplier: 1,
  },
  {
    canonical: 'BLUR-PERP',
    name: 'Blur',
    aster: 'BLURUSDT',
    hyperliquid: 'BLUR',
    lighter: 'BLUR-USDC',
    multiplier: 1,
  },

  // Gaming & NFT
  {
    canonical: 'AXS-PERP',
    name: 'Axie Infinity',
    aster: 'AXSUSDT',
    hyperliquid: 'AXS',
    lighter: 'AXS-USDC',
    multiplier: 1,
  },
  {
    canonical: 'GALA-PERP',
    name: 'Gala',
    aster: 'GALAUSDT',
    hyperliquid: 'GALA',
    lighter: 'GALA-USDC',
    multiplier: 1,
  },
  {
    canonical: 'MANA-PERP',
    name: 'Decentraland',
    aster: 'MANAUSDT',
    hyperliquid: 'MANA',
    lighter: 'MANA-USDC',
    multiplier: 1,
  },
  {
    canonical: 'SAND-PERP',
    name: 'The Sandbox',
    aster: 'SANDUSDT',
    hyperliquid: 'SAND',
    lighter: 'SAND-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ILV-PERP',
    name: 'Illuvium',
    aster: 'ILVUSDT',
    hyperliquid: 'ILV',
    lighter: 'ILV-USDC',
    multiplier: 1,
  },

  // Additional Popular Assets
  {
    canonical: 'FIL-PERP',
    name: 'Filecoin',
    aster: 'FILUSDT',
    hyperliquid: 'FIL',
    lighter: 'FIL-USDC',
    multiplier: 1,
  },
  {
    canonical: 'FTM-PERP',
    name: 'Fantom',
    aster: 'FTMUSDT',
    hyperliquid: 'FTM',
    lighter: 'FTM-USDC',
    multiplier: 1,
  },
  {
    canonical: 'XLM-PERP',
    name: 'Stellar',
    aster: 'XLMUSDT',
    hyperliquid: 'XLM',
    lighter: 'XLM-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ALGO-PERP',
    name: 'Algorand',
    aster: 'ALGOUSDT',
    hyperliquid: 'ALGO',
    lighter: 'ALGO-USDC',
    multiplier: 1,
  },
  {
    canonical: 'VET-PERP',
    name: 'VeChain',
    aster: 'VETUSDT',
    hyperliquid: 'VET',
    lighter: 'VET-USDC',
    multiplier: 1,
  },
  {
    canonical: 'ICP-PERP',
    name: 'Internet Computer',
    aster: 'ICPUSDT',
    hyperliquid: 'ICP',
    lighter: 'ICP-USDC',
    multiplier: 1,
  },
  {
    canonical: 'HBAR-PERP',
    name: 'Hedera',
    aster: 'HBARUSDT',
    hyperliquid: 'HBAR',
    lighter: 'HBAR-USDC',
    multiplier: 1,
  },
  {
    canonical: 'THETA-PERP',
    name: 'Theta',
    aster: 'THETAUSDT',
    hyperliquid: 'THETA',
    lighter: 'THETA-USDC',
    multiplier: 1,
  },
  {
    canonical: 'XTZ-PERP',
    name: 'Tezos',
    aster: 'XTZUSDT',
    hyperliquid: 'XTZ',
    lighter: 'XTZ-USDC',
    multiplier: 1,
  },
  {
    canonical: 'EOS-PERP',
    name: 'EOS',
    aster: 'EOSUSDT',
    hyperliquid: 'EOS',
    lighter: 'EOS-USDC',
    multiplier: 1,
  },
];

/**
 * Unified Symbol Mapping Engine
 */
export class UnifiedSymbolMapper {
  private symbolMap: Map<string, ExchangeSymbolMap>;
  private reverseMap: {
    aster: Map<string, string>;
    hyperliquid: Map<string, string>;
    lighter: Map<string, string>;
  };

  constructor() {
    this.symbolMap = new Map();
    this.reverseMap = {
      aster: new Map(),
      hyperliquid: new Map(),
      lighter: new Map(),
    };

    this.initializeMaps();
  }

  private initializeMaps() {
    UNIFIED_SYMBOL_MAP.forEach(mapping => {
      this.symbolMap.set(mapping.canonical, mapping);

      if (mapping.aster) {
        this.reverseMap.aster.set(mapping.aster, mapping.canonical);
      }
      if (mapping.hyperliquid) {
        this.reverseMap.hyperliquid.set(mapping.hyperliquid, mapping.canonical);
      }
      if (mapping.lighter) {
        this.reverseMap.lighter.set(mapping.lighter, mapping.canonical);
      }
    });
  }

  /**
   * Convert exchange-specific symbol to unified canonical format
   */
  toCanonical(symbol: string, exchange: 'aster' | 'hyperliquid' | 'lighter'): string | null {
    return this.reverseMap[exchange].get(symbol) || null;
  }

  /**
   * Convert canonical symbol to exchange-specific format
   */
  toExchangeSymbol(canonical: string, exchange: 'aster' | 'hyperliquid' | 'lighter'): string | null {
    const mapping = this.symbolMap.get(canonical);
    if (!mapping) return null;

    return mapping[exchange] || null;
  }

  /**
   * Get all symbols available on a specific exchange
   */
  getExchangeSymbols(exchange: 'aster' | 'hyperliquid' | 'lighter'): string[] {
    const symbols: string[] = [];
    this.symbolMap.forEach(mapping => {
      if (mapping[exchange]) {
        symbols.push(mapping[exchange]!);
      }
    });
    return symbols;
  }

  /**
   * Get all symbols available on multiple exchanges (for arbitrage)
   */
  getCommonSymbols(exchanges: Array<'aster' | 'hyperliquid' | 'lighter'>): ExchangeSymbolMap[] {
    const common: ExchangeSymbolMap[] = [];

    this.symbolMap.forEach(mapping => {
      const available = exchanges.every(ex => mapping[ex] !== undefined);
      if (available) {
        common.push(mapping);
      }
    });

    return common;
  }

  /**
   * Get complete mapping for a canonical symbol
   */
  getMapping(canonical: string): ExchangeSymbolMap | null {
    return this.symbolMap.get(canonical) || null;
  }

  /**
   * Get all mappings
   */
  getAllMappings(): ExchangeSymbolMap[] {
    return Array.from(this.symbolMap.values());
  }

  /**
   * Normalize funding rate to hourly rate for comparison
   */
  normalizeToHourlyRate(rate: number, frequency: 'hourly' | '8hourly'): number {
    if (frequency === '8hourly') {
      return rate / 8; // AsterDEX pays every 8 hours
    }
    return rate; // HyperLiquid and Lighter pay hourly
  }

  /**
   * Calculate APR from hourly rate
   */
  calculateAPR(hourlyRate: number): number {
    return hourlyRate * 24 * 365 * 100; // Convert to percentage
  }
}

// Export singleton instance
export const unifiedSymbolMapper = new UnifiedSymbolMapper();
