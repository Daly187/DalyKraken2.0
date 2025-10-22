import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { apiService } from '@/services/apiService';
import { globalPriceManager } from '@/services/globalPriceManager';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Clock,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  BarChart3,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Settings,
  Edit,
  Save,
  X,
  Plus,
  ShieldAlert,
  TrendingDownUp,
  Wallet,
  Eye,
  EyeOff,
} from 'lucide-react';

interface StablecoinPrice {
  pair: string;
  symbol: string;
  currentPrice: number;
  pegPrice: number;
  depegPercentage: number;
  depegAmount: number;
  volume24h: number;
  priceChange24h: number;
  lastUpdate: string;
  bid: number;
  ask: number;
  spread: number;
  liquidityDepth: number;
}

interface DepegOpportunity {
  id: string;
  pair: string;
  type: 'buy' | 'sell';
  entryPrice: number;
  targetPrice: number;
  depegPercentage: number;
  estimatedProfit: number;
  estimatedProfitPercent: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  detectedAt: string;
  status: 'pending' | 'active' | 'monitoring';
}

interface ActivePosition {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  quantity: number;
  investedAmount: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: string;
  duration: string;
  status: 'open' | 'closing';
}

interface TradeHistory {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  profit: number;
  profitPercent: number;
  fees: number;
  netProfit: number;
  duration: string;
  openedAt: string;
  closedAt: string;
}

interface StrategyConfig {
  enabled: boolean;
  autoExecute: boolean;
  minDepegThreshold: number;
  maxDepegThreshold: number;
  maxAllocationPercent: number;
  maxPositionSize: number;
  minProfitTarget: number;
  stopLossPercent: number;
  slippageTolerance: number;
  feeTierPercent: number;
  enabledPairs: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export default function DalyDEPEG() {
  // State for live price monitoring
  const [stablecoinPrices, setStablecoinPrices] = useState<StablecoinPrice[]>([]);
  const [opportunities, setOpportunities] = useState<DepegOpportunity[]>([]);
  const [activePositions, setActivePositions] = useState<ActivePosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [expandedOpportunityId, setExpandedOpportunityId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Section visibility
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const [isMonitoringExpanded, setIsMonitoringExpanded] = useState(true);
  const [isOpportunitiesExpanded, setIsOpportunitiesExpanded] = useState(true);
  const [isPositionsExpanded, setIsPositionsExpanded] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

  // Strategy Configuration
  const [config, setConfig] = useState<StrategyConfig>({
    enabled: false,
    autoExecute: false,
    minDepegThreshold: 0.5,
    maxDepegThreshold: 5.0,
    maxAllocationPercent: 50,
    maxPositionSize: 10000,
    minProfitTarget: 0.5,
    stopLossPercent: 3.0,
    slippageTolerance: 0.1,
    feeTierPercent: 0.26,
    enabledPairs: ['USDT/USD', 'USDC/USD', 'DAI/USD', 'PYUSD/USD'],
    riskLevel: 'moderate',
  });

  // Available stablecoin pairs
  const availableStablecoinPairs = [
    'USDT/USD',
    'USDC/USD',
    'DAI/USD',
    'PYUSD/USD',
    'TUSD/USD',
    'USDD/USD',
  ];

  // Mock data for demonstration
  const mockStablecoinPrices: StablecoinPrice[] = [
    {
      pair: 'USDT/USD',
      symbol: 'USDT',
      currentPrice: 0.9965,
      pegPrice: 1.0,
      depegPercentage: -0.35,
      depegAmount: -0.0035,
      volume24h: 1250000000,
      priceChange24h: -0.15,
      lastUpdate: new Date().toISOString(),
      bid: 0.9964,
      ask: 0.9966,
      spread: 0.0002,
      liquidityDepth: 500000,
    },
    {
      pair: 'USDC/USD',
      symbol: 'USDC',
      currentPrice: 0.9945,
      pegPrice: 1.0,
      depegPercentage: -0.55,
      depegAmount: -0.0055,
      volume24h: 980000000,
      priceChange24h: -0.25,
      lastUpdate: new Date().toISOString(),
      bid: 0.9943,
      ask: 0.9947,
      spread: 0.0004,
      liquidityDepth: 750000,
    },
    {
      pair: 'DAI/USD',
      symbol: 'DAI',
      currentPrice: 1.0015,
      pegPrice: 1.0,
      depegPercentage: 0.15,
      depegAmount: 0.0015,
      volume24h: 450000000,
      priceChange24h: 0.08,
      lastUpdate: new Date().toISOString(),
      bid: 1.0013,
      ask: 1.0017,
      spread: 0.0004,
      liquidityDepth: 300000,
    },
    {
      pair: 'PYUSD/USD',
      symbol: 'PYUSD',
      currentPrice: 0.9990,
      pegPrice: 1.0,
      depegPercentage: -0.10,
      depegAmount: -0.0010,
      volume24h: 125000000,
      priceChange24h: -0.05,
      lastUpdate: new Date().toISOString(),
      bid: 0.9988,
      ask: 0.9992,
      spread: 0.0004,
      liquidityDepth: 150000,
    },
  ];

  const mockOpportunities: DepegOpportunity[] = [
    {
      id: '1',
      pair: 'USDC/USD',
      type: 'buy',
      entryPrice: 0.9945,
      targetPrice: 1.0000,
      depegPercentage: -0.55,
      estimatedProfit: 55.0,
      estimatedProfitPercent: 0.55,
      riskLevel: 'low',
      confidence: 95,
      detectedAt: new Date(Date.now() - 300000).toISOString(),
      status: 'pending',
    },
    {
      id: '2',
      pair: 'USDT/USD',
      type: 'buy',
      entryPrice: 0.9965,
      targetPrice: 1.0000,
      depegPercentage: -0.35,
      estimatedProfit: 35.0,
      estimatedProfitPercent: 0.35,
      riskLevel: 'low',
      confidence: 90,
      detectedAt: new Date(Date.now() - 180000).toISOString(),
      status: 'monitoring',
    },
  ];

  const mockActivePositions: ActivePosition[] = [
    {
      id: '1',
      pair: 'USDT/USD',
      side: 'buy',
      entryPrice: 0.9950,
      currentPrice: 0.9965,
      targetPrice: 1.0000,
      quantity: 10050.25,
      investedAmount: 10000,
      currentValue: 10015.07,
      unrealizedPnL: 15.07,
      unrealizedPnLPercent: 0.15,
      openedAt: new Date(Date.now() - 900000).toISOString(),
      duration: '15m',
      status: 'open',
    },
  ];

  const mockTradeHistory: TradeHistory[] = [
    {
      id: '1',
      pair: 'USDC/USD',
      side: 'buy',
      entryPrice: 0.9935,
      exitPrice: 0.9995,
      quantity: 10065.51,
      profit: 60.39,
      profitPercent: 0.60,
      fees: 52.00,
      netProfit: 8.39,
      duration: '23m',
      openedAt: new Date(Date.now() - 7200000).toISOString(),
      closedAt: new Date(Date.now() - 5820000).toISOString(),
    },
    {
      id: '2',
      pair: 'USDT/USD',
      side: 'buy',
      entryPrice: 0.9960,
      exitPrice: 1.0005,
      quantity: 10040.16,
      profit: 45.18,
      profitPercent: 0.45,
      fees: 52.00,
      netProfit: -6.82,
      duration: '8m',
      openedAt: new Date(Date.now() - 14400000).toISOString(),
      closedAt: new Date(Date.now() - 13920000).toISOString(),
    },
    {
      id: '3',
      pair: 'DAI/USD',
      side: 'sell',
      entryPrice: 1.0120,
      exitPrice: 1.0010,
      quantity: 9881.42,
      profit: 108.70,
      profitPercent: 1.09,
      fees: 52.00,
      netProfit: 56.70,
      duration: '1h 12m',
      openedAt: new Date(Date.now() - 86400000).toISOString(),
      closedAt: new Date(Date.now() - 82080000).toISOString(),
    },
  ];

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 seconds for live monitoring
    const refreshInterval = setInterval(() => {
      if (config.enabled) {
        console.log('[DalyDEPEG] Auto-refreshing depeg data...');
        loadData();
      }
    }, 5 * 1000);

    return () => clearInterval(refreshInterval);
  }, [config.enabled]);

  // Auto-save config changes with debounce
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      saveConfig(config);
    }, 1000); // Debounce 1 second

    return () => clearTimeout(saveTimeout);
  }, [
    config.minDepegThreshold,
    config.maxDepegThreshold,
    config.maxAllocationPercent,
    config.maxPositionSize,
    config.minProfitTarget,
    config.stopLossPercent,
    config.slippageTolerance,
    config.autoExecute,
    config.enabledPairs,
    config.riskLevel,
  ]);

  // Subscribe to live price updates via WebSocket
  useEffect(() => {
    const stablecoinPairs = ['USDTZUSD', 'USDCZUSD', 'DAIUSD', 'PYUSDUSD'];

    // Subscribe to price updates for each stablecoin
    const unsubscribes = stablecoinPairs.map(pair => {
      return globalPriceManager.subscribeToPrice(pair, (priceData) => {
        setStablecoinPrices(prev => {
          const updated = [...prev];
          const index = updated.findIndex(p => p.pair === pair.replace('ZUSD', '/USD').replace('USD', '/USD'));
          if (index !== -1 && priceData) {
            const currentPrice = priceData.last || priceData.c?.[0] || updated[index].currentPrice;
            const depegPercentage = ((currentPrice - 1.0) / 1.0) * 100;
            updated[index] = {
              ...updated[index],
              currentPrice,
              depegPercentage,
              depegAmount: currentPrice - 1.0,
              bid: priceData.b?.[0] || updated[index].bid,
              ask: priceData.a?.[0] || updated[index].ask,
              spread: priceData.a?.[0] && priceData.b?.[0] ? priceData.a[0] - priceData.b[0] : updated[index].spread,
              volume24h: priceData.v?.[1] || updated[index].volume24h,
              lastUpdate: new Date().toISOString(),
            };
          }
          return updated;
        });
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[DalyDEPEG] Loading live depeg data from API...');

      // Load configuration first
      try {
        const configResponse = await apiService.getDepegConfig();
        if (configResponse.success && configResponse.config) {
          setConfig(configResponse.config);
          console.log('[DalyDEPEG] Loaded config:', configResponse.config);
        }
      } catch (configError) {
        console.warn('[DalyDEPEG] No existing config, using defaults');
      }

      // Load prices
      const pricesResponse = await apiService.getDepegPrices();
      if (pricesResponse.success && pricesResponse.prices) {
        setStablecoinPrices(pricesResponse.prices);
        console.log('[DalyDEPEG] Loaded prices:', pricesResponse.prices.length);
      }

      // Load opportunities
      const opportunitiesResponse = await apiService.getDepegOpportunities();
      if (opportunitiesResponse.success && opportunitiesResponse.opportunities) {
        setOpportunities(opportunitiesResponse.opportunities);
        console.log('[DalyDEPEG] Loaded opportunities:', opportunitiesResponse.opportunities.length);
      }

      // Load active positions
      const positionsResponse = await apiService.getDepegPositions();
      if (positionsResponse.success && positionsResponse.positions) {
        setActivePositions(positionsResponse.positions);
        console.log('[DalyDEPEG] Loaded positions:', positionsResponse.positions.length);
      }

      // Load trade history
      const historyResponse = await apiService.getDepegHistory(50);
      if (historyResponse.success && historyResponse.history) {
        setTradeHistory(historyResponse.history);
        console.log('[DalyDEPEG] Loaded history:', historyResponse.history.length);
      }

      setLastRefreshTime(new Date());
    } catch (error: any) {
      console.error('[DalyDEPEG] Failed to load depeg data:', error);

      // Fall back to mock data if API fails
      console.log('[DalyDEPEG] Falling back to mock data for demonstration');
      setStablecoinPrices(mockStablecoinPrices);
      setOpportunities(mockOpportunities);
      setActivePositions(mockActivePositions);
      setTradeHistory(mockTradeHistory);

      useStore.getState().addNotification({
        type: 'warning',
        title: 'Using Demo Data',
        message: 'Could not connect to API. Showing demonstration data.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      useStore.getState().addNotification({
        type: 'success',
        title: 'Refreshed',
        message: 'Depeg data updated successfully',
      });
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const saveConfig = async (newConfig: StrategyConfig) => {
    try {
      const response = await apiService.updateDepegConfig(newConfig);
      if (response.success) {
        console.log('[DalyDEPEG] Config saved successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[DalyDEPEG] Failed to save config:', error);
      return false;
    }
  };

  const handleToggleStrategy = async () => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);

    // Save to API
    await saveConfig(newConfig);

    useStore.getState().addNotification({
      type: config.enabled ? 'warning' : 'success',
      title: config.enabled ? 'Strategy Stopped' : 'Strategy Started',
      message: config.enabled ? 'Depeg arbitrage monitoring stopped' : 'Depeg arbitrage monitoring active',
    });
  };

  const handleExecuteTrade = async (opportunity: DepegOpportunity) => {
    useStore.getState().addNotification({
      type: 'info',
      title: 'Executing Trade',
      message: `${opportunity.type.toUpperCase()} ${opportunity.pair} at $${opportunity.entryPrice.toFixed(4)}`,
    });

    try {
      const response = await apiService.executeDepegTrade({
        pair: opportunity.pair,
        entryPrice: opportunity.entryPrice,
        targetPrice: opportunity.targetPrice,
        type: opportunity.type,
      });

      if (response.success) {
        useStore.getState().addNotification({
          type: 'success',
          title: 'Trade Executed',
          message: `Position opened for ${opportunity.pair}`,
        });
        await loadData();
      } else {
        throw new Error(response.error || 'Failed to execute trade');
      }
    } catch (error: any) {
      console.error('[DalyDEPEG] Failed to execute trade:', error);
      useStore.getState().addNotification({
        type: 'error',
        title: 'Trade Failed',
        message: error.message || 'Failed to execute trade',
      });
    }
  };

  const handleClosePosition = async (position: ActivePosition) => {
    useStore.getState().addNotification({
      type: 'info',
      title: 'Closing Position',
      message: `Closing ${position.pair} position...`,
    });

    try {
      const response = await apiService.closeDepegPosition(position.id);

      if (response.success) {
        const closedPosition = response.position;
        const finalPnL = closedPosition.realizedPnL || position.unrealizedPnL;

        useStore.getState().addNotification({
          type: finalPnL >= 0 ? 'success' : 'warning',
          title: 'Position Closed',
          message: `${position.pair} closed with ${finalPnL >= 0 ? '+' : ''}$${finalPnL.toFixed(2)} P&L`,
        });
        await loadData();
      } else {
        throw new Error(response.error || 'Failed to close position');
      }
    } catch (error: any) {
      console.error('[DalyDEPEG] Failed to close position:', error);
      useStore.getState().addNotification({
        type: 'error',
        title: 'Close Failed',
        message: error.message || 'Failed to close position',
      });
    }
  };

  const togglePair = (pair: string) => {
    setConfig({
      ...config,
      enabledPairs: config.enabledPairs.includes(pair)
        ? config.enabledPairs.filter(p => p !== pair)
        : [...config.enabledPairs, pair],
    });
  };

  const getDepegColor = (percentage: number) => {
    const abs = Math.abs(percentage);
    if (abs >= 2.0) return 'text-red-500';
    if (abs >= 1.0) return 'text-orange-500';
    if (abs >= 0.5) return 'text-yellow-500';
    if (abs >= 0.3) return 'text-blue-400';
    return 'text-green-400';
  };

  const getDepegBgColor = (percentage: number) => {
    const abs = Math.abs(percentage);
    if (abs >= 2.0) return 'bg-red-500/10 border-red-500/20';
    if (abs >= 1.0) return 'bg-orange-500/10 border-orange-500/20';
    if (abs >= 0.5) return 'bg-yellow-500/10 border-yellow-500/20';
    if (abs >= 0.3) return 'bg-blue-500/10 border-blue-500/20';
    return 'bg-green-500/10 border-green-500/20';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-500 bg-red-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'low': return 'text-green-500 bg-green-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatVolume = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate summary stats
  const totalPnL = activePositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalInvested = activePositions.reduce((sum, pos) => sum + pos.investedAmount, 0);
  const totalHistoricalPnL = tradeHistory.reduce((sum, trade) => sum + trade.netProfit, 0);
  const winRate = tradeHistory.length > 0
    ? (tradeHistory.filter(t => t.netProfit > 0).length / tradeHistory.length) * 100
    : 0;
  const avgProfit = tradeHistory.length > 0
    ? tradeHistory.reduce((sum, t) => sum + t.netProfit, 0) / tradeHistory.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
            DalyDEPEG Arbitrage
          </h1>
          <p className="text-sm text-gray-400 mt-1">Automated Stablecoin Mean Reversion Strategy</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStrategy}
            className={`btn flex items-center gap-2 ${
              config.enabled
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {config.enabled ? (
              <>
                <Pause className="h-5 w-5" />
                Stop Strategy
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Start Strategy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-primary-500/10 to-purple-600/5 border-primary-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Strategy Status</p>
              <p className="text-2xl font-bold text-white">{config.enabled ? 'ACTIVE' : 'PAUSED'}</p>
              <p className="text-xs text-gray-500 mt-1">
                {opportunities.length} opportunities
              </p>
            </div>
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
              config.enabled ? 'bg-green-500/20' : 'bg-gray-500/20'
            }`}>
              {config.enabled ? (
                <Activity className="h-7 w-7 text-green-400 animate-pulse" />
              ) : (
                <Pause className="h-7 w-7 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Positions</p>
              <p className="text-2xl font-bold text-white">{activePositions.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(totalInvested)} deployed
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-blue-400" />
            </div>
          </div>
        </div>

        <div className={`card ${totalPnL >= 0
          ? 'bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20'
          : 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Open P&L</p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
              <p className={`text-xs font-semibold mt-1 ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalInvested > 0 ? `${((totalPnL / totalInvested) * 100).toFixed(2)}%` : '0.00%'}
              </p>
            </div>
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
              totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {totalPnL >= 0 ? (
                <TrendingUp className="h-7 w-7 text-green-400" />
              ) : (
                <TrendingDown className="h-7 w-7 text-red-400" />
              )}
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500/10 to-pink-600/5 border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total P&L</p>
              <p className={`text-2xl font-bold ${totalHistoricalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalHistoricalPnL >= 0 ? '+' : ''}{formatCurrency(totalHistoricalPnL)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {tradeHistory.length} trades • {winRate.toFixed(0)}% win rate
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <BarChart3 className="h-7 w-7 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Configuration */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                {isConfigExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              <div>
                <h2 className="text-xl font-bold">Strategy Configuration</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Fine-tune arbitrage parameters for optimal performance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50">
                <div className={`h-2 w-2 rounded-full ${config.autoExecute ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">
                  Auto-Execute: {config.autoExecute ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {isConfigExpanded && (
            <div className="space-y-6">
              {/* Risk & Execution Settings */}
              <div className="grid md:grid-cols-3 gap-5">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="h-4 w-4 text-primary-400" />
                    Min Depeg Threshold
                    <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      value={config.minDepegThreshold}
                      onChange={(e) => setConfig({ ...config, minDepegThreshold: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum price deviation to trigger trade</p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    Stop Loss Threshold
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={config.stopLossPercent}
                      onChange={(e) => setConfig({ ...config, stopLossPercent: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Max loss before forced exit</p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    Min Profit Target
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="2"
                      value={config.minProfitTarget}
                      onChange={(e) => setConfig({ ...config, minProfitTarget: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum profit after fees</p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Wallet className="h-4 w-4 text-blue-400" />
                    Max Allocation
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      min="10"
                      max="100"
                      value={config.maxAllocationPercent}
                      onChange={(e) => setConfig({ ...config, maxAllocationPercent: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">% of USD balance to deploy</p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="h-4 w-4 text-purple-400" />
                    Max Position Size
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="1000"
                      min="100"
                      value={config.maxPositionSize}
                      onChange={(e) => setConfig({ ...config, maxPositionSize: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Maximum USD per trade</p>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Activity className="h-4 w-4 text-orange-400" />
                    Slippage Tolerance
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={config.slippageTolerance}
                      onChange={(e) => setConfig({ ...config, slippageTolerance: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Max acceptable slippage</p>
                </div>
              </div>

              {/* Enabled Pairs Selection */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                      <TrendingDownUp className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white">
                        Enabled Stablecoin Pairs
                      </label>
                      <p className="text-xs text-gray-400">
                        <span className="text-primary-400 font-medium">{config.enabledPairs.length}</span> of {availableStablecoinPairs.length} selected
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {availableStablecoinPairs.map((pair) => (
                    <button
                      key={pair}
                      type="button"
                      onClick={() => togglePair(pair)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                        config.enabledPairs.includes(pair)
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 scale-105'
                          : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50 hover:text-gray-300'
                      }`}
                    >
                      {pair.replace('/USD', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-600/30 hover:border-slate-500/50 transition-colors">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.autoExecute}
                      onChange={(e) => setConfig({ ...config, autoExecute: e.target.checked })}
                      className="mt-1 h-5 w-5 rounded-lg bg-slate-700 border-slate-600 text-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm font-medium text-white">Auto-Execute Trades</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Automatically execute trades when opportunities meet criteria
                      </p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      config.autoExecute
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-slate-700 text-gray-500'
                    }`}>
                      {config.autoExecute ? 'ON' : 'OFF'}
                    </div>
                  </label>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-600/30">
                  <div className="flex items-start gap-4">
                    <Settings className="h-5 w-5 text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">Risk Level</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {['conservative', 'moderate', 'aggressive'].map((level) => (
                          <button
                            key={level}
                            onClick={() => setConfig({ ...config, riskLevel: level as any })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              config.riskLevel === level
                                ? 'bg-primary-500/20 text-primary-300'
                                : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'
                            }`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Price Monitoring */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsMonitoringExpanded(!isMonitoringExpanded)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isMonitoringExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Live Price Monitor
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-medium flex items-center gap-1">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Real-time monitoring • Updated {lastRefreshTime.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isMonitoringExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-gray-400">
                  <th className="text-left py-3 px-2 font-medium">Pair</th>
                  <th className="text-right py-3 px-2 font-medium">Current Price</th>
                  <th className="text-right py-3 px-2 font-medium">Peg</th>
                  <th className="text-right py-3 px-2 font-medium">Depeg %</th>
                  <th className="text-right py-3 px-2 font-medium">Depeg $</th>
                  <th className="text-right py-3 px-2 font-medium">24h Vol</th>
                  <th className="text-right py-3 px-2 font-medium">Spread</th>
                  <th className="text-right py-3 px-2 font-medium">Liquidity</th>
                  <th className="text-center py-3 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stablecoinPrices
                  .filter(price => config.enabledPairs.includes(price.pair))
                  .map((price) => {
                    const isOpportunity = Math.abs(price.depegPercentage) >= config.minDepegThreshold;

                    return (
                      <tr
                        key={price.pair}
                        className={`border-b border-slate-800 hover:bg-slate-800/30 transition-colors ${
                          isOpportunity ? 'bg-yellow-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{price.symbol}</span>
                            <span className="text-xs text-gray-500">/USD</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-semibold ${getDepegColor(price.depegPercentage)}`}>
                            {formatCurrency(price.currentPrice)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400">
                          {formatCurrency(price.pegPrice)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-bold ${getDepegColor(price.depegPercentage)}`}>
                            {price.depegPercentage >= 0 ? '+' : ''}{price.depegPercentage.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={getDepegColor(price.depegPercentage)}>
                            {price.depegAmount >= 0 ? '+' : ''}{formatCurrency(Math.abs(price.depegAmount))}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300">
                          {formatVolume(price.volume24h)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400">
                          {(price.spread * 100).toFixed(3)}%
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400">
                          {formatVolume(price.liquidityDepth)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isOpportunity ? (
                            <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-medium">
                              OPPORTUNITY
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                              STABLE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detected Opportunities */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsOpportunitiesExpanded(!isOpportunitiesExpanded)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isOpportunitiesExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Arbitrage Opportunities
                {opportunities.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-medium">
                    {opportunities.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Profitable depeg events ready for execution
              </p>
            </div>
          </div>
        </div>

        {isOpportunitiesExpanded && (
          <>
            {opportunities.length > 0 ? (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="border border-yellow-500/30 rounded-xl bg-gradient-to-br from-yellow-500/5 to-orange-500/5 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-white">{opp.pair}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          opp.type === 'buy' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {opp.type.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(opp.riskLevel)}`}>
                          {opp.riskLevel.toUpperCase()} RISK
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-24 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-400"
                              style={{ width: `${opp.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{opp.confidence}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleExecuteTrade(opp)}
                        disabled={!config.enabled || config.autoExecute}
                        className="btn btn-primary btn-sm flex items-center gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Execute
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Entry Price</p>
                        <p className="font-semibold text-white">{formatCurrency(opp.entryPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Target Price</p>
                        <p className="font-semibold text-green-400">{formatCurrency(opp.targetPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Depeg</p>
                        <p className={`font-bold ${getDepegColor(opp.depegPercentage)}`}>
                          {opp.depegPercentage >= 0 ? '+' : ''}{opp.depegPercentage.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Est. Profit</p>
                        <p className="font-semibold text-green-400">+{formatCurrency(opp.estimatedProfit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Detected</p>
                        <p className="font-semibold text-gray-400">{formatTimestamp(opp.detectedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No opportunities detected</p>
                <p className="text-xs text-gray-500 mt-1">Strategy is monitoring for profitable depeg events</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Active Positions */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsPositionsExpanded(!isPositionsExpanded)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isPositionsExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Active Positions
                {activePositions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium">
                    {activePositions.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Open mean-reversion trades awaiting target
              </p>
            </div>
          </div>
        </div>

        {isPositionsExpanded && (
          <>
            {activePositions.length > 0 ? (
              <div className="space-y-3">
                {activePositions.map((pos) => (
                  <div
                    key={pos.id}
                    className={`border rounded-xl p-4 ${
                      pos.unrealizedPnL >= 0
                        ? 'border-green-500/30 bg-gradient-to-br from-green-500/5 to-green-600/5'
                        : 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-red-600/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-white">{pos.pair}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          pos.side === 'buy' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {pos.side.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {pos.duration}
                        </span>
                      </div>
                      <button
                        onClick={() => handleClosePosition(pos)}
                        className="btn btn-danger btn-sm flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Entry Price</p>
                        <p className="font-semibold text-white">{formatCurrency(pos.entryPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Current Price</p>
                        <p className="font-semibold text-blue-400">{formatCurrency(pos.currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Target Price</p>
                        <p className="font-semibold text-green-400">{formatCurrency(pos.targetPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Quantity</p>
                        <p className="font-semibold text-gray-300">{pos.quantity.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Invested</p>
                        <p className="font-semibold text-white">{formatCurrency(pos.investedAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Unrealized P&L</p>
                        <p className={`font-bold ${pos.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPnL)}
                          <span className="text-xs ml-1">
                            ({pos.unrealizedPnLPercent >= 0 ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(2)}%)
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Progress bar to target */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Progress to Target</span>
                        <span className="text-xs text-gray-400">
                          {((Math.abs(pos.currentPrice - pos.entryPrice) / Math.abs(pos.targetPrice - pos.entryPrice)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${pos.unrealizedPnL >= 0 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                          style={{
                            width: `${Math.min(100, (Math.abs(pos.currentPrice - pos.entryPrice) / Math.abs(pos.targetPrice - pos.entryPrice)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No active positions</p>
                <p className="text-xs text-gray-500 mt-1">Positions will appear here when trades are executed</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Trade History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              {isHistoryExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Trade History
                {tradeHistory.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
                    {tradeHistory.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Completed trades • Win Rate: {winRate.toFixed(0)}% • Avg: {avgProfit >= 0 ? '+' : ''}{formatCurrency(avgProfit)}
              </p>
            </div>
          </div>
        </div>

        {isHistoryExpanded && (
          <>
            {tradeHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-gray-400">
                      <th className="text-left py-3 px-2 font-medium">Pair</th>
                      <th className="text-left py-3 px-2 font-medium">Side</th>
                      <th className="text-right py-3 px-2 font-medium">Entry</th>
                      <th className="text-right py-3 px-2 font-medium">Exit</th>
                      <th className="text-right py-3 px-2 font-medium">Quantity</th>
                      <th className="text-right py-3 px-2 font-medium">Gross P&L</th>
                      <th className="text-right py-3 px-2 font-medium">Fees</th>
                      <th className="text-right py-3 px-2 font-medium">Net P&L</th>
                      <th className="text-left py-3 px-2 font-medium">Duration</th>
                      <th className="text-left py-3 px-2 font-medium">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeHistory.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-3 px-2">
                          <span className="font-medium text-white">{trade.pair}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            trade.side === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300">
                          {formatCurrency(trade.entryPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300">
                          {formatCurrency(trade.exitPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400">
                          {trade.quantity.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500">
                          -{formatCurrency(trade.fees)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-bold ${trade.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.netProfit >= 0 ? '+' : ''}{formatCurrency(trade.netProfit)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-gray-400">
                          {trade.duration}
                        </td>
                        <td className="py-3 px-2 text-gray-400 text-xs">
                          {formatTimestamp(trade.closedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No trade history yet</p>
                <p className="text-xs text-gray-500 mt-1">Completed trades will appear here</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Strategy Info */}
      <div className="card bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary-400" />
          About Stablecoin Depeg Arbitrage
        </h3>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <TrendingDownUp className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Mean Reversion Strategy:</strong> Automatically buys stablecoins when they
              trade below $1.00 and sells when above $1.00, profiting from the inevitable return to peg.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">High-Frequency Monitoring:</strong> Scans live prices every 5 seconds to detect
              depeg events ≥0.5% from $1.00 peg, ensuring you never miss profitable opportunities.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Risk Management:</strong> Built-in stop-loss protection, position sizing limits,
              and slippage controls ensure capital preservation while maximizing returns.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <BarChart3 className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Historical Performance:</strong> Academic research shows ~0.5-1% profit per trade
              after fees, with 3-4 opportunities per month per stablecoin. Strategy works for USDT, USDC, DAI, PYUSD.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
