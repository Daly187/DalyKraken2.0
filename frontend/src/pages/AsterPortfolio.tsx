import { useEffect, useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  ExternalLink,
  Wallet,
  DollarSign,
  PieChart,
} from 'lucide-react';

interface AsterBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface AsterPosition {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  leverage: number;
  marginType: string;
  liquidationPrice: number;
}

interface AsterAccountInfo {
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  availableBalance: number;
  positions: AsterPosition[];
  spotBalances: AsterBalance[];
}

const CACHE_KEY = 'aster_portfolio_cache';
const CACHE_TIMESTAMP_KEY = 'aster_portfolio_timestamp';

export default function AsterPortfolio() {
  const [accountInfo, setAccountInfo] = useState<AsterAccountInfo | null>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(() => {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    return timestamp ? new Date(timestamp) : null;
  });

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    setLoading(true);
    setError(null);

    const apiKey = localStorage.getItem('aster_api_key');
    const apiSecret = localStorage.getItem('aster_api_secret');

    if (!apiKey || !apiSecret) {
      setError('Aster API credentials not configured. Please add them in Settings.');
      setLoading(false);
      return;
    }

    try {
      const crypto = await import('crypto-js');
      const timestamp = Date.now();
      const params = `timestamp=${timestamp}&recvWindow=5000`;
      const signature = crypto.default.HmacSHA256(params, apiSecret).toString();

      // Fetch futures account info
      const futuresResponse = await fetch(
        `https://fapi.asterdex.com/fapi/v2/account?${params}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': apiKey },
        }
      );

      let futuresData: any = null;
      if (futuresResponse.ok) {
        futuresData = await futuresResponse.json();
      }

      // Fetch spot balances
      const spotResponse = await fetch(
        `https://sapi.asterdex.com/api/v1/account?${params}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': apiKey },
        }
      );

      let spotBalances: AsterBalance[] = [];
      if (spotResponse.ok) {
        const spotData = await spotResponse.json();
        if (spotData.balances) {
          spotBalances = spotData.balances
            .filter((b: any) => parseFloat(b.free) + parseFloat(b.locked) > 0)
            .map((b: any) => ({
              asset: b.asset,
              free: parseFloat(b.free),
              locked: parseFloat(b.locked),
              total: parseFloat(b.free) + parseFloat(b.locked),
            }));
        }
      }

      // Parse futures positions
      const positions: AsterPosition[] = [];
      if (futuresData?.positions) {
        futuresData.positions
          .filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .forEach((p: any) => {
            positions.push({
              symbol: p.symbol,
              positionAmt: parseFloat(p.positionAmt),
              entryPrice: parseFloat(p.entryPrice),
              markPrice: parseFloat(p.markPrice),
              unrealizedProfit: parseFloat(p.unrealizedProfit),
              leverage: parseInt(p.leverage),
              marginType: p.marginType,
              liquidationPrice: parseFloat(p.liquidationPrice),
            });
          });
      }

      const info: AsterAccountInfo = {
        totalWalletBalance: parseFloat(futuresData?.totalWalletBalance || '0'),
        totalUnrealizedProfit: parseFloat(futuresData?.totalUnrealizedProfit || '0'),
        totalMarginBalance: parseFloat(futuresData?.totalMarginBalance || '0'),
        availableBalance: parseFloat(futuresData?.availableBalance || '0'),
        positions,
        spotBalances,
      };

      const now = new Date();
      setAccountInfo(info);
      setLastUpdate(now);
      localStorage.setItem(CACHE_KEY, JSON.stringify(info));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toISOString());

    } catch (err: any) {
      console.error('[AsterPortfolio] Error:', err);
      setError(err.message || 'Failed to fetch Aster account info');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatAmount = (value: number) => {
    if (Math.abs(value) >= 1) return value.toFixed(4);
    if (Math.abs(value) >= 0.0001) return value.toFixed(6);
    return value.toFixed(8);
  };

  const totalSpotValue = accountInfo?.spotBalances?.reduce((sum, b) => sum + b.total, 0) || 0;
  const totalValue = (accountInfo?.totalMarginBalance || 0) + totalSpotValue;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Aster Portfolio</h1>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-lg font-bold text-white">A</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Your AsterDEX futures and spot holdings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://www.asterdex.com/en/futures"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            AsterDEX
          </a>
          <button
            onClick={fetchAccountInfo}
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
        <div className="card bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-purple-100 to-slate-50 dark:from-purple-900/50 dark:to-slate-800 border-purple-200 dark:border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              {lastUpdate && (
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                  Updated {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
            <Wallet className="h-8 w-8 text-purple-500 dark:text-purple-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Futures Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(accountInfo?.totalMarginBalance || 0)}</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                Available: {formatCurrency(accountInfo?.availableBalance || 0)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500 dark:text-green-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Unrealized PnL</p>
              <p className={`text-2xl font-bold ${(accountInfo?.totalUnrealizedProfit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(accountInfo?.totalUnrealizedProfit || 0)}
              </p>
            </div>
            {(accountInfo?.totalUnrealizedProfit || 0) >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-500 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-500 dark:text-red-400" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Spot Holdings</p>
              <p className="text-2xl font-bold">{accountInfo?.spotBalances?.length || 0}</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                ~{formatCurrency(totalSpotValue)} value
              </p>
            </div>
            <PieChart className="h-8 w-8 text-blue-500 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Open Futures Positions</h2>
        {accountInfo?.positions && accountInfo.positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-500 dark:text-gray-400 text-sm border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-3">Symbol</th>
                  <th className="pb-3">Side</th>
                  <th className="pb-3">Size</th>
                  <th className="pb-3">Entry Price</th>
                  <th className="pb-3">Mark Price</th>
                  <th className="pb-3">PnL</th>
                  <th className="pb-3">Leverage</th>
                  <th className="pb-3">Liq. Price</th>
                </tr>
              </thead>
              <tbody>
                {accountInfo.positions.map((pos) => {
                  const isLong = pos.positionAmt > 0;
                  const isProfitable = pos.unrealizedProfit >= 0;

                  return (
                    <tr key={pos.symbol} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 font-bold">{pos.symbol}</td>
                      <td className={`py-3 ${isLong ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isLong ? 'LONG' : 'SHORT'}
                      </td>
                      <td className="py-3 font-mono">{formatAmount(Math.abs(pos.positionAmt))}</td>
                      <td className="py-3 font-mono">{formatCurrency(pos.entryPrice)}</td>
                      <td className="py-3 font-mono">{formatCurrency(pos.markPrice)}</td>
                      <td className={`py-3 font-mono ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(pos.unrealizedProfit)}
                      </td>
                      <td className="py-3">{pos.leverage}x</td>
                      <td className="py-3 font-mono text-yellow-600 dark:text-yellow-400">{formatCurrency(pos.liquidationPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No open futures positions</p>
          </div>
        )}
      </div>

      {/* Spot Balances */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Spot Balances</h2>
        {accountInfo?.spotBalances && accountInfo.spotBalances.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {accountInfo.spotBalances
              .sort((a, b) => b.total - a.total)
              .map((balance) => (
                <div key={balance.asset} className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{balance.asset}</span>
                  </div>
                  <p className="text-lg font-mono">{formatAmount(balance.total)}</p>
                  {balance.locked > 0 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Locked: {formatAmount(balance.locked)}
                    </p>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No spot balances</p>
          </div>
        )}
      </div>
    </div>
  );
}
