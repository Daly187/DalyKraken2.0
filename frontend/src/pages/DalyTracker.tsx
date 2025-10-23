import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { apiService } from '@/services/apiService';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Target,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  X,
  Eye,
  EyeOff,
  Settings,
  Zap,
  BarChart3,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Search,
  Filter,
} from 'lucide-react';

// Types
interface DiscoveredWallet {
  address: string;
  chain: 'ethereum' | 'solana' | 'arbitrum' | 'optimism' | 'base';
  source: string;
  label?: string;
  ens?: string;
  nickname?: string;
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  avgTradeSize: number;
  activeForDays: number;
  preliminaryScore: number;
  confidence: 'high' | 'medium' | 'low';
}

interface TrackedWallet {
  id: string;
  address: string;
  chain: 'ethereum' | 'solana' | 'arbitrum' | 'optimism' | 'base';
  nickname?: string;
  isActive: boolean;
  score: number;
  performance: {
    pnl30d: number;
    pnl90d: number;
    winRate: number;
    sharpeRatio: number;
  };
  risk: {
    maxDrawdown30d: number;
    volatility: number;
  };
  stats: {
    totalTrades: number;
    tradesLast30d: number;
    avgTradesPerWeek: number;
  };
}

interface WalletSignal {
  id: string;
  walletId: string;
  walletAddress: string;
  timestamp: any;
  type: 'buy' | 'sell' | 'swap';
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  price: number;
  protocol: string;
  copyable: boolean;
  skipReason?: string;
  status: 'pending' | 'copied' | 'skipped' | 'failed';
}

interface CopyPosition {
  id: string;
  walletId: string;
  walletAddress: string;
  pair: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  investedAmount: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  status: string;
  openedAt: any;
}

interface TrackerConfig {
  enabled: boolean;
  simulationMode: boolean;
  totalAllocationPercent: number;
  perTradeAllocationPercent: number;
  maxPositionSize: number;
  dailyLossCapPercent: number;
  maxConcurrentPositions: number;
  stopLossPercent: number;
  minWalletScore: number;
  maxPriceMovementBps: number;
}

export default function DalyTracker() {
  // State
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [signals, setSignals] = useState<WalletSignal[]>([]);
  const [positions, setPositions] = useState<CopyPosition[]>([]);
  const [config, setConfig] = useState<TrackerConfig>({
    enabled: false,
    simulationMode: true,
    totalAllocationPercent: 30,
    perTradeAllocationPercent: 2,
    maxPositionSize: 1000,
    dailyLossCapPercent: 2,
    maxConcurrentPositions: 10,
    stopLossPercent: 5,
    minWalletScore: 60,
    maxPriceMovementBps: 50,
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showDiscoverWallets, setShowDiscoverWallets] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);

  // Section visibility
  const [isWalletsExpanded, setIsWalletsExpanded] = useState(true);
  const [isSignalsExpanded, setIsSignalsExpanded] = useState(true);
  const [isPositionsExpanded, setIsPositionsExpanded] = useState(true);

  // Wallet discovery
  const [discoveredWallets, setDiscoveredWallets] = useState<DiscoveredWallet[]>([]);
  const [searchFilters, setSearchFilters] = useState({
    chain: [] as string[],
    minPnL: undefined as number | undefined,
    minWinRate: undefined as number | undefined,
    minTrades: undefined as number | undefined,
  });

  // Add wallet form
  const [newWallet, setNewWallet] = useState({
    address: '',
    chain: 'ethereum' as TrackedWallet['chain'],
    nickname: '',
  });

  // Load data
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWallets(),
        loadSignals(),
        loadPositions(),
        loadConfig(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWallets = async () => {
    try {
      const response = await apiService.getTrackedWallets();
      setWallets(response.wallets || []);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  };

  const loadSignals = async () => {
    try {
      const response = await apiService.getWalletSignals(50);
      setSignals(response.signals || []);
    } catch (error) {
      console.error('Error loading signals:', error);
    }
  };

  const loadPositions = async () => {
    try {
      const response = await apiService.getCopyPositions();
      setPositions(response.positions || []);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await apiService.getTrackerConfig();
      if (response.config) {
        setConfig(response.config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleAddWallet = async () => {
    if (!newWallet.address) return;

    try {
      await apiService.addTrackedWallet(
        newWallet.address,
        newWallet.chain,
        newWallet.nickname
      );
      setShowAddWallet(false);
      setNewWallet({ address: '', chain: 'ethereum', nickname: '' });
      await loadWallets();
    } catch (error: any) {
      console.error('Error adding wallet:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    if (!confirm('Are you sure you want to stop tracking this wallet?')) return;

    try {
      await apiService.removeTrackedWallet(walletId);
      await loadWallets();
    } catch (error: any) {
      console.error('Error removing wallet:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    if (!confirm('Are you sure you want to close this position?')) return;

    try {
      await apiService.closeCopyPosition(positionId);
      await loadPositions();
    } catch (error: any) {
      console.error('Error closing position:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await apiService.updateTrackerConfig(config);
      setShowConfig(false);
      alert('Configuration saved successfully');
    } catch (error: any) {
      console.error('Error saving config:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDiscoverWallets = async () => {
    setShowDiscoverWallets(true);
    try {
      const response = await apiService.getRecommendedWallets(20);
      setDiscoveredWallets(response.wallets || []);
    } catch (error: any) {
      console.error('Error discovering wallets:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleSearchWallets = async () => {
    try {
      const response = await apiService.searchWallets(searchFilters);
      setDiscoveredWallets(response.wallets || []);
    } catch (error: any) {
      console.error('Error searching wallets:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleTrackDiscoveredWallet = async (wallet: DiscoveredWallet) => {
    try {
      await apiService.addTrackedWallet(
        wallet.address,
        wallet.chain,
        wallet.nickname || wallet.label
      );
      alert(`Now tracking wallet: ${wallet.label || wallet.address}`);
      setShowDiscoverWallets(false);
      await loadWallets();
    } catch (error: any) {
      console.error('Error tracking wallet:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Calculate overall stats
  const totalInvested = positions.reduce((sum, p) => sum + p.investedAmount, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-primary-500" />
            DalyTracker
          </h1>
          <p className="text-gray-400 mt-1">
            Copy-trade top on-chain wallets automatically
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Strategy Status</span>
            {config.enabled ? (
              <Play className="h-4 w-4 text-green-400" />
            ) : (
              <Pause className="h-4 w-4 text-gray-400" />
            )}
          </div>
          <div className="text-2xl font-bold text-white">
            {config.enabled ? 'Active' : 'Paused'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {config.simulationMode ? 'Simulation Mode' : 'Live Trading'}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Tracked Wallets</span>
            <Users className="h-4 w-4 text-primary-500" />
          </div>
          <div className="text-2xl font-bold text-white">{wallets.length}</div>
          <div className="text-xs text-gray-500 mt-1">
            Avg Score: {wallets.length > 0 ? Math.round(wallets.reduce((sum, w) => sum + w.score, 0) / wallets.length) : 0}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Open Positions</span>
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{positions.length}</div>
          <div className="text-xs text-gray-500 mt-1">
            Total Invested: ${totalInvested.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total P&L</span>
            {totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </div>
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
          <div className={`text-xs mt-1 ${totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Tracked Wallets Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setIsWalletsExpanded(!isWalletsExpanded)}
        >
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-500" />
            Tracked Wallets ({wallets.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDiscoverWallets();
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              <Search className="h-4 w-4" />
              Discover Wallets
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddWallet(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Wallet
            </button>
            {isWalletsExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        {isWalletsExpanded && (
          <div className="p-4 pt-0 space-y-3">
            {wallets.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No wallets tracked yet</p>
                <button
                  onClick={() => setShowAddWallet(true)}
                  className="mt-3 text-primary-500 hover:text-primary-400"
                >
                  Add your first wallet
                </button>
              </div>
            ) : (
              wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`text-2xl font-bold ${getScoreColor(wallet.score)}`}>
                          {wallet.score}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-300">
                              {formatAddress(wallet.address)}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-slate-700 text-gray-400 rounded">
                              {wallet.chain}
                            </span>
                            {wallet.nickname && (
                              <span className="text-sm text-primary-400">
                                {wallet.nickname}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span>{wallet.stats.totalTrades} trades</span>
                            <span>{wallet.stats.avgTradesPerWeek.toFixed(1)} / week</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">30d Return</div>
                          <div className={wallet.performance.pnl30d >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {wallet.performance.pnl30d >= 0 ? '+' : ''}{wallet.performance.pnl30d.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Win Rate</div>
                          <div className="text-white">{wallet.performance.winRate.toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Max DD</div>
                          <div className="text-orange-400">{wallet.risk.maxDrawdown30d.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Sharpe</div>
                          <div className="text-white">{wallet.performance.sharpeRatio.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveWallet(wallet.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Stop tracking"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Recent Signals Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setIsSignalsExpanded(!isSignalsExpanded)}
        >
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Recent Signals ({signals.length})
          </h2>
          {isSignalsExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>

        {isSignalsExpanded && (
          <div className="p-4 pt-0">
            {signals.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No signals yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="bg-slate-900 rounded p-3 border border-slate-700 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded text-xs font-semibold ${
                          signal.type === 'buy' || signal.type === 'swap'
                            ? 'bg-green-900 text-green-400'
                            : 'bg-red-900 text-red-400'
                        }`}>
                          {signal.type.toUpperCase()}
                        </div>
                        <span className="font-mono text-gray-400">
                          {formatAddress(signal.walletAddress)}
                        </span>
                        <span className="text-gray-500">→</span>
                        <span className="text-white font-semibold">
                          {signal.tokenOut}
                        </span>
                        <span className="text-gray-500">on {signal.protocol}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{formatTimeAgo(signal.timestamp)}</span>
                        {signal.status === 'copied' && (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        )}
                        {signal.status === 'skipped' && (
                          <span title={signal.skipReason}>
                            <XCircle className="h-4 w-4 text-orange-400" />
                          </span>
                        )}
                        {signal.status === 'pending' && (
                          <Clock className="h-4 w-4 text-yellow-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Open Positions Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setIsPositionsExpanded(!isPositionsExpanded)}
        >
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-yellow-400" />
            Open Positions ({positions.length})
          </h2>
          {isPositionsExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>

        {isPositionsExpanded && (
          <div className="p-4 pt-0">
            {positions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No open positions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((position) => (
                  <div
                    key={position.id}
                    className="bg-slate-900 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-semibold text-white">
                            {position.pair}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            position.side === 'buy'
                              ? 'bg-green-900 text-green-400'
                              : 'bg-red-900 text-red-400'
                          }`}>
                            {position.side.toUpperCase()}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            from {formatAddress(position.walletAddress)}
                          </span>
                        </div>

                        <div className="grid grid-cols-5 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Entry</div>
                            <div className="text-white">${position.entryPrice.toFixed(4)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Current</div>
                            <div className="text-white">${position.currentPrice.toFixed(4)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Invested</div>
                            <div className="text-white">${position.investedAmount.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Value</div>
                            <div className="text-white">${position.currentValue.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">P&L</div>
                            <div className={position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                              <span className="ml-1 text-xs">
                                ({position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleClosePosition(position.id)}
                        className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 rounded text-sm transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Wallet Modal */}
      {showAddWallet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Add Wallet to Track</h3>
              <button
                onClick={() => setShowAddWallet(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Wallet Address</label>
                <input
                  type="text"
                  value={newWallet.address}
                  onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })}
                  placeholder="0x... or solana address"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Chain</label>
                <select
                  value={newWallet.chain}
                  onChange={(e) => setNewWallet({ ...newWallet, chain: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="solana">Solana</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="optimism">Optimism</option>
                  <option value="base">Base</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Nickname (optional)</label>
                <input
                  type="text"
                  value={newWallet.nickname}
                  onChange={(e) => setNewWallet({ ...newWallet, nickname: e.target.value })}
                  placeholder="e.g., SmartMoney123"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddWallet(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWallet}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                  disabled={!newWallet.address}
                >
                  Add Wallet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discover Wallets Modal */}
      {showDiscoverWallets && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-6xl border border-slate-700 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="h-6 w-6" />
                Discover Top Wallets
              </h3>
              <button
                onClick={() => setShowDiscoverWallets(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Filters */}
            <div className="bg-slate-900 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-300">Filters</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min P&L</label>
                  <input
                    type="number"
                    value={searchFilters.minPnL || ''}
                    onChange={(e) => setSearchFilters({ ...searchFilters, minPnL: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g. 1000000"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Win Rate %</label>
                  <input
                    type="number"
                    value={searchFilters.minWinRate || ''}
                    onChange={(e) => setSearchFilters({ ...searchFilters, minWinRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g. 65"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Trades</label>
                  <input
                    type="number"
                    value={searchFilters.minTrades || ''}
                    onChange={(e) => setSearchFilters({ ...searchFilters, minTrades: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="e.g. 100"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSearchWallets}
                    className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            {/* Discovered Wallets List */}
            <div className="space-y-3">
              {discoveredWallets.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Click "Search" or adjust filters to discover top wallets</p>
                </div>
              ) : (
                discoveredWallets.map((wallet, index) => (
                  <div
                    key={wallet.address}
                    className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-2xl font-bold text-green-400">
                            #{index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {wallet.label && (
                                <span className="text-primary-400 font-semibold">
                                  {wallet.label}
                                </span>
                              )}
                              {wallet.ens && (
                                <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded">
                                  {wallet.ens}
                                </span>
                              )}
                              <span className="text-xs px-2 py-0.5 bg-slate-700 text-gray-400 rounded">
                                {wallet.chain}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                wallet.confidence === 'high' ? 'bg-green-900 text-green-300' :
                                wallet.confidence === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                                'bg-gray-700 text-gray-400'
                              }`}>
                                {wallet.confidence} confidence
                              </span>
                            </div>
                            <div className="font-mono text-xs text-gray-500">
                              {formatAddress(wallet.address)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-6 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Score</div>
                            <div className={`font-bold ${getScoreColor(wallet.preliminaryScore)}`}>
                              {wallet.preliminaryScore}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Total P&L</div>
                            <div className="text-green-400 font-semibold">
                              ${(wallet.totalPnL / 1000000).toFixed(1)}M
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Return</div>
                            <div className="text-green-400">
                              +{wallet.totalPnLPercent.toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Win Rate</div>
                            <div className="text-white">{wallet.winRate.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Trades</div>
                            <div className="text-white">{wallet.totalTrades}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Active</div>
                            <div className="text-white">{wallet.activeForDays}d</div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTrackDiscoveredWallet(wallet)}
                        className="ml-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors whitespace-nowrap"
                      >
                        Track This Wallet
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-700 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Strategy Configuration</h3>
              <button
                onClick={() => setShowConfig(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Strategy Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                      className="rounded"
                    />
                    Enable Strategy
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <input
                      type="checkbox"
                      checked={config.simulationMode}
                      onChange={(e) => setConfig({ ...config, simulationMode: e.target.checked })}
                      className="rounded"
                    />
                    Simulation Mode (Paper Trading)
                  </label>
                </div>
              </div>

              {/* Allocation Settings */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Allocation Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Total Allocation (%)
                    </label>
                    <input
                      type="number"
                      value={config.totalAllocationPercent}
                      onChange={(e) => setConfig({ ...config, totalAllocationPercent: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Per Trade Allocation (%)
                    </label>
                    <input
                      type="number"
                      value={config.perTradeAllocationPercent}
                      onChange={(e) => setConfig({ ...config, perTradeAllocationPercent: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Max Position Size ($)
                    </label>
                    <input
                      type="number"
                      value={config.maxPositionSize}
                      onChange={(e) => setConfig({ ...config, maxPositionSize: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Max Concurrent Positions
                    </label>
                    <input
                      type="number"
                      value={config.maxConcurrentPositions}
                      onChange={(e) => setConfig({ ...config, maxConcurrentPositions: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Risk Management */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Risk Management</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Daily Loss Cap (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.dailyLossCapPercent}
                      onChange={(e) => setConfig({ ...config, dailyLossCapPercent: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Stop Loss (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.stopLossPercent}
                      onChange={(e) => setConfig({ ...config, stopLossPercent: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Signal Filters */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Signal Filters</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Min Wallet Score
                    </label>
                    <input
                      type="number"
                      value={config.minWalletScore}
                      onChange={(e) => setConfig({ ...config, minWalletScore: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Max Price Movement (bps)
                    </label>
                    <input
                      type="number"
                      value={config.maxPriceMovementBps}
                      onChange={(e) => setConfig({ ...config, maxPriceMovementBps: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfig(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
