import { useEffect, useState, useMemo } from 'react';
import { krakenApiService } from '@/services/krakenApiService';
import { useStore } from '@/store/useStore';
import { getCommonName } from '@/utils/assetNames';
import { globalPriceManager } from '@/services/globalPriceManager';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
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

const CACHE_KEY = 'kraken_portfolio_balances_cache';
const CACHE_TIMESTAMP_KEY = 'kraken_portfolio_balances_timestamp';

type SortField = 'asset' | 'holdings' | 'price' | 'value' | 'change' | 'weight';
type SortDirection = 'asc' | 'desc';

// Kraken-style color palette
const CHART_COLORS = [
  '#5741d9', // Purple (BTC)
  '#627eea', // Blue (ETH)
  '#26a17b', // Teal (Stables)
  '#f7931a', // Orange
  '#e84142', // Red
  '#00d4aa', // Cyan
  '#9945ff', // Violet
  '#14f195', // Green
  '#ff6b6b', // Coral
  '#4ecdc4', // Turquoise
  '#ffe66d', // Yellow
  '#95e1d3', // Mint
];

// Asset icon component with fallback
function AssetIcon({ asset, size = 32 }: { asset: string; size?: number }) {
  const [hasError, setHasError] = useState(false);
  const iconUrl = `https://assets.kraken.com/marketing/web/icons/sym-${asset.toLowerCase()}_colored.svg`;

  if (hasError) {
    return (
      <div
        className="flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 rounded-full text-white font-bold"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {asset.substring(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={asset}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setHasError(true)}
    />
  );
}

// Pie chart component
function AllocationChart({ holdings, totalValue }: { holdings: HoldingWithPrice[]; totalValue: number }) {
  const significantHoldings = holdings.filter(h => h.weight >= 1).slice(0, 10);
  const otherWeight = holdings.filter(h => h.weight < 1).reduce((sum, h) => sum + h.weight, 0);

  const chartData = useMemo(() => {
    const data = significantHoldings.map((h, i) => ({
      name: h.commonName,
      value: h.weight,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    if (otherWeight > 0) {
      data.push({
        name: 'Other',
        value: otherWeight,
        color: '#64748b',
      });
    }

    return data;
  }, [significantHoldings, otherWeight]);

  // Calculate pie slices
  let currentAngle = -90; // Start from top
  const slices = chartData.map((item) => {
    const angle = (item.value / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    return {
      ...item,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
    };
  });

  return (
    <div className="flex items-center gap-6">
      {/* Pie Chart */}
      <div className="relative">
        <svg width="180" height="180" viewBox="0 0 100 100">
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.path}
              fill={slice.color}
              className="transition-opacity hover:opacity-80 cursor-pointer"
            />
          ))}
          {/* Center hole for donut effect */}
          <circle cx="50" cy="50" r="25" className="fill-white dark:fill-slate-800" />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-slate-500 dark:text-gray-400">{chartData.length} assets</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
        {chartData.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 dark:text-gray-300 truncate max-w-[80px]">{item.name}</span>
            <span className="text-slate-500 dark:text-gray-500 ml-auto">{item.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KrakenPortfolio() {
  const livePrices = useStore((state) => state.livePrices);
  const [hideBalances, setHideBalances] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'all' | 'crypto' | 'stables'>('all');

  const [balances, setBalances] = useState<Balance[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(() => {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    return timestamp ? new Date(timestamp) : null;
  });

  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showSmallBalances, setShowSmallBalances] = useState(false);

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedBalances = await krakenApiService.getAccountBalance();
      const now = new Date();

      setBalances(fetchedBalances);
      setLastUpdate(now);

      localStorage.setItem(CACHE_KEY, JSON.stringify(fetchedBalances));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toISOString());

      if (fetchedBalances.length > 0) {
        const portfolioSymbols = fetchedBalances
          .map(b => b.symbol)
          .filter(symbol => symbol && symbol !== 'USD');

        globalPriceManager.addSymbols(portfolioSymbols);
      }
    } catch (err: any) {
      console.error('[KrakenPortfolio] Error fetching balances:', err);

      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && balances.length === 0) {
        try {
          setBalances(JSON.parse(cached));
        } catch (e) {}
      }

      if (err.message?.includes('rate limit')) {
        setError('Rate limited. Using cached data.');
      } else {
        setError(err.message || 'Failed to fetch portfolio data');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate holdings with prices
  const holdings: HoldingWithPrice[] = useMemo(() => {
    return balances.map((balance) => {
      const livePrice = livePrices.get(balance.symbol);
      const currentPrice = livePrice?.price || 0;
      const commonName = getCommonName(balance.asset);

      const isStable = ['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'EUR'].includes(commonName);
      const price = isStable ? 1 : currentPrice;

      const value = balance.amount * price;
      const change24h = livePrice?.change24h || 0;
      const changePercent24h = livePrice?.changePercent24h || 0;

      return {
        ...balance,
        commonName,
        currentPrice: price,
        value,
        weight: 0,
        change24h,
        changePercent24h,
      };
    });
  }, [balances, livePrices]);

  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const stableAssets = ['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'EUR'];
  const stableValue = holdings
    .filter((h) => stableAssets.includes(h.commonName))
    .reduce((sum, h) => sum + h.value, 0);
  const cryptoValue = totalValue - stableValue;

  // Calculate weights
  holdings.forEach((holding) => {
    holding.weight = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
  });

  // Calculate 24h change
  const totalChange24h = holdings.reduce((sum, h) => {
    const change = h.amount * h.change24h;
    return sum + (isNaN(change) ? 0 : change);
  }, 0);
  const totalChangePercent24h = totalValue > 0 ? (totalChange24h / (totalValue - totalChange24h)) * 100 : 0;

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'asset' ? 'asc' : 'desc');
    }
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    let compareValue = 0;
    switch (sortField) {
      case 'asset': compareValue = a.commonName.localeCompare(b.commonName); break;
      case 'holdings': compareValue = a.amount - b.amount; break;
      case 'price': compareValue = a.currentPrice - b.currentPrice; break;
      case 'value': compareValue = a.value - b.value; break;
      case 'change': compareValue = (a.amount * a.change24h) - (b.amount * b.change24h); break;
      case 'weight': compareValue = a.weight - b.weight; break;
    }
    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  // Filter holdings
  const filteredHoldings = sortedHoldings.filter(h => {
    if (!showSmallBalances && h.value < 1) return false;
    if (expandedSection === 'crypto') return !stableAssets.includes(h.commonName);
    if (expandedSection === 'stables') return stableAssets.includes(h.commonName);
    return true;
  });

  const formatCurrency = (value: number, hide?: boolean) => {
    if (hide) return '****.**';
    if (isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    if (isNaN(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatAmount = (value: number) => {
    if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (value >= 1) return value.toFixed(4);
    if (value >= 0.0001) return value.toFixed(6);
    return value.toFixed(8);
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return formatCurrency(price);
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.01) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(8)}`;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-gray-200 transition-colors group"
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
      )}
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Kraken Portfolio</h1>
            <button
              onClick={() => setHideBalances(!hideBalances)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={hideBalances ? 'Show balances' : 'Hide balances'}
            >
              {hideBalances ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Real-time portfolio tracking with live WebSocket prices
            </p>
            {livePrices.size > 0 && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Activity className="h-3 w-3 animate-pulse" />
                <span>Live ({livePrices.size})</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://pro.kraken.com/app/portfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Kraken Pro
          </a>
          <button
            onClick={fetchBalances}
            disabled={loading}
            className="btn btn-primary btn-sm flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            <p className="text-yellow-700 dark:text-yellow-500 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Value Card */}
        <div className="card bg-gradient-to-br from-purple-100 to-slate-50 dark:from-purple-900/50 dark:to-slate-800 border-purple-200 dark:border-purple-500/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-1">Total Portfolio Value</p>
              <p className="text-4xl font-bold">{formatCurrency(totalValue, hideBalances)}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 ${
              totalChange24h >= 0 ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              {totalChange24h >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatPercent(totalChangePercent24h)}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-gray-400">24h Change: </span>
              <span className={totalChange24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {hideBalances ? '****.**' : formatCurrency(totalChange24h)}
              </span>
            </div>
            {lastUpdate && (
              <div className="text-slate-500 dark:text-gray-500">
                Updated {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Asset Breakdown Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Asset Breakdown</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-slate-600 dark:text-gray-300">Crypto</span>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(cryptoValue, hideBalances)}</p>
                <p className="text-xs text-gray-500">{((cryptoValue / totalValue) * 100 || 0).toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-600 dark:text-gray-300">Cash & Stables</span>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(stableValue, hideBalances)}</p>
                <p className="text-xs text-gray-500">{((stableValue / totalValue) * 100 || 0).toFixed(1)}%</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${(cryptoValue / totalValue) * 100 || 0}%` }}
              />
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(stableValue / totalValue) * 100 || 0}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-gray-400">Total Assets</span>
              <span className="font-semibold">{holdings.length}</span>
            </div>
          </div>
        </div>

        {/* Allocation Chart Card */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Allocation</h3>
          {holdings.length > 0 ? (
            <AllocationChart holdings={sortedHoldings} totalValue={totalValue} />
          ) : (
            <div className="flex items-center justify-center h-[180px] text-slate-500 dark:text-gray-500">
              No holdings to display
            </div>
          )}
        </div>
      </div>

      {/* Top Holdings Grid */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Top Holdings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandedSection('all')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                expandedSection === 'all' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setExpandedSection('crypto')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                expandedSection === 'crypto' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              Crypto
            </button>
            <button
              onClick={() => setExpandedSection('stables')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                expandedSection === 'stables' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              Cash & Stables
            </button>
          </div>
        </div>

        {loading && holdings.length === 0 ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-slate-500 dark:text-gray-400">Syncing with Kraken...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredHoldings.slice(0, 12).map((holding) => {
              const isPositive = holding.changePercent24h >= 0;
              const isStable = stableAssets.includes(holding.commonName);
              const hasLivePrice = livePrices.has(holding.symbol);

              return (
                <div
                  key={holding.asset}
                  className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <AssetIcon asset={holding.commonName} size={40} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{holding.commonName}</span>
                          {hasLivePrice && !isStable && (
                            <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-gray-500">
                          {formatAmount(holding.amount)} {holding.commonName}
                        </span>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded ${
                      holding.weight >= 10
                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-gray-400'
                    }`}>
                      {holding.weight.toFixed(1)}%
                    </div>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl font-bold">{formatCurrency(holding.value, hideBalances)}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">
                        @ {formatPrice(holding.currentPrice)}
                      </p>
                    </div>
                    {!isStable && (
                      <div className={`text-right ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        <p className="text-sm font-medium">{formatPercent(holding.changePercent24h)}</p>
                        <p className="text-xs opacity-75">
                          {hideBalances ? '****' : formatCurrency(holding.amount * holding.change24h)}
                        </p>
                      </div>
                    )}
                    {isStable && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 rounded">
                        Stable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Holdings Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">All Holdings</h2>
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showSmallBalances}
              onChange={(e) => setShowSmallBalances(e.target.checked)}
              className="rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-purple-500 focus:ring-purple-500"
            />
            Show small balances (&lt;$1)
          </label>
        </div>

        {filteredHoldings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-500 dark:text-gray-400 text-sm border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-3 pl-2">
                    <SortableHeader field="asset">Asset</SortableHeader>
                  </th>
                  <th className="pb-3">
                    <SortableHeader field="holdings">Holdings</SortableHeader>
                  </th>
                  <th className="pb-3">
                    <SortableHeader field="price">Price</SortableHeader>
                  </th>
                  <th className="pb-3">
                    <SortableHeader field="value">Value</SortableHeader>
                  </th>
                  <th className="pb-3">
                    <SortableHeader field="change">24h Change</SortableHeader>
                  </th>
                  <th className="pb-3">
                    <SortableHeader field="weight">Allocation</SortableHeader>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map((holding) => {
                  const isPositive = holding.changePercent24h >= 0;
                  const hasLivePrice = livePrices.has(holding.symbol);
                  const isStable = stableAssets.includes(holding.commonName);

                  return (
                    <tr
                      key={holding.asset}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <AssetIcon asset={holding.commonName} size={32} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{holding.commonName}</span>
                              {hasLivePrice && !isStable && (
                                <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                              )}
                            </div>
                            <span className="text-xs text-slate-500 dark:text-gray-500">{holding.asset}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono">
                        {formatAmount(holding.amount)}
                      </td>
                      <td className="py-4 font-mono">
                        {formatPrice(holding.currentPrice)}
                      </td>
                      <td className="py-4 font-mono font-bold">
                        {formatCurrency(holding.value, hideBalances)}
                      </td>
                      <td className="py-4">
                        {!isStable ? (
                          <div className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            <span className="font-medium">{formatPercent(holding.changePercent24h)}</span>
                            <br />
                            <span className="text-xs opacity-75">
                              {hideBalances ? '****' : formatCurrency(holding.amount * holding.change24h)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-blue-600 dark:text-blue-400">Stable</span>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <div
                              className="bg-purple-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(holding.weight, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-500 dark:text-gray-400 min-w-[3rem]">
                            {holding.weight.toFixed(1)}%
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
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-gray-400">No holdings to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
