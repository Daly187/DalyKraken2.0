import { useStore } from '@/store/useStore';
import { krakenApiService } from '@/services/krakenApiService';
import { livePriceService } from '@/services/livePriceService';
import { apiService } from '@/services/apiService';
import { Bell, User, LogOut, DollarSign, TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { LivePrice } from '@/types';

interface Balance {
  asset: string;
  symbol: string;
  amount: number;
  availableBalance: number;
  lockedBalance: number;
}

export default function Header() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const notifications = useStore((state) => state.notifications);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Portfolio state
  const [balances, setBalances] = useState<Balance[]>([]);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());

  // Strategy status state
  const [strategyStatus, setStrategyStatus] = useState<{
    dca: { active: boolean; activeBots: number; totalBots: number };
    depeg: { active: boolean; enabled: boolean; autoExecute: boolean };
  }>({
    dca: { active: false, activeBots: 0, totalBots: 0 },
    depeg: { active: false, enabled: false, autoExecute: false },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    // Subscribe to live prices
    const unsubscribe = livePriceService.subscribe((prices) => {
      setLivePrices(prices);
    });

    // Fetch initial balances and strategy status
    fetchBalances();
    fetchStrategyStatus();

    // Refresh every 60 seconds (increased from 30 to reduce API calls)
    const refreshInterval = setInterval(() => {
      fetchBalances();
      fetchStrategyStatus();
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const fetchBalances = async () => {
    // Don't show loading state to avoid UI flicker
    try {
      const fetchedBalances = await krakenApiService.getAccountBalance();
      setBalances(fetchedBalances);
    } catch (err: any) {
      // Silently fail - the service will use cached/mock data
      // Only log if it's not a rate limit error
      if (!err.message?.includes('Temporary lockout') && !err.message?.includes('rate limit')) {
        console.warn('[Header] Error fetching balances:', err.message);
      }
    }
  };

  const fetchStrategyStatus = async () => {
    try {
      const response = await apiService.getStrategiesStatus();
      if (response.success) {
        setStrategyStatus(response.strategies);
      }
    } catch (err: any) {
      // Silently fail
      console.warn('[Header] Error fetching strategy status:', err.message);
    }
  };

  // Calculate portfolio totals
  const calculatePortfolio = () => {
    const holdings = balances.map((balance) => {
      const livePrice = livePrices.get(balance.symbol);
      const isStable = ['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'EUR'].includes(balance.asset);
      const price = isStable ? 1 : (livePrice?.price || 0);
      const value = balance.amount * price;
      const change24h = livePrice?.change24h || 0;

      return {
        ...balance,
        value,
        change24h: balance.amount * change24h,
        isStable,
      };
    });

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const stableValue = holdings
      .filter((h) => h.isStable)
      .reduce((sum, h) => sum + h.value, 0);
    const totalChange24h = holdings.reduce((sum, h) => sum + h.change24h, 0);

    return { totalValue, stableValue, totalChange24h };
  };

  const { totalValue, stableValue, totalChange24h } = calculatePortfolio();
  const isPositive = totalChange24h >= 0;

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return '$0.00';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-semibold text-white">
          Crypto Trading Dashboard
        </h2>

        {/* Portfolio Balance */}
        {balances.length > 0 && (
          <div className="flex items-center gap-4 pl-4 border-l border-slate-700">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary-500" />
              <div>
                <p className="text-xs text-gray-400">Portfolio</p>
                <p className="text-sm font-bold text-white">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <div>
                <p className="text-xs text-gray-400">24h</p>
                <p className={`text-sm font-bold ${
                  isPositive ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatCurrency(Math.abs(totalChange24h))}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-gray-400">Stables</p>
                <p className="text-sm font-bold text-blue-400">
                  {formatCurrency(stableValue)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Status Indicators */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
          {/* DalyDCA Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-700">
            <Activity className={`h-4 w-4 ${strategyStatus.dca.active ? 'text-green-500' : 'text-gray-500'}`} />
            <div className="flex flex-col">
              <p className="text-xs text-gray-400">DalyDCA</p>
              <p className={`text-xs font-semibold ${strategyStatus.dca.active ? 'text-green-500' : 'text-gray-500'}`}>
                {strategyStatus.dca.active ? `Active (${strategyStatus.dca.activeBots})` : 'Inactive'}
              </p>
            </div>
          </div>

          {/* DalyDEPEG Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-700">
            <Activity className={`h-4 w-4 ${strategyStatus.depeg.active ? 'text-green-500' : 'text-gray-500'}`} />
            <div className="flex flex-col">
              <p className="text-xs text-gray-400">DalyDEPEG</p>
              <p className={`text-xs font-semibold ${strategyStatus.depeg.active ? 'text-green-500' : 'text-gray-500'}`}>
                {strategyStatus.depeg.active ? 'Active' : strategyStatus.depeg.enabled ? 'Enabled' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <User className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-300">{user?.username}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-1 z-50">
              <button
                onClick={() => {
                  logout();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-slate-700"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
