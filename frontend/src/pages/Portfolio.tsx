import { useEffect, useState } from 'react';
import { krakenApiService } from '@/services/krakenApiService';
import { useStore } from '@/store/useStore';
import { getCommonName } from '@/utils/assetNames';
import type { LivePrice } from '@/types';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Activity,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface Balance {
  asset: string;
  symbol: string;
  amount: number;
  availableBalance: number;
  lockedBalance: number;
}

interface HoldingWithPrice extends Balance {
  commonName: string;
  currentPrice: number;
  value: number;
  weight: number;
  change24h: number;
  changePercent24h: number;
}

const CACHE_KEY = 'portfolio_balances_cache';
const CACHE_TIMESTAMP_KEY = 'portfolio_balances_timestamp';

type SortField = 'asset' | 'holdings' | 'price' | 'value' | 'change' | 'weight';
type SortDirection = 'asc' | 'desc';

export default function Portfolio() {
  // Get global live prices from store
  const livePrices = useStore((state) => state.livePrices);

  const [balances, setBalances] = useState<Balance[]>(() => {
    // Initialize from localStorage cache if available
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('[Portfolio] Failed to parse cached balances:', e);
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(() => {
    // Initialize from localStorage timestamp if available
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    return timestamp ? new Date(timestamp) : null;
  });
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    // Fetch initial balances (will use cache if API fails)
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedBalances = await krakenApiService.getAccountBalance();
      const now = new Date();

      // Update state with fresh data
      setBalances(fetchedBalances);
      setLastUpdate(now);

      // Cache the fresh data to localStorage
      localStorage.setItem(CACHE_KEY, JSON.stringify(fetchedBalances));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toISOString());

      // Also update backend balance cache for backend functions to use
      try {
        const balanceMap: { [asset: string]: number } = {};
        fetchedBalances.forEach((balance: any) => {
          if (balance.asset && balance.total) {
            balanceMap[balance.asset] = balance.total;
          }
        });

        // Call backend API to update balance cache
        await fetch('/api/balance-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balances: balanceMap }),
        });

        console.log('[Portfolio] Updated backend balance cache with', Object.keys(balanceMap).length, 'assets');
      } catch (cacheError) {
        console.warn('[Portfolio] Failed to update backend balance cache:', cacheError);
        // Don't fail the whole operation if cache update fails
      }

      // Clear any previous errors on success
      if (fetchedBalances.length > 0) {
        setError(null);
      }

      console.log('[Portfolio] Successfully fetched and cached', fetchedBalances.length, 'balances');
    } catch (err: any) {
      console.error('[Portfolio] Error fetching balances:', err);

      // Try to use cached data when API fails
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cached) {
        try {
          const cachedBalances = JSON.parse(cached);
          // Only set balances if we don't already have them (prevents overwriting on refresh)
          if (balances.length === 0) {
            setBalances(cachedBalances);
            setLastUpdate(cachedTimestamp ? new Date(cachedTimestamp) : null);
          }
          console.log('[Portfolio] Using cached balances due to API error');
        } catch (parseError) {
          console.error('[Portfolio] Failed to parse cached balances:', parseError);
        }
      }

      // Set appropriate error message
      if (err.message?.includes('Temporary lockout') || err.message?.includes('rate limit')) {
        setError(
          cached
            ? 'Kraken API rate limit reached. Showing cached data from ' +
              (cachedTimestamp ? new Date(cachedTimestamp).toLocaleString() : 'earlier') + '. Please wait a few minutes before refreshing.'
            : 'Kraken API rate limit reached. No cached data available. Please wait a few minutes before refreshing.'
        );
      } else if (err.message?.includes('CORS') || err.message?.includes('Failed to fetch')) {
        setError(
          cached
            ? 'Unable to connect to backend server. Showing cached data from ' +
              (cachedTimestamp ? new Date(cachedTimestamp).toLocaleString() : 'earlier') + '.'
            : 'Unable to connect to backend server. Please check your connection and try again.'
        );
      } else {
        setError(
          cached
            ? `Failed to fetch fresh data: ${err.message || 'Unknown error'}. Showing cached data from ` +
              (cachedTimestamp ? new Date(cachedTimestamp).toLocaleString() : 'earlier') + '.'
            : err.message || 'Failed to fetch portfolio data'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate holdings with prices
  const holdings: HoldingWithPrice[] = balances.map((balance) => {
    const livePrice = livePrices.get(balance.symbol);
    const currentPrice = livePrice?.price || 0;
    const commonName = getCommonName(balance.asset);

    // For stablecoins and USD, price is 1
    const isStable = ['USD', 'USDT', 'USDC', 'DAI', 'BUSD'].includes(commonName);
    const price = isStable ? 1 : currentPrice;

    const value = balance.amount * price;
    const change24h = livePrice?.change24h || 0;
    const changePercent24h = livePrice?.changePercent24h || 0;

    return {
      ...balance,
      commonName,
      currentPrice: price,
      value,
      weight: 0, // Will calculate after getting total
      change24h,
      changePercent24h,
    };
  });

  // Calculate total portfolio value
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  // Calculate USD + stablecoins total
  const stableValue = holdings
    .filter((h) => ['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'EUR'].includes(h.commonName))
    .reduce((sum, h) => sum + h.value, 0);

  // Calculate weights
  holdings.forEach((holding) => {
    holding.weight = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
  });

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default direction
      setSortField(field);
      setSortDirection(field === 'asset' ? 'asc' : 'desc');
    }
  };

  // Apply sorting
  holdings.sort((a, b) => {
    let compareValue = 0;

    switch (sortField) {
      case 'asset':
        compareValue = a.commonName.localeCompare(b.commonName);
        break;
      case 'holdings':
        compareValue = a.amount - b.amount;
        break;
      case 'price':
        compareValue = a.currentPrice - b.currentPrice;
        break;
      case 'value':
        compareValue = a.value - b.value;
        break;
      case 'change':
        compareValue = (a.amount * a.change24h) - (b.amount * b.change24h);
        break;
      case 'weight':
        compareValue = a.weight - b.weight;
        break;
    }

    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  // Calculate portfolio 24h change
  const totalChange24h = holdings.reduce((sum, h) => {
    const change = (h.amount * h.change24h);
    return sum + (isNaN(change) ? 0 : change);
  }, 0);

  const totalChangePercent24h = totalValue > 0 ? (totalChange24h / (totalValue - totalChange24h)) * 100 : 0;

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatAmount = (value: number, decimals: number = 8) => {
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(decimals);
  };

  // Calculate cache age
  const getCacheAge = () => {
    if (!lastUpdate) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'just now';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-400">
              Your Kraken account holdings and balances
            </p>
            {livePrices.size > 0 && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Activity className="h-3 w-3 animate-pulse" />
                <span>Live Prices ({livePrices.size})</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="btn btn-primary btn-sm flex items-center"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error Display / Cache Notice */}
      {error && (
        <div className={`card border ${
          error.includes('rate limit') || error.includes('cached') || error.includes('Showing cached')
            ? 'bg-yellow-500/10 border-yellow-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <AlertCircle className={`h-6 w-6 ${
              error.includes('rate limit') || error.includes('cached') || error.includes('Showing cached')
                ? 'text-yellow-500'
                : 'text-red-500'
            }`} />
            <div className="flex-1">
              <p className={`font-bold ${
                error.includes('rate limit') || error.includes('cached') || error.includes('Showing cached')
                  ? 'text-yellow-500'
                  : 'text-red-500'
              }`}>
                {error.includes('rate limit')
                  ? 'Rate Limited - Using Cache'
                  : error.includes('Showing cached')
                  ? 'API Unavailable - Using Cache'
                  : 'Error Loading Portfolio'}
              </p>
              <p className="text-sm text-gray-300 mt-1">{error}</p>
              {!error.includes('rate limit') && !error.includes('backend') && !error.includes('Showing cached') && (
                <p className="text-xs text-gray-500 mt-2">
                  Make sure you've added your Kraken API keys in Settings with "Query Funds" permission.
                </p>
              )}
              {(error.includes('rate limit') || error.includes('Showing cached')) && balances.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Live prices continue to update via WebSocket. Holdings data will refresh when API becomes available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              {lastUpdate && (
                <p className="text-xs text-gray-500 mt-1">
                  {error && (error.includes('cached') || error.includes('Showing cached'))
                    ? `Cache: ${getCacheAge()}`
                    : `Updated ${lastUpdate.toLocaleTimeString()}`}
                </p>
              )}
            </div>
            <DollarSign className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">24h Change</p>
              <p className={`text-2xl font-bold ${
                totalChange24h >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {formatCurrency(totalChange24h)}
              </p>
              <p className={`text-sm ${
                totalChangePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPercent(totalChangePercent24h)}
              </p>
            </div>
            {totalChange24h >= 0 ? (
              <TrendingUp className="h-10 w-10 text-green-500" />
            ) : (
              <TrendingDown className="h-10 w-10 text-red-500" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">USD + Stables</p>
              <p className="text-2xl font-bold">{formatCurrency(stableValue)}</p>
              <p className="text-sm text-gray-400">
                {formatPercent((stableValue / totalValue) * 100)} of portfolio
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Holdings</p>
              <p className="text-2xl font-bold">{holdings.length}</p>
              <p className="text-sm text-gray-400">
                {holdings.filter(h => h.value > 1).length} &gt; $1
              </p>
            </div>
            <PieChart className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Holdings</h2>

        {loading && holdings.length === 0 ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-400">Loading portfolio...</p>
          </div>
        ) : holdings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-3">
                    <button
                      onClick={() => handleSort('asset')}
                      className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                    >
                      Asset
                      {sortField === 'asset' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                      {sortField !== 'asset' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      onClick={() => handleSort('holdings')}
                      className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                    >
                      Holdings
                      {sortField === 'holdings' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                      {sortField !== 'holdings' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                    >
                      Price
                      {sortField === 'price' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                      {sortField !== 'price' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      onClick={() => handleSort('value')}
                      className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                    >
                      Value
                      {sortField === 'value' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                      {sortField !== 'value' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      onClick={() => handleSort('change')}
                      className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                    >
                      24h Change
                      {sortField === 'change' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                      {sortField !== 'change' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      onClick={() => handleSort('weight')}
                      className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                    >
                      Weight
                      {sortField === 'weight' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                      {sortField !== 'weight' && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const isPositive = holding.changePercent24h >= 0;
                  const hasLivePrice = livePrices.has(holding.symbol);
                  const isStable = ['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'EUR'].includes(holding.commonName);

                  return (
                    <tr
                      key={holding.asset}
                      className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{holding.commonName}</span>
                          {hasLivePrice && !isStable && (
                            <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 font-mono">
                        {formatAmount(holding.amount)}
                      </td>
                      <td className="py-3 font-mono">
                        {formatCurrency(holding.currentPrice)}
                      </td>
                      <td className="py-3 font-mono font-bold">
                        {formatCurrency(holding.value)}
                      </td>
                      <td className="py-3">
                        {!isStable ? (
                          <div>
                            <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                              {formatCurrency(holding.amount * holding.change24h)}
                            </span>
                            <br />
                            <span className={`text-sm ${
                              isPositive ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatPercent(holding.changePercent24h)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">Stable</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full"
                              style={{ width: `${Math.min(holding.weight, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-400 min-w-[3rem]">
                            {holding.weight.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        {isStable ? (
                          <span className="text-xs text-blue-500">Stable</span>
                        ) : hasLivePrice ? (
                          <span className="text-xs text-green-500">Live</span>
                        ) : (
                          <span className="text-xs text-gray-500">No Price</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <PieChart className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No holdings found</p>
            <p className="text-sm text-gray-500 mt-2">
              Make sure your Kraken API key has "Query Funds" permission
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
