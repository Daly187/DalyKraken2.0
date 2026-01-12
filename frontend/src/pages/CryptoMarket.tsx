import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { ASSET_MAPPINGS, type AssetMapping } from '@/data/assetMappings';
import { resolveKrakenSymbol, type ResolvedSymbol } from '@/services/krakenSymbolResolver';
import type { LivePrice } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Wifi,
  AlertCircle,
  Search,
  BarChart3,
  ArrowUpDown,
} from 'lucide-react';

/**
 * CryptoMarket Page
 *
 * Displays top 200 crypto assets by market cap from the shared ASSET_MAPPINGS data.
 * Live price data comes from the existing Kraken WebSocket feed (via global store).
 *
 * Mapping strategy:
 * - Each row is driven by ASSET_MAPPINGS (source of truth for which assets to show)
 * - Kraken live data is joined by matching the canonical symbol to WebSocket keys
 * - Assets not on Kraken display gracefully with "-" for price data
 */

// Sort options for the table
type SortColumn = 'rank' | 'assetName' | 'price' | 'change' | 'high' | 'low' | 'volume' | 'lastUpdate';
type SortDirection = 'asc' | 'desc';

// Combined row type: asset mapping + resolved Kraken data
interface MarketRow {
  mapping: AssetMapping;
  liveData: LivePrice | null;
  resolvedPair?: string;    // The actual pair key that matched (for debugging)
  resolveStrategy?: string; // Which resolution strategy worked
}

export default function CryptoMarket() {
  // Get global live prices from store (keyed by Kraken pair like "BTC/USD")
  const livePrices = useStore((state) => state.livePrices);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [, setTick] = useState(0);

  useEffect(() => {
    // Update "Last Update" times every second
    const tickInterval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(tickInterval);
    };
  }, []);

  /**
   * Build display rows: ASSET_MAPPINGS as source, joined with live Kraken data
   * Uses the krakenSymbolResolver to try multiple matching strategies
   */
  const marketRows: MarketRow[] = useMemo(() => {
    return ASSET_MAPPINGS.map(mapping => {
      // Use the resolver to find a matching pair with multiple strategies
      const resolved = resolveKrakenSymbol(mapping.canonical, livePrices);

      if (resolved) {
        return {
          mapping,
          liveData: resolved.liveData,
          resolvedPair: resolved.pair,
          resolveStrategy: resolved.strategy,
        };
      }

      // No match found
      return {
        mapping,
        liveData: null,
      };
    });
  }, [livePrices]);

  // Filter and sort logic
  const filteredAndSortedRows = useMemo(() => {
    let rows = [...marketRows];

    // Filter by search query (matches Asset Name, canonical symbol, or Kraken symbol)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter(row =>
        row.mapping.assetName.toLowerCase().includes(query) ||
        row.mapping.canonical.toLowerCase().includes(query) ||
        (row.mapping.kraken && row.mapping.kraken.toLowerCase().includes(query)) ||
        (row.mapping.coinGeckoId && row.mapping.coinGeckoId.toLowerCase().includes(query))
      );
    }

    // Sort
    rows.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'rank':
          comparison = a.mapping.rank - b.mapping.rank;
          break;
        case 'assetName':
          comparison = a.mapping.assetName.localeCompare(b.mapping.assetName);
          break;
        case 'price':
          comparison = (a.liveData?.price || 0) - (b.liveData?.price || 0);
          break;
        case 'change':
          comparison = (a.liveData?.changePercent24h || 0) - (b.liveData?.changePercent24h || 0);
          break;
        case 'high':
          comparison = (a.liveData?.high24h || 0) - (b.liveData?.high24h || 0);
          break;
        case 'low':
          comparison = (a.liveData?.low24h || 0) - (b.liveData?.low24h || 0);
          break;
        case 'volume':
          comparison = (a.liveData?.volume24h || 0) - (b.liveData?.volume24h || 0);
          break;
        case 'lastUpdate':
          comparison = (a.liveData?.timestamp || 0) - (b.liveData?.timestamp || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return rows;
  }, [marketRows, searchQuery, sortColumn, sortDirection]);

  // Handle column sort click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // Default to desc for numeric columns, asc for rank/name
      setSortDirection(column === 'rank' || column === 'assetName' ? 'asc' : 'desc');
    }
  };

  // Format helpers
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatVolume = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '—';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  const formatTimeSince = (timestamp: number | undefined | null) => {
    if (!timestamp) return '—';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Sortable header component
  const SortableHeader = ({
    column,
    label,
    className = '',
  }: {
    column: SortColumn;
    label: string;
    className?: string;
  }) => (
    <th
      className={`pb-3 cursor-pointer hover:text-white transition-colors ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortColumn === column ? 'text-primary-500' : 'text-gray-500'}`} />
        {sortColumn === column && (
          <span className="text-primary-500 text-xs">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  // Count assets with live data
  const assetsWithData = marketRows.filter(r => r.liveData !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Crypto Market</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-400">
              Real-time market data powered by Kraken WebSocket
            </p>
            {livePrices.size > 0 && (
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-500">
                  {assetsWithData} pairs streaming
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by asset name, symbol, or ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSort('change')}
              className={`btn btn-sm ${sortColumn === 'change' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              % Change
            </button>
            <button
              onClick={() => handleSort('volume')}
              className={`btn btn-sm ${sortColumn === 'volume' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Volume
            </button>
          </div>
        </div>
      </div>

      {/* Market Data Table */}
      <div className="card">
        {filteredAndSortedRows.length > 0 ? (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              {/* Sticky header row */}
              <thead className="sticky top-0 z-10 bg-slate-800">
                <tr className="text-left text-gray-400 text-sm border-b border-slate-700">
                  <SortableHeader column="rank" label="Rank" className="w-16" />
                  <SortableHeader column="assetName" label="Asset Name" />
                  <SortableHeader column="price" label="Price" />
                  <SortableHeader column="change" label="24h Change" />
                  <SortableHeader column="high" label="24h High" />
                  <SortableHeader column="low" label="24h Low" />
                  <SortableHeader column="volume" label="24h Volume" />
                  <SortableHeader column="lastUpdate" label="Last Update" />
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedRows.map((row) => {
                  const { mapping, liveData } = row;
                  const hasData = liveData !== null;
                  const isPositive = (liveData?.changePercent24h || 0) >= 0;
                  const timeSinceUpdate = Date.now() - (liveData?.timestamp || 0);
                  const isStale = !hasData || timeSinceUpdate > 10000; // 10 seconds or no data

                  return (
                    <tr
                      key={mapping.canonical}
                      className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors"
                    >
                      {/* Rank */}
                      <td className="py-3 text-center text-gray-400 font-mono">
                        {mapping.rank}
                      </td>

                      {/* Asset Name with canonical symbol */}
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{mapping.assetName}</span>
                          <span className="text-xs text-gray-500">({mapping.canonical})</span>
                          {hasData && !isStale && (
                            <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                          )}
                          {!hasData && mapping.kraken === null && (
                            <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                              Not on Kraken
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 font-mono font-bold">
                        {hasData ? formatCurrency(liveData.price) : '—'}
                      </td>

                      {/* 24h Change */}
                      <td className="py-3">
                        {hasData ? (
                          <div className="flex items-center gap-2">
                            {isPositive ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                              {formatPercent(liveData.changePercent24h)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>

                      {/* 24h High */}
                      <td className="py-3 text-gray-400 font-mono">
                        {hasData ? formatCurrency(liveData.high24h) : '—'}
                      </td>

                      {/* 24h Low */}
                      <td className="py-3 text-gray-400 font-mono">
                        {hasData ? formatCurrency(liveData.low24h) : '—'}
                      </td>

                      {/* 24h Volume */}
                      <td className="py-3 text-gray-400 font-mono">
                        {hasData ? formatVolume(liveData.volume24h) : '—'}
                      </td>

                      {/* Last Update */}
                      <td className="py-3">
                        <span className={`text-xs ${isStale ? 'text-gray-500' : 'text-green-500'}`}>
                          {hasData ? formatTimeSince(liveData.timestamp) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : livePrices.size === 0 ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-400 mb-2">Connecting to market data...</p>
            <p className="text-sm text-gray-500">
              Establishing WebSocket connection to Kraken
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Market Stats */}
      {livePrices.size > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Total Assets</p>
            <p className="text-2xl font-bold">{ASSET_MAPPINGS.length}</p>
            <p className="text-xs text-gray-500 mt-1">{assetsWithData} with live data</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Gainers (24h)</p>
            <p className="text-2xl font-bold text-green-500">
              {marketRows.filter(r => r.liveData && (r.liveData.changePercent24h || 0) > 0).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Losers (24h)</p>
            <p className="text-2xl font-bold text-red-500">
              {marketRows.filter(r => r.liveData && (r.liveData.changePercent24h || 0) < 0).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Avg Change (24h)</p>
            {(() => {
              const rowsWithData = marketRows.filter(r => r.liveData);
              const avgChange = rowsWithData.length > 0
                ? rowsWithData.reduce((sum, r) => sum + (r.liveData?.changePercent24h || 0), 0) / rowsWithData.length
                : 0;
              return (
                <p className={`text-2xl font-bold ${avgChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(avgChange)}
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
