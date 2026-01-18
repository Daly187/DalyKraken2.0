import { useEffect, useState, useCallback } from 'react';
import {
  Dice5,
  Play,
  Pause,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  BarChart3,
  History,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Download,
  Filter,
  Search,
  WifiOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Star,
  Info,
} from 'lucide-react';
import type {
  PolymarketConfig,
  PolymarketPosition,
  PolymarketBet,
  PolymarketStats,
  PolymarketMarket,
  PolymarketExecution,
} from '@/types/polymarket';
import { apiService } from '@/services/apiService';

type TabType = 'dashboard' | 'strategy' | 'history';

// Format currency helper
const formatCurrency = (value: number): string => {
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

// Format time remaining
const formatTimeRemaining = (endDate: string): string => {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return 'Ended';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;

  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m`;
};

// Check if Polymarket API is configured
const isPolymarketConfigured = (): boolean => {
  const apiKey = localStorage.getItem('polymarket_api_key');
  return !!apiKey;
};

export default function Gambling() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(isPolymarketConfigured());

  // Data states
  const [balance, setBalance] = useState<number>(0);
  const [config, setConfig] = useState<PolymarketConfig | null>(null);
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);
  const [bets, setBets] = useState<PolymarketBet[]>([]);
  const [stats, setStats] = useState<PolymarketStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<PolymarketExecution[]>([]);
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [scanResult, setScanResult] = useState<{
    marketsScanned: number;
    marketsAfterVolumeFilter?: number;
    opportunitiesFound: number;
    opportunities: Array<{
      id: string;
      conditionId?: string;
      tokenId?: string; // Token ID for trading
      question: string;
      outcome: string;
      outcomeIndex?: number;
      probability: number;
      volume: number;
      hoursToClose: number;
      endDate?: string;
      category?: string;
      slug?: string;
      aiAnalysis?: {
        score: number;
        recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
        reasoning: string;
        isBestPick?: boolean;
        rank?: number;
        factors: Array<{ name: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }>;
      };
    }>;
    filtersUsed?: {
      timeframeHours: number;
      minProbability: number;
      maxProbability: number;
      minVolume: number;
      minLiquidity?: number;
      marketScopeLimit: number;
      closeDate?: string;
    };
  } | null>(null);

  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  // Form states for strategy tab
  const [formConfig, setFormConfig] = useState<Partial<PolymarketConfig>>({
    enabled: false,
    scanIntervalMinutes: 60,
    timeframeHours: 168, // 7 days default for better initial results
    minProbability: 0.75, // Default target threshold
    maxProbability: 0.98,
    contrarianMode: false,
    contrarianThreshold: 0.95,
    closeDate: undefined,
    marketScopeLimit: 100,
    minVolume: 1000, // Lower minimum volume for more results
    minLiquidity: 5000,
    betSizeMode: 'fixed',
    fixedBetAmount: 10,
    percentageBetAmount: 2,
    maxBetPercent: 25,
    maxDailyBets: 10,
    takeProfitPercent: 5,
    stopLossPercent: 10,
  });

  // Section collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quickStats: true,
    positions: true,
    opportunities: true,
    activity: true,
    filters: true,
    sizing: true,
    automation: true,
    performance: true,
    betHistory: true,
  });

  // Bet modal state
  const [betModal, setBetModal] = useState<{
    isOpen: boolean;
    opportunity: {
      id: string;
      conditionId?: string;
      tokenId?: string;
      question: string;
      outcome: string;
      probability: number;
      volume: number;
      hoursToClose: number;
    } | null;
  }>({ isOpen: false, opportunity: null });
  const [betAmount, setBetAmount] = useState<string>('10');
  const [placingBet, setPlacingBet] = useState(false);

  // History tab filters
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wins' | 'losses' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Opportunities sorting
  const [opportunitySort, setOpportunitySort] = useState<{
    field: 'probability' | 'volume' | 'hoursToClose';
    direction: 'asc' | 'desc';
  }>({ field: 'probability', direction: 'desc' });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCloseDateChange = (value: string) => {
    if (!value) {
      setFormConfig(prev => ({ ...prev, closeDate: undefined }));
      return;
    }

    const endOfDay = new Date(`${value}T23:59:59`);
    const diffHours = Math.max(1, Math.round((endOfDay.getTime() - Date.now()) / (1000 * 60 * 60)));

    setFormConfig(prev => ({
      ...prev,
      closeDate: value,
      timeframeHours: diffHours,
    }));
  };

  // Fetch all data from API
  const fetchAllData = useCallback(async () => {
    if (!isPolymarketConfigured()) {
      setIsConfigured(false);
      setLoading(false);
      return;
    }

    setIsConfigured(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [balanceRes, configRes, statsRes, positionsRes, betsRes, executionsRes] = await Promise.allSettled([
        apiService.getPolymarketBalance(),
        apiService.getPolymarketConfig(),
        apiService.getPolymarketStats(),
        apiService.getPolymarketPositions(),
        apiService.getPolymarketBets(50),
        apiService.getPolymarketExecutions(20),
      ]);

      // Handle balance
      if (balanceRes.status === 'fulfilled' && balanceRes.value?.success) {
        setBalance(balanceRes.value.balance || 0);
      }

      // Handle config
      if (configRes.status === 'fulfilled' && configRes.value?.success) {
        const fetchedConfig = configRes.value.config;
        setConfig(fetchedConfig);
        setFormConfig(fetchedConfig);
      }

      // Handle stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.stats);
      }

      // Handle positions
      if (positionsRes.status === 'fulfilled' && positionsRes.value?.success) {
        setPositions(positionsRes.value.positions || []);
      }

      // Handle bets
      if (betsRes.status === 'fulfilled' && betsRes.value?.success) {
        setBets(betsRes.value.bets || []);
      }

      // Handle executions
      if (executionsRes.status === 'fulfilled' && executionsRes.value?.success) {
        setRecentActivity(executionsRes.value.executions || []);
      }

    } catch (err: any) {
      console.error('[Gambling] Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 30 seconds when on dashboard tab
  useEffect(() => {
    if (activeTab !== 'dashboard' || !isConfigured) return;

    const interval = setInterval(() => {
      fetchAllData();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, isConfigured, fetchAllData]);

  const handleToggleAutoBetting = async () => {
    const newEnabled = !formConfig.enabled;
    setFormConfig(prev => ({ ...prev, enabled: newEnabled }));

    try {
      await apiService.updatePolymarketConfig({ ...formConfig, enabled: newEnabled });
    } catch (err: any) {
      console.error('[Gambling] Error toggling auto-betting:', err);
      // Revert on error
      setFormConfig(prev => ({ ...prev, enabled: !newEnabled }));
      setError('Failed to toggle auto-betting');
    }
  };

  const handleTriggerScan = async () => {
    setTriggering(true);
    setError(null);

    try {
      const result = await apiService.triggerPolymarketScan();
      console.log('[Gambling] Scan result:', result);
      if (result?.success) {
        // Store scan results for display
        if (result.result) {
          console.log('[Gambling] Setting scan result with opportunities:', result.result.opportunities?.slice(0, 2));
          // Log first opportunity's tokenId
          if (result.result.opportunities?.[0]) {
            console.log('[Gambling] First opportunity tokenId:', result.result.opportunities[0].tokenId);
          }
          setScanResult(result.result);
        }
        // Refresh data after scan
        await fetchAllData();
      } else {
        setError(result?.error || 'Scan failed');
      }
    } catch (err: any) {
      console.error('[Gambling] Error triggering scan:', err);
      setError(err.message || 'Failed to trigger scan');
    } finally {
      setTriggering(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);

    try {
      const result = await apiService.updatePolymarketConfig(formConfig);
      if (result?.success) {
        setConfig(result.config);
      } else {
        setError(result?.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      console.error('[Gambling] Error saving config:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };


  const handleRefresh = async () => {
    setLoading(true);
    await fetchAllData();
  };

  const filteredBets = bets.filter(bet => {
    if (historyFilter === 'wins' && (bet.profit === undefined || bet.profit <= 0)) return false;
    if (historyFilter === 'losses' && (bet.profit === undefined || bet.profit >= 0)) return false;
    if (historyFilter === 'pending' && bet.status !== 'pending' && bet.status !== 'filled') return false;
    if (searchQuery && !bet.marketQuestion.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Sort opportunities
  const sortedOpportunities = scanResult?.opportunities ? [...scanResult.opportunities].sort((a, b) => {
    const multiplier = opportunitySort.direction === 'asc' ? 1 : -1;
    switch (opportunitySort.field) {
      case 'probability':
        return (a.probability - b.probability) * multiplier;
      case 'volume':
        return (a.volume - b.volume) * multiplier;
      case 'hoursToClose':
        return (a.hoursToClose - b.hoursToClose) * multiplier;
      default:
        return 0;
    }
  }) : [];

  const toggleOpportunitySort = (field: 'probability' | 'volume' | 'hoursToClose') => {
    setOpportunitySort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const SortIcon = ({ field }: { field: 'probability' | 'volume' | 'hoursToClose' }) => {
    if (opportunitySort.field !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return opportunitySort.direction === 'desc'
      ? <ArrowDown className="h-3 w-3" />
      : <ArrowUp className="h-3 w-3" />;
  };

  // Open bet modal
  const openBetModal = (opportunity: typeof betModal.opportunity) => {
    console.log('[Gambling] Opening bet modal with opportunity:', opportunity);
    console.log('[Gambling] TokenId:', opportunity?.tokenId);
    setBetModal({ isOpen: true, opportunity });
    setBetAmount(formConfig.fixedBetAmount?.toString() || '10');
  };

  // Close bet modal
  const closeBetModal = () => {
    setBetModal({ isOpen: false, opportunity: null });
    setBetAmount('10');
  };

  // Place bet
  const handlePlaceBet = async () => {
    if (!betModal.opportunity) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bet amount');
      return;
    }

    // Note: Balance check temporarily relaxed - balance may show 0 due to address mismatch
    // The actual balance on Polymarket is what matters for order execution
    if (balance > 0 && amount > balance) {
      setError('Insufficient balance');
      return;
    }

    // Check if we have a token ID for trading
    if (!betModal.opportunity.tokenId) {
      setError('Missing token ID for this market. Please run a new scan to get updated market data.');
      return;
    }

    setPlacingBet(true);
    setError(null);

    try {
      // Determine the side based on outcome
      const side = betModal.opportunity.outcome.toLowerCase() === 'yes' ? 'yes' : 'no';

      const result = await apiService.placePolymarketBet({
        marketId: betModal.opportunity.id,
        tokenId: betModal.opportunity.tokenId, // Proper token ID for trading
        outcomeId: betModal.opportunity.tokenId, // For backwards compatibility
        side: side as 'yes' | 'no',
        amount: amount,
        question: betModal.opportunity.question,
        outcome: betModal.opportunity.outcome,
      } as any);

      if (result?.success) {
        closeBetModal();
        // Refresh data
        await fetchAllData();
        // Show success (could add toast notification)
      } else {
        setError(result?.error || 'Failed to place bet');
      }
    } catch (err: any) {
      console.error('[Gambling] Error placing bet:', err);
      setError(err.message || 'Failed to place bet');
    } finally {
      setPlacingBet(false);
    }
  };

  // AI Analysis of opportunities
  const handleAnalyzeOpportunities = async () => {
    if (!scanResult?.opportunities || scanResult.opportunities.length === 0) {
      setError('No opportunities to analyze. Run a scan first.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const result = await apiService.analyzePolymarketOpportunities(scanResult.opportunities);

      if (result?.success && result.opportunities) {
        setScanResult(prev => prev ? {
          ...prev,
          opportunities: result.opportunities,
        } : null);
      } else {
        setError(result?.error || 'Failed to analyze opportunities');
      }
    } catch (err: any) {
      console.error('[Gambling] Error analyzing opportunities:', err);
      setError(err.message || 'Failed to analyze opportunities');
    } finally {
      setAnalyzing(false);
    }
  };

  // Get recommendation badge color
  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'strong_buy':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'buy':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'hold':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'avoid':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'strong_buy': return 'Strong Buy';
      case 'buy': return 'Buy';
      case 'hold': return 'Hold';
      case 'avoid': return 'Avoid';
      default: return rec;
    }
  };

  const renderDashboardTab = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('quickStats')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Quick Stats</span>
          </div>
          {expandedSections.quickStats ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.quickStats && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Balance Card */}
            <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Balance</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
            </div>

            {/* P/L Card */}
            <div className={`p-4 rounded-xl ${stats && stats.totalProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-rose-600'} text-white`}>
              <div className="flex items-center gap-2 mb-2">
                {stats && stats.totalProfit >= 0 ? <TrendingUp className="h-5 w-5 opacity-80" /> : <TrendingDown className="h-5 w-5 opacity-80" />}
                <span className="text-sm opacity-80">Total P/L</span>
              </div>
              <p className="text-2xl font-bold">{stats ? formatCurrency(stats.totalProfit) : '$0.00'}</p>
              <p className="text-sm opacity-80">{stats ? `${(stats.roi * 100).toFixed(1)}% ROI` : '0% ROI'}</p>
            </div>

            {/* Win Rate Card */}
            <div className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl text-white">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Win Rate</span>
              </div>
              <p className="text-2xl font-bold">{stats ? `${(stats.winRate * 100).toFixed(0)}%` : '0%'}</p>
              <p className="text-sm opacity-80">{stats ? `${stats.wins}W / ${stats.losses}L` : '0W / 0L'}</p>
            </div>

            {/* Active Bets Card */}
            <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white">
              <div className="flex items-center gap-2 mb-2">
                <Dice5 className="h-5 w-5 opacity-80" />
                <span className="text-sm opacity-80">Active</span>
              </div>
              <p className="text-2xl font-bold">{positions.length}</p>
              <p className="text-sm opacity-80">{stats ? formatCurrency(stats.currentExposure) : '$0'} at risk</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Controls */}
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
        <button
          onClick={handleToggleAutoBetting}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            formConfig.enabled
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
          }`}
        >
          {formConfig.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {formConfig.enabled ? 'Pause Auto-Betting' : 'Start Auto-Betting'}
        </button>

        <button
          onClick={handleTriggerScan}
          disabled={triggering}
          className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
          {triggering ? 'Scanning...' : 'Run Scan Now'}
        </button>

        <div className="flex items-center gap-2 ml-auto text-sm text-slate-500 dark:text-slate-400">
          <Clock className="h-4 w-4" />
          <span>Next scan in: {formConfig.enabled ? '12:34' : '--:--'}</span>
        </div>
      </div>

      {/* Active Positions */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('positions')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Active Positions ({positions.length})</span>
          </div>
          {expandedSections.positions ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.positions && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            {positions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Dice5 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active positions</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Market</th>
                      <th className="text-center p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Position</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Entry</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Current</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">P/L</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Ends In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => {
                      const takeProfitTarget = formConfig.takeProfitPercent ?? 5;
                      const stopLossTarget = formConfig.stopLossPercent ?? 10;
                      const pnlPercent = position.unrealizedPnLPercent * 100;
                      const isTakeProfitReady = pnlPercent >= takeProfitTarget;
                      const isStopLossHit = pnlPercent <= -stopLossTarget;

                      return (
                      <tr key={position.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="p-4">
                          <p className="font-medium text-slate-800 dark:text-white text-sm">{position.marketQuestion}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            position.side === 'yes'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {position.outcomeName}
                          </span>
                        </td>
                        <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                          {formatPercent(position.avgPrice)}
                        </td>
                        <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                          {formatPercent(position.currentPrice)}
                        </td>
                        <td className={`p-4 text-right text-sm font-medium ${
                          position.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                          <span className="block text-xs opacity-70">
                            {position.unrealizedPnLPercent >= 0 ? '+' : ''}{(position.unrealizedPnLPercent * 100).toFixed(1)}%
                          </span>
                          {(isTakeProfitReady || isStopLossHit) && (
                            <span className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${
                              isStopLossHit
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            }`}>
                              {isStopLossHit ? 'Stop Loss' : 'Take Profit'}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                          {formatTimeRemaining(position.endDate)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scan Opportunities */}
      {scanResult && (
        <div className="mb-2">
          <button
            onClick={() => toggleSection('opportunities')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-semibold text-slate-800 dark:text-white">
                Opportunities Found ({scanResult.opportunities.length})
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                from {scanResult.marketsScanned} markets scanned
                {scanResult.filtersUsed && ` • ${Math.round(scanResult.filtersUsed.timeframeHours / 24)}d timeframe • ${(scanResult.filtersUsed.minProbability * 100).toFixed(0)}-${(scanResult.filtersUsed.maxProbability * 100).toFixed(0)}% prob`}
              </span>
            </div>
            {expandedSections.opportunities ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          {expandedSections.opportunities && (
            <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              {/* AI Analysis Button */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">AI Analysis</span>
                  {scanResult.opportunities.some(o => o.aiAnalysis) && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ Analyzed
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAnalyzeOpportunities}
                  disabled={analyzing || scanResult.opportunities.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-purple-400 disabled:to-indigo-400 text-white text-sm font-medium rounded-lg transition-all"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze with AI
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Market</th>
                      <th className="text-center p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Outcome</th>
                      <th
                        className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/50 select-none"
                        onClick={() => toggleOpportunitySort('probability')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Probability
                          <SortIcon field="probability" />
                        </span>
                      </th>
                      <th
                        className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/50 select-none"
                        onClick={() => toggleOpportunitySort('volume')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Volume
                          <SortIcon field="volume" />
                        </span>
                      </th>
                      <th
                        className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/50 select-none"
                        onClick={() => toggleOpportunitySort('hoursToClose')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Closes In
                          <SortIcon field="hoursToClose" />
                        </span>
                      </th>
                      <th className="text-center p-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                        AI Rating
                      </th>
                      <th className="text-center p-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOpportunities.map((opp, idx) => (
                      <>
                        <tr key={opp.id || idx} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="p-4">
                            <div className="flex items-start gap-2">
                              {opp.aiAnalysis?.isBestPick && (
                                <Star className="h-5 w-5 text-amber-500 fill-amber-500 flex-shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className="font-medium text-slate-800 dark:text-white text-sm truncate max-w-[350px]">
                                  {opp.question}
                                </p>
                                {opp.category && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">{opp.category}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              opp.outcome.toLowerCase() === 'yes'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {opp.outcome}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {(opp.probability * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                            ${opp.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                            {opp.hoursToClose < 24
                              ? `${opp.hoursToClose.toFixed(1)}h`
                              : `${Math.floor(opp.hoursToClose / 24)}d ${Math.round(opp.hoursToClose % 24)}h`
                            }
                          </td>
                          <td className="p-4 text-center">
                            {opp.aiAnalysis ? (
                              <button
                                onClick={() => setExpandedAnalysis(expandedAnalysis === opp.id ? null : opp.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${getRecommendationStyle(opp.aiAnalysis.recommendation)}`}
                              >
                                {opp.aiAnalysis.isBestPick && <Star className="h-3 w-3 fill-current" />}
                                {getRecommendationLabel(opp.aiAnalysis.recommendation)}
                                <span className="opacity-70">({opp.aiAnalysis.score})</span>
                                <Info className="h-3 w-3 opacity-60" />
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                Not analyzed
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => openBetModal(opp)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              Bet
                            </button>
                          </td>
                        </tr>
                        {/* Expanded AI Analysis Row */}
                        {expandedAnalysis === opp.id && opp.aiAnalysis && (
                          <tr key={`${opp.id}-analysis`} className="bg-slate-50 dark:bg-slate-700/30">
                            <td colSpan={7} className="p-4">
                              <div className="flex flex-col md:flex-row gap-4">
                                {/* AI Reasoning */}
                                <div className="flex-1 p-4 bg-white dark:bg-slate-800 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="h-4 w-4 text-purple-500" />
                                    <span className="font-medium text-slate-800 dark:text-white text-sm">AI Analysis</span>
                                    {opp.aiAnalysis.isBestPick && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                                        <Star className="h-3 w-3 fill-current" />
                                        Best Pick #{opp.aiAnalysis.rank}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 dark:text-slate-300">
                                    {opp.aiAnalysis.reasoning}
                                  </p>
                                </div>
                                {/* Factors */}
                                <div className="md:w-80 p-4 bg-white dark:bg-slate-800 rounded-lg">
                                  <span className="font-medium text-slate-800 dark:text-white text-sm block mb-2">Key Factors</span>
                                  <div className="space-y-2">
                                    {opp.aiAnalysis.factors.map((factor, fIdx) => (
                                      <div key={fIdx} className="flex items-start gap-2">
                                        <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                          factor.impact === 'positive' ? 'bg-emerald-500' :
                                          factor.impact === 'negative' ? 'bg-red-500' :
                                          'bg-slate-400'
                                        }`} />
                                        <div className="flex-1">
                                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{factor.name}</span>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">{factor.detail}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedOpportunities.length === 0 && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No opportunities found matching your filters</p>
                  <p className="text-sm mt-1">Try adjusting your strategy settings:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    <li>• Increase the timeframe (more days)</li>
                    <li>• Lower the probability threshold</li>
                    <li>• Lower the minimum volume</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('activity')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Recent Activity</span>
          </div>
          {expandedSections.activity ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.activity && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                <div className={`p-2 rounded-lg ${
                  activity.action === 'scan' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  activity.action === 'bet' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                  activity.action === 'resolution' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {activity.action === 'scan' && <RefreshCw className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                  {activity.action === 'bet' && <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  {activity.action === 'resolution' && <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  {activity.action === 'error' && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                    {activity.action === 'scan' && `Scanned ${activity.marketsScanned} markets, found ${activity.opportunitiesFound} opportunities`}
                    {activity.action === 'bet' && `Placed bet on market`}
                    {activity.action === 'resolution' && `Bet resolved`}
                    {activity.action === 'error' && `Error: ${activity.error}`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStrategyTab = () => (
    <div className="space-y-6">
      {/* Market Filters */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('filters')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Filter className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Market Filters</span>
          </div>
          {expandedSections.filters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.filters && (
          <div className="mt-4 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm space-y-6">
            {/* Timeframe */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Markets Closing Within
                </label>
                <button
                  onClick={() => setFormConfig(prev => ({
                    ...prev,
                    closeDate: undefined,
                    timeframeHours: prev.timeframeHours && prev.timeframeHours < 9000 ? 9999 : 168
                  }))}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    formConfig.timeframeHours && formConfig.timeframeHours >= 9000
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {formConfig.timeframeHours && formConfig.timeframeHours >= 9000 ? '✓ All Markets' : 'Show All Markets'}
                </button>
              </div>
              {formConfig.timeframeHours && formConfig.timeframeHours >= 9000 ? (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <strong>All Markets Mode:</strong> Showing markets sorted by volume, regardless of end date.
                    This includes crypto, politics, and long-term prediction markets.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Close Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formConfig.closeDate || ''}
                      onChange={(e) => handleCloseDateChange(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Picks a target close date and adjusts the timeframe automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="365"
                      value={Math.round((formConfig.timeframeHours || 24) / 24)}
                      onChange={(e) => setFormConfig(prev => ({
                        ...prev,
                        closeDate: undefined,
                        timeframeHours: Number(e.target.value) * 24
                      }))}
                      className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="w-24 text-center font-medium text-slate-800 dark:text-white">
                      {Math.round((formConfig.timeframeHours || 24) / 24)} {Math.round((formConfig.timeframeHours || 24) / 24) === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Only consider markets that will resolve within this timeframe. Sports events typically resolve within days, while crypto/politics markets may be months out.
                  </p>
                </>
              )}
            </div>

            {/* Probability Range */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Probability Threshold (Min: {(formConfig.minProbability! * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="50"
                max="99"
                value={(formConfig.minProbability || 0.8) * 100}
                onChange={(e) => setFormConfig(prev => ({ ...prev, minProbability: Number(e.target.value) / 100 }))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Only bet on outcomes with probability above this threshold
              </p>
            </div>

            {/* Contrarian Mode */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="font-medium text-slate-800 dark:text-white">Contrarian Mode</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bet against extreme favorites</p>
                </div>
                <button
                  onClick={() => setFormConfig(prev => ({ ...prev, contrarianMode: !prev.contrarianMode }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formConfig.contrarianMode ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    formConfig.contrarianMode ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {formConfig.contrarianMode && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Contrarian Threshold: {((formConfig.contrarianThreshold || 0.95) * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="90"
                    max="99"
                    value={(formConfig.contrarianThreshold || 0.95) * 100}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, contrarianThreshold: Number(e.target.value) / 100 }))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Bet AGAINST outcomes above this probability (betting on the underdog)
                  </p>
                </div>
              )}
            </div>

            {/* Market Scope */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Market Scope (Top {formConfig.marketScopeLimit} by volume)
              </label>
              <select
                value={formConfig.marketScopeLimit}
                onChange={(e) => setFormConfig(prev => ({ ...prev, marketScopeLimit: Number(e.target.value) }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
              >
                <option value={10}>Top 10 markets</option>
                <option value={25}>Top 25 markets</option>
                <option value={50}>Top 50 markets</option>
                <option value={100}>Top 100 markets</option>
                <option value={250}>Top 250 markets</option>
              </select>
            </div>

            {/* Minimum Volume */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Volume (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formConfig.minVolume || 0}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, minVolume: Number(e.target.value) }))}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
                  placeholder="10000"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Only scan markets with trading volume above this amount
              </p>
            </div>

            {/* Minimum Liquidity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Liquidity (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formConfig.minLiquidity || 0}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, minLiquidity: Number(e.target.value) }))}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
                  placeholder="5000"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Filters out thin markets with shallow order books
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bet Sizing */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('sizing')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Bet Sizing</span>
          </div>
          {expandedSections.sizing ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.sizing && (
          <div className="mt-4 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm space-y-6">
            {/* Bet Size Mode */}
            <div className="flex gap-4">
              <button
                onClick={() => setFormConfig(prev => ({ ...prev, betSizeMode: 'fixed' }))}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  formConfig.betSizeMode === 'fixed'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                }`}
              >
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <p className="font-medium text-slate-800 dark:text-white">Fixed Amount</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Same $ per bet</p>
              </button>

              <button
                onClick={() => setFormConfig(prev => ({ ...prev, betSizeMode: 'percentage' }))}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  formConfig.betSizeMode === 'percentage'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                }`}
              >
                <Target className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <p className="font-medium text-slate-800 dark:text-white">Percentage</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">% of bankroll</p>
              </button>
            </div>

            {/* Amount Input */}
            {formConfig.betSizeMode === 'fixed' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Amount Per Bet (USDC)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    value={formConfig.fixedBetAmount}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, fixedBetAmount: Number(e.target.value) }))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Percentage Per Bet: {formConfig.percentageBetAmount}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={formConfig.percentageBetAmount}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, percentageBetAmount: Number(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* Max Daily Bets */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Maximum Daily Bets
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formConfig.maxDailyBets}
                onChange={(e) => setFormConfig(prev => ({ ...prev, maxDailyBets: Number(e.target.value) }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
              />
            </div>

            {/* Max Exposure */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Max Bankroll at Risk: {formConfig.maxBetPercent}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={formConfig.maxBetPercent}
                onChange={(e) => setFormConfig(prev => ({ ...prev, maxBetPercent: Number(e.target.value) }))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Maximum percentage of balance that can be in active positions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Automation */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('automation')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Automation</span>
          </div>
          {expandedSections.automation ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.automation && (
          <div className="mt-4 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm space-y-6">
            {/* Scan Interval */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Scan Interval
              </label>
              <select
                value={formConfig.scanIntervalMinutes}
                onChange={(e) => setFormConfig(prev => ({ ...prev, scanIntervalMinutes: Number(e.target.value) }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
                <option value={120}>Every 2 hours</option>
              </select>
            </div>

            {/* Take Profit Target */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Take Profit Target (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formConfig.takeProfitPercent || 5}
                onChange={(e) => setFormConfig(prev => ({ ...prev, takeProfitPercent: Number(e.target.value) }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Target profit threshold for closing a position.
              </p>
            </div>

            {/* Stop Loss */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Stop Loss (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formConfig.stopLossPercent || 10}
                onChange={(e) => setFormConfig(prev => ({ ...prev, stopLossPercent: Number(e.target.value) }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Maximum downside before the bot should exit a position.
              </p>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <div>
                <label className="font-medium text-slate-800 dark:text-white">Auto-Betting</label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formConfig.enabled ? 'Bot is actively scanning and placing bets' : 'Bot is paused'}
                </p>
              </div>
              <button
                onClick={() => setFormConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formConfig.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  formConfig.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveConfig}
        disabled={saving}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Settings className="h-4 w-4" />
            Save Configuration
          </>
        )}
      </button>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('performance')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Performance Summary</span>
          </div>
          {expandedSections.performance ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.performance && stats && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Bets</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalBets}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Win Rate</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{(stats.winRate * 100).toFixed(0)}%</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Invested</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(stats.totalInvested)}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Profit</p>
              <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.totalProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalProfit)}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">ROI</p>
              <p className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.roi >= 0 ? '+' : ''}{(stats.roi * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Bet Size</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(stats.avgBetSize)}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Best Bet</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.bestBet)}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Worst Bet</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.worstBet)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bet History */}
      <div className="mb-2">
        <button
          onClick={() => toggleSection('betHistory')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">Bet History ({bets.length})</span>
          </div>
          {expandedSections.betHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expandedSections.betHistory && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'wins', 'losses', 'pending'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      historyFilter === filter
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              <button className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Market</th>
                    <th className="text-center p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Position</th>
                    <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Amount</th>
                    <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Price</th>
                    <th className="text-center p-4 text-sm font-medium text-slate-600 dark:text-slate-300">Status</th>
                    <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-300">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBets.map((bet) => (
                    <tr key={bet.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                        {new Date(bet.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-slate-800 dark:text-white text-sm truncate max-w-[300px]">
                          {bet.marketQuestion}
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {bet.strategy === 'external' ? 'Polymarket' : bet.strategy}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          bet.side === 'yes'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {bet.outcomeName}
                        </span>
                      </td>
                      <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                        {formatCurrency(bet.amount)}
                      </td>
                      <td className="p-4 text-right text-sm text-slate-600 dark:text-slate-300">
                        {formatPercent(bet.price)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          bet.status === 'resolved' && bet.profit !== undefined && bet.profit > 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : bet.status === 'resolved' && bet.profit !== undefined && bet.profit < 0
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : bet.status === 'filled'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {bet.status === 'resolved' && bet.profit !== undefined && bet.profit > 0 && <CheckCircle className="h-3 w-3" />}
                          {bet.status === 'resolved' && bet.profit !== undefined && bet.profit < 0 && <XCircle className="h-3 w-3" />}
                          {bet.status === 'filled' && <Clock className="h-3 w-3" />}
                          {bet.status === 'pending' && <Clock className="h-3 w-3" />}
                          {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                        </span>
                      </td>
                      <td className={`p-4 text-right text-sm font-medium ${
                        bet.profit !== undefined && bet.profit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {bet.profit !== undefined ? (
                          <>
                            {bet.profit >= 0 ? '+' : ''}{formatCurrency(bet.profit)}
                            <span className="block text-xs opacity-70">
                              {bet.profitPercent !== undefined && (
                                <>{bet.profitPercent >= 0 ? '+' : ''}{(bet.profitPercent * 100).toFixed(1)}%</>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredBets.length === 0 && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No bets found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Show not configured state
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <Dice5 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Polymarket Auto-Betting</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automated prediction market betting
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center">
            <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              API Not Configured
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Please configure your Polymarket API credentials in Settings to use this feature.
            </p>
            <a
              href="/settings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              Go to Settings
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading Polymarket data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-300 text-sm flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <Dice5 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Polymarket Auto-Betting</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automated prediction market betting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`h-5 w-5 text-slate-600 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              formConfig.enabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${formConfig.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {formConfig.enabled ? 'Active' : 'Paused'}
            </div>
            <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <span className="text-sm text-slate-500 dark:text-slate-400">Balance: </span>
              <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 p-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm w-fit">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'strategy', label: 'Strategy', icon: Settings },
          { id: 'history', label: 'History', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboardTab()}
      {activeTab === 'strategy' && renderStrategyTab()}
      {activeTab === 'history' && renderHistoryTab()}

      {/* Bet Modal */}
      {betModal.isOpen && betModal.opportunity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Place Bet</h3>
                <button
                  onClick={closeBetModal}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XCircle className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Market Question */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Market</label>
                <p className="text-sm font-medium text-slate-800 dark:text-white">
                  {betModal.opportunity.question}
                </p>
              </div>

              {/* Outcome and Probability */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Outcome</label>
                  <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${
                    betModal.opportunity.outcome.toLowerCase() === 'yes'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {betModal.opportunity.outcome}
                  </span>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Current Probability</label>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {(betModal.opportunity.probability * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Bet Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Bet Amount (USDC)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-lg font-medium"
                    placeholder="10"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Available: {formatCurrency(balance)}
                  </span>
                  <div className="flex gap-2">
                    {[5, 10, 25, 50].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setBetAmount(amt.toString())}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded transition-colors"
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Potential Return */}
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Potential Return</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(parseFloat(betAmount || '0') / betModal.opportunity.probability)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Potential Profit</span>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency((parseFloat(betAmount || '0') / betModal.opportunity.probability) - parseFloat(betAmount || '0'))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={closeBetModal}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceBet}
                disabled={placingBet || !betAmount || parseFloat(betAmount) <= 0}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {placingBet ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Placing Bet...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Place Bet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
