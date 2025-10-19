import { useState } from 'react';
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
} from 'lucide-react';

export default function DalyFunding() {
  const [selectedPair, setSelectedPair] = useState('BTC/USD');

  // Available trading pairs
  const availablePairs = [
    'BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD',
    'DOGE/USD', 'DOT/USD', 'LINK/USD', 'UNI/USD', 'AVAX/USD',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">DalyFunding Strategy</h1>
          <p className="text-sm text-gray-400 mt-1">
            Earn funding rates by holding perpetual positions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Positions</p>
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-xs text-gray-500 mt-1">No positions yet</p>
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
              <p className="text-2xl font-bold text-white">$0.00</p>
              <p className="text-xs text-gray-500 mt-1">Start trading to see stats</p>
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
              <p className="text-2xl font-bold text-white">$0.00</p>
              <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total P&L</p>
              <p className="text-2xl font-bold text-green-400">$0.00</p>
              <p className="text-xs text-green-500 mt-1">+0.00% return</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-500/20 flex items-center justify-center">
              <BarChart3 className="h-7 w-7 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
              Configure Funding Strategy
            </h2>
            <p className="text-sm text-gray-400 mt-1">Set up automated funding rate collection</p>
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
                  {pair.replace('/USD', '')}
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
                  defaultValue={100}
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
                  step="0.01"
                  min="0"
                  defaultValue={0.01}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  placeholder="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Minimum funding rate to enter</p>
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
        <h3 className="text-lg font-bold mb-3">DalyFunding Strategy Info</h3>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary-500 mt-0.5" />
            <div>
              <strong className="text-white">What is Funding?</strong> Funding rates are periodic payments
              exchanged between long and short positions in perpetual futures markets. When funding is positive,
              longs pay shorts. When negative, shorts pay longs.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <strong className="text-white">Automated Collection:</strong> This strategy automatically monitors
              funding rates across different pairs and opens positions when rates exceed your threshold,
              maximizing your funding rate earnings.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <strong className="text-white">Payment Schedule:</strong> Funding payments typically occur every
              8 hours. The strategy will hold positions through funding periods and can automatically close
              positions when rates become unfavorable.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <strong className="text-white">Risk Management:</strong> The strategy includes position sizing
              controls and automatic exit conditions to protect your capital while maximizing funding earnings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
