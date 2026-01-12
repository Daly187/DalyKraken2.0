/**
 * Shared Asset Mapping Data
 *
 * This file contains the top 200 crypto assets by market cap with their
 * symbol mappings across different exchanges (Kraken, Aster, Hyperliquid, Lighter).
 *
 * Used by:
 * - Settings page (Crypto Mapping tab) - for viewing/searching mappings
 * - CryptoMarket page - as the source of truth for which assets to display
 */

// Asset mapping data structure
export interface AssetMapping {
  rank: number;
  assetName: string;
  canonical: string;
  marketCap: number | null;
  coinGeckoId: string | null;
  kraken: string | null;
  aster: string | null;
  hyperliquid: string | null;
  lighter: string | null;
}

// Static asset mapping data - Top 200 crypto assets by market cap
export const ASSET_MAPPINGS: AssetMapping[] = [
  // 1-10
  { rank: 1, assetName: 'Bitcoin', canonical: 'BTC', marketCap: 1811784623364, coinGeckoId: 'bitcoin', kraken: 'XXBT', aster: 'BTCUSDT', hyperliquid: 'BTC', lighter: 'BTC-PERP' },
  { rank: 2, assetName: 'Ethereum', canonical: 'ETH', marketCap: 374760469599, coinGeckoId: 'ethereum', kraken: 'XETH', aster: 'ETHUSDT', hyperliquid: 'ETH', lighter: 'ETH-PERP' },
  { rank: 3, assetName: 'Tether', canonical: 'USDT', marketCap: 186735317449, coinGeckoId: 'tether', kraken: 'USDT', aster: null, hyperliquid: null, lighter: null },
  { rank: 4, assetName: 'XRP', canonical: 'XRP', marketCap: 127248491801, coinGeckoId: 'ripple', kraken: 'XXRP', aster: 'XRPUSDT', hyperliquid: 'XRP', lighter: null },
  { rank: 5, assetName: 'BNB', canonical: 'BNB', marketCap: 125604719915, coinGeckoId: 'binancecoin', kraken: 'BNB', aster: 'BNBUSDT', hyperliquid: 'BNB', lighter: null },
  { rank: 6, assetName: 'Solana', canonical: 'SOL', marketCap: 77035560822, coinGeckoId: 'solana', kraken: 'SOL', aster: 'SOLUSDT', hyperliquid: 'SOL', lighter: 'SOL-PERP' },
  { rank: 7, assetName: 'USDC', canonical: 'USDC', marketCap: 50300000000, coinGeckoId: 'usd-coin', kraken: 'USDC', aster: null, hyperliquid: null, lighter: null },
  { rank: 8, assetName: 'Dogecoin', canonical: 'DOGE', marketCap: 26000000000, coinGeckoId: 'dogecoin', kraken: 'XXDG', aster: 'DOGEUSDT', hyperliquid: 'DOGE', lighter: null },
  { rank: 9, assetName: 'Toncoin', canonical: 'TON', marketCap: 24000000000, coinGeckoId: 'the-open-network', kraken: 'TON', aster: 'TONUSDT', hyperliquid: 'TON', lighter: null },
  { rank: 10, assetName: 'Cardano', canonical: 'ADA', marketCap: 21000000000, coinGeckoId: 'cardano', kraken: 'ADA', aster: 'ADAUSDT', hyperliquid: 'ADA', lighter: null },
  // 11-20
  { rank: 11, assetName: 'TRON', canonical: 'TRX', marketCap: 19000000000, coinGeckoId: 'tron', kraken: 'TRX', aster: 'TRXUSDT', hyperliquid: 'TRX', lighter: null },
  { rank: 12, assetName: 'Avalanche', canonical: 'AVAX', marketCap: 16000000000, coinGeckoId: 'avalanche-2', kraken: 'AVAX', aster: 'AVAXUSDT', hyperliquid: 'AVAX', lighter: null },
  { rank: 13, assetName: 'Shiba Inu', canonical: 'SHIB', marketCap: 15000000000, coinGeckoId: 'shiba-inu', kraken: 'SHIB', aster: '1000SHIBUSDT', hyperliquid: 'kSHIB', lighter: null },
  { rank: 14, assetName: 'Wrapped Bitcoin', canonical: 'WBTC', marketCap: 14000000000, coinGeckoId: 'wrapped-bitcoin', kraken: 'WBTC', aster: null, hyperliquid: null, lighter: null },
  { rank: 15, assetName: 'Polkadot', canonical: 'DOT', marketCap: 12000000000, coinGeckoId: 'polkadot', kraken: 'DOT', aster: 'DOTUSDT', hyperliquid: 'DOT', lighter: null },
  { rank: 16, assetName: 'Chainlink', canonical: 'LINK', marketCap: 11000000000, coinGeckoId: 'chainlink', kraken: 'LINK', aster: 'LINKUSDT', hyperliquid: 'LINK', lighter: 'LINK-PERP' },
  { rank: 17, assetName: 'Bitcoin Cash', canonical: 'BCH', marketCap: 10500000000, coinGeckoId: 'bitcoin-cash', kraken: 'BCH', aster: 'BCHUSDT', hyperliquid: 'BCH', lighter: null },
  { rank: 18, assetName: 'Polygon', canonical: 'POL', marketCap: 10000000000, coinGeckoId: 'matic-network', kraken: 'MATIC', aster: 'MATICUSDT', hyperliquid: 'MATIC', lighter: null },
  { rank: 19, assetName: 'Litecoin', canonical: 'LTC', marketCap: 9800000000, coinGeckoId: 'litecoin', kraken: 'XLTC', aster: 'LTCUSDT', hyperliquid: 'LTC', lighter: null },
  { rank: 20, assetName: 'Dai', canonical: 'DAI', marketCap: 9000000000, coinGeckoId: 'dai', kraken: 'DAI', aster: null, hyperliquid: null, lighter: null },
  // 21-30
  { rank: 21, assetName: 'Uniswap', canonical: 'UNI', marketCap: 8500000000, coinGeckoId: 'uniswap', kraken: 'UNI', aster: 'UNIUSDT', hyperliquid: 'UNI', lighter: null },
  { rank: 22, assetName: 'NEAR Protocol', canonical: 'NEAR', marketCap: 8200000000, coinGeckoId: 'near', kraken: 'NEAR', aster: 'NEARUSDT', hyperliquid: 'NEAR', lighter: null },
  { rank: 23, assetName: 'Internet Computer', canonical: 'ICP', marketCap: 7800000000, coinGeckoId: 'internet-computer', kraken: 'ICP', aster: 'ICPUSDT', hyperliquid: 'ICP', lighter: null },
  { rank: 24, assetName: 'Kaspa', canonical: 'KAS', marketCap: 7500000000, coinGeckoId: 'kaspa', kraken: 'KAS', aster: 'KASUSDT', hyperliquid: 'KAS', lighter: null },
  { rank: 25, assetName: 'Ethereum Classic', canonical: 'ETC', marketCap: 7200000000, coinGeckoId: 'ethereum-classic', kraken: 'XETC', aster: 'ETCUSDT', hyperliquid: 'ETC', lighter: null },
  { rank: 26, assetName: 'Stellar', canonical: 'XLM', marketCap: 7000000000, coinGeckoId: 'stellar', kraken: 'XXLM', aster: 'XLMUSDT', hyperliquid: 'XLM', lighter: null },
  { rank: 27, assetName: 'Cosmos Hub', canonical: 'ATOM', marketCap: 6800000000, coinGeckoId: 'cosmos', kraken: 'ATOM', aster: 'ATOMUSDT', hyperliquid: 'ATOM', lighter: null },
  { rank: 28, assetName: 'Monero', canonical: 'XMR', marketCap: 6500000000, coinGeckoId: 'monero', kraken: 'XXMR', aster: null, hyperliquid: null, lighter: null },
  { rank: 29, assetName: 'Filecoin', canonical: 'FIL', marketCap: 6200000000, coinGeckoId: 'filecoin', kraken: 'FIL', aster: 'FILUSDT', hyperliquid: 'FIL', lighter: null },
  { rank: 30, assetName: 'OKB', canonical: 'OKB', marketCap: 6000000000, coinGeckoId: 'okb', kraken: null, aster: 'OKBUSDT', hyperliquid: 'OKB', lighter: null },
  // 31-40
  { rank: 31, assetName: 'Lido DAO', canonical: 'LDO', marketCap: 5800000000, coinGeckoId: 'lido-dao', kraken: 'LDO', aster: 'LDOUSDT', hyperliquid: 'LDO', lighter: null },
  { rank: 32, assetName: 'Aptos', canonical: 'APT', marketCap: 5600000000, coinGeckoId: 'aptos', kraken: 'APT', aster: 'APTUSDT', hyperliquid: 'APT', lighter: null },
  { rank: 33, assetName: 'Hedera', canonical: 'HBAR', marketCap: 5400000000, coinGeckoId: 'hedera-hashgraph', kraken: 'HBAR', aster: 'HBARUSDT', hyperliquid: 'HBAR', lighter: null },
  { rank: 34, assetName: 'Arbitrum', canonical: 'ARB', marketCap: 5200000000, coinGeckoId: 'arbitrum', kraken: 'ARB', aster: 'ARBUSDT', hyperliquid: 'ARB', lighter: null },
  { rank: 35, assetName: 'VeChain', canonical: 'VET', marketCap: 5000000000, coinGeckoId: 'vechain', kraken: 'VET', aster: 'VETUSDT', hyperliquid: 'VET', lighter: null },
  { rank: 36, assetName: 'Immutable', canonical: 'IMX', marketCap: 4800000000, coinGeckoId: 'immutable-x', kraken: 'IMX', aster: 'IMXUSDT', hyperliquid: 'IMX', lighter: null },
  { rank: 37, assetName: 'Cronos', canonical: 'CRO', marketCap: 4600000000, coinGeckoId: 'crypto-com-chain', kraken: 'CRO', aster: 'CROUSDT', hyperliquid: 'CRO', lighter: null },
  { rank: 38, assetName: 'Render', canonical: 'RNDR', marketCap: 4400000000, coinGeckoId: 'render-token', kraken: 'RNDR', aster: 'RNDRUSDT', hyperliquid: 'RENDER', lighter: null },
  { rank: 39, assetName: 'Injective', canonical: 'INJ', marketCap: 4200000000, coinGeckoId: 'injective-protocol', kraken: 'INJ', aster: 'INJUSDT', hyperliquid: 'INJ', lighter: null },
  { rank: 40, assetName: 'Optimism', canonical: 'OP', marketCap: 4000000000, coinGeckoId: 'optimism', kraken: 'OP', aster: 'OPUSDT', hyperliquid: 'OP', lighter: null },
  // 41-50
  { rank: 41, assetName: 'Mantle', canonical: 'MNT', marketCap: 3800000000, coinGeckoId: 'mantle', kraken: 'MNT', aster: 'MNTUSDT', hyperliquid: 'MNT', lighter: null },
  { rank: 42, assetName: 'The Graph', canonical: 'GRT', marketCap: 3600000000, coinGeckoId: 'the-graph', kraken: 'GRT', aster: 'GRTUSDT', hyperliquid: 'GRT', lighter: null },
  { rank: 43, assetName: 'Quant', canonical: 'QNT', marketCap: 3400000000, coinGeckoId: 'quant-network', kraken: 'QNT', aster: 'QNTUSDT', hyperliquid: 'QNT', lighter: null },
  { rank: 44, assetName: 'Aave', canonical: 'AAVE', marketCap: 3300000000, coinGeckoId: 'aave', kraken: 'AAVE', aster: 'AAVEUSDT', hyperliquid: 'AAVE', lighter: null },
  { rank: 45, assetName: 'Fantom', canonical: 'FTM', marketCap: 3200000000, coinGeckoId: 'fantom', kraken: 'FTM', aster: 'FTMUSDT', hyperliquid: 'FTM', lighter: null },
  { rank: 46, assetName: 'Sui', canonical: 'SUI', marketCap: 3100000000, coinGeckoId: 'sui', kraken: 'SUI', aster: 'SUIUSDT', hyperliquid: 'SUI', lighter: null },
  { rank: 47, assetName: 'Maker', canonical: 'MKR', marketCap: 3000000000, coinGeckoId: 'maker', kraken: 'MKR', aster: 'MKRUSDT', hyperliquid: 'MKR', lighter: null },
  { rank: 48, assetName: 'Theta Network', canonical: 'THETA', marketCap: 2900000000, coinGeckoId: 'theta-token', kraken: 'THETA', aster: 'THETAUSDT', hyperliquid: 'THETA', lighter: null },
  { rank: 49, assetName: 'Algorand', canonical: 'ALGO', marketCap: 2800000000, coinGeckoId: 'algorand', kraken: 'ALGO', aster: 'ALGOUSDT', hyperliquid: 'ALGO', lighter: null },
  { rank: 50, assetName: 'BitTorrent', canonical: 'BTT', marketCap: 2700000000, coinGeckoId: 'bittorrent', kraken: null, aster: 'BTTUSDT', hyperliquid: 'BTT', lighter: null },
  // 51-60
  { rank: 51, assetName: 'Celestia', canonical: 'TIA', marketCap: 2600000000, coinGeckoId: 'celestia', kraken: 'TIA', aster: 'TIAUSDT', hyperliquid: 'TIA', lighter: null },
  { rank: 52, assetName: 'Tezos', canonical: 'XTZ', marketCap: 2500000000, coinGeckoId: 'tezos', kraken: 'XTZ', aster: 'XTZUSDT', hyperliquid: 'XTZ', lighter: null },
  { rank: 53, assetName: 'EOS', canonical: 'EOS', marketCap: 2400000000, coinGeckoId: 'eos', kraken: 'EOS', aster: 'EOSUSDT', hyperliquid: 'EOS', lighter: null },
  { rank: 54, assetName: 'Flow', canonical: 'FLOW', marketCap: 2300000000, coinGeckoId: 'flow', kraken: 'FLOW', aster: 'FLOWUSDT', hyperliquid: 'FLOW', lighter: null },
  { rank: 55, assetName: 'Axie Infinity', canonical: 'AXS', marketCap: 2200000000, coinGeckoId: 'axie-infinity', kraken: 'AXS', aster: 'AXSUSDT', hyperliquid: 'AXS', lighter: null },
  { rank: 56, assetName: 'Neo', canonical: 'NEO', marketCap: 2100000000, coinGeckoId: 'neo', kraken: 'NEO', aster: 'NEOUSDT', hyperliquid: 'NEO', lighter: null },
  { rank: 57, assetName: 'Kava', canonical: 'KAVA', marketCap: 2000000000, coinGeckoId: 'kava', kraken: 'KAVA', aster: 'KAVAUSDT', hyperliquid: 'KAVA', lighter: null },
  { rank: 58, assetName: 'Mina', canonical: 'MINA', marketCap: 1950000000, coinGeckoId: 'mina-protocol', kraken: 'MINA', aster: 'MINAUSDT', hyperliquid: 'MINA', lighter: null },
  { rank: 59, assetName: 'IOTA', canonical: 'IOTA', marketCap: 1900000000, coinGeckoId: 'iota', kraken: 'IOTA', aster: 'IOTAUSDT', hyperliquid: 'IOTA', lighter: null },
  { rank: 60, assetName: 'Curve DAO', canonical: 'CRV', marketCap: 1850000000, coinGeckoId: 'curve-dao-token', kraken: 'CRV', aster: 'CRVUSDT', hyperliquid: 'CRV', lighter: null },
  // 61-70
  { rank: 61, assetName: 'Chiliz', canonical: 'CHZ', marketCap: 1800000000, coinGeckoId: 'chiliz', kraken: 'CHZ', aster: 'CHZUSDT', hyperliquid: 'CHZ', lighter: null },
  { rank: 62, assetName: 'Gala', canonical: 'GALA', marketCap: 1750000000, coinGeckoId: 'gala', kraken: 'GALA', aster: 'GALAUSDT', hyperliquid: 'GALA', lighter: null },
  { rank: 63, assetName: 'PancakeSwap', canonical: 'CAKE', marketCap: 1700000000, coinGeckoId: 'pancakeswap-token', kraken: 'CAKE', aster: 'CAKEUSDT', hyperliquid: 'CAKE', lighter: null },
  { rank: 64, assetName: 'Trust Wallet Token', canonical: 'TWT', marketCap: 1650000000, coinGeckoId: 'trust-wallet-token', kraken: null, aster: 'TWTUSDT', hyperliquid: 'TWT', lighter: null },
  { rank: 65, assetName: 'Zcash', canonical: 'ZEC', marketCap: 1600000000, coinGeckoId: 'zcash', kraken: 'XZEC', aster: 'ZECUSDT', hyperliquid: 'ZEC', lighter: null },
  { rank: 66, assetName: 'Dash', canonical: 'DASH', marketCap: 1550000000, coinGeckoId: 'dash', kraken: 'DASH', aster: 'DASHUSDT', hyperliquid: 'DASH', lighter: null },
  { rank: 67, assetName: 'Enjin Coin', canonical: 'ENJ', marketCap: 1500000000, coinGeckoId: 'enjincoin', kraken: 'ENJ', aster: 'ENJUSDT', hyperliquid: 'ENJ', lighter: null },
  { rank: 68, assetName: 'Waves', canonical: 'WAVES', marketCap: 1450000000, coinGeckoId: 'waves', kraken: 'WAVES', aster: 'WAVESUSDT', hyperliquid: 'WAVES', lighter: null },
  { rank: 69, assetName: 'Basic Attention Token', canonical: 'BAT', marketCap: 1400000000, coinGeckoId: 'basic-attention-token', kraken: 'BAT', aster: 'BATUSDT', hyperliquid: 'BAT', lighter: null },
  { rank: 70, assetName: 'Loopring', canonical: 'LRC', marketCap: 1350000000, coinGeckoId: 'loopring', kraken: 'LRC', aster: 'LRCUSDT', hyperliquid: 'LRC', lighter: null },
  // 71-80
  { rank: 71, assetName: '1inch', canonical: '1INCH', marketCap: 1300000000, coinGeckoId: '1inch', kraken: '1INCH', aster: '1INCHUSDT', hyperliquid: '1INCH', lighter: null },
  { rank: 72, assetName: 'GMX', canonical: 'GMX', marketCap: 1250000000, coinGeckoId: 'gmx', kraken: 'GMX', aster: 'GMXUSDT', hyperliquid: 'GMX', lighter: null },
  { rank: 73, assetName: 'Synthetix', canonical: 'SNX', marketCap: 1200000000, coinGeckoId: 'havven', kraken: 'SNX', aster: 'SNXUSDT', hyperliquid: 'SNX', lighter: null },
  { rank: 74, assetName: 'Compound', canonical: 'COMP', marketCap: 1150000000, coinGeckoId: 'compound-governance-token', kraken: 'COMP', aster: 'COMPUSDT', hyperliquid: 'COMP', lighter: null },
  { rank: 75, assetName: 'Oasis Network', canonical: 'ROSE', marketCap: 1100000000, coinGeckoId: 'oasis-network', kraken: 'ROSE', aster: 'ROSEUSDT', hyperliquid: 'ROSE', lighter: null },
  { rank: 76, assetName: 'Nexo', canonical: 'NEXO', marketCap: 1050000000, coinGeckoId: 'nexo', kraken: null, aster: 'NEXOUSDT', hyperliquid: 'NEXO', lighter: null },
  { rank: 77, assetName: 'yearn.finance', canonical: 'YFI', marketCap: 1000000000, coinGeckoId: 'yearn-finance', kraken: 'YFI', aster: 'YFIUSDT', hyperliquid: 'YFI', lighter: null },
  { rank: 78, assetName: 'dYdX', canonical: 'DYDX', marketCap: 980000000, coinGeckoId: 'dydx', kraken: 'DYDX', aster: 'DYDXUSDT', hyperliquid: 'DYDX', lighter: null },
  { rank: 79, assetName: 'Ronin', canonical: 'RON', marketCap: 960000000, coinGeckoId: 'ronin', kraken: 'RON', aster: 'RONUSDT', hyperliquid: 'RON', lighter: null },
  { rank: 80, assetName: 'Blur', canonical: 'BLUR', marketCap: 940000000, coinGeckoId: 'blur', kraken: 'BLUR', aster: 'BLURUSDT', hyperliquid: 'BLUR', lighter: null },
  // 81-90
  { rank: 81, assetName: 'Illuvium', canonical: 'ILV', marketCap: 920000000, coinGeckoId: 'illuvium', kraken: 'ILV', aster: 'ILVUSDT', hyperliquid: 'ILV', lighter: null },
  { rank: 82, assetName: 'Radix', canonical: 'XRD', marketCap: 900000000, coinGeckoId: 'radix', kraken: null, aster: 'XRDUSDT', hyperliquid: 'XRD', lighter: null },
  { rank: 83, assetName: 'Helium', canonical: 'HNT', marketCap: 880000000, coinGeckoId: 'helium', kraken: 'HNT', aster: 'HNTUSDT', hyperliquid: 'HNT', lighter: null },
  { rank: 84, assetName: 'Klaytn', canonical: 'KLAY', marketCap: 860000000, coinGeckoId: 'klay-token', kraken: 'KLAY', aster: 'KLAYUSDT', hyperliquid: 'KLAY', lighter: null },
  { rank: 85, assetName: 'Audius', canonical: 'AUDIO', marketCap: 840000000, coinGeckoId: 'audius', kraken: 'AUDIO', aster: 'AUDIOUSDT', hyperliquid: 'AUDIO', lighter: null },
  { rank: 86, assetName: 'Convex Finance', canonical: 'CVX', marketCap: 820000000, coinGeckoId: 'convex-finance', kraken: 'CVX', aster: 'CVXUSDT', hyperliquid: 'CVX', lighter: null },
  { rank: 87, assetName: 'Arweave', canonical: 'AR', marketCap: 800000000, coinGeckoId: 'arweave', kraken: 'AR', aster: 'ARUSDT', hyperliquid: 'AR', lighter: null },
  { rank: 88, assetName: 'Fetch.ai', canonical: 'FET', marketCap: 780000000, coinGeckoId: 'fetch-ai', kraken: 'FET', aster: 'FETUSDT', hyperliquid: 'FET', lighter: null },
  { rank: 89, assetName: 'SingularityNET', canonical: 'AGIX', marketCap: 760000000, coinGeckoId: 'singularitynet', kraken: 'AGIX', aster: 'AGIXUSDT', hyperliquid: 'AGIX', lighter: null },
  { rank: 90, assetName: 'Celo', canonical: 'CELO', marketCap: 740000000, coinGeckoId: 'celo', kraken: 'CELO', aster: 'CELOUSDT', hyperliquid: 'CELO', lighter: null },
  // 91-100
  { rank: 91, assetName: 'Stacks', canonical: 'STX', marketCap: 720000000, coinGeckoId: 'blockstack', kraken: 'STX', aster: 'STXUSDT', hyperliquid: 'STX', lighter: null },
  { rank: 92, assetName: 'Harmony', canonical: 'ONE', marketCap: 700000000, coinGeckoId: 'harmony', kraken: 'ONE', aster: 'ONEUSDT', hyperliquid: 'ONE', lighter: null },
  { rank: 93, assetName: 'Ocean Protocol', canonical: 'OCEAN', marketCap: 680000000, coinGeckoId: 'ocean-protocol', kraken: 'OCEAN', aster: 'OCEANUSDT', hyperliquid: 'OCEAN', lighter: null },
  { rank: 94, assetName: 'Band Protocol', canonical: 'BAND', marketCap: 660000000, coinGeckoId: 'band-protocol', kraken: 'BAND', aster: 'BANDUSDT', hyperliquid: 'BAND', lighter: null },
  { rank: 95, assetName: 'Gnosis', canonical: 'GNO', marketCap: 640000000, coinGeckoId: 'gnosis', kraken: 'GNO', aster: 'GNOUSDT', hyperliquid: 'GNO', lighter: null },
  { rank: 96, assetName: 'iExec RLC', canonical: 'RLC', marketCap: 620000000, coinGeckoId: 'iexec-rlc', kraken: 'RLC', aster: 'RLCUSDT', hyperliquid: 'RLC', lighter: null },
  { rank: 97, assetName: 'Ankr', canonical: 'ANKR', marketCap: 600000000, coinGeckoId: 'ankr', kraken: 'ANKR', aster: 'ANKRUSDT', hyperliquid: 'ANKR', lighter: null },
  { rank: 98, assetName: 'Lisk', canonical: 'LSK', marketCap: 580000000, coinGeckoId: 'lisk', kraken: 'LSK', aster: 'LSKUSDT', hyperliquid: 'LSK', lighter: null },
  { rank: 99, assetName: 'Status', canonical: 'SNT', marketCap: 560000000, coinGeckoId: 'status', kraken: 'SNT', aster: 'SNTUSDT', hyperliquid: 'SNT', lighter: null },
  { rank: 100, assetName: 'Storj', canonical: 'STORJ', marketCap: 540000000, coinGeckoId: 'storj', kraken: 'STORJ', aster: 'STORJUSDT', hyperliquid: 'STORJ', lighter: null },
  // 101-110
  { rank: 101, assetName: 'Numeraire', canonical: 'NMR', marketCap: 520000000, coinGeckoId: 'numeraire', kraken: 'NMR', aster: 'NMRUSDT', hyperliquid: 'NMR', lighter: null },
  { rank: 102, assetName: 'Orchid', canonical: 'OXT', marketCap: 500000000, coinGeckoId: 'orchid-protocol', kraken: 'OXT', aster: 'OXTUSDT', hyperliquid: 'OXT', lighter: null },
  { rank: 103, assetName: 'Golem', canonical: 'GLM', marketCap: 490000000, coinGeckoId: 'golem', kraken: 'GLM', aster: 'GLMUSDT', hyperliquid: 'GLM', lighter: null },
  { rank: 104, assetName: 'Balancer', canonical: 'BAL', marketCap: 480000000, coinGeckoId: 'balancer', kraken: 'BAL', aster: 'BALUSDT', hyperliquid: 'BAL', lighter: null },
  { rank: 105, assetName: 'Kusama', canonical: 'KSM', marketCap: 470000000, coinGeckoId: 'kusama', kraken: 'KSM', aster: 'KSMUSDT', hyperliquid: 'KSM', lighter: null },
  { rank: 106, assetName: 'Zilliqa', canonical: 'ZIL', marketCap: 460000000, coinGeckoId: 'zilliqa', kraken: 'ZIL', aster: 'ZILUSDT', hyperliquid: 'ZIL', lighter: null },
  { rank: 107, assetName: '0x', canonical: 'ZRX', marketCap: 450000000, coinGeckoId: '0x', kraken: 'ZRX', aster: 'ZRXUSDT', hyperliquid: 'ZRX', lighter: null },
  { rank: 108, assetName: 'Livepeer', canonical: 'LPT', marketCap: 440000000, coinGeckoId: 'livepeer', kraken: 'LPT', aster: 'LPTUSDT', hyperliquid: 'LPT', lighter: null },
  { rank: 109, assetName: 'SushiSwap', canonical: 'SUSHI', marketCap: 430000000, coinGeckoId: 'sushi', kraken: 'SUSHI', aster: 'SUSHIUSDT', hyperliquid: 'SUSHI', lighter: null },
  { rank: 110, assetName: 'API3', canonical: 'API3', marketCap: 420000000, coinGeckoId: 'api3', kraken: 'API3', aster: 'API3USDT', hyperliquid: 'API3', lighter: null },
  // 111-120
  { rank: 111, assetName: 'Cartesi', canonical: 'CTSI', marketCap: 410000000, coinGeckoId: 'cartesi', kraken: 'CTSI', aster: 'CTSIUSDT', hyperliquid: 'CTSI', lighter: null },
  { rank: 112, assetName: 'Mask Network', canonical: 'MASK', marketCap: 400000000, coinGeckoId: 'mask-network', kraken: 'MASK', aster: 'MASKUSDT', hyperliquid: 'MASK', lighter: null },
  { rank: 113, assetName: 'Decentraland', canonical: 'MANA', marketCap: 390000000, coinGeckoId: 'decentraland', kraken: 'MANA', aster: 'MANAUSDT', hyperliquid: 'MANA', lighter: null },
  { rank: 114, assetName: 'Sandbox', canonical: 'SAND', marketCap: 380000000, coinGeckoId: 'the-sandbox', kraken: 'SAND', aster: 'SANDUSDT', hyperliquid: 'SAND', lighter: null },
  { rank: 115, assetName: 'Ren', canonical: 'REN', marketCap: 370000000, coinGeckoId: 'republic-protocol', kraken: 'REN', aster: 'RENUSDT', hyperliquid: 'REN', lighter: null },
  { rank: 116, assetName: 'Bancor', canonical: 'BNT', marketCap: 360000000, coinGeckoId: 'bancor', kraken: 'BNT', aster: 'BNTUSDT', hyperliquid: 'BNT', lighter: null },
  { rank: 117, assetName: 'NKN', canonical: 'NKN', marketCap: 350000000, coinGeckoId: 'nkn', kraken: 'NKN', aster: 'NKNUSDT', hyperliquid: 'NKN', lighter: null },
  { rank: 118, assetName: 'Request', canonical: 'REQ', marketCap: 340000000, coinGeckoId: 'request-network', kraken: 'REQ', aster: 'REQUSDT', hyperliquid: 'REQ', lighter: null },
  { rank: 119, assetName: 'Astar', canonical: 'ASTR', marketCap: 330000000, coinGeckoId: 'astar', kraken: 'ASTR', aster: 'ASTRUSDT', hyperliquid: 'ASTR', lighter: null },
  { rank: 120, assetName: 'MultiversX', canonical: 'EGLD', marketCap: 320000000, coinGeckoId: 'elrond-erd-2', kraken: 'EGLD', aster: 'EGLDUSDT', hyperliquid: 'EGLD', lighter: null },
  // 121-130
  { rank: 121, assetName: 'Pepe', canonical: 'PEPE', marketCap: 310000000, coinGeckoId: 'pepe', kraken: 'PEPE', aster: '1000PEPEUSDT', hyperliquid: 'kPEPE', lighter: null },
  { rank: 122, assetName: 'Bonk', canonical: 'BONK', marketCap: 300000000, coinGeckoId: 'bonk', kraken: 'BONK', aster: '1000BONKUSDT', hyperliquid: 'kBONK', lighter: null },
  { rank: 123, assetName: 'Floki', canonical: 'FLOKI', marketCap: 290000000, coinGeckoId: 'floki', kraken: 'FLOKI', aster: '1000FLOKIUSDT', hyperliquid: 'kFLOKI', lighter: null },
  { rank: 124, assetName: 'dogwifhat', canonical: 'WIF', marketCap: 280000000, coinGeckoId: 'dogwifcoin', kraken: 'WIF', aster: 'WIFUSDT', hyperliquid: 'WIF', lighter: null },
  { rank: 125, assetName: 'Sei', canonical: 'SEI', marketCap: 270000000, coinGeckoId: 'sei-network', kraken: 'SEI', aster: 'SEIUSDT', hyperliquid: 'SEI', lighter: null },
  { rank: 126, assetName: 'THORChain', canonical: 'RUNE', marketCap: 260000000, coinGeckoId: 'thorchain', kraken: 'RUNE', aster: 'RUNEUSDT', hyperliquid: 'RUNE', lighter: null },
  { rank: 127, assetName: 'Bittensor', canonical: 'TAO', marketCap: 250000000, coinGeckoId: 'bittensor', kraken: 'TAO', aster: 'TAOUSDT', hyperliquid: 'TAO', lighter: null },
  { rank: 128, assetName: 'Worldcoin', canonical: 'WLD', marketCap: 240000000, coinGeckoId: 'worldcoin-wld', kraken: 'WLD', aster: 'WLDUSDT', hyperliquid: 'WLD', lighter: null },
  { rank: 129, assetName: 'Jupiter', canonical: 'JUP', marketCap: 230000000, coinGeckoId: 'jupiter-exchange-solana', kraken: 'JUP', aster: 'JUPUSDT', hyperliquid: 'JUP', lighter: null },
  { rank: 130, assetName: 'Pyth Network', canonical: 'PYTH', marketCap: 220000000, coinGeckoId: 'pyth-network', kraken: 'PYTH', aster: 'PYTHUSDT', hyperliquid: 'PYTH', lighter: null },
  // 131-140
  { rank: 131, assetName: 'Ondo Finance', canonical: 'ONDO', marketCap: 210000000, coinGeckoId: 'ondo-finance', kraken: 'ONDO', aster: 'ONDOUSDT', hyperliquid: 'ONDO', lighter: null },
  { rank: 132, assetName: 'Ethena', canonical: 'ENA', marketCap: 200000000, coinGeckoId: 'ethena', kraken: 'ENA', aster: 'ENAUSDT', hyperliquid: 'ENA', lighter: null },
  { rank: 133, assetName: 'Notcoin', canonical: 'NOT', marketCap: 190000000, coinGeckoId: 'notcoin', kraken: 'NOT', aster: 'NOTUSDT', hyperliquid: 'NOT', lighter: null },
  { rank: 134, assetName: 'Pengu', canonical: 'PENGU', marketCap: 180000000, coinGeckoId: 'pengu', kraken: 'PENGU', aster: 'PENGUUSDT', hyperliquid: 'PENGU', lighter: null },
  { rank: 135, assetName: 'TRUMP', canonical: 'TRUMP', marketCap: 170000000, coinGeckoId: 'trump', kraken: 'TRUMP', aster: 'TRUMPUSDT', hyperliquid: 'TRUMP', lighter: null },
  { rank: 136, assetName: 'ApeCoin', canonical: 'APE', marketCap: 160000000, coinGeckoId: 'apecoin', kraken: 'APE', aster: 'APEUSDT', hyperliquid: 'APE', lighter: null },
  { rank: 137, assetName: 'Raydium', canonical: 'RAY', marketCap: 150000000, coinGeckoId: 'raydium', kraken: 'RAY', aster: 'RAYUSDT', hyperliquid: 'RAY', lighter: null },
  { rank: 138, assetName: 'Ribbon Finance', canonical: 'RBN', marketCap: 145000000, coinGeckoId: 'ribbon-finance', kraken: 'RBN', aster: 'RBNUSDT', hyperliquid: 'RBN', lighter: null },
  { rank: 139, assetName: 'Perpetual Protocol', canonical: 'PERP', marketCap: 140000000, coinGeckoId: 'perpetual-protocol', kraken: 'PERP', aster: 'PERPUSDT', hyperliquid: 'PERP', lighter: null },
  { rank: 140, assetName: 'Spell Token', canonical: 'SPELL', marketCap: 135000000, coinGeckoId: 'spell-token', kraken: 'SPELL', aster: 'SPELLUSDT', hyperliquid: 'SPELL', lighter: null },
  // 141-150
  { rank: 141, assetName: 'ALICE', canonical: 'ALICE', marketCap: 130000000, coinGeckoId: 'my-neighbor-alice', kraken: 'ALICE', aster: 'ALICEUSDT', hyperliquid: 'ALICE', lighter: null },
  { rank: 142, assetName: 'Origin Protocol', canonical: 'OGN', marketCap: 125000000, coinGeckoId: 'origin-protocol', kraken: 'OGN', aster: 'OGNUSDT', hyperliquid: 'OGN', lighter: null },
  { rank: 143, assetName: 'SKALE', canonical: 'SKL', marketCap: 120000000, coinGeckoId: 'skale', kraken: 'SKL', aster: 'SKLUSDT', hyperliquid: 'SKL', lighter: null },
  { rank: 144, assetName: 'SuperRare', canonical: 'RARE', marketCap: 115000000, coinGeckoId: 'superrare', kraken: 'RARE', aster: 'RAREUSDT', hyperliquid: 'RARE', lighter: null },
  { rank: 145, assetName: 'Phala Network', canonical: 'PHA', marketCap: 110000000, coinGeckoId: 'pha', kraken: 'PHA', aster: 'PHAUSDT', hyperliquid: 'PHA', lighter: null },
  { rank: 146, assetName: 'Badger DAO', canonical: 'BADGER', marketCap: 105000000, coinGeckoId: 'badger-dao', kraken: 'BADGER', aster: 'BADGERUSDT', hyperliquid: 'BADGER', lighter: null },
  { rank: 147, assetName: 'Kyber Network', canonical: 'KNC', marketCap: 100000000, coinGeckoId: 'kyber-network-crystal', kraken: 'KNC', aster: 'KNCUSDT', hyperliquid: 'KNC', lighter: null },
  { rank: 148, assetName: 'DODO', canonical: 'DODO', marketCap: 95000000, coinGeckoId: 'dodo', kraken: 'DODO', aster: 'DODOUSDT', hyperliquid: 'DODO', lighter: null },
  { rank: 149, assetName: 'Civic', canonical: 'CVC', marketCap: 90000000, coinGeckoId: 'civic', kraken: 'CVC', aster: 'CVCUSDT', hyperliquid: 'CVC', lighter: null },
  { rank: 150, assetName: 'Quickswap', canonical: 'QUICK', marketCap: 85000000, coinGeckoId: 'quickswap', kraken: null, aster: 'QUICKUSDT', hyperliquid: 'QUICK', lighter: null },
  // 151-160
  { rank: 151, assetName: 'Power Ledger', canonical: 'POWR', marketCap: 80000000, coinGeckoId: 'power-ledger', kraken: 'POWR', aster: 'POWRUSDT', hyperliquid: 'POWR', lighter: null },
  { rank: 152, assetName: 'Moonriver', canonical: 'MOVR', marketCap: 78000000, coinGeckoId: 'moonriver', kraken: 'MOVR', aster: 'MOVRUSDT', hyperliquid: 'MOVR', lighter: null },
  { rank: 153, assetName: 'Siacoin', canonical: 'SC', marketCap: 76000000, coinGeckoId: 'siacoin', kraken: 'SC', aster: 'SCUSDT', hyperliquid: 'SC', lighter: null },
  { rank: 154, assetName: 'OMG Network', canonical: 'OMG', marketCap: 74000000, coinGeckoId: 'omisego', kraken: 'OMG', aster: 'OMGUSDT', hyperliquid: 'OMG', lighter: null },
  { rank: 155, assetName: 'IoTeX', canonical: 'IOTX', marketCap: 72000000, coinGeckoId: 'iotex', kraken: 'IOTX', aster: 'IOTXUSDT', hyperliquid: 'IOTX', lighter: null },
  { rank: 156, assetName: 'JasmyCoin', canonical: 'JASMY', marketCap: 70000000, coinGeckoId: 'jasmycoin', kraken: 'JASMY', aster: 'JASMYUSDT', hyperliquid: 'JASMY', lighter: null },
  { rank: 157, assetName: 'Moonbeam', canonical: 'GLMR', marketCap: 68000000, coinGeckoId: 'moonbeam', kraken: 'GLMR', aster: 'GLMRUSDT', hyperliquid: 'GLMR', lighter: null },
  { rank: 158, assetName: 'Qtum', canonical: 'QTUM', marketCap: 66000000, coinGeckoId: 'qtum', kraken: 'QTUM', aster: 'QTUMUSDT', hyperliquid: 'QTUM', lighter: null },
  { rank: 159, assetName: 'Amp', canonical: 'AMP', marketCap: 64000000, coinGeckoId: 'amp-token', kraken: 'AMP', aster: 'AMPUSDT', hyperliquid: 'AMP', lighter: null },
  { rank: 160, assetName: 'PAX Gold', canonical: 'PAXG', marketCap: 62000000, coinGeckoId: 'pax-gold', kraken: 'PAXG', aster: 'PAXGUSDT', hyperliquid: 'PAXG', lighter: null },
  // 161-170
  { rank: 161, assetName: 'Centrifuge', canonical: 'CFG', marketCap: 60000000, coinGeckoId: 'centrifuge', kraken: 'CFG', aster: 'CFGUSDT', hyperliquid: 'CFG', lighter: null },
  { rank: 162, assetName: 'Reserve Rights', canonical: 'RSR', marketCap: 58000000, coinGeckoId: 'reserve-rights-token', kraken: 'RSR', aster: 'RSRUSDT', hyperliquid: 'RSR', lighter: null },
  { rank: 163, assetName: 'Energy Web Token', canonical: 'EWT', marketCap: 56000000, coinGeckoId: 'energy-web-token', kraken: 'EWT', aster: null, hyperliquid: null, lighter: null },
  { rank: 164, assetName: 'Akash Network', canonical: 'AKT', marketCap: 54000000, coinGeckoId: 'akash-network', kraken: 'AKT', aster: 'AKTUSDT', hyperliquid: 'AKT', lighter: null },
  { rank: 165, assetName: 'Threshold', canonical: 'T', marketCap: 52000000, coinGeckoId: 'threshold-network-token', kraken: 'T', aster: 'TUSDT', hyperliquid: 'T', lighter: null },
  { rank: 166, assetName: 'Kilt Protocol', canonical: 'KILT', marketCap: 50000000, coinGeckoId: 'kilt-protocol', kraken: 'KILT', aster: null, hyperliquid: null, lighter: null },
  { rank: 167, assetName: 'Shiden Network', canonical: 'SDN', marketCap: 48000000, coinGeckoId: 'shiden', kraken: 'SDN', aster: null, hyperliquid: null, lighter: null },
  { rank: 168, assetName: 'Kintsugi', canonical: 'KINT', marketCap: 46000000, coinGeckoId: 'kintsugi', kraken: 'KINT', aster: null, hyperliquid: null, lighter: null },
  { rank: 169, assetName: 'Airswap', canonical: 'AST', marketCap: 44000000, coinGeckoId: 'airswap', kraken: 'AIR', aster: null, hyperliquid: null, lighter: null },
  { rank: 170, assetName: 'Robonomics', canonical: 'XRT', marketCap: 42000000, coinGeckoId: 'robonomics-network', kraken: 'XRT', aster: null, hyperliquid: null, lighter: null },
  // 171-180
  { rank: 171, assetName: 'Rocket Pool', canonical: 'RPL', marketCap: 40000000, coinGeckoId: 'rocket-pool', kraken: 'RPL', aster: 'RPLUSDT', hyperliquid: 'RPL', lighter: null },
  { rank: 172, assetName: 'Orca', canonical: 'ORCA', marketCap: 38000000, coinGeckoId: 'orca', kraken: 'ORCA', aster: 'ORCAUSDT', hyperliquid: 'ORCA', lighter: null },
  { rank: 173, assetName: 'Mango', canonical: 'MNGO', marketCap: 36000000, coinGeckoId: 'mango-markets', kraken: 'MNGO', aster: null, hyperliquid: null, lighter: null },
  { rank: 174, assetName: 'Serum', canonical: 'SRM', marketCap: 34000000, coinGeckoId: 'serum', kraken: 'SRM', aster: null, hyperliquid: null, lighter: null },
  { rank: 175, assetName: 'Keep Network', canonical: 'KEEP', marketCap: 32000000, coinGeckoId: 'keep-network', kraken: 'KEEP', aster: null, hyperliquid: null, lighter: null },
  { rank: 176, assetName: 'Rari Governance', canonical: 'RARI', marketCap: 30000000, coinGeckoId: 'rarible', kraken: 'RARI', aster: 'RARIUSDT', hyperliquid: 'RARI', lighter: null },
  { rank: 177, assetName: 'Aragon', canonical: 'ANT', marketCap: 28000000, coinGeckoId: 'aragon', kraken: 'ANT', aster: 'ANTUSDT', hyperliquid: 'ANT', lighter: null },
  { rank: 178, assetName: 'Icon', canonical: 'ICX', marketCap: 26000000, coinGeckoId: 'icon', kraken: 'ICX', aster: 'ICXUSDT', hyperliquid: 'ICX', lighter: null },
  { rank: 179, assetName: 'GHOST', canonical: 'GHST', marketCap: 24000000, coinGeckoId: 'aavegotchi', kraken: 'GHST', aster: 'GHSTUSDT', hyperliquid: 'GHST', lighter: null },
  { rank: 180, assetName: 'tBTC', canonical: 'TBTC', marketCap: 22000000, coinGeckoId: 'tbtc', kraken: 'TBTC', aster: null, hyperliquid: null, lighter: null },
  // 181-190
  { rank: 181, assetName: 'Ethereum Name Service', canonical: 'ENS', marketCap: 20000000, coinGeckoId: 'ethereum-name-service', kraken: 'ENS', aster: 'ENSUSDT', hyperliquid: 'ENS', lighter: null },
  { rank: 182, assetName: 'Origin Dollar', canonical: 'OUSD', marketCap: 19000000, coinGeckoId: 'origin-dollar', kraken: null, aster: null, hyperliquid: null, lighter: null },
  { rank: 183, assetName: 'Mirror Protocol', canonical: 'MIR', marketCap: 18000000, coinGeckoId: 'mirror-protocol', kraken: 'MIR', aster: null, hyperliquid: null, lighter: null },
  { rank: 184, assetName: 'Polymath', canonical: 'POLY', marketCap: 17000000, coinGeckoId: 'polymath', kraken: 'POLY', aster: 'POLYUSDT', hyperliquid: 'POLY', lighter: null },
  { rank: 185, assetName: 'Aleph.im', canonical: 'ALEPH', marketCap: 16000000, coinGeckoId: 'aleph', kraken: null, aster: 'ALEPHUSDT', hyperliquid: 'ALEPH', lighter: null },
  { rank: 186, assetName: 'ROOK', canonical: 'ROOK', marketCap: 15000000, coinGeckoId: 'rook', kraken: 'ROOK', aster: null, hyperliquid: null, lighter: null },
  { rank: 187, assetName: 'Tribe', canonical: 'TRIBE', marketCap: 14000000, coinGeckoId: 'tribe-2', kraken: 'TRIBE', aster: null, hyperliquid: null, lighter: null },
  { rank: 188, assetName: 'Bounce Token', canonical: 'AUCTION', marketCap: 13000000, coinGeckoId: 'auction', kraken: 'AUCTION', aster: 'AUCTIONUSDT', hyperliquid: 'AUCTION', lighter: null },
  { rank: 189, assetName: 'Wrapped NXM', canonical: 'WNXM', marketCap: 12000000, coinGeckoId: 'wrapped-nxm', kraken: 'WNXM', aster: null, hyperliquid: null, lighter: null },
  { rank: 190, assetName: 'BarnBridge', canonical: 'BOND', marketCap: 11000000, coinGeckoId: 'barnbridge', kraken: 'BOND', aster: 'BONDUSDT', hyperliquid: 'BOND', lighter: null },
  // 191-200
  { rank: 191, assetName: 'Harvest Finance', canonical: 'FARM', marketCap: 10500000, coinGeckoId: 'harvest-finance', kraken: 'FARM', aster: null, hyperliquid: null, lighter: null },
  { rank: 192, assetName: 'Index Coop', canonical: 'INDEX', marketCap: 10000000, coinGeckoId: 'index-cooperative', kraken: null, aster: null, hyperliquid: null, lighter: null },
  { rank: 193, assetName: 'mStable USD', canonical: 'MUSD', marketCap: 9500000, coinGeckoId: 'mstable-usd', kraken: null, aster: null, hyperliquid: null, lighter: null },
  { rank: 194, assetName: 'Venus', canonical: 'XVS', marketCap: 9000000, coinGeckoId: 'venus', kraken: null, aster: 'XVSUSDT', hyperliquid: 'XVS', lighter: null },
  { rank: 195, assetName: 'Ampleforth', canonical: 'AMPL', marketCap: 8500000, coinGeckoId: 'ampleforth', kraken: null, aster: null, hyperliquid: null, lighter: null },
  { rank: 196, assetName: 'Cover Protocol', canonical: 'COVER', marketCap: 8000000, coinGeckoId: 'cover-protocol', kraken: null, aster: null, hyperliquid: null, lighter: null },
  { rank: 197, assetName: 'DFI.Money', canonical: 'YFII', marketCap: 7500000, coinGeckoId: 'yfii-finance', kraken: null, aster: 'YFIIUSDT', hyperliquid: 'YFII', lighter: null },
  { rank: 198, assetName: 'Hegic', canonical: 'HEGIC', marketCap: 7000000, coinGeckoId: 'hegic', kraken: null, aster: 'HEGICUSDT', hyperliquid: 'HEGIC', lighter: null },
  { rank: 199, assetName: 'StaFi', canonical: 'FIS', marketCap: 6500000, coinGeckoId: 'stafi', kraken: null, aster: 'FISUSDT', hyperliquid: 'FIS', lighter: null },
  { rank: 200, assetName: 'Cream Finance', canonical: 'CREAM', marketCap: 6000000, coinGeckoId: 'cream-2', kraken: null, aster: 'CREAMUSDT', hyperliquid: 'CREAM', lighter: null },
];

/**
 * Build a lookup map from Kraken symbol to canonical symbol
 * Used by CryptoMarket to join live Kraken data with asset mappings
 */
export function buildKrakenToCanonicalMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const asset of ASSET_MAPPINGS) {
    if (asset.kraken) {
      // Map Kraken internal symbol (e.g., XXBT) to canonical (e.g., BTC)
      map.set(asset.kraken, asset.canonical);
      // Also map the USD pair format that comes from WebSocket
      map.set(`${asset.kraken}/USD`, asset.canonical);
      // Also try with canonical symbol for direct matches
      map.set(`${asset.canonical}/USD`, asset.canonical);
    }
  }
  return map;
}

/**
 * Build a lookup map from canonical symbol to AssetMapping
 * Used to quickly find asset details by canonical symbol
 */
export function buildCanonicalToAssetMap(): Map<string, AssetMapping> {
  const map = new Map<string, AssetMapping>();
  for (const asset of ASSET_MAPPINGS) {
    map.set(asset.canonical, asset);
  }
  return map;
}
