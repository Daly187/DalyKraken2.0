/**
 * Symbol Mapping Engine for Cross-Exchange Asset Monitoring
 * Handles symbol normalization, fuzzy matching, and multiplier detection
 */

export interface CanonicalSymbol {
  canonical: string;
  name: string;
  variants: string[];
  multipliers: { [exchange: string]: number };
}

export interface MatchedPair {
  canonical: string;
  aster?: {
    symbol: string;
    fundingRate: number;
    annualRate: number;
    markPrice: number;
    multiplier: number;
  };
  hyperliquid?: {
    symbol: string;
    fundingRate: number;
    annualRate: number;
    markPrice: number;
    multiplier: number;
  };
  spread?: number; // Funding rate difference
  annualSpread?: number; // Annual rate difference
  opportunity: 'long_aster_short_hl' | 'short_aster_long_hl' | 'none';
}

export interface AssetInfo {
  symbol: string;
  exchange: 'aster' | 'hyperliquid' | 'liquid';
  fundingRate: number;
  markPrice: number;
  volume24h?: number;
  openInterest?: number;
}

class SymbolMappingEngine {
  private symbolMappings: Map<string, CanonicalSymbol>;
  private customMappings: Map<string, string>; // User-defined mappings

  constructor() {
    this.symbolMappings = new Map();
    this.customMappings = new Map();
    this.initializeCanonicalSymbols();
  }

  /**
   * Initialize canonical symbol definitions with variants and multipliers
   */
  private initializeCanonicalSymbols() {
    const symbols: CanonicalSymbol[] = [
      // Top Market Cap Assets
      {
        canonical: 'BTC',
        name: 'Bitcoin',
        variants: ['BTC', 'BTCUSDT', 'BTC-USD', 'BTC-PERP', 'BTCPERP', 'XBT', 'XBTUSDT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ETH',
        name: 'Ethereum',
        variants: ['ETH', 'ETHUSDT', 'ETH-USD', 'ETH-PERP', 'ETHPERP', 'ETHER', 'ETHEREUM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BNB',
        name: 'BNB',
        variants: ['BNB', 'BNBUSDT', 'BNB-USD', 'BNB-PERP', 'BNBPERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SOL',
        name: 'Solana',
        variants: ['SOL', 'SOLUSDT', 'SOL-USD', 'SOL-PERP', 'SOLPERP', 'SOLANA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XRP',
        name: 'Ripple',
        variants: ['XRP', 'XRPUSDT', 'XRP-USD', 'XRP-PERP', 'XRPPERP', 'RIPPLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ADA',
        name: 'Cardano',
        variants: ['ADA', 'ADAUSDT', 'ADA-USD', 'ADA-PERP', 'ADAPERP', 'CARDANO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AVAX',
        name: 'Avalanche',
        variants: ['AVAX', 'AVAXUSDT', 'AVAX-USD', 'AVAX-PERP', 'AVAXPERP', 'AVALANCHE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DOGE',
        name: 'Dogecoin',
        variants: ['DOGE', 'DOGEUSDT', 'DOGE-USD', 'DOGE-PERP', 'DOGEPERP', 'DOGECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DOT',
        name: 'Polkadot',
        variants: ['DOT', 'DOTUSDT', 'DOT-USD', 'DOT-PERP', 'DOTPERP', 'POLKADOT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MATIC',
        name: 'Polygon',
        variants: ['MATIC', 'MATICUSDT', 'MATIC-USD', 'POL', 'POLUSDT', 'POLYGON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },

      // Layer 1 Blockchains
      {
        canonical: 'ATOM',
        name: 'Cosmos',
        variants: ['ATOM', 'ATOMUSDT', 'ATOM-USD', 'ATOM-PERP', 'COSMOS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LTC',
        name: 'Litecoin',
        variants: ['LTC', 'LTCUSDT', 'LTC-USD', 'LTC-PERP', 'LITECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BCH',
        name: 'Bitcoin Cash',
        variants: ['BCH', 'BCHUSDT', 'BCH-USD', 'BCH-PERP', 'BITCOINCASH'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ETC',
        name: 'Ethereum Classic',
        variants: ['ETC', 'ETCUSDT', 'ETC-USD', 'ETC-PERP', 'ETHEREUMCLASSIC'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FIL',
        name: 'Filecoin',
        variants: ['FIL', 'FILUSDT', 'FIL-USD', 'FIL-PERP', 'FILECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NEAR',
        name: 'Near Protocol',
        variants: ['NEAR', 'NEARUSDT', 'NEAR-USD', 'NEAR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'APT',
        name: 'Aptos',
        variants: ['APT', 'APTUSDT', 'APT-USD', 'APT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SUI',
        name: 'Sui',
        variants: ['SUI', 'SUIUSDT', 'SUI-USD', 'SUI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },

      // DeFi Tokens
      {
        canonical: 'UNI',
        name: 'Uniswap',
        variants: ['UNI', 'UNIUSDT', 'UNI-USD', 'UNI-PERP', 'UNISWAP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LINK',
        name: 'Chainlink',
        variants: ['LINK', 'LINKUSDT', 'LINK-USD', 'LINK-PERP', 'CHAINLINK'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AAVE',
        name: 'Aave',
        variants: ['AAVE', 'AAVEUSDT', 'AAVE-USD', 'AAVE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CRV',
        name: 'Curve',
        variants: ['CRV', 'CRVUSDT', 'CRV-USD', 'CRV-PERP', 'CURVE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MKR',
        name: 'Maker',
        variants: ['MKR', 'MKRUSDT', 'MKR-USD', 'MKR-PERP', 'MAKER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SNX',
        name: 'Synthetix',
        variants: ['SNX', 'SNXUSDT', 'SNX-USD', 'SNX-PERP', 'SYNTHETIX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },

      // Meme Coins (with multiplier handling)
      {
        canonical: 'PEPE',
        name: 'Pepe',
        variants: ['PEPE', 'PEPEUSDT', '1000PEPE', '1000PEPEUSDT', 'PEPE-1000'],
        multipliers: { aster: 1000, hyperliquid: 1000 }, // Default 1000x
      },
      {
        canonical: 'SHIB',
        name: 'Shiba Inu',
        variants: ['SHIB', 'SHIBUSDT', '1000SHIB', '1000SHIBUSDT', 'SHIB-1000'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
      {
        canonical: 'FLOKI',
        name: 'Floki',
        variants: ['FLOKI', 'FLOKIUSDT', '1000FLOKI', '1000FLOKIUSDT'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
      {
        canonical: 'BONK',
        name: 'Bonk',
        variants: ['BONK', 'BONKUSDT', '1000BONK', '1000BONKUSDT'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },

      // Layer 2 & Scaling
      {
        canonical: 'ARB',
        name: 'Arbitrum',
        variants: ['ARB', 'ARBUSDT', 'ARB-USD', 'ARB-PERP', 'ARBITRUM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OP',
        name: 'Optimism',
        variants: ['OP', 'OPUSDT', 'OP-USD', 'OP-PERP', 'OPTIMISM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },

      // AI & Compute
      {
        canonical: 'FET',
        name: 'Fetch.ai',
        variants: ['FET', 'FETUSDT', 'FET-USD', 'FET-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RNDR',
        name: 'Render',
        variants: ['RNDR', 'RNDRUSDT', 'RNDR-USD', 'RNDR-PERP', 'RENDER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'WLD',
        name: 'Worldcoin',
        variants: ['WLD', 'WLDUSDT', 'WLD-USD', 'WLD-PERP', 'WORLDCOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GRT',
        name: 'The Graph',
        variants: ['GRT', 'GRTUSDT', 'GRT-USD', 'GRT-PERP', 'GRAPH'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TAO',
        name: 'Bittensor',
        variants: ['TAO', 'TAOUSDT', 'TAO-USD', 'TAO-PERP', 'BITTENSOR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },

      // Gaming & Metaverse
      {
        canonical: 'SAND',
        name: 'Sandbox',
        variants: ['SAND', 'SANDUSDT', 'SAND-USD', 'SAND-PERP', 'SANDBOX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MANA',
        name: 'Decentraland',
        variants: ['MANA', 'MANAUSDT', 'MANA-USD', 'MANA-PERP', 'DECENTRALAND'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AXS',
        name: 'Axie Infinity',
        variants: ['AXS', 'AXSUSDT', 'AXS-USD', 'AXS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'IMX',
        name: 'Immutable X',
        variants: ['IMX', 'IMXUSDT', 'IMX-USD', 'IMX-PERP', 'IMMUTABLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GALA',
        name: 'Gala',
        variants: ['GALA', 'GALAUSDT', 'GALA-USD', 'GALA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PIXEL',
        name: 'Pixel',
        variants: ['PIXEL', 'PIXELUSDT', 'PIXEL-USD', 'PIXEL-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BLUR',
        name: 'Blur',
        variants: ['BLUR', 'BLURUSDT', 'BLUR-USD', 'BLUR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },

      // Additional Major Assets
      {
        canonical: 'TRX',
        name: 'Tron',
        variants: ['TRX', 'TRXUSDT', 'TRX-USD', 'TRX-PERP', 'TRON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XLM',
        name: 'Stellar',
        variants: ['XLM', 'XLMUSDT', 'XLM-USD', 'XLM-PERP', 'STELLAR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XMR',
        name: 'Monero',
        variants: ['XMR', 'XMRUSDT', 'XMR-USD', 'XMR-PERP', 'MONERO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'EOS',
        name: 'EOS',
        variants: ['EOS', 'EOSUSDT', 'EOS-USD', 'EOS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ALGO',
        name: 'Algorand',
        variants: ['ALGO', 'ALGOUSDT', 'ALGO-USD', 'ALGO-PERP', 'ALGORAND'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'VET',
        name: 'VeChain',
        variants: ['VET', 'VETUSDT', 'VET-USD', 'VET-PERP', 'VECHAIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ICP',
        name: 'Internet Computer',
        variants: ['ICP', 'ICPUSDT', 'ICP-USD', 'ICP-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HBAR',
        name: 'Hedera',
        variants: ['HBAR', 'HBARUSDT', 'HBAR-USD', 'HBAR-PERP', 'HEDERA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STX',
        name: 'Stacks',
        variants: ['STX', 'STXUSDT', 'STX-USD', 'STX-PERP', 'STACKS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'INJ',
        name: 'Injective',
        variants: ['INJ', 'INJUSDT', 'INJ-USD', 'INJ-PERP', 'INJECTIVE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SEI',
        name: 'Sei',
        variants: ['SEI', 'SEIUSDT', 'SEI-USD', 'SEI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TIA',
        name: 'Celestia',
        variants: ['TIA', 'TIAUSDT', 'TIA-USD', 'TIA-PERP', 'CELESTIA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RUNE',
        name: 'THORChain',
        variants: ['RUNE', 'RUNEUSDT', 'RUNE-USD', 'RUNE-PERP', 'THORCHAIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'THETA',
        name: 'Theta',
        variants: ['THETA', 'THETAUSDT', 'THETA-USD', 'THETA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FTM',
        name: 'Fantom',
        variants: ['FTM', 'FTMUSDT', 'FTM-USD', 'FTM-PERP', 'FANTOM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MINA',
        name: 'Mina',
        variants: ['MINA', 'MINAUSDT', 'MINA-USD', 'MINA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KAVA',
        name: 'Kava',
        variants: ['KAVA', 'KAVAUSDT', 'KAVA-USD', 'KAVA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FLOW',
        name: 'Flow',
        variants: ['FLOW', 'FLOWUSDT', 'FLOW-USD', 'FLOW-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'EGLD',
        name: 'MultiversX',
        variants: ['EGLD', 'EGLDUSDT', 'EGLD-USD', 'EGLD-PERP', 'ELROND'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XTZ',
        name: 'Tezos',
        variants: ['XTZ', 'XTZUSDT', 'XTZ-USD', 'XTZ-PERP', 'TEZOS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AR',
        name: 'Arweave',
        variants: ['AR', 'ARUSDT', 'AR-USD', 'AR-PERP', 'ARWEAVE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZIL',
        name: 'Zilliqa',
        variants: ['ZIL', 'ZILUSDT', 'ZIL-USD', 'ZIL-PERP', 'ZILLIQA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KAS',
        name: 'Kaspa',
        variants: ['KAS', 'KASUSDT', 'KAS-USD', 'KAS-PERP', 'KASPA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TON',
        name: 'Toncoin',
        variants: ['TON', 'TONUSDT', 'TON-USD', 'TON-PERP', 'TONCOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'COMP',
        name: 'Compound',
        variants: ['COMP', 'COMPUSDT', 'COMP-USD', 'COMP-PERP', 'COMPOUND'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SUSHI',
        name: 'SushiSwap',
        variants: ['SUSHI', 'SUSHIUSDT', 'SUSHI-USD', 'SUSHI-PERP', 'SUSHISWAP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZRX',
        name: '0x',
        variants: ['ZRX', 'ZRXUSDT', 'ZRX-USD', 'ZRX-PERP', '0X'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BAL',
        name: 'Balancer',
        variants: ['BAL', 'BALUSDT', 'BAL-USD', 'BAL-PERP', 'BALANCER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'YFI',
        name: 'Yearn Finance',
        variants: ['YFI', 'YFIUSDT', 'YFI-USD', 'YFI-PERP', 'YEARN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: '1INCH',
        name: '1inch',
        variants: ['1INCH', '1INCHUSDT', '1INCH-USD', '1INCH-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LDO',
        name: 'Lido DAO',
        variants: ['LDO', 'LDOUSDT', 'LDO-USD', 'LDO-PERP', 'LIDO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PENDLE',
        name: 'Pendle',
        variants: ['PENDLE', 'PENDLEUSDT', 'PENDLE-USD', 'PENDLE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'WOO',
        name: 'WOO Network',
        variants: ['WOO', 'WOOUSDT', 'WOO-USD', 'WOO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'JTO',
        name: 'Jito',
        variants: ['JTO', 'JTOUSDT', 'JTO-USD', 'JTO-PERP', 'JITO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'JUP',
        name: 'Jupiter',
        variants: ['JUP', 'JUPUSDT', 'JUP-USD', 'JUP-PERP', 'JUPITER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PYTH',
        name: 'Pyth Network',
        variants: ['PYTH', 'PYTHUSDT', 'PYTH-USD', 'PYTH-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'WIF',
        name: 'dogwifhat',
        variants: ['WIF', 'WIFUSDT', 'WIF-USD', 'WIF-PERP', 'DOGWIFHAT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ORDI',
        name: 'Ordinals',
        variants: ['ORDI', 'ORDIUSDT', 'ORDI-USD', 'ORDI-PERP', 'ORDINALS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STRK',
        name: 'Starknet',
        variants: ['STRK', 'STRKUSDT', 'STRK-USD', 'STRK-PERP', 'STARKNET'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DYDX',
        name: 'dYdX',
        variants: ['DYDX', 'DYDXUSDT', 'DYDX-USD', 'DYDX-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AEVO',
        name: 'Aevo',
        variants: ['AEVO', 'AEVOUSDT', 'AEVO-USD', 'AEVO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZK',
        name: 'zkSync',
        variants: ['ZK', 'ZKUSDT', 'ZK-USD', 'ZK-PERP', 'ZKSYNC'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BIGTIME',
        name: 'Big Time',
        variants: ['BIGTIME', 'BIGTIMEUSDT', 'BIGTIME-USD', 'BIGTIME-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BEAM',
        name: 'Beam',
        variants: ['BEAM', 'BEAMUSDT', 'BEAM-USD', 'BEAM-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'METIS',
        name: 'Metis',
        variants: ['METIS', 'METISUSDT', 'METIS-USD', 'METIS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MANTA',
        name: 'Manta Network',
        variants: ['MANTA', 'MANTAUSDT', 'MANTA-USD', 'MANTA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ENS',
        name: 'Ethereum Name Service',
        variants: ['ENS', 'ENSUSDT', 'ENS-USD', 'ENS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GMT',
        name: 'STEPN',
        variants: ['GMT', 'GMTUSDT', 'GMT-USD', 'GMT-PERP', 'STEPN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'APE',
        name: 'ApeCoin',
        variants: ['APE', 'APEUSDT', 'APE-USD', 'APE-PERP', 'APECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LRC',
        name: 'Loopring',
        variants: ['LRC', 'LRCUSDT', 'LRC-USD', 'LRC-PERP', 'LOOPRING'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MATIC',
        name: 'Polygon (POL)',
        variants: ['MATIC', 'MATICUSDT', 'POL', 'POLUSDT', 'POLYGON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MEW',
        name: 'cat in a dogs world',
        variants: ['MEW', 'MEWUSDT', 'MEW-USD', 'MEW-PERP', '1000MEWUSDT', '1000MEW'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
      {
        canonical: 'BOME',
        name: 'BOOK OF MEME',
        variants: ['BOME', 'BOMEUSDT', 'BOME-USD', 'BOME-PERP', '1000BOMEUSDT', '1000BOME'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
      {
        canonical: 'PEOPLE',
        name: 'ConstitutionDAO',
        variants: ['PEOPLE', 'PEOPLEUSDT', 'PEOPLE-USD', 'PEOPLE-PERP', '1000PEOPLEUSDT', '1000PEOPLE'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
      {
        canonical: 'RATS',
        name: 'Rats',
        variants: ['RATS', 'RATSUSDT', 'RATS-USD', 'RATS-PERP', '1000RATSUSDT', '1000RATS'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
    ];

    symbols.forEach(symbol => {
      this.symbolMappings.set(symbol.canonical, symbol);
    });
  }

  /**
   * Normalize exchange-specific symbol to canonical format
   */
  normalizeSymbol(rawSymbol: string): { canonical: string | null; multiplier: number } {
    // Remove common suffixes
    const cleaned = rawSymbol
      .toUpperCase()
      .replace(/USDT$|USD$|-USD$|-PERP$|PERP$/g, '')
      .trim();

    // Check for 1000x multiplier prefix
    const multiplierMatch = cleaned.match(/^1000(.+)$/);
    const baseSymbol = multiplierMatch ? multiplierMatch[1] : cleaned;
    const detectedMultiplier = multiplierMatch ? 1000 : 1;

    // Check custom mappings first
    if (this.customMappings.has(baseSymbol)) {
      return {
        canonical: this.customMappings.get(baseSymbol)!,
        multiplier: detectedMultiplier,
      };
    }

    // Direct match in canonical symbols
    if (this.symbolMappings.has(baseSymbol)) {
      return { canonical: baseSymbol, multiplier: detectedMultiplier };
    }

    // Check variants
    for (const [canonical, info] of this.symbolMappings) {
      if (info.variants.some(v => v.toUpperCase() === baseSymbol)) {
        return { canonical, multiplier: detectedMultiplier };
      }
    }

    // Fuzzy match as last resort
    const fuzzyMatch = this.fuzzyMatch(baseSymbol);
    if (fuzzyMatch && fuzzyMatch.score >= 0.8) {
      return { canonical: fuzzyMatch.canonical, multiplier: detectedMultiplier };
    }

    return { canonical: null, multiplier: 1 };
  }

  /**
   * Fuzzy match using Levenshtein distance
   */
  private fuzzyMatch(symbol: string): { canonical: string; score: number } | null {
    let bestMatch: { canonical: string; score: number } | null = null;

    for (const [canonical, info] of this.symbolMappings) {
      const allVariants = [canonical, ...info.variants];

      for (const variant of allVariants) {
        const distance = this.levenshteinDistance(symbol, variant.toUpperCase());
        const maxLen = Math.max(symbol.length, variant.length);
        const score = 1 - distance / maxLen;

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { canonical, score };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Match assets from both exchanges
   */
  matchAssets(asterAssets: AssetInfo[], hlAssets: AssetInfo[]): MatchedPair[] {
    const matchedPairs: Map<string, MatchedPair> = new Map();

    // Process AsterDEX assets
    asterAssets.forEach(asset => {
      const { canonical, multiplier } = this.normalizeSymbol(asset.symbol);
      if (!canonical) return;

      if (!matchedPairs.has(canonical)) {
        matchedPairs.set(canonical, {
          canonical,
          opportunity: 'none',
        });
      }

      const pair = matchedPairs.get(canonical)!;
      const paymentsPerDay = 3; // AsterDEX pays 8-hourly
      const annualRate = asset.fundingRate * paymentsPerDay * 365;

      pair.aster = {
        symbol: asset.symbol,
        fundingRate: asset.fundingRate,
        annualRate,
        markPrice: asset.markPrice,
        multiplier,
      };
    });

    // Process HyperLiquid assets
    hlAssets.forEach(asset => {
      const { canonical, multiplier } = this.normalizeSymbol(asset.symbol);
      if (!canonical) return;

      if (!matchedPairs.has(canonical)) {
        matchedPairs.set(canonical, {
          canonical,
          opportunity: 'none',
        });
      }

      const pair = matchedPairs.get(canonical)!;
      const paymentsPerDay = 24; // HyperLiquid pays hourly
      const annualRate = asset.fundingRate * paymentsPerDay * 365;

      pair.hyperliquid = {
        symbol: asset.symbol,
        fundingRate: asset.fundingRate,
        annualRate,
        markPrice: asset.markPrice,
        multiplier,
      };
    });

    // Calculate spreads and opportunities
    matchedPairs.forEach((pair, canonical) => {
      if (pair.aster && pair.hyperliquid) {
        // Adjust for multipliers if different
        const asterRate = pair.aster.fundingRate;
        const hlRate = pair.hyperliquid.fundingRate;

        pair.spread = asterRate - hlRate;
        pair.annualSpread = pair.aster.annualRate - pair.hyperliquid.annualRate;

        // Determine arbitrage opportunity
        if (Math.abs(pair.spread) > 0.01) { // At least 0.01% difference
          if (asterRate > hlRate) {
            pair.opportunity = 'short_aster_long_hl'; // Short expensive, long cheap
          } else {
            pair.opportunity = 'long_aster_short_hl'; // Long cheap, short expensive
          }
        } else {
          pair.opportunity = 'none';
        }
      }
    });

    return Array.from(matchedPairs.values())
      .filter(pair => pair.aster || pair.hyperliquid); // Only return pairs with at least one exchange
  }

  /**
   * Add custom symbol mapping
   */
  addCustomMapping(exchangeSymbol: string, canonical: string) {
    const normalized = exchangeSymbol.toUpperCase().replace(/USDT$|USD$/g, '');
    this.customMappings.set(normalized, canonical);
  }

  /**
   * Get all canonical symbols
   */
  getAllCanonicalSymbols(): CanonicalSymbol[] {
    return Array.from(this.symbolMappings.values());
  }

  /**
   * Get canonical symbol info
   */
  getCanonicalInfo(canonical: string): CanonicalSymbol | undefined {
    return this.symbolMappings.get(canonical.toUpperCase());
  }
}

export const symbolMappingEngine = new SymbolMappingEngine();
