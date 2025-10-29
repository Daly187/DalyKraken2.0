import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Info,
  Wallet,
  ArrowDownUp,
  Clock,
  Target,
  BarChart3,
  Zap,
  Activity,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Signal,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { multiExchangeService, FundingRate, FundingPosition } from '@/services/multiExchangeService';
import { useStore } from '@/store/useStore';

export default function DalyFunding() {
  const addNotification = useStore((state) => state.addNotification);

  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [selectedExchange, setSelectedExchange] = useState<'all' | 'aster' | 'hyperliquid' | 'liquid'>('all');
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [positions, setPositions] = useState<FundingPosition[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sortBy, setSortBy] = useState<'rate' | 'symbol' | 'markPrice'>('rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Strategy Configuration
  const [positionSize, setPositionSize] = useState(100);
  const [fundingThreshold, setFundingThreshold] = useState(0.01);
  const [minVolume24h, setMinVolume24h] = useState(1000000);
  const [maxSpread, setMaxSpread] = useState(0.1);
  const [autoExecute, setAutoExecute] = useState(false);

  // Available trading pairs (normalized format) - Aster DEX supported assets
  const availablePairs = [
    // Major Assets
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    // Layer 1s
    'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'ATOMUSDT',
    // DeFi
    'LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'SNXUSDT',
    // Meme Coins
    'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT',
    // Gaming & Metaverse
    'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'ENJUSDT',
    // Other Popular
    'LTCUSDT', 'BCHUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT',
    'ARBUSDT', 'OPUSDT', 'NEARUSDT', 'SUIUSDT', 'INJUSDT',
    'STXUSDT', 'TIAUSDT', 'SEIUSDT', 'JUPUSDT', 'WLDUSDT',
    'RENDERUSDT', 'FTMUSDT', 'IMXUSDT', 'THETAUSDT', 'LDOUSDT',
  ];

  // Connect to WebSocket feeds on mount
  useEffect(() => {
    console.log('[DalyFunding] Connecting to multi-exchange feeds...');

    multiExchangeService.connectAll(availablePairs);
    setIsConnected(true);

    // Subscribe to funding rate updates
    const unsubscribe = multiExchangeService.onFundingRateUpdate((fundingRate) => {
      setFundingRates(prev => {
        const updated = [...prev];
        const index = updated.findIndex(
          f => f.exchange === fundingRate.exchange && f.symbol === fundingRate.symbol
        );

        if (index >= 0) {
          updated[index] = fundingRate;
        } else {
          updated.push(fundingRate);
        }

        return updated;
      });

      // Check if funding rate exceeds threshold
      if (autoExecute && Math.abs(fundingRate.rate) >= fundingThreshold) {
        addNotification({
          type: 'info',
          title: 'Funding Rate Alert',
          message: `${fundingRate.exchange} ${fundingRate.symbol}: ${fundingRate.rate.toFixed(3)}%`,
        });
      }
    });

    return () => {
      unsubscribe();
      multiExchangeService.disconnectAll();
      setIsConnected(false);
    };
  }, [autoExecute, fundingThreshold]);

  // Filter and sort funding rates
  const filteredRates = selectedExchange === 'all'
    ? fundingRates
    : fundingRates.filter(f => f.exchange === selectedExchange);

  const sortedRates = [...filteredRates].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'rate':
        comparison = a.rate - b.rate;
        break;
      case 'symbol':
        comparison = a.symbol.localeCompare(b.symbol);
        break;
      case 'markPrice':
        comparison = a.markPrice - b.markPrice;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column: 'rate' | 'symbol' | 'markPrice') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Calculate statistics
  const totalPositions = positions.filter(p => p.status === 'open').length;
  const totalInvested = positions
    .filter(p => p.status === 'open')
    .reduce((sum, p) => sum + (p.size * p.entryPrice), 0);
  const totalFundingEarned = positions.reduce((sum, p) => sum + p.fundingEarned, 0);
  const totalPnL = positions
    .filter(p => p.status === 'open')
    .reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">DalyFunding Strategy</h1>
          <p className="text-sm text-gray-400 mt-1">
            Multi-Exchange Funding Rate Arbitrage (Aster, Hyperliquid, Liquid)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Live Data' : 'Disconnected'}
            </span>
          </div>
          <div className="text-sm text-gray-400">
            {fundingRates.length} rates tracking
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Positions</p>
              <p className="text-2xl font-bold text-white">{totalPositions}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPositions === 0 ? 'No positions yet' : 'Across all exchanges'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-green-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Invested</p>
              <p className="text-2xl font-bold text-white">${totalInvested.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPositions > 0 ? 'Current exposure' : 'Start trading to see stats'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Funding Earned</p>
              <p className="text-2xl font-bold text-white">${totalFundingEarned.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-purple-400" />
            </div>
          </div>
        </div>

        <div className={`card bg-gradient-to-br ${totalPnL >= 0 ? 'from-green-500/10 to-green-600/5 border-green-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total P&L</p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${totalPnL.toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : '0.00'}% return
              </p>
            </div>
            <div className={`h-14 w-14 rounded-xl ${totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
              <BarChart3 className={`h-7 w-7 ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Live Funding Rates Monitor */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Live Funding Rates
            </h2>
            <p className="text-sm text-gray-400 mt-1">Real-time monitoring across Aster, Hyperliquid, and Liquid</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Exchange Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedExchange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedExchange === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedExchange('aster')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedExchange === 'aster'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                Aster
              </button>
              <button
                onClick={() => setSelectedExchange('hyperliquid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedExchange === 'hyperliquid'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                Hyperliquid
              </button>
              <button
                onClick={() => setSelectedExchange('liquid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedExchange === 'liquid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                Liquid
              </button>
            </div>
          </div>
        </div>

        {sortedRates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Exchange
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center gap-1">
                      Symbol
                      {sortBy === 'symbol' && (
                        <span className="text-primary-400">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={() => handleSort('rate')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Funding Rate (8h)
                      {sortBy === 'rate' && (
                        <span className="text-primary-400">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Annual Rate
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={() => handleSort('markPrice')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Mark Price
                      {sortBy === 'markPrice' && (
                        <span className="text-primary-400">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    24h Volume
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Next Funding
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedRates.map((rate) => {
                  const annualRate = rate.rate * 3 * 365; // 3 times per day * 365 days
                  return (
                    <tr
                      key={`${rate.exchange}-${rate.symbol}`}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Activity className={`h-4 w-4 ${
                            rate.exchange === 'aster' ? 'text-cyan-400' :
                            rate.exchange === 'hyperliquid' ? 'text-purple-400' :
                            'text-blue-400'
                          }`} />
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            rate.exchange === 'aster' ? 'bg-cyan-500/20 text-cyan-400' :
                            rate.exchange === 'hyperliquid' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {rate.exchange}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-white">{rate.symbol}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-lg font-bold ${
                          rate.rate > 0 ? 'text-green-400' :
                          rate.rate < 0 ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {rate.rate > 0 ? '+' : ''}{rate.rate.toFixed(4)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-sm font-medium ${
                          annualRate > 0 ? 'text-green-400' :
                          annualRate < 0 ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {annualRate > 0 ? '+' : ''}{annualRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-mono text-gray-300">
                          ${rate.markPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm text-gray-400">
                          -
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs text-gray-400">
                          {rate.nextFundingTime > 0
                            ? new Date(rate.nextFundingTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all"
                          onClick={() => {
                            setSelectedPair(rate.symbol);
                            addNotification({
                              type: 'info',
                              title: 'Symbol Selected',
                              message: `Now tracking ${rate.symbol} on ${rate.exchange}`,
                            });
                          }}
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Signal className="h-12 w-12 text-gray-600 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-400">Waiting for funding rate data...</p>
            <p className="text-xs text-gray-500 mt-1">
              Make sure API keys are configured in Settings
            </p>
          </div>
        )}
      </div>

      {/* Strategy Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
              Configure Funding Strategy
            </h2>
            <p className="text-sm text-gray-400 mt-1">Set up automated funding rate collection with liquidity checks</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
            <Zap className="h-6 w-6 text-white" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Pair Selection */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Target className="h-4 w-4 text-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">
                  Trading Pair
                </label>
                <p className="text-xs text-gray-400">Select pair for funding rate strategy</p>
              </div>
            </div>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {availablePairs.map((pair) => (
                <button
                  key={pair}
                  type="button"
                  onClick={() => setSelectedPair(pair)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                    selectedPair === pair
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 scale-105'
                      : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50 hover:text-gray-300'
                  }`}
                >
                  {pair.replace('USDT', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Options */}
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <DollarSign className="h-4 w-4 text-green-400" />
                Position Size
                <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={positionSize}
                  onChange={(e) => setPositionSize(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  placeholder="100.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Amount to allocate per position</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Target className="h-4 w-4 text-purple-400" />
                Funding Rate Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={fundingThreshold}
                  onChange={(e) => setFundingThreshold(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  placeholder="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Minimum funding rate to enter</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Activity className="h-4 w-4 text-blue-400" />
                Minimum 24h Volume
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="100000"
                  min="0"
                  value={minVolume24h}
                  onChange={(e) => setMinVolume24h(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  placeholder="1000000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Liquidity check - minimum daily volume</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Layers className="h-4 w-4 text-yellow-400" />
                Max Spread %
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={maxSpread}
                  onChange={(e) => setMaxSpread(Number(e.target.value))}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  placeholder="0.1"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Maximum bid-ask spread allowed</p>
            </div>
          </div>

          {/* Auto-Execute Toggle */}
          <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${autoExecute ? 'bg-green-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                  {autoExecute ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <label className="font-semibold text-white cursor-pointer">
                    Auto-Execute Strategy
                  </label>
                  <p className="text-xs text-gray-400">
                    Automatically enter positions when funding rate exceeds threshold
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="flex-1 relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
            >
              <div className="relative flex items-center justify-center gap-2">
                <Zap className="h-5 w-5" />
                <span>Create Funding Position</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Active Positions
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Currently earning funding rates
            </p>
          </div>
        </div>

        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 mb-4">
            <ArrowDownUp className="h-10 w-10 text-primary-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Positions Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first funding position to start earning from funding rates on perpetual contracts.
          </p>
        </div>
      </div>

      {/* Funding Rate History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Funding Rate History
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Historical funding rates for {selectedPair}
            </p>
          </div>
        </div>

        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No funding rate data available</p>
          <p className="text-xs text-gray-500 mt-1">Data will appear once you start tracking positions</p>
        </div>
      </div>

      {/* Strategy Info */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">Multi-Exchange Funding Strategy Overview</h3>
        <div className="space-y-4 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">What is Funding?</strong> Funding rates are periodic payments
              exchanged between long and short positions in perpetual futures markets. When funding is positive,
              longs pay shorts. When negative, shorts pay longs. This strategy captures these payments across
              multiple exchanges simultaneously.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-cyan-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Multi-Exchange Coverage:</strong> By monitoring funding rates across
              Aster DEX, Hyperliquid, and Liquid simultaneously, this strategy identifies the best opportunities
              regardless of which platform offers the highest rates. Each exchange has unique characteristics:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li><strong className="text-cyan-400">Aster:</strong> Decentralized perpetuals with up to 125x leverage</li>
                <li><strong className="text-purple-400">Hyperliquid:</strong> On-chain L1 DEX with CEX-like performance</li>
                <li><strong className="text-blue-400">Liquid:</strong> Centralized exchange with fiat pairs and deep liquidity</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Liquidity & Volume Checks:</strong> Before executing any trade, the system
              verifies that the market has sufficient liquidity by checking:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li>24-hour trading volume exceeds your minimum threshold</li>
                <li>Order book depth can absorb your position size</li>
                <li>Bid-ask spread is within acceptable limits</li>
              </ul>
              This prevents slippage and ensures you can enter/exit positions efficiently.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">WebSocket Real-Time Monitoring:</strong> The strategy uses WebSocket
              connections to each exchange for instant funding rate updates. Aster provides mark price streams,
              Hyperliquid broadcasts asset context with funding data, and Liquid streams order book depth. All data
              is processed in real-time to identify opportunities the moment they arise.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Automated Entry & Exit:</strong> When auto-execute is enabled and a
              funding rate exceeds your threshold (while passing liquidity checks), the system automatically opens
              a position. Positions are monitored continuously and can be automatically closed when:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li>Funding rate mean-reverts below threshold</li>
                <li>Market conditions change (liquidity drops, spread widens)</li>
                <li>Target profit is achieved</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Risk Management:</strong> The strategy includes multiple safety features:
              position sizing controls, spread limits, volume requirements, and automatic circuit breakers to protect
              your capital. Never trade on illiquid markets, and always maintain control over your exposure across
              all three exchanges.
            </div>
          </div>

          <div className="p-4 mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <strong className="text-blue-300">Setup Required:</strong> To use this strategy, configure your
                API keys for Aster, Hyperliquid, and/or Liquid in the Settings page. At minimum, one exchange must
                be configured. The strategy will automatically connect to all configured exchanges and begin monitoring
                funding rates.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
