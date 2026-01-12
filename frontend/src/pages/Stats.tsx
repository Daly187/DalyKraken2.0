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
  RefreshCw,
} from 'lucide-react';

export default function Stats() {
  const portfolio = useStore((state) => state.portfolio);
  const dcaStatus = useStore((state) => state.dcaStatus);
  const livePrices = useStore((state) => state.livePrices);
  const dcaBots = useStore((state) => state.dcaBots);
  const transactions = useStore((state) => state.transactions);
  const auditSummary = useStore((state) => state.auditSummary);
  const fetchDCABots = useStore((state) => state.fetchDCABots);
  const fetchTransactions = useStore((state) => state.fetchTransactions);
  const fetchAuditSummary = useStore((state) => state.fetchAuditSummary);
  const fetchPortfolio = useStore((state) => state.fetchPortfolio);
  const fetchDCAStatus = useStore((state) => state.fetchDCAStatus);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Use Promise.allSettled to prevent one failure from stopping others
      await Promise.allSettled([
        fetchPortfolio(),
        fetchDCAStatus(),
        fetchDCABots(),
        fetchTransactions(),
        fetchAuditSummary(),
      ]);
    } catch (error) {
      console.error('[Stats] Error loading data:', error);
    }
    setIsLoading(false);
  };

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
  const holdings = portfolio?.holdings || [];
  const portfolioTotalValue = portfolio?.totalValue || 0;
  const portfolioTotalProfitLoss = portfolio?.totalProfitLoss || 0;
  const portfolioTotalProfitLossPercent = portfolio?.totalProfitLossPercent || 0;

  // Debug logging
  console.log('[Stats] Portfolio:', portfolio);
  console.log('[Stats] Holdings:', holdings.length);
  console.log('[Stats] DCA Bots:', dcaBots.length);
  console.log('[Stats] Transactions:', transactions.length);
  console.log('[Stats] Audit Summary:', auditSummary);

  const portfolioStats = {
    totalAssets: holdings.length,
    profitableAssets: holdings.filter((h) => (h.profitLoss || 0) > 0).length,
    losingAssets: holdings.filter((h) => (h.profitLoss || 0) < 0).length,
    avgReturn: holdings.length > 0
      ? holdings.reduce((sum, h) => sum + (h.profitLossPercent || 0), 0) / holdings.length
      : 0,
    totalInvested: holdings.reduce((sum, h) => sum + ((h.value || 0) - (h.profitLoss || 0)), 0),
    largestHolding: holdings.length > 0
      ? [...holdings].sort((a, b) => (b.value || 0) - (a.value || 0))[0]
      : null,
    bestPerformer: holdings.length > 0
      ? [...holdings].sort((a, b) => (b.profitLossPercent || 0) - (a.profitLossPercent || 0))[0]
      : null,
    worstPerformer: holdings.length > 0
      ? [...holdings].sort((a, b) => (a.profitLossPercent || 0) - (b.profitLossPercent || 0))[0]
      : null,
  };

  // Calculate DCA statistics
  const dcaStats = {
    totalOrders: dcaStatus?.totalOrders || 0,
    successRate: dcaStatus?.successRate || 0,
    totalDeployed: dcaStatus?.totalDeployed || 0,
    avgOrderSize: dcaStatus?.totalOrders ? (dcaStatus.totalDeployed || 0) / dcaStatus.totalOrders : 0,
  };

  // Calculate DCA Bot statistics
  const activeBots = dcaBots.filter(b => b.status === 'active');
  const pausedBots = dcaBots.filter(b => b.status === 'paused');
  const completedBots = dcaBots.filter(b => b.status === 'completed');

  const botStats = {
    totalBots: dcaBots.length,
    activeBots: activeBots.length,
    pausedBots: pausedBots.length,
    completedBots: completedBots.length,
    totalInvested: dcaBots.reduce((sum, bot) => sum + (bot.totalInvested || 0), 0),
    totalUnrealizedPnL: dcaBots.reduce((sum, bot) => sum + (bot.unrealizedPnL || 0), 0),
    avgPnLPercent: dcaBots.length > 0
      ? dcaBots.reduce((sum, bot) => sum + (bot.unrealizedPnLPercent || 0), 0) / dcaBots.length
      : 0,
    profitableBots: dcaBots.filter(b => (b.unrealizedPnL || 0) > 0).length,
    losingBots: dcaBots.filter(b => (b.unrealizedPnL || 0) < 0).length,
  };

  // Calculate transaction statistics
  const txStats = {
    totalTransactions: auditSummary?.totalTransactions || transactions.length || 0,
    totalBuys: auditSummary?.totalBuys || transactions.filter(t => t.type === 'buy').length || 0,
    totalSells: auditSummary?.totalSells || transactions.filter(t => t.type === 'sell').length || 0,
    totalFees: auditSummary?.totalFees || transactions.reduce((sum, t) => sum + (t.fee || 0), 0) || 0,
    netProfitLoss: auditSummary?.netProfitLoss || 0,
    buyVolume: transactions.filter(t => t.type === 'buy').reduce((sum, t) => sum + (t.total || 0), 0),
    sellVolume: transactions.filter(t => t.type === 'sell').reduce((sum, t) => sum + (t.total || 0), 0),
  };

  // Calculate time-based metrics
  const timeMetrics = {
    lastUpdate: new Date().toLocaleString(),
    portfolioAge: '90 days', // This would come from actual data
    tradingDays: dcaStatus?.totalOrders || 0,
  };

  return (
    <div className="min-h-screen">
      {/* Animated background gradients - only visible in dark mode */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:block hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative space-y-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 dark:bg-gradient-to-r dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 dark:bg-clip-text dark:text-transparent">
              Statistics & Analytics
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Comprehensive overview of your trading performance</p>
            {isLoading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-400">
                <Activity className="h-4 w-4 animate-pulse" />
                <span>Loading latest data...</span>
              </div>
            )}
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Overall Performance Summary */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 backdrop-blur-xl border border-blue-200 dark:border-blue-500/20 p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Portfolio Value</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{formatCurrency(portfolioTotalValue)}</p>
              <p className={`text-sm font-semibold ${
                portfolioTotalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(portfolioTotalProfitLoss)} ({formatPercent(portfolioTotalProfitLossPercent)})
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">DCA Bots P&L</p>
              <p className={`text-3xl font-bold ${botStats.totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(botStats.totalUnrealizedPnL)}
              </p>
              <p className={`text-sm font-semibold ${botStats.avgPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(botStats.avgPnLPercent)} avg
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Trading Volume</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-white mb-1">
                {formatCurrency(txStats.buyVolume + txStats.sellVolume)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {txStats.totalTransactions} trades
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Win Rate</p>
              <p className="text-3xl font-bold text-purple-400">
                {portfolioStats.totalAssets > 0
                  ? ((portfolioStats.profitableAssets / portfolioStats.totalAssets) * 100).toFixed(1)
                  : '0.0'}%
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {portfolioStats.profitableAssets} / {portfolioStats.totalAssets} assets
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Portfolio Value */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-blue-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-blue-200 dark:border-blue-500/20 p-6 hover:border-blue-400 dark:hover:border-blue-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-xl ring-1 ring-blue-200 dark:ring-blue-500/30">
                <DollarSign className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(portfolioTotalValue)}</p>
          </div>

          {/* Total Invested */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-purple-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-purple-200 dark:border-purple-500/20 p-6 hover:border-purple-400 dark:hover:border-purple-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-xl ring-1 ring-purple-200 dark:ring-purple-500/30">
                <Target className="h-6 w-6 text-purple-500 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Invested</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(portfolioStats.totalInvested)}</p>
          </div>

          {/* Average Return */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-green-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-green-200 dark:border-green-500/20 p-6 hover:border-green-400 dark:hover:border-green-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-500/20 rounded-xl ring-1 ring-green-200 dark:ring-green-500/30">
                <Percent className="h-6 w-6 text-green-500 dark:text-green-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Avg Return</p>
            <p className={`text-2xl font-bold ${portfolioStats.avgReturn >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {formatPercent(portfolioStats.avgReturn)}
            </p>
          </div>

          {/* Total Assets */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-pink-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-pink-200 dark:border-pink-500/20 p-6 hover:border-pink-400 dark:hover:border-pink-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-pink-100 dark:bg-pink-500/20 rounded-xl ring-1 ring-pink-200 dark:ring-pink-500/30">
                <PieChart className="h-6 w-6 text-pink-500 dark:text-pink-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{portfolioStats.totalAssets}</p>
          </div>
        </div>

        {/* Trading Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Trades */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-cyan-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-cyan-200 dark:border-cyan-500/20 p-6 hover:border-cyan-400 dark:hover:border-cyan-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-cyan-100 dark:bg-cyan-500/20 rounded-xl ring-1 ring-cyan-200 dark:ring-cyan-500/30">
                <Activity className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{txStats.totalTransactions}</p>
            <p className="text-xs text-slate-500 mt-1">{txStats.totalBuys} buys / {txStats.totalSells} sells</p>
          </div>

          {/* Trade Volume */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-emerald-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-emerald-200 dark:border-emerald-500/20 p-6 hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl ring-1 ring-emerald-200 dark:ring-emerald-500/30">
                <BarChart3 className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Trade Volume</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(txStats.buyVolume + txStats.sellVolume)}</p>
            <p className="text-xs text-slate-500 mt-1">Buy: {formatCurrency(txStats.buyVolume)}</p>
          </div>

          {/* Total Fees Paid */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-orange-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-orange-200 dark:border-orange-500/20 p-6 hover:border-orange-400 dark:hover:border-orange-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-500/20 rounded-xl ring-1 ring-orange-200 dark:ring-orange-500/30">
                <DollarSign className="h-6 w-6 text-orange-500 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Fees</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(txStats.totalFees)}</p>
            <p className="text-xs text-slate-500 mt-1">Cumulative trading fees</p>
          </div>

          {/* Net P&L */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-violet-500/10 dark:via-slate-800/50 dark:to-slate-900/50 backdrop-blur-xl border border-violet-200 dark:border-violet-500/20 p-6 hover:border-violet-400 dark:hover:border-violet-500/40 transition-all duration-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-violet-100 dark:bg-violet-500/20 rounded-xl ring-1 ring-violet-200 dark:ring-violet-500/30">
                <TrendingUp className="h-6 w-6 text-violet-500 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Net Realized P&L</p>
            <p className={`text-2xl font-bold ${txStats.netProfitLoss >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {formatCurrency(txStats.netProfitLoss)}
            </p>
            <p className="text-xs text-slate-500 mt-1">From completed trades</p>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Performance */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-400" />
                Portfolio Performance
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <span className="text-slate-600 dark:text-slate-300">Profitable Assets</span>
                </div>
                <span className="text-2xl font-bold text-green-400">{portfolioStats.profitableAssets}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                  <span className="text-slate-600 dark:text-slate-300">Losing Assets</span>
                </div>
                <span className="text-2xl font-bold text-red-400">{portfolioStats.losingAssets}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Activity className="h-5 w-5 text-purple-400" />
                  <span className="text-slate-600 dark:text-slate-300">Win Rate</span>
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
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                <Activity className="h-5 w-5 mr-2 text-purple-400" />
                DCA Performance
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-blue-400" />
                  <span className="text-slate-600 dark:text-slate-300">Total Orders</span>
                </div>
                <span className="text-2xl font-bold text-blue-400">{dcaStats.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <span className="text-slate-600 dark:text-slate-300">Total Deployed</span>
                </div>
                <span className="text-2xl font-bold text-green-400">{formatCurrency(dcaStats.totalDeployed)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Percent className="h-5 w-5 text-purple-400" />
                  <span className="text-slate-600 dark:text-slate-300">Success Rate</span>
                </div>
                <span className="text-2xl font-bold text-purple-400">{dcaStats.successRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* DCA Bot Performance */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                <Target className="h-5 w-5 mr-2 text-cyan-400" />
                DCA Bot Performance
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Activity className="h-5 w-5 text-cyan-400" />
                  <span className="text-slate-600 dark:text-slate-300">Active Bots</span>
                </div>
                <span className="text-2xl font-bold text-cyan-400">{botStats.activeBots} / {botStats.totalBots}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                  <span className="text-slate-600 dark:text-slate-300">Total Invested</span>
                </div>
                <span className="text-2xl font-bold text-blue-400">{formatCurrency(botStats.totalInvested)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  {botStats.totalUnrealizedPnL >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  )}
                  <span className="text-slate-600 dark:text-slate-300">Unrealized P&L</span>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${botStats.totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(botStats.totalUnrealizedPnL)}
                  </span>
                  <p className={`text-sm ${botStats.avgPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(botStats.avgPnLPercent)} avg
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Profitable</p>
                  <p className="text-xl font-bold text-green-400">{botStats.profitableBots}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Losing</p>
                  <p className="text-xl font-bold text-red-400">{botStats.losingBots}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performing DCA Bots */}
        {dcaBots.length > 0 && (
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Top Performing Bots</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-gray-100 dark:border-slate-700/50">
                    <th className="pb-4 pt-4 pl-6 font-semibold">Symbol</th>
                    <th className="pb-4 pt-4 font-semibold">Status</th>
                    <th className="pb-4 pt-4 font-semibold">Invested</th>
                    <th className="pb-4 pt-4 font-semibold">Entries</th>
                    <th className="pb-4 pt-4 font-semibold">Avg Price</th>
                    <th className="pb-4 pt-4 font-semibold">Current Price</th>
                    <th className="pb-4 pt-4 font-semibold">P&L</th>
                    <th className="pb-4 pt-4 pr-6 font-semibold">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dcaBots]
                    .sort((a, b) => (b.unrealizedPnLPercent || 0) - (a.unrealizedPnLPercent || 0))
                    .slice(0, 10)
                    .map((bot) => (
                      <tr
                        key={bot.id}
                        className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors duration-200"
                      >
                        <td className="py-4 pl-6">
                          <span className="font-semibold text-slate-800 dark:text-white">{bot.symbol}</span>
                        </td>
                        <td className="py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            bot.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : bot.status === 'paused'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : bot.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {bot.status}
                          </span>
                        </td>
                        <td className="py-4 text-slate-600 dark:text-slate-300 font-mono">
                          {formatCurrency(bot.totalInvested || 0)}
                        </td>
                        <td className="py-4 text-slate-600 dark:text-slate-300">
                          {bot.currentEntryCount} / {bot.reEntryCount + 1}
                        </td>
                        <td className="py-4 text-slate-600 dark:text-slate-300 font-mono">
                          {formatCurrency(bot.averagePurchasePrice || 0)}
                        </td>
                        <td className="py-4 text-slate-600 dark:text-slate-300 font-mono">
                          {formatCurrency(bot.currentPrice || 0)}
                        </td>
                        <td className="py-4">
                          <span className={`font-semibold ${
                            (bot.unrealizedPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatCurrency(bot.unrealizedPnL || 0)}
                          </span>
                        </td>
                        <td className="py-4 pr-6">
                          <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
                            (bot.unrealizedPnLPercent || 0) >= 0
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {formatPercent(bot.unrealizedPnLPercent || 0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Holdings Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Largest Holding */}
          {portfolioStats.largestHolding && (
            <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-slate-800/40 dark:via-slate-800/60 dark:to-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Largest Holding</h3>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-slate-800 dark:text-white font-bold">
                  {portfolioStats.largestHolding.asset?.substring(0, 2) || '??'}
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{portfolioStats.largestHolding.asset}</p>
              <p className="text-3xl font-bold text-blue-400 mb-2">{formatCurrency(portfolioStats.largestHolding.value)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{portfolioStats.largestHolding.allocation?.toFixed(1)}% of portfolio</p>
            </div>
          )}

          {/* Best Performer */}
          {portfolioStats.bestPerformer && (
            <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-slate-800/40 dark:via-slate-800/60 dark:to-slate-800/40 backdrop-blur-xl border border-green-200 dark:border-green-500/20 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Best Performer</h3>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-slate-800 dark:text-white font-bold">
                  {portfolioStats.bestPerformer.asset?.substring(0, 2) || '??'}
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{portfolioStats.bestPerformer.asset}</p>
              <p className="text-3xl font-bold text-green-400 mb-2">{formatPercent(portfolioStats.bestPerformer.profitLossPercent)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(portfolioStats.bestPerformer.profitLoss)} profit</p>
            </div>
          )}

          {/* Worst Performer */}
          {portfolioStats.worstPerformer && (
            <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gradient-to-br dark:from-slate-800/40 dark:via-slate-800/60 dark:to-slate-800/40 backdrop-blur-xl border border-red-200 dark:border-red-500/20 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Worst Performer</h3>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-slate-800 dark:text-white font-bold">
                  {portfolioStats.worstPerformer.asset?.substring(0, 2) || '??'}
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{portfolioStats.worstPerformer.asset}</p>
              <p className="text-3xl font-bold text-red-400 mb-2">{formatPercent(portfolioStats.worstPerformer.profitLossPercent)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(portfolioStats.worstPerformer.profitLoss)} loss</p>
            </div>
          )}
        </div>

        {/* Recent Transactions & Time Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                <Clock className="h-5 w-5 mr-2 text-cyan-400" />
                Recent Transactions
              </h2>
            </div>
            <div className="p-6">
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30 hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          tx.type === 'buy'
                            ? 'bg-green-500/20 text-green-400'
                            : tx.type === 'sell'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {tx.type === 'buy' ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : tx.type === 'sell' ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <DollarSign className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-white">
                            {tx.type.toUpperCase()} {tx.symbol}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{formatCurrency(tx.total)}</p>
                        <p className="text-xs text-slate-400">{tx.amount.toFixed(4)} @ {formatCurrency(tx.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No recent transactions</p>
                </div>
              )}
            </div>
          </div>

          {/* Time-based Metrics */}
          <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-cyan-400" />
                Time Metrics
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-cyan-400" />
                  <span className="text-slate-600 dark:text-slate-300">Portfolio Age</span>
                </div>
                <span className="text-xl font-bold text-slate-800 dark:text-white">{timeMetrics.portfolioAge}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Activity className="h-5 w-5 text-purple-400" />
                  <span className="text-slate-600 dark:text-slate-300">Trading Days</span>
                </div>
                <span className="text-xl font-bold text-slate-800 dark:text-white">{timeMetrics.tradingDays}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <span className="text-slate-600 dark:text-slate-300">Last Update</span>
                </div>
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{timeMetrics.lastUpdate}</span>
              </div>
              {dcaBots.length > 0 && activeBots.length > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-5 w-5 text-green-400 animate-pulse" />
                    <span className="text-slate-600 dark:text-slate-300">Active Bots</span>
                  </div>
                  <span className="text-xl font-bold text-green-400">{activeBots.length} Running</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Holdings Table */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-gray-100 dark:border-slate-700/50">
          <div className="p-6 border-b border-gray-100 dark:border-slate-700/50">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">All Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-gray-100 dark:border-slate-700/50">
                  <th className="pb-4 pt-4 pl-6 font-semibold">Asset</th>
                  <th className="pb-4 pt-4 font-semibold">Amount</th>
                  <th className="pb-4 pt-4 font-semibold">Value</th>
                  <th className="pb-4 pt-4 font-semibold">P&L</th>
                  <th className="pb-4 pt-4 font-semibold">P&L %</th>
                  <th className="pb-4 pt-4 pr-6 font-semibold">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding, idx) => (
                  <tr
                    key={holding.symbol || holding.asset}
                    className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors duration-200"
                  >
                    <td className="py-4 pl-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-slate-800 dark:text-white font-bold text-sm">
                          {holding.asset?.substring(0, 2) || '??'}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-white">{holding.asset || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-600 dark:text-slate-300 font-mono">
                      {holding.amount !== undefined && holding.amount !== null
                        ? holding.amount.toFixed(6)
                        : '0.000000'}
                    </td>
                    <td className="py-4 text-slate-800 dark:text-white font-semibold">
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
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"
                            style={{ width: `${holding.allocation}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold min-w-[3rem] text-right">
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
