import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { getCommonName } from '@/utils/assetNames';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  RefreshCw,
  Zap,
  BarChart3,
  Wallet,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export default function Dashboard() {
  const portfolio = useStore((state) => state.portfolio);
  const dcaStatus = useStore((state) => state.dcaStatus);
  const systemStatus = useStore((state) => state.systemStatus);
  const livePrices = useStore((state) => state.livePrices);
  const fetchPortfolio = useStore((state) => state.fetchPortfolio);
  const fetchDCAStatus = useStore((state) => state.fetchDCAStatus);
  const fetchLivePrices = useStore((state) => state.fetchLivePrices);
  const syncTradeHistory = useStore((state) => state.syncTradeHistory);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [animatedValues, setAnimatedValues] = useState({
    portfolioValue: 0,
    profitLoss: 0,
  });

  // Animated counter effect
  useEffect(() => {
    if (portfolio) {
      const duration = 1500;
      const steps = 60;
      const stepDuration = duration / steps;

      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setAnimatedValues({
          portfolioValue: (portfolio.totalValue || 0) * easeOut,
          profitLoss: (portfolio.totalProfitLoss || 0) * easeOut,
        });

        if (currentStep >= steps) {
          clearInterval(interval);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }
  }, [portfolio?.totalValue, portfolio?.totalProfitLoss]);

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPortfolio(),
        fetchDCAStatus(),
        fetchLivePrices(),
      ]);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTrades = async () => {
    setSyncing(true);
    try {
      await syncTradeHistory();
    } catch (error) {
      console.error('Failed to sync trade history:', error);
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00%';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Get top movers from portfolio
  const topMovers = portfolio?.holdings
    ?.filter(h => h.profitLossPercent !== undefined)
    .sort((a, b) => Math.abs(b.profitLossPercent || 0) - Math.abs(a.profitLossPercent || 0))
    .slice(0, 3) || [];

  // Convert live prices map to array for ticker
  const livePricesList = Array.from(livePrices.values()).slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-slate-400 mt-2">Here's what's happening with your portfolio today</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSyncTrades}
              disabled={syncing}
              className="group relative px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-semibold text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50"
              title="Sync your Kraken trade history for accurate P&L calculations"
            >
              <Activity className={`inline mr-2 h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Trades'}
            </button>
            <button
              onClick={refreshData}
              disabled={loading}
              className="group relative px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              <RefreshCw className={`inline mr-2 h-5 w-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Main Stats - Hero Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Portfolio Value Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-purple-500/20 shadow-2xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-xl ring-1 ring-purple-500/30">
                  <Wallet className="h-8 w-8 text-purple-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total Portfolio</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-5xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  {formatCurrency(animatedValues.portfolioValue)}
                </p>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-1000"
                      style={{ width: '75%' }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">75% capacity</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          {/* P&L Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ring-1 ${
                  (portfolio?.totalProfitLoss || 0) >= 0
                    ? 'bg-green-500/20 ring-green-500/30'
                    : 'bg-red-500/20 ring-red-500/30'
                }`}>
                  {(portfolio?.totalProfitLoss || 0) >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-400" />
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total P&L</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-5xl font-bold ${
                  (portfolio?.totalProfitLoss || 0) >= 0
                    ? 'bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-red-400 to-rose-300 bg-clip-text text-transparent'
                }`}>
                  {formatCurrency(animatedValues.profitLoss)}
                </p>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    (portfolio?.totalProfitLossPercent || 0) >= 0
                      ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                      : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                  }`}>
                    {formatPercent(portfolio?.totalProfitLossPercent)}
                  </span>
                  <span className="text-xs text-slate-400">All time</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* DCA Status Card */}
          <div className="group relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 hover:border-pink-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  DCA Status
                </p>
                <p className={`text-2xl font-bold mb-1 ${
                  dcaStatus?.isRunning ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {dcaStatus?.isRunning ? 'Active' : 'Stopped'}
                </p>
                {dcaStatus && (
                  <p className="text-sm text-slate-500">{dcaStatus.totalOrders} orders placed</p>
                )}
              </div>
              <div className={`p-3 rounded-xl ${
                dcaStatus?.isRunning
                  ? 'bg-green-500/20 ring-1 ring-green-500/30'
                  : 'bg-slate-700/30 ring-1 ring-slate-600/30'
              }`}>
                <Zap className={`h-6 w-6 ${
                  dcaStatus?.isRunning ? 'text-green-400 animate-pulse' : 'text-slate-500'
                }`} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          </div>

          {/* System Status Card */}
          <div className="group relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 hover:border-blue-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  System Status
                </p>
                <p className={`text-2xl font-bold mb-1 ${
                  systemStatus.wsConnected ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {systemStatus.wsConnected ? 'Connected' : 'Fallback'}
                </p>
                <p className="text-sm text-slate-500">
                  {systemStatus.wsConnected ? 'WebSocket' : 'REST API'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemStatus.wsConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-slate-600'
                  }`} />
                  <span className="text-xs text-slate-500">WS</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemStatus.cacheAvailable ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-slate-600'
                  }`} />
                  <span className="text-xs text-slate-500">Cache</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemStatus.krakenConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-slate-600'
                  }`} />
                  <span className="text-xs text-slate-500">Kraken</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          </div>

          {/* Quick Stats Card */}
          <div className="group relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Active Assets
                </p>
                <p className="text-2xl font-bold mb-1 text-purple-400">
                  {portfolio?.holdings?.length || 0}
                </p>
                <p className="text-sm text-slate-500">Total holdings</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-xl ring-1 ring-purple-500/30">
                <DollarSign className="h-6 w-6 text-purple-400" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          </div>
        </div>

        {/* Live Price Ticker */}
        {livePricesList.length > 0 && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-indigo-500/20 p-4">
            <div className="flex items-center space-x-6 animate-scroll">
              {livePricesList.map((price) => (
                <div
                  key={price.symbol}
                  className="flex items-center space-x-3 px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-700/30 min-w-fit"
                >
                  <span className="font-semibold text-white">{price.symbol}</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {formatCurrency(price.price)}
                  </span>
                  <span className={`text-sm px-2 py-0.5 rounded ${
                    price.change24h >= 0
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {formatPercent(price.change24h)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Movers Bar */}
        {topMovers.length > 0 && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800/40 via-slate-800/60 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-cyan-400" />
                Top Movers
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topMovers.map((holding, idx) => {
                const commonName = getCommonName(holding.asset);
                return (
                <div
                  key={holding.asset}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:border-purple-500/30 transition-all duration-300"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      (holding.profitLossPercent || 0) >= 0
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {commonName?.substring(0, 2) || '??'}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{commonName}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(holding.value)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      (holding.profitLossPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(holding.profitLossPercent)}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Holdings Table */}
        <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Top Holdings
            </h2>
          </div>

          {portfolio && portfolio.holdings && Array.isArray(portfolio.holdings) && portfolio.holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700/50">
                    <th className="pb-4 pt-4 pl-6 font-semibold">Asset</th>
                    <th className="pb-4 pt-4 font-semibold">Amount</th>
                    <th className="pb-4 pt-4 font-semibold">Price</th>
                    <th className="pb-4 pt-4 font-semibold">Value</th>
                    <th className="pb-4 pt-4 font-semibold">P&L</th>
                    <th className="pb-4 pt-4 pr-6 font-semibold">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.slice(0, 5).map((holding, idx) => {
                    const commonName = getCommonName(holding.asset);
                    return (
                    <tr
                      key={holding.symbol || holding.asset}
                      className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-200"
                      style={{ animation: 'fadeIn 0.5s ease-in', animationDelay: `${idx * 50}ms` }}
                    >
                      <td className="py-4 pl-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                            {commonName?.substring(0, 2) || '??'}
                          </div>
                          <span className="font-semibold text-white">{commonName || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-4 text-slate-300 font-mono">
                        {holding.amount !== undefined && holding.amount !== null
                          ? holding.amount.toFixed(6)
                          : '0.000000'}
                      </td>
                      <td className="py-4 text-slate-300 font-mono">
                        {formatCurrency(holding.currentPrice)}
                      </td>
                      <td className="py-4 text-white font-semibold">
                        {formatCurrency(holding.value)}
                      </td>
                      <td className="py-4">
                        <div className="space-y-1">
                          <span className={`font-semibold ${
                            (holding.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatCurrency(holding.profitLoss)}
                          </span>
                          <div>
                            <span className={`text-sm px-2 py-0.5 rounded ${
                              (holding.profitLossPercent || 0) >= 0
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {formatPercent(holding.profitLossPercent)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full transition-all duration-1000"
                              style={{
                                width: `${holding.allocation}%`,
                                animation: 'slideIn 1s ease-out',
                                animationDelay: `${idx * 100}ms`
                              }}
                            />
                          </div>
                          <span className="text-sm text-slate-400 font-semibold min-w-[3rem] text-right">
                            {holding.allocation.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No holdings data available</p>
            </div>
          )}
        </div>

        {/* DCA Activity Card */}
        {dcaStatus && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/40 via-slate-800/60 to-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                DCA Activity
              </h2>
            </div>
            <div className="p-6 grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl bg-slate-900/30 border border-slate-700/30">
                <p className="text-sm text-slate-400 mb-2">Total Deployed</p>
                <p className="text-3xl font-bold text-purple-400">
                  {formatCurrency(dcaStatus?.totalDeployed || 0)}
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-slate-900/30 border border-slate-700/30">
                <p className="text-sm text-slate-400 mb-2">Success Rate</p>
                <p className="text-3xl font-bold text-green-400">
                  {dcaStatus?.successRate?.toFixed(1) || '0.0'}%
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-slate-900/30 border border-slate-700/30">
                <p className="text-sm text-slate-400 mb-2">Last Execution</p>
                <p className="text-lg text-slate-300 font-semibold">
                  {dcaStatus?.lastExecution
                    ? new Date(dcaStatus.lastExecution).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
