import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ExternalLink,
  Copy,
  Check,
  X,
  Eye,
  Plus,
  Minus,
  Wallet,
  Activity,
  Percent,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import type {
  TopWallet,
  TrackedWallet,
  TrackedPortfolio,
  WalletDetails,
  WalletPosition,
  WalletTrade,
  SortOption,
  TimeframeOption,
} from '@/types/walletTracker';
import { apiService } from '@/services/apiService';

type TabType = 'leaderboard' | 'portfolio';

// Format currency helper
const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Format percentage helper
const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// Format address helper
const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Format relative time
const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function WalletTracker() {
  const [activeTab, setActiveTab] = useState<TabType>('leaderboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter/sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('pnl7d');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data states
  const [topWallets, setTopWallets] = useState<TopWallet[]>([]);
  const [portfolio, setPortfolio] = useState<TrackedPortfolio | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerWallet, setDrawerWallet] = useState<string | null>(null);
  const [drawerDetails, setDrawerDetails] = useState<WalletDetails | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Track modal states
  const [trackingWallet, setTrackingWallet] = useState<string | null>(null);
  const [allocationInput, setAllocationInput] = useState<string>('1000');

  // Copy state
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Fetch top wallets
  const fetchTopWallets = useCallback(async () => {
    try {
      const response = await apiService.getTopWallets({
        sortBy,
        limit: 50,
      });

      if (response?.success) {
        setTopWallets(response.wallets || []);
        setLastSyncedAt(response.lastSyncedAt);
      }
    } catch (err: any) {
      console.error('[WalletTracker] Error fetching top wallets:', err);
    }
  }, [sortBy]);

  // Fetch portfolio
  const fetchPortfolio = useCallback(async () => {
    try {
      const response = await apiService.getTrackedPortfolio();

      if (response?.success) {
        setPortfolio(response.portfolio);
      }
    } catch (err: any) {
      console.error('[WalletTracker] Error fetching portfolio:', err);
    }
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([fetchTopWallets(), fetchPortfolio()]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fetchTopWallets, fetchPortfolio]);

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        apiService.syncTopWallets(),
        apiService.syncTrackedPortfolio(),
      ]);
      await fetchAllData();
    } catch (err: any) {
      console.error('[WalletTracker] Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Open wallet drawer
  const openWalletDrawer = async (address: string) => {
    setDrawerWallet(address);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerDetails(null);

    try {
      const response = await apiService.getPmWalletDetails(address, {
        includePositions: true,
        includeTrades: true,
        tradeLimit: 20,
      });

      if (response?.success) {
        setDrawerDetails(response.wallet);
      }
    } catch (err: any) {
      console.error('[WalletTracker] Error fetching wallet details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Close drawer
  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerWallet(null);
    setDrawerDetails(null);
  };

  // Track wallet
  const handleTrackWallet = async (address: string) => {
    const allocation = parseFloat(allocationInput);
    if (isNaN(allocation) || allocation <= 0) {
      return;
    }

    try {
      await apiService.trackWallet(address, allocation);
      await fetchPortfolio();
      setTrackingWallet(null);
      setAllocationInput('1000');
    } catch (err: any) {
      console.error('[WalletTracker] Error tracking wallet:', err);
    }
  };

  // Untrack wallet
  const handleUntrackWallet = async (address: string) => {
    try {
      await apiService.untrackWallet(address);
      await fetchPortfolio();
    } catch (err: any) {
      console.error('[WalletTracker] Error untracking wallet:', err);
    }
  };

  // Update allocation
  const handleUpdateAllocation = async (address: string, newAllocation: number) => {
    try {
      await apiService.updateTracking(address, { allocationUsd: newAllocation });
      await fetchPortfolio();
    } catch (err: any) {
      console.error('[WalletTracker] Error updating allocation:', err);
    }
  };

  // Copy address
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Check if wallet is tracked
  const isWalletTracked = (address: string): boolean => {
    return portfolio?.trackedWallets.some(w => w.address.toLowerCase() === address.toLowerCase()) || false;
  };

  // Filter wallets by search
  const filteredWallets = topWallets.filter(wallet =>
    wallet.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wallet.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAllData();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllData]);

  // Re-fetch when sort changes
  useEffect(() => {
    fetchTopWallets();
  }, [sortBy, fetchTopWallets]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Polymarket Wallet Tracker
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track top traders and simulate portfolio performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                autoRefresh
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
            </button>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="flex items-center justify-between mt-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy className="h-4 w-4 inline mr-2" />
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'portfolio'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Wallet className="h-4 w-4 inline mr-2" />
              My Portfolio
              {portfolio && portfolio.trackedWallets.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                  {portfolio.trackedWallets.length}
                </span>
              )}
            </button>
          </div>

          {/* Filters (only on leaderboard tab) */}
          {activeTab === 'leaderboard' && (
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search wallets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="pnl7d">7D PnL</option>
                <option value="pnl30d">30D PnL</option>
                <option value="roi7d">7D ROI</option>
                <option value="roi30d">30D ROI</option>
                <option value="winRate7d">Win Rate</option>
                <option value="volume30d">Volume</option>
              </select>

              {/* Timeframe toggle */}
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setTimeframe('7d')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeframe === '7d'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setTimeframe('30d')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeframe === '30d'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  30D
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Last synced info */}
        {lastSyncedAt && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Last synced: {formatTimeAgo(lastSyncedAt)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 text-purple-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={fetchAllData}
              className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : activeTab === 'leaderboard' ? (
          /* Leaderboard Tab */
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Wallet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {timeframe === '7d' ? '7D' : '30D'} PnL
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Win Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Volume
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Positions
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredWallets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                        {searchQuery ? 'No wallets match your search' : 'No wallets found. Try syncing the leaderboard.'}
                      </td>
                    </tr>
                  ) : (
                    filteredWallets.map((wallet, index) => {
                      const pnl = timeframe === '7d' ? wallet.pnl7d : wallet.pnl30d;
                      const roi = timeframe === '7d' ? wallet.roi7d : wallet.roi30d;
                      const winRate = timeframe === '7d' ? wallet.winRate7d : wallet.winRate30d;
                      const volume = timeframe === '7d' ? wallet.volume7d : wallet.volume30d;
                      const isTracked = isWalletTracked(wallet.address);

                      return (
                        <tr
                          key={wallet.address}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <td className="px-4 py-4">
                            <span className="text-lg font-bold text-slate-400 dark:text-slate-500">
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-slate-900 dark:text-white">
                                {wallet.displayName || formatAddress(wallet.address)}
                              </span>
                              <button
                                onClick={() => copyAddress(wallet.address)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                title="Copy address"
                              >
                                {copiedAddress === wallet.address ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                              {isTracked && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                                  Tracking
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span
                              className={`font-semibold ${
                                pnl >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span
                              className={`font-medium ${
                                roi >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {roi >= 0 ? '+' : ''}{formatPercent(roi)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 rounded-full"
                                  style={{ width: `${winRate * 100}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {formatPercent(winRate)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                            {formatCurrency(volume)}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                            {wallet.openPositions}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-500 dark:text-slate-400 text-sm">
                            {formatTimeAgo(wallet.lastActiveAt)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openWalletDrawer(wallet.address)}
                                className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {trackingWallet === wallet.address ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={allocationInput}
                                    onChange={(e) => setAllocationInput(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 border-0 rounded text-right"
                                    placeholder="$"
                                  />
                                  <button
                                    onClick={() => handleTrackWallet(wallet.address)}
                                    className="p-1.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setTrackingWallet(null)}
                                    className="p-1.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : isTracked ? (
                                <button
                                  onClick={() => handleUntrackWallet(wallet.address)}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-lg text-sm hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                                >
                                  Untrack
                                </button>
                              ) : (
                                <button
                                  onClick={() => setTrackingWallet(wallet.address)}
                                  className="px-3 py-1.5 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                >
                                  Track
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Portfolio Tab */
          <div className="space-y-6">
            {/* Portfolio Summary */}
            {portfolio && portfolio.trackedWallets.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">Total Allocated</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(portfolio.totalAllocation)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">Current Value</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(portfolio.currentValue)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        portfolio.totalPnl >= 0
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {portfolio.totalPnl >= 0 ? (
                          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">Total PnL</span>
                    </div>
                    <p className={`text-2xl font-bold ${
                      portfolio.totalPnl >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {portfolio.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.totalPnl)}
                      <span className="text-sm ml-2">
                        ({portfolio.totalPnlPercent >= 0 ? '+' : ''}{formatPercent(portfolio.totalPnlPercent)})
                      </span>
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">Weighted Win Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatPercent(portfolio.weightedWinRate)}
                    </p>
                  </div>
                </div>

                {/* Tracked Wallets Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Tracked Wallets
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Wallet
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Allocation
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Weight
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Current Value
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            PnL
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Win Rate
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {portfolio.trackedWallets.map((wallet) => (
                          <tr
                            key={wallet.address}
                            className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-slate-900 dark:text-white">
                                  {wallet.nickname || formatAddress(wallet.address)}
                                </span>
                                <button
                                  onClick={() => copyAddress(wallet.address)}
                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                  {copiedAddress === wallet.address ? (
                                    <Check className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right font-medium text-slate-900 dark:text-white">
                              {formatCurrency(wallet.allocationUsd)}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                              {formatPercent(wallet.weight)}
                            </td>
                            <td className="px-4 py-4 text-right font-medium text-slate-900 dark:text-white">
                              {formatCurrency(wallet.currentValue)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span
                                className={`font-semibold ${
                                  wallet.pnlContribution >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {wallet.pnlContribution >= 0 ? '+' : ''}{formatCurrency(wallet.pnlContribution)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                              {formatPercent(wallet.cachedWinRate)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openWalletDrawer(wallet.address)}
                                  className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title="View positions"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleUntrackWallet(wallet.address)}
                                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  title="Untrack"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center shadow-sm">
                <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No Tracked Wallets
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Start tracking wallets from the leaderboard to build your simulated portfolio
                </p>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Browse Leaderboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wallet Details Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-slate-800 shadow-xl overflow-y-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Wallet Details
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                      {drawerWallet ? formatAddress(drawerWallet) : ''}
                    </span>
                    {drawerWallet && (
                      <button
                        onClick={() => copyAddress(drawerWallet)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {copiedAddress === drawerWallet ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-6">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-8 w-8 text-purple-600 animate-spin" />
                </div>
              ) : drawerDetails ? (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">7D PnL</p>
                      <p className={`text-lg font-bold ${
                        drawerDetails.stats.pnl7d >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {drawerDetails.stats.pnl7d >= 0 ? '+' : ''}{formatCurrency(drawerDetails.stats.pnl7d)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">30D PnL</p>
                      <p className={`text-lg font-bold ${
                        drawerDetails.stats.pnl30d >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {drawerDetails.stats.pnl30d >= 0 ? '+' : ''}{formatCurrency(drawerDetails.stats.pnl30d)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Win Rate</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatPercent(drawerDetails.stats.winRate7d)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Open Positions</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {drawerDetails.stats.openPositionsCount}
                      </p>
                    </div>
                  </div>

                  {/* Open Positions */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Open Positions ({drawerDetails.positions.length})
                    </h3>
                    {drawerDetails.positions.length > 0 ? (
                      <div className="space-y-2">
                        {drawerDetails.positions.map((pos, index) => (
                          <div
                            key={`${pos.tokenId}-${index}`}
                            className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-white flex-1 pr-4">
                                {pos.question}
                              </p>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                pos.side === 'YES'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {pos.side}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">Size</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {formatCurrency(pos.size)}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">Avg Price</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {formatPercent(pos.avgPrice)}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">Unrealized</p>
                                <p className={`font-medium ${
                                  pos.unrealizedPnl >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {pos.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnl)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                        No open positions
                      </p>
                    )}
                  </div>

                  {/* Recent Trades */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Recent Trades ({drawerDetails.recentTrades.length})
                    </h3>
                    {drawerDetails.recentTrades.length > 0 ? (
                      <div className="space-y-2">
                        {drawerDetails.recentTrades.map((trade, index) => (
                          <div
                            key={trade.id || index}
                            className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm text-slate-900 dark:text-white flex-1 pr-4">
                                {trade.question}
                              </p>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                trade.side === 'BUY'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {trade.side}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">
                                {formatTimeAgo(trade.timestamp)}
                              </span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {formatCurrency(trade.size * trade.price)} @ {formatPercent(trade.price)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                        No recent trades
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-slate-400">Failed to load wallet details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
