import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import config from '@/config/env';
import {
  Play,
  Pause,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Plus,
  Activity,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  BarChart3,
  Zap,
  Layers,
  RefreshCw,
} from 'lucide-react';
import type { DCABotConfig } from '@/types';

export default function DalyDCA() {
  const dcaBots = useStore((state) => state.dcaBots);
  const fetchDCABots = useStore((state) => state.fetchDCABots);
  const createDCABot = useStore((state) => state.createDCABot);
  const updateDCABot = useStore((state) => state.updateDCABot);
  const pauseDCABot = useStore((state) => state.pauseDCABot);
  const resumeDCABot = useStore((state) => state.resumeDCABot);
  const deleteDCABot = useStore((state) => state.deleteDCABot);
  const triggerDCABots = useStore((state) => state.triggerDCABots);

  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [expandedBotId, setExpandedBotId] = useState<string | null>(null);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [sortBy, setSortBy] = useState<'name' | 'invested' | 'pnl'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Section collapse states
  const [isCreateSectionExpanded, setIsCreateSectionExpanded] = useState(true);
  const [isLiveBotsSectionExpanded, setIsLiveBotsSectionExpanded] = useState(true);
  const [isPendingOrdersSectionExpanded, setIsPendingOrdersSectionExpanded] = useState(true);

  // Available trading pairs (only pairs supported by Kraken)
  const availableSymbols = [
    'BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD',
    'DOGE/USD', 'DOT/USD', 'LINK/USD', 'UNI/USD', 'AVAX/USD',
    'ATOM/USD', 'LTC/USD', 'BCH/USD', 'XLM/USD', 'ALGO/USD',
    'NEAR/USD', 'SAND/USD', 'MANA/USD', 'GRT/USD', 'FIL/USD',
  ];

  // Bot creation form state
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC/USD']);
  const [formData, setFormData] = useState({
    initialOrderAmount: 10,
    tradeMultiplier: 2,
    reEntryCount: 8,
    stepPercent: 1,
    stepMultiplier: 2,
    tpTarget: 3,
    supportResistanceEnabled: false,
    reEntryDelay: 888,
    trendAlignmentEnabled: true,
  });

  useEffect(() => {
    refreshData();

    // Set up automatic refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      console.log('[DalyDCA] Auto-refreshing DCA bots data...');
      refreshData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchPendingOrders = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${config.api.mainUrl}/order-queue`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Get ALL orders, sorted by most recent
        const allOrders = (data.orders || [])
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPendingOrders(allOrders);
      }
    } catch (error) {
      console.error('Failed to fetch pending orders:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDCABots(),
        fetchPendingOrders(),
      ]);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to refresh DCA bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerDCABots();
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to trigger bot processing:', error);
    } finally {
      setTriggering(false);
    }
  };

  const handleRefresh = async () => {
    console.log('[Refresh] Button clicked, refreshing pending orders');
    setRefreshing(true);
    try {
      await fetchPendingOrders();
      useStore.getState().addNotification({
        type: 'success',
        title: 'Refreshed',
        message: 'Pending orders list updated',
      });
    } catch (error) {
      console.error('Failed to refresh pending orders:', error);
      useStore.getState().addNotification({
        type: 'error',
        title: 'Refresh Failed',
        message: 'Failed to refresh pending orders',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteAll = async () => {
    console.log('[DeleteAll] Button clicked, pending orders:', pendingOrders.length);

    if (!window.confirm('⚠️ WARNING: This will delete ALL pending orders. This action cannot be undone. Continue?')) {
      console.log('[DeleteAll] User cancelled');
      return;
    }

    setDeletingAll(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.api.mainUrl}/order-queue/delete-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        useStore.getState().addNotification({
          type: 'success',
          title: 'All Orders Deleted',
          message: `Deleted ${data.deletedCount} pending orders`,
        });
        // Refresh pending orders list
        await fetchPendingOrders();
      } else {
        useStore.getState().addNotification({
          type: 'error',
          title: 'Delete Failed',
          message: data.error || 'Failed to delete pending orders',
        });
      }
    } catch (error) {
      console.error('Failed to delete all pending orders:', error);
      useStore.getState().addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete all pending orders',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExecuteNow = async () => {
    console.log('[ExecuteNow] Button clicked, pending orders:', pendingOrders.length);

    setExecuting(true);
    try {
      const token = localStorage.getItem('auth_token');

      // Get Kraken API keys using the same logic as manual trades
      const getApiKeys = (): { apiKey: string; apiSecret: string } | null => {
        try {
          const keysJson = localStorage.getItem('kraken_api_keys');
          if (!keysJson) {
            console.warn('[ExecuteNow] No API keys found in localStorage');
            return null;
          }

          const keys = JSON.parse(keysJson);

          // Keys are stored as an array of objects with type property
          if (!Array.isArray(keys)) {
            console.error('[ExecuteNow] Invalid API keys format');
            return null;
          }

          // Try primary key first
          const primaryKey = keys.find((k) => k.type === 'primary');
          if (primaryKey?.apiKey && primaryKey?.apiSecret && primaryKey.isActive) {
            console.log('[ExecuteNow] Using primary API key');
            return {
              apiKey: primaryKey.apiKey,
              apiSecret: primaryKey.apiSecret,
            };
          }

          // Try fallback1
          const fallback1Key = keys.find((k) => k.type === 'fallback1');
          if (fallback1Key?.apiKey && fallback1Key?.apiSecret && fallback1Key.isActive) {
            console.log('[ExecuteNow] Using fallback #1 API key');
            return {
              apiKey: fallback1Key.apiKey,
              apiSecret: fallback1Key.apiSecret,
            };
          }

          // Try fallback2
          const fallback2Key = keys.find((k) => k.type === 'fallback2');
          if (fallback2Key?.apiKey && fallback2Key?.apiSecret && fallback2Key.isActive) {
            console.log('[ExecuteNow] Using fallback #2 API key');
            return {
              apiKey: fallback2Key.apiKey,
              apiSecret: fallback2Key.apiSecret,
            };
          }

          console.warn('[ExecuteNow] No valid API keys found (all inactive or empty)');
          return null;
        } catch (error) {
          console.error('[ExecuteNow] Error reading API keys:', error);
          return null;
        }
      };

      const credentials = getApiKeys();

      if (!credentials) {
        useStore.getState().addNotification({
          type: 'error',
          title: 'Kraken API Keys Missing',
          message: 'Please configure your Kraken API keys in Settings',
        });
        setExecuting(false);
        return;
      }

      const response = await fetch(`${config.api.mainUrl}/order-queue/execute-now`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-kraken-api-key': credentials.apiKey,
          'x-kraken-api-secret': credentials.apiSecret,
        },
      });

      const data = await response.json();

      if (response.ok) {
        useStore.getState().addNotification({
          type: 'success',
          title: 'Orders Executed',
          message: data.message,
        });
        // Refresh pending orders and bots
        await Promise.all([fetchPendingOrders(), fetchDCABots()]);
      } else {
        useStore.getState().addNotification({
          type: 'error',
          title: 'Execution Failed',
          message: data.error || 'Failed to execute orders',
        });
      }
    } catch (error) {
      console.error('Failed to execute orders:', error);
      useStore.getState().addNotification({
        type: 'error',
        title: 'Execution Failed',
        message: 'Failed to execute pending orders',
      });
    } finally {
      setExecuting(false);
    }
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) => {
      if (prev.includes(symbol)) {
        // Don't allow deselecting all symbols
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  const selectAllSymbols = () => {
    setSelectedSymbols([...availableSymbols]);
  };

  const clearAllSymbols = () => {
    setSelectedSymbols(['BTC/USD']); // Keep at least one
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Create a bot for each selected symbol
      const createPromises = selectedSymbols.map((symbol) =>
        createDCABot({
          symbol,
          ...formData,
        })
      );

      await Promise.all(createPromises);

      // Reset form
      setSelectedSymbols(['BTC/USD']);
      setFormData({
        initialOrderAmount: 10,
        tradeMultiplier: 2,
        reEntryCount: 8,
        stepPercent: 1,
        stepMultiplier: 2,
        tpTarget: 3,
        supportResistanceEnabled: false,
        reEntryDelay: 888,
        trendAlignmentEnabled: true,
      });
    } catch (error) {
      console.error('Failed to create bot(s):', error);
    } finally {
      setCreating(false);
    }
  };

  const handlePauseResume = async (bot: any) => {
    try {
      if (bot.status === 'active') {
        await pauseDCABot(bot.id);
      } else if (bot.status === 'paused') {
        await resumeDCABot(bot.id);
      }
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    }
  };

  const handleDelete = async (botId: string) => {
    if (window.confirm('Are you sure you want to delete this bot?')) {
      try {
        await deleteDCABot(botId);
        setExpandedBotId(null);
        setEditingBotId(null);
      } catch (error) {
        console.error('Failed to delete bot:', error);
      }
    }
  };

  const handleEditBot = (bot: any) => {
    setEditingBotId(bot.id);
    setEditFormData({
      initialOrderAmount: bot.initialOrderAmount,
      tradeMultiplier: bot.tradeMultiplier,
      reEntryCount: bot.reEntryCount,
      stepPercent: bot.stepPercent,
      stepMultiplier: bot.stepMultiplier,
      tpTarget: bot.tpTarget,
      supportResistanceEnabled: bot.supportResistanceEnabled,
      reEntryDelay: bot.reEntryDelay,
      trendAlignmentEnabled: bot.trendAlignmentEnabled,
    });
  };

  const handleSaveEdit = async (botId: string) => {
    try {
      await updateDCABot(botId, editFormData);
      setEditingBotId(null);
    } catch (error) {
      console.error('Failed to update bot:', error);
    }
  };

  const toggleBotExpanded = (botId: string) => {
    setExpandedBotId(expandedBotId === botId ? null : botId);
    if (editingBotId === botId) {
      setEditingBotId(null);
    }
  };

  const getNextActionMessage = (bot: any) => {
    if (bot.status !== 'active') {
      return { message: 'Bot is paused', color: 'text-yellow-500' };
    }

    if (bot.currentEntryCount >= bot.reEntryCount) {
      return { message: 'Max entries reached', color: 'text-orange-500' };
    }

    // FIRST ENTRY: Always ready (no trend/support checks)
    if (bot.currentEntryCount === 0) {
      return { message: 'Ready to enter on next trigger', color: 'text-green-400' };
    }

    // RE-ENTRIES ONLY: Check trend alignment if enabled
    if (bot.trendAlignmentEnabled && (bot.techScore < 50 || bot.trendScore < 50)) {
      return { message: 'Waiting for trend alignment', color: 'text-blue-400' };
    }

    // For re-entries, check additional conditions
    if (bot.currentEntryCount > 0) {
      // Check if support/resistance is enabled
      if (bot.supportResistanceEnabled) {
        return { message: 'Waiting for support level', color: 'text-purple-400' };
      }

      // Check if re-entry delay is active
      if (bot.lastEntryTime) {
        const lastEntryTime = new Date(bot.lastEntryTime).getTime();
        const timeSinceLastEntry = Date.now() - lastEntryTime;
        const delayMs = bot.reEntryDelay * 60 * 1000;

        if (timeSinceLastEntry < delayMs) {
          const minutesRemaining = Math.ceil((delayMs - timeSinceLastEntry) / 60000);
          return { message: `Cooldown: ${minutesRemaining}m remaining`, color: 'text-cyan-400' };
        }
      }

      // Check if price condition is met
      if (bot.nextEntryPrice && bot.currentPrice > bot.nextEntryPrice) {
        const dropNeeded = ((bot.currentPrice - bot.nextEntryPrice) / bot.currentPrice * 100).toFixed(2);
        return { message: `Waiting for ${dropNeeded}% price drop`, color: 'text-gray-400' };
      }
    }

    // Check if funds are available (mock check)
    const nextOrderAmount = bot.initialOrderAmount * Math.pow(bot.tradeMultiplier, bot.currentEntryCount);
    if (nextOrderAmount > 1000) { // Mock insufficient funds check
      return { message: 'Insufficient funds available', color: 'text-red-400' };
    }

    return { message: 'Ready to enter on next trigger', color: 'text-green-400' };
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500 bg-green-500/10';
      case 'pending':
        return 'text-blue-500 bg-blue-500/10';
      case 'processing':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'retry':
        return 'text-orange-500 bg-orange-500/10';
      case 'failed':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getOrderDebugMessage = (order: any) => {
    if (order.status === 'completed') {
      return 'Order executed successfully';
    }
    if (order.status === 'pending') {
      return 'Waiting for next execution cycle';
    }
    if (order.status === 'processing') {
      return 'Currently being processed';
    }
    if (order.status === 'retry') {
      if (order.lastError) {
        // Check for common errors
        if (order.lastError.toLowerCase().includes('insufficient funds')) {
          return `Insufficient funds - Retry in ${formatRetryTime(order.nextRetryAt)}`;
        }
        if (order.lastError.toLowerCase().includes('rate limit')) {
          return `Rate limited - Retry in ${formatRetryTime(order.nextRetryAt)}`;
        }
        return `${order.lastError.substring(0, 50)}... - Retry ${order.attempts}/${order.maxAttempts}`;
      }
      return `Retrying - Attempt ${order.attempts}/${order.maxAttempts}`;
    }
    if (order.status === 'failed') {
      if (order.lastError) {
        if (order.lastError.toLowerCase().includes('insufficient funds')) {
          return 'Failed: Insufficient funds';
        }
        if (order.lastError.toLowerCase().includes('invalid')) {
          return 'Failed: Invalid order parameters';
        }
        return `Failed: ${order.lastError.substring(0, 50)}...`;
      }
      return 'Permanently failed after max attempts';
    }
    return 'Unknown status';
  };

  const formatRetryTime = (nextRetryAt: string | undefined) => {
    if (!nextRetryAt) return 'soon';
    const now = new Date();
    const retryTime = new Date(nextRetryAt);
    const diffMs = retryTime.getTime() - now.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return `${diffSecs}s`;
    if (diffMins < 60) return `${diffMins}m`;
    return `${Math.floor(diffMins / 60)}h`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'paused':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'completed':
        return 'text-blue-500 bg-blue-500/10';
      case 'stopped':
        return 'text-gray-500 bg-gray-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const activeBots = dcaBots.filter((bot) => bot.status === 'active');
  const pausedBots = dcaBots.filter((bot) => bot.status === 'paused');
  const completedBots = dcaBots.filter((bot) => bot.status === 'completed');
  const totalInvested = dcaBots.reduce((sum, bot) => sum + (bot.totalInvested || 0), 0);
  const totalUnrealizedPnL = dcaBots.reduce((sum, bot) => sum + (bot.unrealizedPnL || 0), 0);
  const totalCurrentValue = totalInvested + totalUnrealizedPnL;
  const totalPnLPercent = totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0;

  // Sort bots based on selected criteria
  const sortedBots = [...dcaBots].sort((a, b) => {
    let compareValue = 0;

    if (sortBy === 'name') {
      compareValue = a.symbol.localeCompare(b.symbol);
    } else if (sortBy === 'invested') {
      compareValue = (a.totalInvested || 0) - (b.totalInvested || 0);
    } else if (sortBy === 'pnl') {
      compareValue = (a.unrealizedPnL || 0) - (b.unrealizedPnL || 0);
    }

    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  const handleSortChange = (newSortBy: 'name' | 'invested' | 'pnl') => {
    if (sortBy === newSortBy) {
      // Toggle direction if same sort criteria
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort criteria - default to ascending
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">DalyDCA Strategy</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary btn-sm flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          {showCreateForm ? 'Hide Form' : 'Create Bot'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Bots</p>
              <p className="text-2xl font-bold text-white">{activeBots.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dcaBots.length > 0 ? `${((activeBots.length / dcaBots.length) * 100).toFixed(0)}% running` : 'No bots yet'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Play className="h-7 w-7 text-green-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-primary-500/10 to-purple-600/5 border-primary-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Bots</p>
              <p className="text-2xl font-bold text-white">{dcaBots.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {pausedBots.length} paused, {completedBots.length} completed
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Settings className="h-7 w-7 text-primary-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Invested</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalInvested)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dcaBots.length > 0 ? `Avg: ${formatCurrency(totalInvested / dcaBots.length)} per bot` : 'Start trading to see stats'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-blue-400" />
            </div>
          </div>
        </div>

        <div className={`card ${totalUnrealizedPnL >= 0 ? 'bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20' : 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unrealized P&L</p>
              <p className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalUnrealizedPnL)}
              </p>
              <p className={`text-xs font-semibold mt-1 ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalInvested > 0 ? `${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}% • ${formatCurrency(totalCurrentValue)} value` : 'No positions yet'}
              </p>
            </div>
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${totalUnrealizedPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {totalUnrealizedPnL >= 0 ? (
                <TrendingUp className="h-7 w-7 text-green-400" />
              ) : (
                <TrendingDown className="h-7 w-7 text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bot Creation Form */}
      {showCreateForm && (
        <div className="relative overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 pointer-events-none" />

          <div className="card relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCreateSectionExpanded(!isCreateSectionExpanded)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  {isCreateSectionExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                    Create New DCA Bot
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Configure your automated trading strategy</p>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                <Plus className="h-6 w-6 text-white" />
              </div>
            </div>

            {isCreateSectionExpanded && (

            <form onSubmit={handleCreateBot} className="space-y-6">
              {/* Symbol Selection */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                      <Target className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white">
                        Trading Pairs
                      </label>
                      <p className="text-xs text-gray-400">
                        <span className="text-primary-400 font-medium">{selectedSymbols.length}</span> selected
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllSymbols}
                      className="px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 text-xs font-medium transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllSymbols}
                      className="px-3 py-1.5 rounded-lg bg-slate-600/30 hover:bg-slate-600/50 text-gray-400 text-xs font-medium transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
                  {availableSymbols.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => toggleSymbol(symbol)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                        selectedSymbols.includes(symbol)
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 scale-105'
                          : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50 hover:text-gray-300'
                      }`}
                    >
                      {symbol.replace('/USD', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Summary */}
              {selectedSymbols.length > 0 && (
                <div className="relative p-5 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">Creation Preview</h3>
                      <span className="ml-auto px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-xs font-bold">
                        {selectedSymbols.length} Bot{selectedSymbols.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Initial Capital</p>
                        <p className="text-lg font-bold text-white">
                          ${formData.initialOrderAmount * selectedSymbols.length}
                        </p>
                        <p className="text-xs text-gray-500">${formData.initialOrderAmount} × {selectedSymbols.length}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Entries Each</p>
                        <p className="text-lg font-bold text-white">{formData.reEntryCount}</p>
                        <p className="text-xs text-gray-500">Max per bot</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Max Investment</p>
                        <p className="text-lg font-bold text-white">
                          ${(formData.initialOrderAmount * (Math.pow(formData.tradeMultiplier, formData.reEntryCount) - 1) / (formData.tradeMultiplier - 1) * selectedSymbols.length).toFixed(0)}
                        </p>
                        <p className="text-xs text-gray-500">If all entries fill</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Target Profit</p>
                        <p className="text-lg font-bold text-green-400">+{formData.tpTarget}%</p>
                        <p className="text-xs text-gray-500">Per bot minimum</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Grid */}
              <div className="grid md:grid-cols-3 gap-5">
                {/* Initial Order Amount */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    Initial Order Amount
                    <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.initialOrderAmount}
                      onChange={(e) => setFormData({ ...formData, initialOrderAmount: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                      required
                    />
                  </div>
                </div>

                {/* Trade Multiplier */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    Trade Multiplier
                    <span className="text-xs text-gray-500 font-normal">({formData.tradeMultiplier}x)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.tradeMultiplier}
                    onChange={(e) => setFormData({ ...formData, tradeMultiplier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Next: <span className="text-primary-400 font-medium">${formData.initialOrderAmount * formData.tradeMultiplier}</span>
                  </p>
                </div>

                {/* Re-Entry Count */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="h-4 w-4 text-purple-400" />
                    Max Re-Entries
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.reEntryCount}
                    onChange={(e) => setFormData({ ...formData, reEntryCount: parseInt(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                {/* Step Percent */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <TrendingDown className="h-4 w-4 text-orange-400" />
                    Step Percent
                    <span className="text-xs text-gray-500 font-normal">({formData.stepPercent}%)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.stepPercent}
                      onChange={(e) => setFormData({ ...formData, stepPercent: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Price drop trigger</p>
                </div>

                {/* Step Multiplier */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Activity className="h-4 w-4 text-pink-400" />
                    Step Multiplier
                    <span className="text-xs text-gray-500 font-normal">({formData.stepMultiplier}x)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.stepMultiplier}
                    onChange={(e) => setFormData({ ...formData, stepMultiplier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    E2: {formData.stepPercent}%, E3: {formData.stepPercent * formData.stepMultiplier}%
                  </p>
                </div>

                {/* TP Target */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="h-4 w-4 text-green-400" />
                    TP Target
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.tpTarget}
                      onChange={(e) => setFormData({ ...formData, tpTarget: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Min from avg price</p>
                </div>

                {/* Re-Entry Delay */}
                <div className="group md:col-span-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Clock className="h-4 w-4 text-yellow-400" />
                    Re-Entry Delay
                    <span className="text-xs text-gray-500 font-normal">({formData.reEntryDelay} minutes)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reEntryDelay}
                    onChange={(e) => setFormData({ ...formData, reEntryDelay: parseInt(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-2">Cooldown between re-entries (prevents over-trading)</p>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Support/Resistance Toggle */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-600/30 hover:border-slate-500/50 transition-colors">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.supportResistanceEnabled}
                      onChange={(e) => setFormData({ ...formData, supportResistanceEnabled: e.target.checked })}
                      className="mt-1 h-5 w-5 rounded-lg bg-slate-700 border-slate-600 text-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">Support/Resistance</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Wait for price to cross support level before entering
                      </p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      formData.supportResistanceEnabled
                        ? 'bg-primary-500/20 text-primary-300'
                        : 'bg-slate-700 text-gray-500'
                    }`}>
                      {formData.supportResistanceEnabled ? 'ON' : 'OFF'}
                    </div>
                  </label>
                </div>

                {/* Trend Alignment Toggle */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-600/30 hover:border-slate-500/50 transition-colors">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.trendAlignmentEnabled}
                      onChange={(e) => setFormData({ ...formData, trendAlignmentEnabled: e.target.checked })}
                      className="mt-1 h-5 w-5 rounded-lg bg-slate-700 border-slate-600 text-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-white">Trend Alignment</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Only enter positions when both tech & trend scores are bullish
                      </p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      formData.trendAlignmentEnabled
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-slate-700 text-gray-500'
                    }`}>
                      {formData.trendAlignmentEnabled ? 'ON' : 'OFF'}
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className={`flex-1 relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 ${
                    creating || selectedSymbols.length === 0
                      ? 'bg-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40'
                  }`}
                  disabled={creating || selectedSymbols.length === 0}
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {creating ? (
                      <>
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating {selectedSymbols.length} Bot{selectedSymbols.length > 1 ? 's' : ''}...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        <span>Create {selectedSymbols.length} Bot{selectedSymbols.length > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-4 rounded-xl font-medium text-gray-300 bg-slate-800/50 border border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all"
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>

              {/* Selected Symbols Preview */}
              {selectedSymbols.length > 1 && !creating && (
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-600/30">
                  <p className="text-xs text-gray-400 mb-2">Selected symbols:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSymbols.map((symbol) => (
                      <span
                        key={symbol}
                        className="px-2 py-1 rounded-md bg-primary-500/10 text-primary-300 text-xs font-medium"
                      >
                        {symbol.replace('/USD', '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </form>
            )}
          </div>
        </div>
      )}

      {/* Live Bots Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsLiveBotsSectionExpanded(!isLiveBotsSectionExpanded)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isLiveBotsSectionExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Live Bots
                {dcaBots.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-xs font-medium">
                    {dcaBots.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Auto-refreshes every 5 minutes • Last update: {lastRefreshTime.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={loading}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <Activity className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {isLiveBotsSectionExpanded && (
        <>

        {/* Sort Controls */}
        {dcaBots.length > 0 && (
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-700">
            <span className="text-sm text-gray-400">Sort by:</span>
            <button
              onClick={() => handleSortChange('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'name'
                  ? 'bg-primary-500/20 text-primary-300'
                  : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'
              }`}
            >
              Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSortChange('invested')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'invested'
                  ? 'bg-primary-500/20 text-primary-300'
                  : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'
              }`}
            >
              Invested {sortBy === 'invested' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSortChange('pnl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'pnl'
                  ? 'bg-primary-500/20 text-primary-300'
                  : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'
              }`}
            >
              P&L {sortBy === 'pnl' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        )}

        {dcaBots.length > 0 ? (
          <div className="space-y-3">
            {sortedBots.map((bot) => {
              const isExpanded = expandedBotId === bot.id;
              const isEditing = editingBotId === bot.id;
              const nextAction = getNextActionMessage(bot);

              return (
                <div
                  key={bot.id}
                  className={`border rounded-xl transition-all duration-200 ${
                    isExpanded
                      ? 'border-primary-500/50 bg-gradient-to-br from-primary-500/5 to-purple-500/5'
                      : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                  }`}
                >
                  {/* Bot Header - Always Visible */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleBotExpanded(bot.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-white">{bot.symbol}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(bot.status)}`}>
                          {bot.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {bot.currentEntryCount || 0}/{bot.reEntryCount} entries
                        </span>
                        {bot.createdAt && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(bot.createdAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePauseResume(bot);
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          {bot.status === 'active' ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {!isExpanded && (
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Invested</p>
                          <p className="font-semibold text-white">{formatCurrency(bot.totalInvested || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Avg Price</p>
                          <p className="font-semibold text-white">{formatCurrency(bot.averagePurchasePrice || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Spot Price</p>
                          <p className="font-semibold text-white">{formatCurrency(bot.currentPrice || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Next Entry</p>
                          <p className="font-semibold text-blue-400">
                            {bot.nextEntryPrice ? formatCurrency(bot.nextEntryPrice) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Tech/Trend</p>
                          <p className="font-semibold">
                            <span className={(bot.techScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}>
                              {bot.techScore || 0}
                            </span>
                            <span className="text-gray-500">/</span>
                            <span className={(bot.trendScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}>
                              {bot.trendScore || 0}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">P&L</p>
                          <p className={`font-semibold ${bot.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(bot.unrealizedPnL || 0)}
                          </p>
                        </div>
                      </div>
                    )}

                    <p className={`text-xs mt-2 ${nextAction.color}`}>
                      {nextAction.message}
                    </p>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-700 p-4 space-y-4">
                      {/* Performance Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-blue-400" />
                          Current Performance
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Invested</p>
                            <p className="text-lg font-bold text-white">{formatCurrency(bot.totalInvested || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Current Value</p>
                            <p className="text-lg font-bold text-white">
                              {formatCurrency((bot.totalInvested || 0) + (bot.unrealizedPnL || 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Unrealized P&L</p>
                            <p className={`text-lg font-bold ${bot.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatCurrency(bot.unrealizedPnL || 0)}
                            </p>
                            <p className={`text-xs ${bot.unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {bot.unrealizedPnLPercent >= 0 ? '+' : ''}{bot.unrealizedPnLPercent?.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Avg Price</p>
                            <p className="text-lg font-bold text-white">{formatCurrency(bot.averagePurchasePrice || 0)}</p>
                            <p className="text-xs text-gray-500">Current: {formatCurrency(bot.currentPrice || 0)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Market Analysis */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-400" />
                          Market Analysis
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Tech Score</p>
                            <div className="flex items-center gap-2">
                              <p className={`text-lg font-bold ${(bot.techScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {bot.techScore || 0}
                              </p>
                              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${(bot.techScore || 0) > 50 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${bot.techScore || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Trend Score</p>
                            <div className="flex items-center gap-2">
                              <p className={`text-lg font-bold ${(bot.trendScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {bot.trendScore || 0}
                              </p>
                              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${(bot.trendScore || 0) > 50 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${bot.trendScore || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Next Entry Price</p>
                            <p className="text-lg font-bold text-blue-400">
                              {bot.nextEntryPrice ? formatCurrency(bot.nextEntryPrice) : 'N/A'}
                            </p>
                            {bot.nextEntryPrice && bot.currentPrice && (
                              <p className="text-xs text-gray-500">
                                {((1 - bot.nextEntryPrice / bot.currentPrice) * 100).toFixed(2)}% drop needed
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">TP Target Price</p>
                            <p className="text-lg font-bold text-green-400">
                              {bot.currentTpPrice ? formatCurrency(bot.currentTpPrice) : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">Min {bot.tpTarget}% profit</p>
                          </div>
                        </div>
                      </div>

                      {/* Support & Resistance Levels */}
                      {bot.supportResistanceEnabled && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-purple-400" />
                            Support & Resistance Levels
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
                              Enabled
                            </span>
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-400">Current Support</p>
                              <p className="text-lg font-bold text-green-400">
                                {bot.currentSupport ? formatCurrency(bot.currentSupport) : formatCurrency((bot.currentPrice || 0) * 0.95)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {bot.currentPrice && bot.currentSupport
                                  ? `${(((bot.currentPrice - bot.currentSupport) / bot.currentPrice) * 100).toFixed(2)}% below`
                                  : '~5% below current'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Current Resistance</p>
                              <p className="text-lg font-bold text-red-400">
                                {bot.currentResistance ? formatCurrency(bot.currentResistance) : formatCurrency((bot.currentPrice || 0) * 1.05)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {bot.currentPrice && bot.currentResistance
                                  ? `${(((bot.currentResistance - bot.currentPrice) / bot.currentPrice) * 100).toFixed(2)}% above`
                                  : '~5% above current'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Next Support</p>
                              <p className="text-lg font-bold text-cyan-400">
                                {bot.nextSupport ? formatCurrency(bot.nextSupport) : formatCurrency((bot.currentPrice || 0) * 0.90)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Entry trigger zone
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">S/R Status</p>
                              {bot.currentPrice && (
                                <>
                                  {bot.currentPrice <= (bot.currentSupport || (bot.currentPrice * 0.95)) ? (
                                    <p className="text-lg font-bold text-green-400">At Support</p>
                                  ) : bot.currentPrice >= (bot.currentResistance || (bot.currentPrice * 1.05)) ? (
                                    <p className="text-lg font-bold text-red-400">At Resistance</p>
                                  ) : (
                                    <p className="text-lg font-bold text-blue-400">In Range</p>
                                  )}
                                  <p className="text-xs text-gray-500">
                                    {bot.currentPrice <= (bot.currentSupport || (bot.currentPrice * 0.95))
                                      ? 'Entry conditions met'
                                      : 'Waiting for support'}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <p className="text-xs text-purple-300">
                              <strong>S/R Strategy:</strong> Bot will only enter new positions when price crosses below the current support level,
                              reducing false entries during sideways movement and improving entry timing.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Bot Configuration */}
                      {isEditing ? (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                            <Edit className="h-4 w-4 text-orange-400" />
                            Edit Configuration
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Initial Amount ($)</label>
                              <input
                                type="number"
                                value={editFormData.initialOrderAmount}
                                onChange={(e) => setEditFormData({ ...editFormData, initialOrderAmount: parseFloat(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Trade Multiplier</label>
                              <input
                                type="number"
                                step="0.1"
                                value={editFormData.tradeMultiplier}
                                onChange={(e) => setEditFormData({ ...editFormData, tradeMultiplier: parseFloat(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Max Entries</label>
                              <input
                                type="number"
                                value={editFormData.reEntryCount}
                                onChange={(e) => setEditFormData({ ...editFormData, reEntryCount: parseInt(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Step %</label>
                              <input
                                type="number"
                                step="0.1"
                                value={editFormData.stepPercent}
                                onChange={(e) => setEditFormData({ ...editFormData, stepPercent: parseFloat(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Step Multiplier</label>
                              <input
                                type="number"
                                step="0.1"
                                value={editFormData.stepMultiplier}
                                onChange={(e) => setEditFormData({ ...editFormData, stepMultiplier: parseFloat(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">TP Target %</label>
                              <input
                                type="number"
                                step="0.1"
                                value={editFormData.tpTarget}
                                onChange={(e) => setEditFormData({ ...editFormData, tpTarget: parseFloat(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-xs text-gray-400 block mb-1">Re-Entry Delay (minutes)</label>
                              <input
                                type="number"
                                value={editFormData.reEntryDelay}
                                onChange={(e) => setEditFormData({ ...editFormData, reEntryDelay: parseInt(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editFormData.trendAlignmentEnabled}
                                onChange={(e) => setEditFormData({ ...editFormData, trendAlignmentEnabled: e.target.checked })}
                                className="rounded"
                              />
                              <label className="text-xs text-gray-400">Trend Alignment</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editFormData.supportResistanceEnabled}
                                onChange={(e) => setEditFormData({ ...editFormData, supportResistanceEnabled: e.target.checked })}
                                className="rounded"
                              />
                              <label className="text-xs text-gray-400">Support/Resistance</label>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleSaveEdit(bot.id)}
                              className="btn btn-primary btn-sm flex items-center gap-2"
                            >
                              <Save className="h-3 w-3" />
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingBotId(null)}
                              className="btn btn-secondary btn-sm flex items-center gap-2"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-gray-400" />
                            Bot Configuration
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-400">Initial Amount</p>
                              <p className="text-white font-medium">${bot.initialOrderAmount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Trade Multiplier</p>
                              <p className="text-white font-medium">{bot.tradeMultiplier}x</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Step %</p>
                              <p className="text-white font-medium">{bot.stepPercent}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Step Multiplier</p>
                              <p className="text-white font-medium">{bot.stepMultiplier}x</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Max Entries</p>
                              <p className="text-white font-medium">{bot.reEntryCount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">TP Target</p>
                              <p className="text-white font-medium">{bot.tpTarget}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Re-Entry Delay</p>
                              <p className="text-white font-medium">{bot.reEntryDelay}m</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Features</p>
                              <div className="flex gap-1 mt-1">
                                {bot.trendAlignmentEnabled && (
                                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">Trend</span>
                                )}
                                {bot.supportResistanceEnabled && (
                                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">S/R</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Entry History */}
                      {bot.entries && bot.entries.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-purple-400" />
                            Entry History ({bot.entries.length})
                          </h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {bot.entries.map((entry: any, index: number) => (
                              <div key={entry.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg text-sm">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-400">#{entry.entryNumber}</span>
                                  <span className="text-white font-medium">{formatCurrency(entry.price)}</span>
                                  <span className="text-gray-400">{entry.quantity?.toFixed(6)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">{formatCurrency(entry.orderAmount)}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${entry.status === 'filled' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                    {entry.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2 border-t border-slate-700">
                        {!isEditing && (
                          <button
                            onClick={() => handleEditBot(bot)}
                            className="btn btn-secondary btn-sm flex items-center gap-2"
                          >
                            <Edit className="h-3 w-3" />
                            Edit Bot
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(bot.id)}
                          className="btn btn-danger btn-sm flex items-center gap-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete Bot
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-500/10 mb-4">
              <Activity className="h-8 w-8 text-primary-400 animate-spin" />
            </div>
            <p className="text-gray-400 font-medium">Loading your bots...</p>
            <p className="text-xs text-gray-500 mt-2">Please wait while we fetch your DCA bots</p>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 mb-4">
              <Settings className="h-10 w-10 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No DCA Bots Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Create your first automated DCA bot to start dollar-cost averaging into your favorite cryptocurrencies with smart re-entry logic.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Create Your First Bot
            </button>
          </div>
        )}
        </>
        )}
      </div>

      {/* Pending Orders Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsPendingOrdersSectionExpanded(!isPendingOrdersSectionExpanded)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isPendingOrdersSectionExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Pending Orders
                {pendingOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium">
                    {pendingOrders.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                All pending orders from the order queue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn btn-secondary btn-sm flex items-center gap-2"
              title="Refresh pending orders list"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="btn btn-sm flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
              title="Delete ALL pending orders (WARNING: Cannot be undone)"
            >
              <X className={`h-4 w-4 ${deletingAll ? 'animate-pulse' : ''}`} />
              {deletingAll ? 'Deleting...' : 'Delete All'}
            </button>
            <button
              onClick={handleExecuteNow}
              disabled={executing || pendingOrders.length === 0}
              className="btn btn-success btn-sm flex items-center gap-2"
              title="Manually execute all pending orders now"
            >
              <Zap className={`h-4 w-4 ${executing ? 'animate-pulse' : ''}`} />
              {executing ? 'Executing...' : 'Execute Now'}
            </button>
            <button
              onClick={handleTrigger}
              disabled={triggering || activeBots.length === 0}
              className="btn btn-primary btn-sm flex items-center gap-2"
              title="Manually trigger bot processing (bypasses 5-minute wait)"
            >
              <Zap className={`h-4 w-4 ${triggering ? 'animate-pulse' : ''}`} />
              {triggering ? 'Processing...' : 'Trigger Now'}
            </button>
          </div>
        </div>

        {isPendingOrdersSectionExpanded && (
        <>

        {pendingOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-gray-400">
                  <th className="text-left py-3 px-2 font-medium">Pair</th>
                  <th className="text-left py-3 px-2 font-medium">Side</th>
                  <th className="text-right py-3 px-2 font-medium">Amount (USD)</th>
                  <th className="text-right py-3 px-2 font-medium">Price</th>
                  <th className="text-right py-3 px-2 font-medium">Volume</th>
                  <th className="text-left py-3 px-2 font-medium">Status</th>
                  <th className="text-left py-3 px-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-3 px-2">
                      <span className="font-medium text-white">{order.pair}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        order.side === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-white font-medium">
                        ${order.amount ? order.amount.toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300">
                      {order.price ? `$${parseFloat(order.price).toFixed(2)}` : 'Market'}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300">
                      {parseFloat(order.volume).toFixed(8)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-400 text-xs">
                      {formatTimestamp(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading orders...</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <Layers className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No recent orders</p>
            <p className="text-xs text-gray-500 mt-1">Orders will appear here when DCA bots create trades</p>
          </div>
        )}
        </>
        )}
      </div>

      {/* Strategy Info */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">DalyDCA Strategy Info</h3>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary-500 mt-0.5" />
            <div>
              <strong className="text-white">Smart Re-Entry System:</strong> Automatically enters positions
              at calculated intervals based on price drops, using a multiplier system to scale entries.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <strong className="text-white">Trend Alignment:</strong> When enabled, only enters positions
              when both technical and trend scores are bullish, ensuring optimal entry conditions.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <strong className="text-white">Re-Entry Delay:</strong> Prevents over-trading during volatile
              conditions by enforcing a minimum time between re-entries.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <strong className="text-white">Dynamic Take Profit:</strong> Sets a minimum TP target, but
              continues holding if price exceeds target and trend remains bullish. Only exits on bearish
              signals or when price drops back to minimum TP.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
