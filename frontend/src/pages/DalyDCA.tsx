import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import config from '@/config/env';
import { krakenApiService } from '@/services/krakenApiService';
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
  LogOut,
} from 'lucide-react';
import type { DCABotConfig } from '@/types';

interface Balance {
  asset: string;
  symbol: string;
  amount: number;
  availableBalance: number;
  lockedBalance: number;
}

export default function DalyDCA() {
  const dcaBots = useStore((state) => state.dcaBots);
  const fetchDCABots = useStore((state) => state.fetchDCABots);
  const createDCABot = useStore((state) => state.createDCABot);
  const updateDCABot = useStore((state) => state.updateDCABot);
  const pauseDCABot = useStore((state) => state.pauseDCABot);
  const resumeDCABot = useStore((state) => state.resumeDCABot);
  const deleteDCABot = useStore((state) => state.deleteDCABot);
  const triggerDCABots = useStore((state) => state.triggerDCABots);
  const livePrices = useStore((state) => state.livePrices);

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
  const [portfolioBalances, setPortfolioBalances] = useState<Balance[]>([]);
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [trendData, setTrendData] = useState<Map<string, any>>(new Map());

  // Section collapse states
  const [isCreateSectionExpanded, setIsCreateSectionExpanded] = useState(true);
  const [isLiveBotsSectionExpanded, setIsLiveBotsSectionExpanded] = useState(true);
  const [isPendingOrdersSectionExpanded, setIsPendingOrdersSectionExpanded] = useState(true);

  // Available trading pairs (ordered by market cap - top 100 on Kraken)
  const availableSymbols = [
    // Top 10
    'BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD', 'BNB/USD',
    'DOGE/USD', 'ADA/USD', 'TRX/USD', 'AVAX/USD', 'LINK/USD',
    // 11-20
    'DOT/USD', 'BCH/USD', 'NEAR/USD', 'LTC/USD', 'UNI/USD',
    'APT/USD', 'ICP/USD', 'MATIC/USD', 'ATOM/USD', 'XLM/USD',
    // 21-30
    'FIL/USD', 'ARB/USD', 'ALGO/USD', 'SAND/USD', 'MANA/USD',
    'GRT/USD', 'AAVE/USD', 'SNX/USD', 'AXS/USD', 'FLOW/USD',
    // 31-40
    'EOS/USD', 'XTZ/USD', 'ZEC/USD', 'DASH/USD', 'COMP/USD',
    'YFI/USD', 'MKR/USD', 'SUSHI/USD', 'BAT/USD', 'ZRX/USD',
    // 41-50
    'ENJ/USD', 'CRV/USD', 'BAL/USD', 'BAND/USD', 'KNC/USD',
    'REN/USD', 'STORJ/USD', 'KSM/USD', 'KAVA/USD', 'OCEAN/USD',
    // 51-60
    'WAVES/USD', 'ICX/USD', 'SC/USD', 'OMG/USD', 'ANT/USD',
    'REP/USD', 'LSK/USD', 'QTUM/USD', 'PAXG/USD', 'DAI/USD',
    // 61-70
    'USDC/USD', 'USDT/USD', 'GHST/USD', 'KEEP/USD', 'PERP/USD',
    'RARI/USD', 'OXT/USD', 'MLN/USD', 'TBTC/USD', 'ETH2/USD',
    // 71-80
    'MOVR/USD', 'PHA/USD', 'KILT/USD', 'SDN/USD', 'KINT/USD',
    'AIR/USD', 'XRT/USD', 'EWT/USD', 'SPELL/USD', 'RUNE/USD',
    // 81-90
    'LPT/USD', 'FET/USD', 'INJ/USD', 'AKT/USD', 'GLM/USD',
    'BLUR/USD', 'IMX/USD', 'OP/USD', 'LDO/USD', 'RPL/USD',
    // 91-100
    'CFG/USD', 'SRM/USD', 'RAY/USD', 'ORCA/USD', 'MNGO/USD',
    'T/USD', '1INCH/USD', 'API3/USD', 'BADGER/USD', 'BNT/USD',
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
    exitPercentage: 90, // Default to selling 90%, keeping 10%
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

  const fetchPortfolioBalances = async () => {
    try {
      // Try to fetch fresh balances from Kraken
      const balances = await krakenApiService.getAccountBalance();
      setPortfolioBalances(balances);
      console.log('[DalyDCA] Fetched', balances.length, 'portfolio balances');
    } catch (error) {
      console.error('[DalyDCA] Error fetching portfolio balances:', error);
      // Try to use cached data from Portfolio page
      const cached = localStorage.getItem('portfolio_balances_cache');
      if (cached) {
        try {
          const cachedBalances = JSON.parse(cached);
          setPortfolioBalances(cachedBalances);
          console.log('[DalyDCA] Using cached portfolio balances');
        } catch (parseError) {
          console.error('[DalyDCA] Failed to parse cached balances:', parseError);
        }
      }
    }
  };

  const fetchTrendData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.api.mainUrl}/market/quantify-crypto/enhanced-trends?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Convert array to Map for fast lookups
        const trendMap = new Map();
        data.trends?.forEach((trend: any) => {
          if (trend.symbol) {
            trendMap.set(trend.symbol, trend);
          }
        });
        setTrendData(trendMap);
        console.log('[DalyDCA] Fetched trend data for', trendMap.size, 'symbols');
      }
    } catch (error) {
      console.error('[DalyDCA] Failed to fetch trend data:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDCABots(),
        fetchPendingOrders(),
        fetchPortfolioBalances(),
        fetchTrendData(),
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
        exitPercentage: 90,
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
      if (bot.status === 'active' || bot.status === 'exiting') {
        await pauseDCABot(bot.id);
      } else if (bot.status === 'paused' || bot.status === 'completed' || bot.status === 'stopped') {
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

  const handleManualExit = async (botId: string, symbol: string) => {
    if (window.confirm(`Are you sure you want to manually exit ${symbol}? This will sell all current holdings back to USD.`)) {
      try {
        setExecuting(true);

        // Get auth token
        const token = localStorage.getItem('auth_token');
        if (!token) {
          alert('Please log in again - session expired');
          setExecuting(false);
          return;
        }

        // Get Kraken API keys using the same logic as manual trades
        const getApiKeys = (): { apiKey: string; apiSecret: string } | null => {
          try {
            const keysJson = localStorage.getItem('kraken_api_keys');
            if (!keysJson) return null;

            const keys = JSON.parse(keysJson);
            if (!Array.isArray(keys)) return null;

            // Try primary, fallback1, fallback2 in order
            for (const keyType of ['primary', 'fallback1', 'fallback2']) {
              const key = keys.find((k) => k.type === keyType);
              if (key?.apiKey && key?.apiSecret && key.isActive) {
                return { apiKey: key.apiKey, apiSecret: key.apiSecret };
              }
            }
            return null;
          } catch (error) {
            console.error('[ManualExit] Error reading API keys:', error);
            return null;
          }
        };

        const credentials = getApiKeys();
        if (!credentials) {
          alert('Please set your Kraken API credentials in settings');
          setExecuting(false);
          return;
        }

        const response = await fetch(`${config.api.mainUrl}/dca-bots/${botId}/exit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-kraken-api-key': credentials.apiKey,
            'x-kraken-api-secret': credentials.apiSecret,
          },
        });

        const data = await response.json();

        if (data.success) {
          console.log('Manual exit successful:', data);
          alert(`Exit order created successfully for ${symbol}!\n\nEntries exited: ${data.exitDetails?.entriesExited}\nP&L: $${data.exitDetails?.unrealizedPnL?.toFixed(2)} (${data.exitDetails?.unrealizedPnLPercent?.toFixed(2)}%)`);
          // Refresh bots to show updated status
          await fetchDCABots();
        } else {
          console.error('Manual exit failed:', data.error);
          alert(`Failed to exit ${symbol}: ${data.error}`);
        }
      } catch (error: any) {
        console.error('Failed to manually exit bot:', error);
        alert(`Failed to exit ${symbol}: ${error.message}`);
      } finally {
        setExecuting(false);
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
      exitPercentage: bot.exitPercentage || 90, // Default to 90% if not set
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

  // Helper function to merge bot data with trend data
  const getBotWithTrend = (bot: any) => {
    const trend = trendData.get(bot.symbol);
    if (trend) {
      return {
        ...bot,
        techScore: trend.technical_score || bot.techScore || 50,
        trendScore: trend.trend_score || bot.trendScore || 50,
        recommendation: trend.recommendation || bot.recommendation || 'neutral',
      };
    }
    return bot;
  };

  const getNextActionMessage = (bot: any) => {
    // Merge with trend data to get latest scores
    const botWithTrend = getBotWithTrend(bot);

    if (botWithTrend.status !== 'active') {
      return { message: 'Bot is paused', color: 'text-yellow-500' };
    }

    if (botWithTrend.currentEntryCount >= botWithTrend.reEntryCount) {
      return { message: 'Max entries reached', color: 'text-orange-500' };
    }

    // Check trend alignment if enabled (applies to BOTH first entry and re-entries)
    if (botWithTrend.trendAlignmentEnabled && (botWithTrend.techScore < 50 || botWithTrend.trendScore < 50)) {
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

      // Check if price condition is met (ONLY for re-entries)
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

  // Helper function to enrich bot data with Portfolio balance data
  const getEnrichedBotData = (bot: any) => {
    // Extract the base asset from the symbol (e.g., "BTC" from "BTC/USD")
    const baseAsset = bot.symbol.split('/')[0];

    // Find the portfolio balance for this asset
    const portfolioBalance = portfolioBalances.find(b =>
      b.asset.toUpperCase() === baseAsset.toUpperCase() ||
      b.asset.replace(/^X/, '').toUpperCase() === baseAsset.toUpperCase() ||
      b.symbol === bot.symbol
    );

    // Get current price from live prices
    const livePrice = livePrices.get(bot.symbol);
    const currentPrice = livePrice?.price || bot.currentPrice || 0;

    // Use portfolio data if available, otherwise fall back to bot data
    const actualHoldings = portfolioBalance?.amount || 0;
    const currentValue = actualHoldings * currentPrice;

    // Get the average purchase price from bot (calculated from all filled entries)
    const botAveragePurchasePrice = bot.averagePurchasePrice || 0;

    // Calculate invested amount based on CURRENT holdings, not all entries
    // This accounts for partial sells or manual exits
    // Invested = Current Holdings × Average Purchase Price
    const totalInvested = actualHoldings * botAveragePurchasePrice;

    // Average price stays the same (from bot's buy entries)
    const averagePurchasePrice = botAveragePurchasePrice;

    // Calculate P&L from actual holdings and current price
    const unrealizedPnL = currentValue - totalInvested;
    const unrealizedPnLPercent = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

    return {
      ...bot,
      // Override with Portfolio-based data
      totalQuantity: actualHoldings,
      currentPrice,
      currentValue,
      totalInvested, // Recalculated based on current holdings
      averagePurchasePrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      // Flag to indicate if we're using portfolio data
      usingPortfolioData: !!portfolioBalance,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'paused':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'exiting':
        return 'text-orange-500 bg-orange-500/10';
      case 'completed':
        return 'text-blue-500 bg-blue-500/10';
      case 'stopped':
        return 'text-gray-500 bg-gray-500/10';
      case 'waiting_for_exit':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getDisplayStatus = (bot: any): { status: string; displayText: string } => {
    const livePrice = livePrices.get(bot.symbol);
    const currentPrice = livePrice?.price || bot.currentPrice || 0;

    // Check if bot is above TP and still active (waiting for bearish trend)
    if (bot.status === 'active' && bot.currentTpPrice && currentPrice >= bot.currentTpPrice) {
      return { status: 'waiting_for_exit', displayText: 'Waiting for Exit' };
    }

    // Return normal status with capitalized display text
    return {
      status: bot.status,
      displayText: bot.status.charAt(0).toUpperCase() + bot.status.slice(1)
    };
  };

  const getTrendDisplay = (recommendation?: 'bullish' | 'bearish' | 'neutral') => {
    switch (recommendation) {
      case 'bullish':
        return {
          label: 'BULLISH',
          icon: TrendingUp,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/50',
        };
      case 'bearish':
        return {
          label: 'BEARISH',
          icon: TrendingDown,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/50',
        };
      case 'neutral':
      default:
        return {
          label: 'NEUTRAL',
          icon: Activity,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/20',
          borderColor: 'border-gray-500/50',
        };
    }
  };

  // Enrich all bots with Portfolio data first
  const enrichedBots = dcaBots.map(bot => getEnrichedBotData(bot));

  const activeBots = enrichedBots.filter((bot) => bot.status === 'active');
  const pausedBots = enrichedBots.filter((bot) => bot.status === 'paused');
  const completedBots = enrichedBots.filter((bot) => bot.status === 'completed');
  const totalInvested = enrichedBots.reduce((sum, bot) => sum + (bot.totalInvested || 0), 0);
  const totalUnrealizedPnL = enrichedBots.reduce((sum, bot) => sum + (bot.unrealizedPnL || 0), 0);
  const totalCurrentValue = totalInvested + totalUnrealizedPnL;
  const totalPnLPercent = totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0;

  // Sort enriched bots based on selected criteria
  const sortedBots = [...enrichedBots].sort((a, b) => {
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
              {/* Symbol Selection - Multi-select Dropdown */}
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

                {/* Custom Multi-select Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
                    className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600/50 text-left text-white text-sm font-medium hover:bg-slate-700/70 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedSymbols.length > 0
                        ? selectedSymbols.slice(0, 3).map(s => s.replace('/USD', '')).join(', ') +
                          (selectedSymbols.length > 3 ? ` +${selectedSymbols.length - 3} more` : '')
                        : 'Select trading pairs'}
                    </span>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isSymbolDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isSymbolDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 rounded-lg bg-slate-800 border border-slate-600/50 shadow-xl max-h-80 overflow-y-auto">
                      {availableSymbols.map((symbol) => {
                        const activeBotCount = dcaBots.filter(
                          (bot) => bot.symbol === symbol && bot.status === 'active'
                        ).length;
                        const isSelected = selectedSymbols.includes(symbol);

                        return (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() => toggleSymbol(symbol)}
                            className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-slate-700/50 transition-colors ${
                              isSelected ? 'bg-primary-500/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-primary-500 border-primary-500' : 'border-slate-600'
                              }`}>
                                {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                              </div>
                              <span className="text-sm font-medium text-white">
                                {symbol.replace('/USD', '')}
                              </span>
                            </div>
                            {activeBotCount > 0 && (
                              <span className="text-xs text-gray-400 bg-slate-700/50 px-2 py-0.5 rounded">
                                {activeBotCount} active
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
              // Merge with trend data to show latest market trends
              const botWithTrend = getBotWithTrend(bot);
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
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(getDisplayStatus(bot).status)}`}>
                          {getDisplayStatus(bot).displayText}
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
                          title={bot.status === 'active' || bot.status === 'exiting' ? 'Pause bot' : 'Resume bot'}
                        >
                          {bot.status === 'active' || bot.status === 'exiting' ? (
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
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Invested</p>
                          <p className="font-semibold text-white">{formatCurrency(bot.totalInvested || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Holdings</p>
                          <p className="font-semibold text-purple-400">
                            {bot.totalQuantity ? bot.totalQuantity.toFixed(6) : '0.000000'}
                          </p>
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
                          <p className="text-xs text-gray-500">Market Trend</p>
                          {(() => {
                            const trend = getTrendDisplay(botWithTrend.recommendation);
                            const TrendIcon = trend.icon;
                            return (
                              <div className={`flex items-center gap-1 px-2 py-1 rounded ${trend.bgColor} border ${trend.borderColor}`}>
                                <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                                <span className={`text-xs font-bold ${trend.color}`}>
                                  {trend.label}
                                </span>
                              </div>
                            );
                          })()}
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

                    {/* Exit Status Indicators */}
                    {/* Auto-Retry in Progress (exiting with failure reason) */}
                    {bot.status === 'exiting' && bot.exitFailureReason && (
                      <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                        <div className="flex items-start gap-2">
                          <RefreshCw className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5 animate-spin" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-yellow-400 mb-1">Auto-Retrying Exit Order</h4>
                            <p className="text-xs text-yellow-300 mb-2">{bot.exitFailureReason}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              {bot.exitFailureTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Last attempt: {new Date(bot.exitFailureTime).toLocaleString()}
                                </span>
                              )}
                              {bot.exitAttempts && (
                                <span>Retry #{bot.exitAttempts}</span>
                              )}
                            </div>
                            <p className="text-xs text-yellow-400 mt-2">
                              System will automatically retry until success. No action needed.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Permanent Failure - Requires Manual Retry */}
                    {bot.status === 'exit_failed' && bot.exitFailureReason && (
                      <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-red-400 mb-1">Exit Order Failed (Manual Retry Required)</h4>
                            <p className="text-xs text-red-300 mb-2">{bot.exitFailureReason}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                              {bot.exitFailureTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(bot.exitFailureTime).toLocaleString()}
                                </span>
                              )}
                              {bot.exitAttempts && (
                                <span>Failed attempts: {bot.exitAttempts}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mb-3">
                              This error cannot be auto-retried. Please fix the issue and click retry.
                            </p>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const response = await fetch(`${config.api.mainUrl}/dca-bots/${bot.id}/retry-exit`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                      'x-kraken-api-key': localStorage.getItem('krakenApiKey') || '',
                                      'x-kraken-api-secret': localStorage.getItem('krakenApiSecret') || '',
                                    },
                                  });

                                  if (response.ok) {
                                    fetchDCABots();
                                    alert('Exit retry initiated successfully');
                                  } else {
                                    const error = await response.json();
                                    alert(`Retry failed: ${error.error}`);
                                  }
                                } catch (error: any) {
                                  alert(`Error: ${error.message}`);
                                }
                              }}
                              className="btn btn-sm bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry Exit
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Invested</p>
                            <p className="text-lg font-bold text-white">{formatCurrency(bot.totalInvested || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Holdings</p>
                            <p className="text-lg font-bold text-purple-400">
                              {bot.totalQuantity ? bot.totalQuantity.toFixed(6) : '0.000000'}
                            </p>
                            <p className="text-xs text-gray-500">{bot.symbol.split('/')[0]}</p>
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
                            <p className="text-xs text-gray-400 mb-2">Market Trend</p>
                            {(() => {
                              const trend = getTrendDisplay(botWithTrend.recommendation);
                              const TrendIcon = trend.icon;
                              return (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${trend.bgColor} border ${trend.borderColor}`}>
                                  <TrendIcon className={`h-5 w-5 ${trend.color}`} />
                                  <span className={`text-sm font-bold ${trend.color}`}>
                                    {trend.label}
                                  </span>
                                </div>
                              );
                            })()}
                            <div className="mt-2 flex gap-2 text-xs text-gray-500">
                              <span>Tech: <span className={(botWithTrend.techScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}>{botWithTrend.techScore || 0}</span></span>
                              <span>•</span>
                              <span>Trend: <span className={(botWithTrend.trendScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}>{botWithTrend.trendScore || 0}</span></span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Current Price</p>
                            <p className="text-lg font-bold text-white">
                              {formatCurrency(bot.currentPrice || 0)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {bot.currentPrice > bot.averagePurchasePrice ? '↑' : '↓'} from avg
                            </p>
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
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Exit % (Sell on exit)</label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max="100"
                                value={editFormData.exitPercentage}
                                onChange={(e) => setEditFormData({ ...editFormData, exitPercentage: parseInt(e.target.value) })}
                                className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">Keep {100 - (editFormData.exitPercentage || 90)}%</p>
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
                        {!isEditing && bot.currentEntryCount > 0 && (
                          <button
                            onClick={() => handleManualExit(bot.id, bot.symbol)}
                            disabled={executing}
                            className="btn btn-warning btn-sm flex items-center gap-2"
                            title="Manually exit all positions"
                          >
                            <LogOut className="h-3 w-3" />
                            {executing ? 'Exiting...' : 'Exit Position'}
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
                  <th className="text-left py-3 px-2 font-medium">Error</th>
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
                    <td className="py-3 px-2 text-xs">
                      {order.status === 'failed' || order.status === 'retry' ? (
                        <span className="text-red-400" title={order.lastError || 'Unknown error'}>
                          {order.lastError ? (order.lastError.length > 50 ? order.lastError.substring(0, 50) + '...' : order.lastError) : '-'}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
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
