import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity, AlertTriangle, Info } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { getCommonName } from '@/utils/assetNames';

// Enhanced trend data structure matching backend output
interface EnhancedTrendData {
  symbol: string;
  commonName?: string; // Display name
  price: number;
  change_24h_percent: number;
  volume_24h: number;
  trend_score: number;
  technical_score: number;
  support_level: number;
  resistance_level: number;
  momentum: number; // RSI-based 0-100
  volatility: number; // 0-100
  rsi?: number;
  macd_state?: 'bullish' | 'bearish' | 'neutral';
  trend_signal?: 'bullish' | 'bearish' | 'neutral';
  sma_50?: number;
  sma_200?: number;
  golden_cross?: boolean;
  isLivePrice?: boolean; // Whether price is from live WebSocket
}

// Market overview from trends stream
interface MarketOverview {
  total_market_cap?: number;
  total_volume_24h?: number;
  btc_dominance?: number;
  active_cryptos?: number;
  sentiment?: string;
}

// Top gainers/losers
interface TopCoin {
  symbol: string;
  name: string;
  price: number;
  change_24h_percent: number;
  volume_24h: number;
}

export default function CryptoTrends() {
  const subscribeTrendStream = useStore((state) => state.subscribeTrendStream);
  // Get global live prices from store
  const livePrices = useStore((state) => state.livePrices);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enhancedTrends, setEnhancedTrends] = useState<EnhancedTrendData[]>([]);
  const [overview, setOverview] = useState<MarketOverview>({});
  const [topGainers, setTopGainers] = useState<TopCoin[]>([]);
  const [topLosers, setTopLosers] = useState<TopCoin[]>([]);

  const [sortBy, setSortBy] = useState<'trend_score' | 'technical_score' | 'momentum' | 'volatility'>('trend_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSignal, setFilterSignal] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');

  // Initial data load and WS subscription
  useEffect(() => {
    loadInitialData();

    // Subscribe to trends stream for periodic updates
    subscribeTrendStream();
  }, []);

  // Load enhanced trends from REST endpoint
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all 200 assets (top 200 by market cap)
      const response = await apiService.getEnhancedTrends(200);

      if (response.success && response.data) {
        setEnhancedTrends(response.data.trends || []);

        // Set overview if included
        if (response.data.overview) {
          setOverview(response.data.overview);
        }

        // Set top gainers/losers if included
        if (response.data.top_gainers) {
          setTopGainers(response.data.top_gainers);
        }
        if (response.data.top_losers) {
          setTopLosers(response.data.top_losers);
        }
      } else {
        setError('No trend data available');
      }
    } catch (err: any) {
      console.error('[CryptoTrends] Failed to load enhanced trends:', err);
      setError(err.message || 'Failed to load trend data');
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh handler
  const handleRefresh = () => {
    loadInitialData();
  };

  // Merge global live prices with trend data
  const trendsWithLivePrices = useMemo(() => {
    return enhancedTrends.map(trend => {
      const commonName = getCommonName(trend.symbol);
      // Try to find matching live price (could be symbol/USD or XXBT format)
      const livePrice = livePrices.get(`${trend.symbol}/USD`) ||
                       livePrices.get(trend.symbol);

      if (livePrice) {
        return {
          ...trend,
          commonName,
          price: livePrice.price || trend.price,
          change_24h_percent: livePrice.changePercent24h || trend.change_24h_percent,
          volume_24h: livePrice.volume24h || trend.volume_24h,
          isLivePrice: true,
        };
      }

      return {
        ...trend,
        commonName,
        isLivePrice: false,
      };
    });
  }, [enhancedTrends, livePrices]);

  // Get trend direction based on trend_signal or change_24h
  const getTrendDirection = (trend: EnhancedTrendData): 'bullish' | 'bearish' | 'neutral' => {
    if (trend.trend_signal) return trend.trend_signal;
    if (trend.change_24h_percent > 2) return 'bullish';
    if (trend.change_24h_percent < -2) return 'bearish';
    return 'neutral';
  };

  // Filter and sort trends
  const filteredAndSortedTrends = useMemo(() => {
    let filtered = [...trendsWithLivePrices];

    // Apply signal filter
    if (filterSignal !== 'all') {
      filtered = filtered.filter(trend => getTrendDirection(trend) === filterSignal);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [trendsWithLivePrices, sortBy, sortOrder, filterSignal]);

  // Count signals
  const signalCounts = useMemo(() => {
    const bullish = trendsWithLivePrices.filter(t => getTrendDirection(t) === 'bullish').length;
    const bearish = trendsWithLivePrices.filter(t => getTrendDirection(t) === 'bearish').length;
    const neutral = trendsWithLivePrices.filter(t => getTrendDirection(t) === 'neutral').length;
    return { bullish, bearish, neutral };
  }, [trendsWithLivePrices]);

  // Format helpers
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatLargeNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return formatCurrency(value);
  };

  // Get score color class
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get score background color
  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    if (score >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Get RSI color
  const getRSIColor = (rsi: number | undefined) => {
    if (rsi === undefined) return 'text-gray-400';
    if (rsi > 70) return 'text-red-400'; // Overbought
    if (rsi < 30) return 'text-green-400'; // Oversold
    return 'text-gray-400';
  };

  // Get trend icon
  const getTrendIcon = (direction: 'bullish' | 'bearish' | 'neutral') => {
    switch (direction) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  // Toggle sort
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Crypto Trends</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Powered by Kraken OHLC - Advanced technical analysis and market scoring
            </p>
            {livePrices.size > 0 && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Activity className="h-3 w-3 animate-pulse" />
                <span>{trendsWithLivePrices.filter(t => t.isLivePrice).length} live prices</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="card bg-red-900/20 border border-red-500/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400">Failed to Load Trends</h3>
              <p className="text-sm text-gray-300 mt-1">{error}</p>
              <button onClick={handleRefresh} className="text-sm text-blue-400 hover:underline mt-2">
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Market Overview */}
      {overview && Object.keys(overview).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {overview.total_market_cap !== undefined && (
            <div className="card">
              <p className="text-sm text-slate-500 dark:text-gray-400">Total Market Cap</p>
              <p className="text-2xl font-bold mt-1">{formatLargeNumber(overview.total_market_cap)}</p>
            </div>
          )}
          {overview.total_volume_24h !== undefined && (
            <div className="card">
              <p className="text-sm text-slate-500 dark:text-gray-400">24h Volume</p>
              <p className="text-2xl font-bold mt-1">{formatLargeNumber(overview.total_volume_24h)}</p>
            </div>
          )}
          {overview.btc_dominance !== undefined && (
            <div className="card">
              <p className="text-sm text-slate-500 dark:text-gray-400">BTC Dominance</p>
              <p className="text-2xl font-bold mt-1">{overview.btc_dominance?.toFixed(1) || 'N/A'}%</p>
            </div>
          )}
          {overview.active_cryptos !== undefined && (
            <div className="card">
              <p className="text-sm text-slate-500 dark:text-gray-400">Active Cryptos</p>
              <p className="text-2xl font-bold mt-1">{overview.active_cryptos.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Signal Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Bullish Signals</p>
              <p className="text-3xl font-bold text-green-500 mt-1">{signalCounts.bullish}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Neutral Signals</p>
              <p className="text-3xl font-bold text-gray-500 mt-1">{signalCounts.neutral}</p>
            </div>
            <Minus className="h-12 w-12 text-gray-500 opacity-20" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Bearish Signals</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{signalCounts.bearish}</p>
            </div>
            <TrendingDown className="h-12 w-12 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Top Gainers & Losers */}
      {(topGainers.length > 0 || topLosers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topGainers.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Top Gainers (24h)
              </h3>
              <div className="space-y-3">
                {topGainers.slice(0, 5).map((coin, index) => (
                  <div key={coin.symbol} className="flex items-center justify-between p-3 bg-green-50 dark:bg-slate-800/50 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{coin.symbol}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{coin.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(coin.price)}</p>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatPercent(coin.change_24h_percent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topLosers.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Top Losers (24h)
              </h3>
              <div className="space-y-3">
                {topLosers.slice(0, 5).map((coin, index) => (
                  <div key={coin.symbol} className="flex items-center justify-between p-3 bg-red-50 dark:bg-slate-800/50 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{coin.symbol}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{coin.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(coin.price)}</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatPercent(coin.change_24h_percent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters & Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-500 dark:text-gray-400">Filter:</span>
            {(['all', 'bullish', 'neutral', 'bearish'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterSignal(filter)}
                className={`btn btn-sm ${
                  filterSignal === filter ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Trends Table */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Enhanced Technical Analysis
        </h2>

        {loading && enhancedTrends.length === 0 ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-slate-500 dark:text-gray-400">Loading enhanced trend data...</p>
          </div>
        ) : filteredAndSortedTrends.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-3 pr-4">Symbol</th>
                  <th className="pb-3 pr-4">Price</th>
                  <th className="pb-3 pr-4">24h Change</th>
                  <th className="pb-3 pr-4 cursor-pointer hover:text-white" onClick={() => handleSort('trend_score')}>
                    Trend Score {sortBy === 'trend_score' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="pb-3 pr-4 cursor-pointer hover:text-white" onClick={() => handleSort('technical_score')}>
                    Technical Score {sortBy === 'technical_score' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="pb-3 pr-4 cursor-pointer hover:text-white" onClick={() => handleSort('momentum')}>
                    Momentum (RSI) {sortBy === 'momentum' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="pb-3 pr-4 cursor-pointer hover:text-white" onClick={() => handleSort('volatility')}>
                    Volatility {sortBy === 'volatility' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="pb-3 pr-4">Support</th>
                  <th className="pb-3">Resistance</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTrends.map((trend) => {
                  const direction = getTrendDirection(trend);
                  return (
                    <tr key={trend.symbol} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(direction)}
                          <span className="font-semibold">{trend.commonName || trend.symbol}</span>
                          {trend.isLivePrice && (
                            <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {formatCurrency(trend.price)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={trend.change_24h_percent >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {formatPercent(trend.change_24h_percent)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getScoreBgColor(trend.trend_score)}`}
                              style={{ width: `${Math.min(trend.trend_score || 0, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${getScoreColor(trend.trend_score)}`}>
                            {trend.trend_score?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getScoreBgColor(trend.technical_score)}`}
                              style={{ width: `${Math.min(trend.technical_score || 0, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${getScoreColor(trend.technical_score)}`}>
                            {trend.technical_score?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={getRSIColor(trend.rsi || trend.momentum)}>
                          {(trend.rsi || trend.momentum)?.toFixed(1) || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={getScoreColor(trend.volatility)}>
                          {trend.volatility?.toFixed(1) || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-green-400 text-sm">
                        {formatCurrency(trend.support_level)}
                      </td>
                      <td className="py-3 text-red-400 text-sm">
                        {formatCurrency(trend.resistance_level)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Info className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-gray-400">No trends match your current filter</p>
            <button onClick={() => setFilterSignal('all')} className="text-sm text-blue-400 hover:underline mt-2">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Scoring Methodology */}
      <div className="card">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Scoring Methodology
        </h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Trend Score (0-100)</h4>
            <p className="text-slate-500 dark:text-gray-400 mb-2">
              Composite indicator measuring market direction and momentum strength.
            </p>
            <ul className="text-slate-500 dark:text-gray-400 space-y-1 ml-4">
              <li><strong>50%</strong> - RSI (Relative Strength Index)</li>
              <li><strong>40%</strong> - Momentum Score</li>
              <li><strong>5%</strong> - MACD State (bullish/bearish/neutral)</li>
              <li><strong>5%</strong> - Trend Signal</li>
            </ul>
            <div className="mt-3 p-2 bg-slate-100 dark:bg-slate-800/50 rounded text-xs">
              <p className="text-green-600 dark:text-green-400">70-100: Strong trend</p>
              <p className="text-yellow-600 dark:text-yellow-400">50-69: Moderate trend</p>
              <p className="text-orange-600 dark:text-orange-400">30-49: Weak trend</p>
              <p className="text-red-600 dark:text-red-400">0-29: No clear trend</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Technical Score (0-100)</h4>
            <p className="text-slate-500 dark:text-gray-400 mb-2">
              Evaluates price position relative to key moving averages and technical signals.
            </p>
            <ul className="text-slate-500 dark:text-gray-400 space-y-1 ml-4">
              <li><strong>40%</strong> - RSI Technical Component</li>
              <li><strong>20%</strong> - MACD State</li>
              <li><strong>20%</strong> - Price vs SMA-50 (short-term bias)</li>
              <li><strong>15%</strong> - Price vs SMA-200 (long-term bias)</li>
              <li><strong>+10</strong> - Golden Cross Bonus (if present)</li>
            </ul>
            <div className="mt-3 p-2 bg-slate-100 dark:bg-slate-800/50 rounded text-xs">
              <p className="text-slate-600 dark:text-gray-400"><strong>Golden Cross:</strong> SMA-50 crosses above SMA-200 (bullish)</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Momentum (RSI 0-100)</h4>
            <p className="text-slate-500 dark:text-gray-400 mb-2">
              Relative Strength Index measuring overbought/oversold conditions.
            </p>
            <ul className="text-slate-500 dark:text-gray-400 space-y-1 ml-4">
              <li className="text-red-600 dark:text-red-400">&gt; 70: Overbought (potential reversal down)</li>
              <li className="text-slate-600 dark:text-gray-400">30-70: Neutral zone</li>
              <li className="text-green-600 dark:text-green-400">&lt; 30: Oversold (potential reversal up)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Volatility (0-100)</h4>
            <p className="text-slate-500 dark:text-gray-400 mb-2">
              Composite measure of price movement magnitude and stability.
            </p>
            <ul className="text-slate-500 dark:text-gray-400 space-y-1 ml-4">
              <li><strong>60%</strong> - 1h price change magnitude</li>
              <li><strong>20%</strong> - 24h price change magnitude</li>
              <li><strong>20%</strong> - Volatility bucket (low/med/high/extreme)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Support & Resistance</h4>
            <p className="text-slate-500 dark:text-gray-400 mb-2">
              Key price levels calculated from recent market structure.
            </p>
            <ul className="text-slate-500 dark:text-gray-400 space-y-1 ml-4">
              <li><strong>Support:</strong> Recent lows with 0.7-0.9× price bounds</li>
              <li><strong>Resistance:</strong> Recent highs with 1.1-1.3× price bounds</li>
              <li>Fallback: ±5% bands when data is sparse</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Data Sources</h4>
            <p className="text-slate-500 dark:text-gray-400 mb-2">
              Multi-provider aggregation with fallback capabilities.
            </p>
            <ul className="text-slate-500 dark:text-gray-400 space-y-1 ml-4">
              <li><strong>Primary:</strong> CoinGecko API</li>
              <li><strong>Fallback:</strong> CoinMarketCap API</li>
              <li><strong>Enrichment:</strong> Quantify Crypto technical data</li>
              <li><strong>Updates:</strong> ~10 second streaming cadence</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Data freshness indicator */}
      <div className="text-center text-xs text-slate-400 dark:text-gray-500">
        <p>Data updates automatically via WebSocket stream (~10s cadence)</p>
        <p className="mt-1">Manual refresh available • Fallback to cache/snapshot on disconnect</p>
      </div>
    </div>
  );
}
