import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { getCommonName } from '@/utils/assetNames';
import type { LivePrice } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Wifi,
  AlertCircle,
  Search,
  BarChart3,
} from 'lucide-react';

// Top 100 USD trading pairs on Kraken by market cap and popularity
// Note: BTC/USD will be converted to XBT/USD internally by the service
const KRAKEN_SYMBOLS = [
  // Top 20 - Mega caps
  'BTC/USD',    // Bitcoin
  'ETH/USD',    // Ethereum
  'SOL/USD',    // Solana
  'BNB/USD',    // Binance Coin
  'XRP/USD',    // Ripple
  'ADA/USD',    // Cardano
  'AVAX/USD',   // Avalanche
  'DOT/USD',    // Polkadot
  'MATIC/USD',  // Polygon
  'LINK/USD',   // Chainlink
  'ATOM/USD',   // Cosmos
  'UNI/USD',    // Uniswap
  'LTC/USD',    // Litecoin
  'BCH/USD',    // Bitcoin Cash
  'NEAR/USD',   // Near Protocol
  'APT/USD',    // Aptos
  'ARB/USD',    // Arbitrum
  'OP/USD',     // Optimism
  'IMX/USD',    // Immutable X
  'ALGO/USD',   // Algorand

  // 21-40 - Large caps
  'AAVE/USD',   // Aave
  'GRT/USD',    // The Graph
  'FIL/USD',    // Filecoin
  'LDO/USD',    // Lido
  'MKR/USD',    // Maker
  'SNX/USD',    // Synthetix
  'SAND/USD',   // The Sandbox
  'MANA/USD',   // Decentraland
  'AXS/USD',    // Axie Infinity
  'FLOW/USD',   // Flow
  'XTZ/USD',    // Tezos
  'EOS/USD',    // EOS
  'DOGE/USD',   // Dogecoin
  'TRX/USD',    // Tron
  'ETC/USD',    // Ethereum Classic
  'XLM/USD',    // Stellar
  'FTM/USD',    // Fantom
  'MINA/USD',   // Mina
  'APE/USD',    // ApeCoin
  'ENJ/USD',    // Enjin

  // 41-60 - Mid caps
  'CRV/USD',    // Curve
  'SUSHI/USD',  // SushiSwap
  'YFI/USD',    // Yearn Finance
  'COMP/USD',   // Compound
  'BAL/USD',    // Balancer
  '1INCH/USD',  // 1inch
  'GALA/USD',   // Gala
  'BLUR/USD',   // Blur
  'ANKR/USD',   // Ankr
  'BAT/USD',    // Basic Attention Token
  'BAND/USD',   // Band Protocol
  'AUDIO/USD',  // Audius
  'API3/USD',   // API3
  'INJ/USD',    // Injective
  'RUNE/USD',   // THORChain
  'GLMR/USD',   // Moonbeam
  'KSM/USD',    // Kusama
  'KAVA/USD',   // Kava
  'CHZ/USD',    // Chiliz
  'ROSE/USD',   // Oasis Network

  // 61-80 - Popular/Emerging
  'BONK/USD',   // Bonk
  'PEPE/USD',   // Pepe
  'WIF/USD',    // dogwifhat
  'FLOKI/USD',  // Floki
  'JASMY/USD',  // JasmyCoin
  'ZIL/USD',    // Zilliqa
  'WAVES/USD',  // Waves
  'DASH/USD',   // Dash
  'ZEC/USD',    // Zcash
  'IOTX/USD',   // IoTeX
  'HBAR/USD',   // Hedera
  'VET/USD',    // VeChain
  'ONE/USD',    // Harmony
  'CELO/USD',   // Celo
  'QTUM/USD',   // Qtum
  'ZRX/USD',    // 0x
  'BNT/USD',    // Bancor
  'OMG/USD',    // OMG Network
  'SUI/USD',    // Sui
  'SEI/USD',    // Sei

  // 81-100 - Additional Popular Assets
  'TIA/USD',    // Celestia
  'PYTH/USD',   // Pyth Network
  'JUP/USD',    // Jupiter
  'BERA/USD',   // Berachain
  'BEAM/USD',   // Beam
  'AR/USD',     // Arweave
  'STORJ/USD',  // Storj
  'RENDER/USD', // Render Token
  'FET/USD',    // Fetch.ai
  'AGIX/USD',   // SingularityNET
  'RLC/USD',    // iExec RLC
  'NMR/USD',    // Numeraire
  'CTSI/USD',   // Cartesi
  'AMP/USD',    // Amp
  'REQ/USD',    // Request
  'PHA/USD',    // Phala Network
  'ASTR/USD',   // Astar
  'ALICE/USD',  // MyNeighborAlice
  'ALCX/USD',   // Alchemix
  'ALPACA/USD', // Alpaca Finance
];

export default function CryptoMarket() {
  // Get global live prices from store
  const livePrices = useStore((state) => state.livePrices);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change' | 'volume'>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [, setTick] = useState(0);

  useEffect(() => {
    // Update "Last Update" times every second
    const tickInterval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(tickInterval);
    };
  }, []);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatVolume = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  const formatTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedData = Array.from(livePrices.entries())
    .map(([symbol, data]) => {
      // Get common name for display
      const commonName = getCommonName(symbol.split('/')[0]);
      return [symbol, data, commonName] as [string, LivePrice, string];
    })
    .filter(([symbol, , commonName]) =>
      symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      commonName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort(([, a], [, b]) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'symbol':
          compareValue = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          compareValue = (a.price || 0) - (b.price || 0);
          break;
        case 'change':
          compareValue = (a.changePercent24h || 0) - (b.changePercent24h || 0);
          break;
        case 'volume':
          compareValue = (a.volume24h || 0) - (b.volume24h || 0);
          break;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Crypto Market</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-400">
              Real-time market data powered by Kraken WebSocket
            </p>
            {livePrices.size > 0 && (
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-500">
                  {livePrices.size} pairs streaming
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSort('change')}
              className={`btn btn-sm ${sortBy === 'change' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              % Change
            </button>
            <button
              onClick={() => handleSort('volume')}
              className={`btn btn-sm ${sortBy === 'volume' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Volume
            </button>
          </div>
        </div>
      </div>

      {/* Market Data Table */}
      <div className="card">
        {filteredAndSortedData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th
                    className="pb-3 cursor-pointer hover:text-white"
                    onClick={() => handleSort('symbol')}
                  >
                    Symbol {sortBy === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="pb-3 cursor-pointer hover:text-white"
                    onClick={() => handleSort('price')}
                  >
                    Price {sortBy === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="pb-3 cursor-pointer hover:text-white"
                    onClick={() => handleSort('change')}
                  >
                    24h Change {sortBy === 'change' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="pb-3">24h High</th>
                  <th className="pb-3">24h Low</th>
                  <th
                    className="pb-3 cursor-pointer hover:text-white"
                    onClick={() => handleSort('volume')}
                  >
                    24h Volume {sortBy === 'volume' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="pb-3">Last Update</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map(([symbol, data, commonName]) => {
                  const isPositive = (data.changePercent24h || 0) >= 0;
                  const timeSinceUpdate = Date.now() - (data.timestamp || 0);
                  const isStale = timeSinceUpdate > 10000; // 10 seconds

                  return (
                    <tr
                      key={symbol}
                      className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{commonName}/USD</span>
                          {!isStale && (
                            <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 font-mono font-bold">
                        {formatCurrency(data.price)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                            {formatPercent(data.changePercent24h)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-gray-400 font-mono">
                        {formatCurrency(data.high24h)}
                      </td>
                      <td className="py-3 text-gray-400 font-mono">
                        {formatCurrency(data.low24h)}
                      </td>
                      <td className="py-3 text-gray-400 font-mono">
                        {formatVolume(data.volume24h)}
                      </td>
                      <td className="py-3">
                        <span className={`text-xs ${isStale ? 'text-gray-500' : 'text-green-500'}`}>
                          {formatTimeSince(data.timestamp || Date.now())}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : livePrices.size === 0 ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-400 mb-2">Connecting to market data...</p>
            <p className="text-sm text-gray-500">
              Establishing WebSocket connection to Kraken
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Market Stats */}
      {livePrices.size > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Total Pairs</p>
            <p className="text-2xl font-bold">{livePrices.size}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Gainers (24h)</p>
            <p className="text-2xl font-bold text-green-500">
              {Array.from(livePrices.values()).filter(d => (d.changePercent24h || 0) > 0).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Losers (24h)</p>
            <p className="text-2xl font-bold text-red-500">
              {Array.from(livePrices.values()).filter(d => (d.changePercent24h || 0) < 0).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Avg Change (24h)</p>
            <p className={`text-2xl font-bold ${
              (Array.from(livePrices.values()).reduce((sum, d) => sum + (d.changePercent24h || 0), 0) / livePrices.size) >= 0
                ? 'text-green-500'
                : 'text-red-500'
            }`}>
              {formatPercent(
                Array.from(livePrices.values()).reduce((sum, d) => sum + (d.changePercent24h || 0), 0) / livePrices.size
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
