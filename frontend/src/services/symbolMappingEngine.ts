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
  exchange: 'aster' | 'hyperliquid' | 'lighter';
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
      {
        canonical: 'CFX',
        name: 'Conflux',
        variants: ['CFX', 'CFXUSDT', 'CFX-USD', 'CFX-PERP', 'CONFLUX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GMX',
        name: 'GMX',
        variants: ['GMX', 'GMXUSDT', 'GMX-USD', 'GMX-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FXS',
        name: 'Frax Share',
        variants: ['FXS', 'FXSUSDT', 'FXS-USD', 'FXS-PERP', 'FRAX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HPOS',
        name: 'HPOS',
        variants: ['HPOS', 'HPOSUSDT', 'HPOS-USD', 'HPOS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RLB',
        name: 'Rollbit Coin',
        variants: ['RLB', 'RLBUSDT', 'RLB-USD', 'RLB-PERP', 'ROLLBIT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'UNIBOT',
        name: 'Unibot',
        variants: ['UNIBOT', 'UNIBOTUSDT', 'UNIBOT-USD', 'UNIBOT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'YGG',
        name: 'Yield Guild Games',
        variants: ['YGG', 'YGGUSDT', 'YGG-USD', 'YGG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FRIEND',
        name: 'Friend.tech',
        variants: ['FRIEND', 'FRIENDUSDT', 'FRIEND-USD', 'FRIEND-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NEIRO',
        name: 'Neiro',
        variants: ['NEIRO', 'NEIROUSDT', 'NEIRO-USD', 'NEIRO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CAKE',
        name: 'PancakeSwap',
        variants: ['CAKE', 'CAKEUSDT', 'CAKE-USD', 'CAKE-PERP', 'PANCAKESWAP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'JASMY',
        name: 'JasmyCoin',
        variants: ['JASMY', 'JASMYUSDT', 'JASMY-USD', 'JASMY-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ONDO',
        name: 'Ondo',
        variants: ['ONDO', 'ONDOUSDT', 'ONDO-USD', 'ONDO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'POPCAT',
        name: 'Popcat',
        variants: ['POPCAT', 'POPCATUSDT', 'POPCAT-USD', 'POPCAT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MOG',
        name: 'Mog Coin',
        variants: ['MOG', 'MOGUSDT', 'MOG-USD', 'MOG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TRUMP',
        name: 'MAGA',
        variants: ['TRUMP', 'TRUMPUSDT', 'TRUMP-USD', 'TRUMP-PERP', 'MAGA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MOTHER',
        name: 'Mother Iggy',
        variants: ['MOTHER', 'MOTHERUSDT', 'MOTHER-USD', 'MOTHER-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BRETT',
        name: 'Brett',
        variants: ['BRETT', 'BRETTUSDT', 'BRETT-USD', 'BRETT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TURBO',
        name: 'Turbo',
        variants: ['TURBO', 'TURBOUSDT', 'TURBO-USD', 'TURBO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MOODENG',
        name: 'Moo Deng',
        variants: ['MOODENG', 'MOODENGUSDT', 'MOODENG-USD', 'MOODENG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RENDER',
        name: 'Render Token',
        variants: ['RENDER', 'RENDERUSDT', 'RENDER-USD', 'RENDER-PERP', 'RNDR', 'RNDRUSDT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ENA',
        name: 'Ethena',
        variants: ['ENA', 'ENAUSDT', 'ENA-USD', 'ENA-PERP', 'ETHENA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GOAT',
        name: 'Goatseus Maximus',
        variants: ['GOAT', 'GOATUSDT', 'GOAT-USD', 'GOAT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PNUT',
        name: 'Peanut',
        variants: ['PNUT', 'PNUTUSDT', 'PNUT-USD', 'PNUT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CETUS',
        name: 'Cetus Protocol',
        variants: ['CETUS', 'CETUSUSDT', 'CETUS-USD', 'CETUS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ACT',
        name: 'Achain',
        variants: ['ACT', 'ACTUSDT', 'ACT-USD', 'ACT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CHILLGUY',
        name: 'Chill Guy',
        variants: ['CHILLGUY', 'CHILLGUYUSDT', 'CHILLGUY-USD', 'CHILLGUY-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MORPHO',
        name: 'Morpho',
        variants: ['MORPHO', 'MORPHOUSDT', 'MORPHO-USD', 'MORPHO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GRASS',
        name: 'Grass',
        variants: ['GRASS', 'GRASSUSDT', 'GRASS-USD', 'GRASS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'EIGEN',
        name: 'EigenLayer',
        variants: ['EIGEN', 'EIGENUSDT', 'EIGEN-USD', 'EIGEN-PERP', 'EIGENLAYER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'VIRTUAL',
        name: 'Virtual Protocol',
        variants: ['VIRTUAL', 'VIRTUALUSDT', 'VIRTUAL-USD', 'VIRTUAL-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AI16Z',
        name: 'ai16z',
        variants: ['AI16Z', 'AI16ZUSDT', 'AI16Z-USD', 'AI16Z-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZEREBRO',
        name: 'Zerebro',
        variants: ['ZEREBRO', 'ZEREBROUSDT', 'ZEREBRO-USD', 'ZEREBRO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GRIFFAIN',
        name: 'Griffain',
        variants: ['GRIFFAIN', 'GRIFFAINUSDT', 'GRIFFAIN-USD', 'GRIFFAIN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FARTCOIN',
        name: 'Fartcoin',
        variants: ['FARTCOIN', 'FARTCOINUSDT', 'FARTCOIN-USD', 'FARTCOIN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MOVE',
        name: 'Move',
        variants: ['MOVE', 'MOVEUSDT', 'MOVE-USD', 'MOVE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ME',
        name: 'Magic Eden',
        variants: ['ME', 'MEUSDT', 'ME-USD', 'ME-PERP', 'MAGICEDEN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HYPE',
        name: 'Hyperliquid',
        variants: ['HYPE', 'HYPEUSDT', 'HYPE-USD', 'HYPE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'COOKIE',
        name: 'Cookie DAO',
        variants: ['COOKIE', 'COOKIEUSDT', 'COOKIE-USD', 'COOKIE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FWOG',
        name: 'Fwog',
        variants: ['FWOG', 'FWOGUSDT', 'FWOG-USD', 'FWOG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GIGA',
        name: 'Giga',
        variants: ['GIGA', 'GIGAUSDT', 'GIGA-USD', 'GIGA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PUMPBTC',
        name: 'PumpBTC',
        variants: ['PUMPBTC', 'PUMPBTCUSDT', 'PUMPBTC-USD', 'PUMPBTC-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RETARDIO',
        name: 'Retardio',
        variants: ['RETARDIO', 'RETARDIOUSDT', 'RETARDIO-USD', 'RETARDIO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Recently added symbols from unmapped lists
      {
        canonical: 'OX',
        name: '0x Protocol',
        variants: ['OX', 'OXUSDT', 'OX-USD', 'OX-PERP', '0X'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SHIA',
        name: 'Shia',
        variants: ['SHIA', 'SHIAUSDT', 'SHIA-USD', 'SHIA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CYBER',
        name: 'CyberConnect',
        variants: ['CYBER', 'CYBERUSDT', 'CYBER-USD', 'CYBER-PERP', 'CYBERCONNECT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // AsterDEX-specific symbols
      {
        canonical: 'ASTER',
        name: 'AsterDEX Token',
        variants: ['ASTER', 'ASTERUSDT', 'ASTER-USD', 'ASTER-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LISTA',
        name: 'Lista',
        variants: ['LISTA', 'LISTAUSDT', 'LISTA-USD', 'LISTA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZORA',
        name: 'Zora',
        variants: ['ZORA', 'ZORAUSDT', 'ZORA-USD', 'ZORA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TAG',
        name: 'Tag Protocol',
        variants: ['TAG', 'TAGUSDT', 'TAG-USD', 'TAG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'C',
        name: 'C Token',
        variants: ['C', 'CUSDT', 'C-USD', 'C-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'INU',
        name: 'INU',
        variants: ['INU', 'INUSDT', 'INU-USD', 'INU-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'USD1',
        name: 'USD1',
        variants: ['USD1', 'USD1USDT', 'USD1-USD', 'USD1-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SAHARA',
        name: 'Sahara',
        variants: ['SAHARA', 'SAHARAUSDT', 'SAHARA-USD', 'SAHARA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PUMP',
        name: 'Pump',
        variants: ['PUMP', 'PUMPUSDT', 'PUMP-USD', 'PUMP-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AAPLUS',
        name: 'AA+',
        variants: ['AAPLUS', 'AAPLUSDT', 'AAPLUS-USD', 'AAPLUS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PENGU',
        name: 'Pengu',
        variants: ['PENGU', 'PENGUUSDT', 'PENGU-USD', 'PENGU-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SBET',
        name: 'SBET',
        variants: ['SBET', 'SBETUSDT', 'SBET-USD', 'SBET-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SPK',
        name: 'SPK',
        variants: ['SPK', 'SPKUSDT', 'SPK-USD', 'SPK-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PORT3',
        name: 'Port3 Network',
        variants: ['PORT3', 'PORT3USDT', 'PORT3-USD', 'PORT3-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TREE',
        name: 'Tree',
        variants: ['TREE', 'TREEUSDT', 'TREE-USD', 'TREE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZRC',
        name: 'ZRC',
        variants: ['ZRC', 'ZRCUSDT', 'ZRC-USD', 'ZRC-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ESPORTS',
        name: 'eSports',
        variants: ['ESPORTS', 'ESPORTSUSDT', 'ESPORTS-USD', 'ESPORTS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Stock/equity perpetuals (AsterDEX)
      {
        canonical: 'TSLA',
        name: 'Tesla',
        variants: ['TSLA', 'TSLAUSDT', 'TSLA-USD', 'TSLA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NVDA',
        name: 'Nvidia',
        variants: ['NVDA', 'NVDAUSDT', 'NVDA-USD', 'NVDA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AMZN',
        name: 'Amazon',
        variants: ['AMZN', 'AMZNUSDT', 'AMZN-USD', 'AMZN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'META',
        name: 'Meta',
        variants: ['META', 'METAUSDT', 'META-USD', 'META-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GOOG',
        name: 'Google',
        variants: ['GOOG', 'GOOGUSDT', 'GOOG-USD', 'GOOG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MSFT',
        name: 'Microsoft',
        variants: ['MSFT', 'MSFTUSDT', 'MSFT-USD', 'MSFT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Additional HyperLiquid assets
      {
        canonical: 'ZRO',
        name: 'LayerZero',
        variants: ['ZRO', 'ZROUSDT', 'ZRO-USD', 'ZRO-PERP', 'LAYERZERO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BLZ',
        name: 'Bluzelle',
        variants: ['BLZ', 'BLZUSDT', 'BLZ-USD', 'BLZ-PERP', 'BLUZELLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BANANA',
        name: 'Banana',
        variants: ['BANANA', 'BANANAUSDT', 'BANANA-USD', 'BANANA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TRB',
        name: 'Tellor',
        variants: ['TRB', 'TRBUSDT', 'TRB-USD', 'TRB-PERP', 'TELLOR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FTT',
        name: 'FTX Token',
        variants: ['FTT', 'FTTUSDT', 'FTT-USD', 'FTT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LOOM',
        name: 'Loom Network',
        variants: ['LOOM', 'LOOMUSDT', 'LOOM-USD', 'LOOM-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OGN',
        name: 'Origin Protocol',
        variants: ['OGN', 'OGNUSDT', 'OGN-USD', 'OGN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RDNT',
        name: 'Radiant Capital',
        variants: ['RDNT', 'RDNTUSDT', 'RDNT-USD', 'RDNT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ARK',
        name: 'Ark',
        variants: ['ARK', 'ARKUSDT', 'ARK-USD', 'ARK-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BNT',
        name: 'Bancor',
        variants: ['BNT', 'BNTUSDT', 'BNT-USD', 'BNT-PERP', 'BANCOR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Additional AsterDEX assets
      {
        canonical: 'TOWNS',
        name: 'Towns',
        variants: ['TOWNS', 'TOWNSUSDT', 'TOWNS-USD', 'TOWNS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PROVE',
        name: 'Prove',
        variants: ['PROVE', 'PROVEUSDT', 'PROVE-USD', 'PROVE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XNY',
        name: 'XNY',
        variants: ['XNY', 'XNYUSDT', 'XNY-USD', 'XNY-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AIO',
        name: 'AIO',
        variants: ['AIO', 'AIOUSDT', 'AIO-USD', 'AIO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DAM',
        name: 'DAM',
        variants: ['DAM', 'DAMUSDT', 'DAM-USD', 'DAM-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SAPIEN',
        name: 'Sapien',
        variants: ['SAPIEN', 'SAPIENUSDT', 'SAPIEN-USD', 'SAPIEN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CUDIS',
        name: 'Cudis',
        variants: ['CUDIS', 'CUDISUSDT', 'CUDIS-USD', 'CUDIS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Massive expansion - adding 100+ more symbols
      // DeFi protocols
      {
        canonical: 'SUSHI',
        name: 'SushiSwap',
        variants: ['SUSHI', 'SUSHIUSDT', 'SUSHI-USD', 'SUSHI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ALCX',
        name: 'Alchemix',
        variants: ['ALCX', 'ALCXUSDT', 'ALCX-USD', 'ALCX-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CVX',
        name: 'Convex Finance',
        variants: ['CVX', 'CVXUSDT', 'CVX-USD', 'CVX-PERP', 'CONVEX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BADGER',
        name: 'Badger DAO',
        variants: ['BADGER', 'BADGERUSDT', 'BADGER-USD', 'BADGER-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Layer 1s and Layer 2s
      {
        canonical: 'CELO',
        name: 'Celo',
        variants: ['CELO', 'CELOUSDT', 'CELO-USD', 'CELO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ROSE',
        name: 'Oasis Network',
        variants: ['ROSE', 'ROSEUSDT', 'ROSE-USD', 'ROSE-PERP', 'OASIS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ONE',
        name: 'Harmony',
        variants: ['ONE', 'ONEUSDT', 'ONE-USD', 'ONE-PERP', 'HARMONY'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CANTO',
        name: 'Canto',
        variants: ['CANTO', 'CANTOUSDT', 'CANTO-USD', 'CANTO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'QTUM',
        name: 'Qtum',
        variants: ['QTUM', 'QTUMUSDT', 'QTUM-USD', 'QTUM-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'WAVES',
        name: 'Waves',
        variants: ['WAVES', 'WAVESUSDT', 'WAVES-USD', 'WAVES-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'IOTX',
        name: 'IoTeX',
        variants: ['IOTX', 'IOTXUSDT', 'IOTX-USD', 'IOTX-PERP', 'IOTEX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GLMR',
        name: 'Moonbeam',
        variants: ['GLMR', 'GLMRUSDT', 'GLMR-USD', 'GLMR-PERP', 'MOONBEAM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MOVR',
        name: 'Moonriver',
        variants: ['MOVR', 'MOVRUSDT', 'MOVR-USD', 'MOVR-PERP', 'MOONRIVER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KLAY',
        name: 'Klaytn',
        variants: ['KLAY', 'KLAYUSDT', 'KLAY-USD', 'KLAY-PERP', 'KLAYTN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Gaming and NFT
      {
        canonical: 'ENJ',
        name: 'Enjin Coin',
        variants: ['ENJ', 'ENJUSDT', 'ENJ-USD', 'ENJ-PERP', 'ENJIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CHZ',
        name: 'Chiliz',
        variants: ['CHZ', 'CHZUSDT', 'CHZ-USD', 'CHZ-PERP', 'CHILIZ'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ALICE',
        name: 'My Neighbor Alice',
        variants: ['ALICE', 'ALICEUSDT', 'ALICE-USD', 'ALICE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SLP',
        name: 'Smooth Love Potion',
        variants: ['SLP', 'SLPUSDT', 'SLP-USD', 'SLP-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SAND',
        name: 'The Sandbox',
        variants: ['SAND', 'SANDUSDT', 'SAND-USD', 'SAND-PERP', 'SANDBOX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GODS',
        name: 'Gods Unchained',
        variants: ['GODS', 'GODSUSDT', 'GODS-USD', 'GODS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GHST',
        name: 'Aavegotchi',
        variants: ['GHST', 'GHSTUSDT', 'GHST-USD', 'GHST-PERP', 'AAVEGOTCHI'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Oracle and Data
      {
        canonical: 'BAND',
        name: 'Band Protocol',
        variants: ['BAND', 'BANDUSDT', 'BAND-USD', 'BAND-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'API3',
        name: 'API3',
        variants: ['API3', 'API3USDT', 'API3-USD', 'API3-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DIA',
        name: 'DIA',
        variants: ['DIA', 'DIAUSDT', 'DIA-USD', 'DIA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Infrastructure
      {
        canonical: 'ANKR',
        name: 'Ankr',
        variants: ['ANKR', 'ANKRUSDT', 'ANKR-USD', 'ANKR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SKL',
        name: 'SKALE',
        variants: ['SKL', 'SKLUSDT', 'SKL-USD', 'SKL-PERP', 'SKALE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MATIC',
        name: 'Polygon',
        variants: ['MATIC', 'MATICUSDT', 'MATIC-USD', 'POL', 'POLUSDT', 'POLYGON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CELR',
        name: 'Celer Network',
        variants: ['CELR', 'CELRUSDT', 'CELR-USD', 'CELR-PERP', 'CELER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Privacy
      {
        canonical: 'ZEC',
        name: 'Zcash',
        variants: ['ZEC', 'ZECUSDT', 'ZEC-USD', 'ZEC-PERP', 'ZCASH'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DASH',
        name: 'Dash',
        variants: ['DASH', 'DASHUSDT', 'DASH-USD', 'DASH-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SCRT',
        name: 'Secret',
        variants: ['SCRT', 'SCRTUSDT', 'SCRT-USD', 'SCRT-PERP', 'SECRET'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Exchange tokens
      {
        canonical: 'CRO',
        name: 'Cronos',
        variants: ['CRO', 'CROUSDT', 'CRO-USD', 'CRO-PERP', 'CRONOS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HT',
        name: 'Huobi Token',
        variants: ['HT', 'HTUSDT', 'HT-USD', 'HT-PERP', 'HUOBI'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OKB',
        name: 'OKB',
        variants: ['OKB', 'OKBUSDT', 'OKB-USD', 'OKB-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KCS',
        name: 'KuCoin Token',
        variants: ['KCS', 'KCSUSDT', 'KCS-USD', 'KCS-PERP', 'KUCOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Meme coins
      {
        canonical: 'ELON',
        name: 'Dogelon Mars',
        variants: ['ELON', 'ELONUSDT', 'ELON-USD', 'ELON-PERP', 'DOGELON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BABYDOGE',
        name: 'Baby Doge Coin',
        variants: ['BABYDOGE', 'BABYDOGEUSDT', 'BABYDOGE-USD', 'BABYDOGE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STARL',
        name: 'Starlink',
        variants: ['STARL', 'STARLUSDT', 'STARL-USD', 'STARL-PERP', 'STARLINK'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KISHU',
        name: 'Kishu Inu',
        variants: ['KISHU', 'KISHUUSDT', 'KISHU-USD', 'KISHU-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // More DeFi
      {
        canonical: 'ALPHA',
        name: 'Alpha Finance',
        variants: ['ALPHA', 'ALPHAUSDT', 'ALPHA-USD', 'ALPHA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PERP',
        name: 'Perpetual Protocol',
        variants: ['PERP', 'PERPUSDT', 'PERP-USD', 'PERP-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RARI',
        name: 'Rarible',
        variants: ['RARI', 'RARIUSDT', 'RARI-USD', 'RARI-PERP', 'RARIBLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OCEAN',
        name: 'Ocean Protocol',
        variants: ['OCEAN', 'OCEANUSDT', 'OCEAN-USD', 'OCEAN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'REQ',
        name: 'Request',
        variants: ['REQ', 'REQUSDT', 'REQ-USD', 'REQ-PERP', 'REQUEST'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OMG',
        name: 'OMG Network',
        variants: ['OMG', 'OMGUSDT', 'OMG-USD', 'OMG-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ICX',
        name: 'ICON',
        variants: ['ICX', 'ICXUSDT', 'ICX-USD', 'ICX-PERP', 'ICON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LSK',
        name: 'Lisk',
        variants: ['LSK', 'LSKUSDT', 'LSK-USD', 'LSK-PERP', 'LISK'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SC',
        name: 'Siacoin',
        variants: ['SC', 'SCUSDT', 'SC-USD', 'SC-PERP', 'SIACOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ONT',
        name: 'Ontology',
        variants: ['ONT', 'ONTUSDT', 'ONT-USD', 'ONT-PERP', 'ONTOLOGY'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZEN',
        name: 'Horizen',
        variants: ['ZEN', 'ZENUSDT', 'ZEN-USD', 'ZEN-PERP', 'HORIZEN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RVN',
        name: 'Ravencoin',
        variants: ['RVN', 'RVNUSDT', 'RVN-USD', 'RVN-PERP', 'RAVENCOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DENT',
        name: 'Dent',
        variants: ['DENT', 'DENTUSDT', 'DENT-USD', 'DENT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HOT',
        name: 'Holo',
        variants: ['HOT', 'HOTUSDT', 'HOT-USD', 'HOT-PERP', 'HOLO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'IOST',
        name: 'IOST',
        variants: ['IOST', 'IOSTUSDT', 'IOST-USD', 'IOST-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STEEM',
        name: 'Steem',
        variants: ['STEEM', 'STEEMUSDT', 'STEEM-USD', 'STEEM-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BTT',
        name: 'BitTorrent',
        variants: ['BTT', 'BTTUSDT', 'BTT-USD', 'BTT-PERP', 'BITTORRENT'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
      {
        canonical: 'WIN',
        name: 'WINkLink',
        variants: ['WIN', 'WINUSDT', 'WIN-USD', 'WIN-PERP', 'WINKLINK'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Stablecoins and wrapped assets
      {
        canonical: 'WBTC',
        name: 'Wrapped Bitcoin',
        variants: ['WBTC', 'WBTCUSDT', 'WBTC-USD', 'WBTC-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'WETH',
        name: 'Wrapped Ethereum',
        variants: ['WETH', 'WETHUSDT', 'WETH-USD', 'WETH-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'USDC',
        name: 'USD Coin',
        variants: ['USDC', 'USDCUSDT', 'USDC-USD', 'USDC-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DAI',
        name: 'Dai',
        variants: ['DAI', 'DAIUSDT', 'DAI-USD', 'DAI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'USDT',
        name: 'Tether',
        variants: ['USDT', 'USDTUSDT', 'USDT-USD', 'USDT-PERP', 'TETHER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BUSD',
        name: 'Binance USD',
        variants: ['BUSD', 'BUSDUSDT', 'BUSD-USD', 'BUSD-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TUSD',
        name: 'TrueUSD',
        variants: ['TUSD', 'TUSDUSDT', 'TUSD-USD', 'TUSD-PERP', 'TRUEUSD'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'USDP',
        name: 'Pax Dollar',
        variants: ['USDP', 'USDPUSDT', 'USDP-USD', 'USDP-PERP', 'PAX', 'PAXUSDT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // More recent additions
      {
        canonical: 'BLUR',
        name: 'Blur',
        variants: ['BLUR', 'BLURUSDT', 'BLUR-USD', 'BLUR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MAGIC',
        name: 'Magic',
        variants: ['MAGIC', 'MAGICUSDT', 'MAGIC-USD', 'MAGIC-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HIGH',
        name: 'Highstreet',
        variants: ['HIGH', 'HIGHUSDT', 'HIGH-USD', 'HIGH-PERP', 'HIGHSTREET'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ID',
        name: 'Space ID',
        variants: ['ID', 'IDUSDT', 'ID-USD', 'ID-PERP', 'SPACEID'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HOOK',
        name: 'Hooked Protocol',
        variants: ['HOOK', 'HOOKUSDT', 'HOOK-USD', 'HOOK-PERP', 'HOOKED'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'EDU',
        name: 'Open Campus',
        variants: ['EDU', 'EDUUSDT', 'EDU-USD', 'EDU-PERP', 'OPENCAMPUS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SUI',
        name: 'Sui',
        variants: ['SUI', 'SUIUSDT', 'SUI-USD', 'SUI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BLUR',
        name: 'Blur',
        variants: ['BLUR', 'BLURUSDT', 'BLUR-USD', 'BLUR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MAV',
        name: 'Maverick Protocol',
        variants: ['MAV', 'MAVUSDT', 'MAV-USD', 'MAV-PERP', 'MAVERICK'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PEPE2',
        name: 'Pepe 2.0',
        variants: ['PEPE2', 'PEPE2USDT', 'PEPE2-USD', 'PEPE2-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'COMBO',
        name: 'Combo',
        variants: ['COMBO', 'COMBOUSDT', 'COMBO-USD', 'COMBO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CYBER',
        name: 'CyberConnect',
        variants: ['CYBER', 'CYBERUSDT', 'CYBER-USD', 'CYBER-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LOOKS',
        name: 'LooksRare',
        variants: ['LOOKS', 'LOOKSUSDT', 'LOOKS-USD', 'LOOKS-PERP', 'LOOKSRARE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'APE',
        name: 'ApeCoin',
        variants: ['APE', 'APEUSDT', 'APE-USD', 'APE-PERP', 'APECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Round 2: Adding all remaining failed normalization symbols
      // HyperLiquid failed normalizations
      {
        canonical: 'KAS',
        name: 'Kaspa',
        variants: ['KAS', 'KASUSDT', 'KAS-USD', 'KAS-PERP', 'KASPA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ORBS',
        name: 'Orbs',
        variants: ['ORBS', 'ORBSUSDT', 'ORBS-USD', 'ORBS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BSV',
        name: 'Bitcoin SV',
        variants: ['BSV', 'BSVUSDT', 'BSV-USD', 'BSV-PERP', 'BITCOINSV'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'POLYX',
        name: 'Polymesh',
        variants: ['POLYX', 'POLYXUSDT', 'POLYX-USD', 'POLYX-PERP', 'POLYMESH'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GAS',
        name: 'Gas',
        variants: ['GAS', 'GASUSDT', 'GAS-USD', 'GAS-PERP', 'NEO GAS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STG',
        name: 'Stargate Finance',
        variants: ['STG', 'STGUSDT', 'STG-USD', 'STG-PERP', 'STARGATE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STRAX',
        name: 'Stratis',
        variants: ['STRAX', 'STRAXUSDT', 'STRAX-USD', 'STRAX-PERP', 'STRATIS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MEME',
        name: 'Memecoin',
        variants: ['MEME', 'MEMEUSDT', 'MEME-USD', 'MEME-PERP', 'MEMECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NEO',
        name: 'Neo',
        variants: ['NEO', 'NEOUSDT', 'NEO-USD', 'NEO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ILV',
        name: 'Illuvium',
        variants: ['ILV', 'ILVUSDT', 'ILV-USD', 'ILV-PERP', 'ILLUVIUM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // AsterDEX failed normalizations
      {
        canonical: 'WLFI',
        name: 'WLFI',
        variants: ['WLFI', 'WLFIUSDT', 'WLFI-USD', 'WLFI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XPLUS',
        name: 'XPLUS',
        variants: ['XPLUS', 'XPLUSDT', 'XPLUS-USD', 'XPLUS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BAS',
        name: 'BAS',
        variants: ['BAS', 'BASUSDT', 'BAS-USD', 'BAS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BTR',
        name: 'BTR',
        variants: ['BTR', 'BTRUSDT', 'BTR-USD', 'BTR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MITOU',
        name: 'MITOU',
        variants: ['MITOU', 'MITOUSDT', 'MITOU-USD', 'MITOU-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HEMI',
        name: 'HEMI',
        variants: ['HEMI', 'HEMIUSDT', 'HEMI-USD', 'HEMI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LINEA',
        name: 'Linea',
        variants: ['LINEA', 'LINEAUSDT', 'LINEA-USD', 'LINEA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // More common symbols likely on both exchanges
      {
        canonical: 'VET',
        name: 'VeChain',
        variants: ['VET', 'VETUSDT', 'VET-USD', 'VET-PERP', 'VECHAIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'THETA',
        name: 'Theta',
        variants: ['THETA', 'THETAUSDT', 'THETA-USD', 'THETA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TFUEL',
        name: 'Theta Fuel',
        variants: ['TFUEL', 'TFUELUSDT', 'TFUEL-USD', 'TFUEL-PERP', 'THETAFUEL'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZIL',
        name: 'Zilliqa',
        variants: ['ZIL', 'ZILUSDT', 'ZIL-USD', 'ZIL-PERP', 'ZILLIQA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XTZ',
        name: 'Tezos',
        variants: ['XTZ', 'XTZUSDT', 'XTZ-USD', 'XTZ-PERP', 'TEZOS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ALGO',
        name: 'Algorand',
        variants: ['ALGO', 'ALGOUSDT', 'ALGO-USD', 'ALGO-PERP', 'ALGORAND'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'EGLD',
        name: 'MultiversX',
        variants: ['EGLD', 'EGLDUSDT', 'EGLD-USD', 'EGLD-PERP', 'ELROND', 'MULTIVERSX'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FIL',
        name: 'Filecoin',
        variants: ['FIL', 'FILUSDT', 'FIL-USD', 'FIL-PERP', 'FILECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'HBAR',
        name: 'Hedera',
        variants: ['HBAR', 'HBARUSDT', 'HBAR-USD', 'HBAR-PERP', 'HEDERA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ICP',
        name: 'Internet Computer',
        variants: ['ICP', 'ICPUSDT', 'ICP-USD', 'ICP-PERP', 'INTERNETCOMPUTER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'FLOW',
        name: 'Flow',
        variants: ['FLOW', 'FLOWUSDT', 'FLOW-USD', 'FLOW-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MINA',
        name: 'Mina',
        variants: ['MINA', 'MINAUSDT', 'MINA-USD', 'MINA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ASTR',
        name: 'Astar',
        variants: ['ASTR', 'ASTRUSDT', 'ASTR-USD', 'ASTR-PERP', 'ASTAR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OSMO',
        name: 'Osmosis',
        variants: ['OSMO', 'OSMOUSDT', 'OSMO-USD', 'OSMO-PERP', 'OSMOSIS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'JUNO',
        name: 'Juno',
        variants: ['JUNO', 'JUNOUSDT', 'JUNO-USD', 'JUNO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SCRT',
        name: 'Secret',
        variants: ['SCRT', 'SCRTUSDT', 'SCRT-USD', 'SCRT-PERP', 'SECRET'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KAVA',
        name: 'Kava',
        variants: ['KAVA', 'KAVAUSDT', 'KAVA-USD', 'KAVA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LUNA',
        name: 'Terra',
        variants: ['LUNA', 'LUNAUSDT', 'LUNA-USD', 'LUNA-PERP', 'TERRA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LUNC',
        name: 'Terra Classic',
        variants: ['LUNC', 'LUNCUSDT', 'LUNC-USD', 'LUNC-PERP', 'TERRACLASSIC'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'USTC',
        name: 'TerraClassicUSD',
        variants: ['USTC', 'USTCUSDT', 'USTC-USD', 'USTC-PERP', 'UST'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NEAR',
        name: 'NEAR Protocol',
        variants: ['NEAR', 'NEARUSDT', 'NEAR-USD', 'NEAR-PERP', 'NEARPROTOCOL'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AXS',
        name: 'Axie Infinity',
        variants: ['AXS', 'AXSUSDT', 'AXS-USD', 'AXS-PERP', 'AXIE', 'AXIEINFINITY'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GALA',
        name: 'Gala',
        variants: ['GALA', 'GALAUSDT', 'GALA-USD', 'GALA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MANA',
        name: 'Decentraland',
        variants: ['MANA', 'MANAUSDT', 'MANA-USD', 'MANA-PERP', 'DECENTRALAND'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XLM',
        name: 'Stellar',
        variants: ['XLM', 'XLMUSDT', 'XLM-USD', 'XLM-PERP', 'STELLAR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'EOS',
        name: 'EOS',
        variants: ['EOS', 'EOSUSDT', 'EOS-USD', 'EOS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ETC',
        name: 'Ethereum Classic',
        variants: ['ETC', 'ETCUSDT', 'ETC-USD', 'ETC-PERP', 'ETHEREUMCLASSIC'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XMR',
        name: 'Monero',
        variants: ['XMR', 'XMRUSDT', 'XMR-USD', 'XMR-PERP', 'MONERO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ATOM',
        name: 'Cosmos',
        variants: ['ATOM', 'ATOMUSDT', 'ATOM-USD', 'ATOM-PERP', 'COSMOS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DOT',
        name: 'Polkadot',
        variants: ['DOT', 'DOTUSDT', 'DOT-USD', 'DOT-PERP', 'POLKADOT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AVAX',
        name: 'Avalanche',
        variants: ['AVAX', 'AVAXUSDT', 'AVAX-USD', 'AVAX-PERP', 'AVALANCHE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'UNI',
        name: 'Uniswap',
        variants: ['UNI', 'UNIUSDT', 'UNI-USD', 'UNI-PERP', 'UNISWAP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CAKE',
        name: 'PancakeSwap',
        variants: ['CAKE', 'CAKEUSDT', 'CAKE-USD', 'CAKE-PERP', 'PANCAKESWAP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Round 3: Final push - adding all remaining unmapped symbols
      // HyperLiquid remaining failed normalizations
      {
        canonical: 'SUPER',
        name: 'SuperVerse',
        variants: ['SUPER', 'SUPERUSDT', 'SUPER-USD', 'SUPER-PERP', 'SUPERVERSE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NFTI',
        name: 'NFTI',
        variants: ['NFTI', 'NFTIUSDT', 'NFTI-USD', 'NFTI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RSR',
        name: 'Reserve Rights',
        variants: ['RSR', 'RSRUSDT', 'RSR-USD', 'RSR-PERP', 'RESERVE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'NTRN',
        name: 'Neutron',
        variants: ['NTRN', 'NTRNUSDT', 'NTRN-USD', 'NTRN-PERP', 'NEUTRON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ACE',
        name: 'ACE',
        variants: ['ACE', 'ACEUSDT', 'ACE-USD', 'ACE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XAI',
        name: 'XAI',
        variants: ['XAI', 'XAIUSDT', 'XAI-USD', 'XAI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'UMA',
        name: 'UMA',
        variants: ['UMA', 'UMAUSDT', 'UMA-USD', 'UMA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ALT',
        name: 'AltLayer',
        variants: ['ALT', 'ALTUSDT', 'ALT-USD', 'ALT-PERP', 'ALTLAYER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZETA',
        name: 'ZetaChain',
        variants: ['ZETA', 'ZETAUSDT', 'ZETA-USD', 'ZETA-PERP', 'ZETACHAIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // AsterDEX remaining failed normalizations
      {
        canonical: 'Q',
        name: 'Q Token',
        variants: ['Q', 'QUSDT', 'Q-USD', 'Q-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PTB',
        name: 'PTB',
        variants: ['PTB', 'PTBUSDT', 'PTB-USD', 'PTB-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ARIA',
        name: 'ARIA',
        variants: ['ARIA', 'ARIAUSDT', 'ARIA-USD', 'ARIA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TAKE',
        name: 'TAKE',
        variants: ['TAKE', 'TAKEUSDT', 'TAKE-USD', 'TAKE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AVNT',
        name: 'AVNT',
        variants: ['AVNT', 'AVNTUSDT', 'AVNT-USD', 'AVNT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OPEN',
        name: 'OPEN',
        variants: ['OPEN', 'OPENUSDT', 'OPEN-USD', 'OPEN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // More popular tokens likely on both exchanges
      {
        canonical: 'RNDR',
        name: 'Render',
        variants: ['RNDR', 'RNDRUSDT', 'RNDR-USD', 'RNDR-PERP', 'RENDER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LDO',
        name: 'Lido DAO',
        variants: ['LDO', 'LDOUSDT', 'LDO-USD', 'LDO-PERP', 'LIDO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'IMX',
        name: 'Immutable X',
        variants: ['IMX', 'IMXUSDT', 'IMX-USD', 'IMX-PERP', 'IMMUTABLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'CRV',
        name: 'Curve DAO',
        variants: ['CRV', 'CRVUSDT', 'CRV-USD', 'CRV-PERP', 'CURVE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LRC',
        name: 'Loopring',
        variants: ['LRC', 'LRCUSDT', 'LRC-USD', 'LRC-PERP', 'LOOPRING'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: '1INCH',
        name: '1inch',
        variants: ['1INCH', '1INCHUSDT', '1INCH-USD', '1INCH-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AAVE',
        name: 'Aave',
        variants: ['AAVE', 'AAVEUSDT', 'AAVE-USD', 'AAVE-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SUSHI',
        name: 'SushiSwap',
        variants: ['SUSHI', 'SUSHIUSDT', 'SUSHI-USD', 'SUSHI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'YFI',
        name: 'Yearn Finance',
        variants: ['YFI', 'YFIUSDT', 'YFI-USD', 'YFI-PERP', 'YEARN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BAT',
        name: 'Basic Attention Token',
        variants: ['BAT', 'BATUSDT', 'BAT-USD', 'BAT-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZRX',
        name: '0x',
        variants: ['ZRX', 'ZRXUSDT', 'ZRX-USD', 'ZRX-PERP', '0X'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'KNC',
        name: 'Kyber Network',
        variants: ['KNC', 'KNCUSDT', 'KNC-USD', 'KNC-PERP', 'KYBER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ENS',
        name: 'Ethereum Name Service',
        variants: ['ENS', 'ENSUSDT', 'ENS-USD', 'ENS-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'JASMY',
        name: 'JasmyCoin',
        variants: ['JASMY', 'JASMYUSDT', 'JASMY-USD', 'JASMY-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AUDIO',
        name: 'Audius',
        variants: ['AUDIO', 'AUDIOUSDT', 'AUDIO-USD', 'AUDIO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'C98',
        name: 'Coin98',
        variants: ['C98', 'C98USDT', 'C98-USD', 'C98-PERP', 'COIN98'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PEOPLE',
        name: 'ConstitutionDAO',
        variants: ['PEOPLE', 'PEOPLEUSDT', 'PEOPLE-USD', 'PEOPLE-PERP', 'CONSTITUTIONDAO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'LOOKS',
        name: 'LooksRare',
        variants: ['LOOKS', 'LOOKSUSDT', 'LOOKS-USD', 'LOOKS-PERP', 'LOOKSRARE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DYDX',
        name: 'dYdX',
        variants: ['DYDX', 'DYDXUSDT', 'DYDX-USD', 'DYDX-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'GAL',
        name: 'Galxe',
        variants: ['GAL', 'GALUSDT', 'GAL-USD', 'GAL-PERP', 'GALXE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'APT',
        name: 'Aptos',
        variants: ['APT', 'APTUSDT', 'APT-USD', 'APT-PERP', 'APTOS'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'OP',
        name: 'Optimism',
        variants: ['OP', 'OPUSDT', 'OP-USD', 'OP-PERP', 'OPTIMISM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ARB',
        name: 'Arbitrum',
        variants: ['ARB', 'ARBUSDT', 'ARB-USD', 'ARB-PERP', 'ARBITRUM'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BLUR',
        name: 'Blur',
        variants: ['BLUR', 'BLURUSDT', 'BLUR-USD', 'BLUR-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TIA',
        name: 'Celestia',
        variants: ['TIA', 'TIAUSDT', 'TIA-USD', 'TIA-PERP', 'CELESTIA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SEI',
        name: 'Sei',
        variants: ['SEI', 'SEIUSDT', 'SEI-USD', 'SEI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'STRK',
        name: 'Starknet',
        variants: ['STRK', 'STRKUSDT', 'STRK-USD', 'STRK-PERP', 'STARKNET'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'JUP',
        name: 'Jupiter',
        variants: ['JUP', 'JUPUSDT', 'JUP-USD', 'JUP-PERP', 'JUPITER'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'WIF',
        name: 'dogwifhat',
        variants: ['WIF', 'WIFUSDT', 'WIF-USD', 'WIF-PERP', 'DOGWIFHAT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PYTH',
        name: 'Pyth Network',
        variants: ['PYTH', 'PYTHUSDT', 'PYTH-USD', 'PYTH-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DYM',
        name: 'Dymension',
        variants: ['DYM', 'DYMUSDT', 'DYM-USD', 'DYM-PERP', 'DYMENSION'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ORDI',
        name: 'ORDI',
        variants: ['ORDI', 'ORDIUSDT', 'ORDI-USD', 'ORDI-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SATS',
        name: 'SATS',
        variants: ['SATS', 'SATSUSDT', 'SATS-USD', 'SATS-PERP', '1000SATS', '1000SATSUSDT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'RATS',
        name: 'RATS',
        variants: ['RATS', 'RATSUSDT', 'RATS-USD', 'RATS-PERP', '1000RATS', '1000RATSUSDT'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // Round 4: Final cleanup - all remaining failed normalizations
      // HyperLiquid final batch
      {
        canonical: 'MAVIA',
        name: 'Heroes of Mavia',
        variants: ['MAVIA', 'MAVIAUSDT', 'MAVIA-USD', 'MAVIA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'W',
        name: 'Wormhole',
        variants: ['W', 'WUSDT', 'W-USD', 'W-PERP', 'WORMHOLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'PANDORA',
        name: 'Pandora',
        variants: ['PANDORA', 'PANDORAUSDT', 'PANDORA-USD', 'PANDORA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'AI',
        name: 'Sleepless AI',
        variants: ['AI', 'AIUSDT', 'AI-USD', 'AI-PERP', 'SLEEPLESSAI'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MYRO',
        name: 'Myro',
        variants: ['MYRO', 'MYROUSDT', 'MYRO-USD', 'MYRO-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ETHFI',
        name: 'Ether.fi',
        variants: ['ETHFI', 'ETHFIUSDT', 'ETHFI-USD', 'ETHFI-PERP', 'ETHERFI'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MNT',
        name: 'Mantle',
        variants: ['MNT', 'MNTUSDT', 'MNT-USD', 'MNT-PERP', 'MANTLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TNSR',
        name: 'Tensor',
        variants: ['TNSR', 'TNSRUSDT', 'TNSR-USD', 'TNSR-PERP', 'TENSOR'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SAGA',
        name: 'Saga',
        variants: ['SAGA', 'SAGAUSDT', 'SAGA-USD', 'SAGA-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // AsterDEX final batch
      {
        canonical: 'FLOCK',
        name: 'Flock',
        variants: ['FLOCK', 'FLOCKUSDT', 'FLOCK-USD', 'FLOCK-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SKY',
        name: 'Sky',
        variants: ['SKY', 'SKYUSDT', 'SKY-USD', 'SKY-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'QQQ',
        name: 'QQQ',
        variants: ['QQQ', 'QQQUSDT', 'QQQ-USD', 'QQQ-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'UB',
        name: 'UB',
        variants: ['UB', 'UBUSDT', 'UB-USD', 'UB-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XPIN',
        name: 'XPIN',
        variants: ['XPIN', 'XPINUSDT', 'XPIN-USD', 'XPIN-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ZKC',
        name: 'ZKC',
        variants: ['ZKC', 'ZKCUSDT', 'ZKC-USD', 'ZKC-PERP'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      // More common tokens
      {
        canonical: 'SOL',
        name: 'Solana',
        variants: ['SOL', 'SOLUSDT', 'SOL-USD', 'SOL-PERP', 'SOLANA'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'BNB',
        name: 'BNB',
        variants: ['BNB', 'BNBUSDT', 'BNB-USD', 'BNB-PERP', 'BINANCECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'XRP',
        name: 'Ripple',
        variants: ['XRP', 'XRPUSDT', 'XRP-USD', 'XRP-PERP', 'RIPPLE'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'ADA',
        name: 'Cardano',
        variants: ['ADA', 'ADAUSDT', 'ADA-USD', 'ADA-PERP', 'CARDANO'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'DOGE',
        name: 'Dogecoin',
        variants: ['DOGE', 'DOGEUSDT', 'DOGE-USD', 'DOGE-PERP', 'DOGECOIN'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'MATIC',
        name: 'Polygon',
        variants: ['MATIC', 'MATICUSDT', 'MATIC-USD', 'MATIC-PERP', 'POL', 'POLUSDT', 'POLYGON'],
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
        canonical: 'LINK',
        name: 'Chainlink',
        variants: ['LINK', 'LINKUSDT', 'LINK-USD', 'LINK-PERP', 'CHAINLINK'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'TRX',
        name: 'TRON',
        variants: ['TRX', 'TRXUSDT', 'TRX-USD', 'TRX-PERP', 'TRON'],
        multipliers: { aster: 1, hyperliquid: 1 },
      },
      {
        canonical: 'SHIB',
        name: 'Shiba Inu',
        variants: ['SHIB', 'SHIBUSDT', 'SHIB-USD', 'SHIB-PERP', 'SHIBAINU'],
        multipliers: { aster: 1000, hyperliquid: 1000 },
      },
    ];

    symbols.forEach(symbol => {
      this.symbolMappings.set(symbol.canonical, symbol);
    });
  }

  /**
   * Normalize exchange-specific symbol to canonical format
   * PUBLIC method for debugging and analysis
   */
  public normalizeSymbol(rawSymbol: string, autoDiscover: boolean = true): { canonical: string | null; multiplier: number } {
    // Remove common suffixes
    const cleaned = rawSymbol
      .toUpperCase()
      .replace(/USDT$|USD$|-USD$|-PERP$|PERP$/g, '')
      .trim();

    // Check for multiplier prefixes:
    // - 1000x: "1000PEPE" format (AsterDEX)
    // - 1000x: "kPEPE" format (HyperLiquid)
    let baseSymbol = cleaned;
    let detectedMultiplier = 1;

    const multiplier1000Match = cleaned.match(/^1000(.+)$/);
    const multiplierKMatch = cleaned.match(/^k(.+)$/i);

    if (multiplier1000Match) {
      baseSymbol = multiplier1000Match[1];
      detectedMultiplier = 1000;
    } else if (multiplierKMatch) {
      baseSymbol = multiplierKMatch[1];
      detectedMultiplier = 1000;
    }

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

    // AUTO-DISCOVERY MODE: If no match found and autoDiscover is enabled,
    // use the base symbol itself as canonical (allows all pairs to be matched)
    if (autoDiscover && baseSymbol.length > 0) {
      // console.log(`[SymbolMapping] Auto-discovered new symbol: ${baseSymbol} (from ${rawSymbol})`);
      return { canonical: baseSymbol, multiplier: detectedMultiplier };
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
