import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  Clock,
  Target,
  Percent,
  Calendar,
} from 'lucide-react';

export default function Stats() {
  const portfolio = useStore((state) => state.portfolio);
  const dcaStatus = useStore((state) => state.dcaStatus);
  const livePrices = useStore((state) => state.livePrices);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00%';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Calculate portfolio statistics
  const portfolioStats = {
    totalAssets: portfolio?.holdings?.length || 0,
    profitableAssets: portfolio?.holdings?.filter((h) => (h.profitLoss || 0) > 0).length || 0,
    losingAssets: portfolio?.holdings?.filter((h) => (h.profitLoss || 0) < 0).length || 0,
    avgReturn: portfolio?.holdings?.reduce((sum, h) => sum + (h.profitLossPercent || 0), 0) / (portfolio?.holdings?.length || 1) || 0,
    totalInvested: portfolio?.holdings?.reduce((sum, h) => sum + ((h.value || 0) - (h.profitLoss || 0)), 0) || 0,
    largestHolding: portfolio?.holdings?.sort((a, b) => (b.value || 0) - (a.value || 0))[0] || null,
    bestPerformer: portfolio?.holdings?.sort((a, b) => (b.profitLossPercent || 0) - (a.profitLossPercent || 0))[0] || null,
    worstPerformer: portfolio?.holdings?.sort((a, b) => (a.profitLossPercent || 0) - (b.profitLossPercent || 0))[0] || null,
  };

  // Calculate DCA statistics
  const dcaStats = {
    totalOrders: dcaStatus?.totalOrders || 0,
    successRate: dcaStatus?.successRate || 0,
    totalDeployed: dcaStatus?.totalDeployed || 0,
    avgOrderSize: dcaStatus?.totalOrders ? (dcaStatus.totalDeployed || 0) / dcaStatus.totalOrders : 0,
  };

  // Calculate time-based metrics
  const timeMetrics = {
    lastUpdate: new Date().toLocaleString(),
    portfolioAge: '90 days', // This would come from actual data
    tradingDays: dcaStatus?.totalOrders || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative space-y-6 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Statistics & Analytics
          </h1>
          <p className="text-slate-400 mt-2">Comprehensive overview of your trading performance</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Portfolio Value */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-blue-500/20 p-6 hover:border-blue-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl ring-1 ring-blue-500/30">
                <DollarSign className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(portfolio?.totalValue)}</p>
          </div>

          {/* Total Invested */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-purple-500/20 p-6 hover:border-purple-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl ring-1 ring-purple-500/30">
                <Target className="h-6 w-6 text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-1">Total Invested</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(portfolioStats.totalInvested)}</p>
          </div>

          {/* Average Return */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-green-500/20 p-6 hover:border-green-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/20 rounded-xl ring-1 ring-green-500/30">
                <Percent className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-1">Avg Return</p>
            <p className={`text-2xl font-bold ${portfolioStats.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(portfolioStats.avgReturn)}
            </p>
          </div>

          {/* Total Assets */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-pink-500/20 p-6 hover:border-pink-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-pink-500/20 rounded-xl ring-1 ring-pink-500/30">
                <PieChart className="h-6 w-6 text-pink-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-white">{portfolioStats.totalAssets}</p>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Performance */}
          <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-400" />
                Portfolio Performance
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <span className="text-slate-300">Profitable Assets</span>
                </div>
                <span className="text-2xl font-bold text-green-400">{portfolioStats.profitableAssets}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                  <span className="text-slate-300">Losing Assets</span>
                </div>
                <span className="text-2xl font-bold text-red-400">{portfolioStats.losingAssets}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Activity className="h-5 w-5 text-purple-400" />
                  <span className="text-slate-300">Win Rate</span>
                </div>
                <span className="text-2xl font-bold text-purple-400">
                  {portfolioStats.totalAssets > 0
                    ? ((portfolioStats.profitableAssets / portfolioStats.totalAssets) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>
          </div>

          {/* DCA Performance */}
          <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Activity className="h-5 w-5 mr-2 text-purple-400" />
                DCA Performance
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-blue-400" />
                  <span className="text-slate-300">Total Orders</span>
                </div>
                <span className="text-2xl font-bold text-blue-400">{dcaStats.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <span className="text-slate-300">Total Deployed</span>
                </div>
                <span className="text-2xl font-bold text-green-400">{formatCurrency(dcaStats.totalDeployed)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Percent className="h-5 w-5 text-purple-400" />
                  <span className="text-slate-300">Success Rate</span>
                </div>
                <span className="text-2xl font-bold text-purple-400">{dcaStats.successRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Holdings Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Largest Holding */}
          {portfolioStats.largestHolding && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/40 via-slate-800/60 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Largest Holding</h3>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                  {portfolioStats.largestHolding.asset?.substring(0, 2) || '??'}
                </div>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{portfolioStats.largestHolding.asset}</p>
              <p className="text-3xl font-bold text-blue-400 mb-2">{formatCurrency(portfolioStats.largestHolding.value)}</p>
              <p className="text-sm text-slate-400">{portfolioStats.largestHolding.allocation?.toFixed(1)}% of portfolio</p>
            </div>
          )}

          {/* Best Performer */}
          {portfolioStats.bestPerformer && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/40 via-slate-800/60 to-slate-800/40 backdrop-blur-xl border border-green-500/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Best Performer</h3>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                  {portfolioStats.bestPerformer.asset?.substring(0, 2) || '??'}
                </div>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{portfolioStats.bestPerformer.asset}</p>
              <p className="text-3xl font-bold text-green-400 mb-2">{formatPercent(portfolioStats.bestPerformer.profitLossPercent)}</p>
              <p className="text-sm text-slate-400">{formatCurrency(portfolioStats.bestPerformer.profitLoss)} profit</p>
            </div>
          )}

          {/* Worst Performer */}
          {portfolioStats.worstPerformer && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/40 via-slate-800/60 to-slate-800/40 backdrop-blur-xl border border-red-500/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Worst Performer</h3>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white font-bold">
                  {portfolioStats.worstPerformer.asset?.substring(0, 2) || '??'}
                </div>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{portfolioStats.worstPerformer.asset}</p>
              <p className="text-3xl font-bold text-red-400 mb-2">{formatPercent(portfolioStats.worstPerformer.profitLossPercent)}</p>
              <p className="text-sm text-slate-400">{formatCurrency(portfolioStats.worstPerformer.profitLoss)} loss</p>
            </div>
          )}
        </div>

        {/* Time-based Metrics */}
        <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Clock className="h-5 w-5 mr-2 text-cyan-400" />
              Time-based Metrics
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl bg-slate-900/30 border border-slate-700/30">
                <Calendar className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-2">Portfolio Age</p>
                <p className="text-2xl font-bold text-white">{timeMetrics.portfolioAge}</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-slate-900/30 border border-slate-700/30">
                <Activity className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-2">Trading Days</p>
                <p className="text-2xl font-bold text-white">{timeMetrics.tradingDays}</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-slate-900/30 border border-slate-700/30">
                <Clock className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-2">Last Update</p>
                <p className="text-lg font-semibold text-white">{timeMetrics.lastUpdate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* All Holdings Table */}
        <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-bold text-white">All Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-700/50">
                  <th className="pb-4 pt-4 pl-6 font-semibold">Asset</th>
                  <th className="pb-4 pt-4 font-semibold">Amount</th>
                  <th className="pb-4 pt-4 font-semibold">Value</th>
                  <th className="pb-4 pt-4 font-semibold">P&L</th>
                  <th className="pb-4 pt-4 font-semibold">P&L %</th>
                  <th className="pb-4 pt-4 pr-6 font-semibold">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings?.map((holding, idx) => (
                  <tr
                    key={holding.symbol || holding.asset}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-200"
                  >
                    <td className="py-4 pl-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                          {holding.asset?.substring(0, 2) || '??'}
                        </div>
                        <span className="font-semibold text-white">{holding.asset || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-300 font-mono">
                      {holding.amount !== undefined && holding.amount !== null
                        ? holding.amount.toFixed(6)
                        : '0.000000'}
                    </td>
                    <td className="py-4 text-white font-semibold">
                      {formatCurrency(holding.value)}
                    </td>
                    <td className="py-4">
                      <span className={`font-semibold ${
                        (holding.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(holding.profitLoss)}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
                        (holding.profitLossPercent || 0) >= 0
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {formatPercent(holding.profitLossPercent)}
                      </span>
                    </td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"
                            style={{ width: `${holding.allocation}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-400 font-semibold min-w-[3rem] text-right">
                          {holding.allocation?.toFixed(1) || '0.0'}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
