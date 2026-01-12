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
  Percent,
} from 'lucide-react';

interface HLPosition {
  coin: string;
  szi: number; // size (positive = long, negative = short)
  entryPx: number;
  positionValue: number;
  unrealizedPnl: number;
  returnOnEquity: number;
  leverage: number;
  liquidationPx: number | null;
  marginUsed: number;
  maxLeverage: number;
}

interface HLAccountInfo {
  accountValue: number;
  totalMarginUsed: number;
  totalNtlPos: number;
  totalRawUsd: number;
  withdrawable: number;
  crossMaintenanceMarginUsed: number;
  positions: HLPosition[];
}

const CACHE_KEY = 'hyperliquid_portfolio_cache';
const CACHE_TIMESTAMP_KEY = 'hyperliquid_portfolio_timestamp';

export default function HyperliquidPortfolio() {
  const [accountInfo, setAccountInfo] = useState<HLAccountInfo | null>(() => {
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

    const walletAddress = localStorage.getItem('hyperliquid_wallet_address');

    if (!walletAddress) {
      setError('Hyperliquid wallet address not configured. Please add it in Settings.');
      setLoading(false);
      return;
    }

    try {
      // Fetch clearinghouse state
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse positions
      const positions: HLPosition[] = [];
      if (data.assetPositions) {
        data.assetPositions.forEach((ap: any) => {
          const pos = ap.position;
          if (parseFloat(pos.szi) !== 0) {
            positions.push({
              coin: pos.coin,
              szi: parseFloat(pos.szi),
              entryPx: parseFloat(pos.entryPx),
              positionValue: parseFloat(pos.positionValue),
              unrealizedPnl: parseFloat(pos.unrealizedPnl),
              returnOnEquity: parseFloat(pos.returnOnEquity),
              leverage: parseFloat(pos.leverage?.value || '1'),
              liquidationPx: pos.liquidationPx ? parseFloat(pos.liquidationPx) : null,
              marginUsed: parseFloat(pos.marginUsed),
              maxLeverage: parseInt(pos.maxLeverage || '50'),
            });
          }
        });
      }

      const info: HLAccountInfo = {
        accountValue: parseFloat(data.marginSummary?.accountValue || '0'),
        totalMarginUsed: parseFloat(data.marginSummary?.totalMarginUsed || '0'),
        totalNtlPos: parseFloat(data.marginSummary?.totalNtlPos || '0'),
        totalRawUsd: parseFloat(data.marginSummary?.totalRawUsd || '0'),
        withdrawable: parseFloat(data.withdrawable || '0'),
        crossMaintenanceMarginUsed: parseFloat(data.crossMaintenanceMarginUsed || '0'),
        positions,
      };

      const now = new Date();
      setAccountInfo(info);
      setLastUpdate(now);
      localStorage.setItem(CACHE_KEY, JSON.stringify(info));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toISOString());

    } catch (err: any) {
      console.error('[HyperliquidPortfolio] Error:', err);
      setError(err.message || 'Failed to fetch Hyperliquid account info');
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

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(2)}%`;
  };

  const totalUnrealizedPnl = accountInfo?.positions?.reduce((sum, p) => sum + p.unrealizedPnl, 0) || 0;
  const totalPositionValue = accountInfo?.positions?.reduce((sum, p) => sum + Math.abs(p.positionValue), 0) || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Hyperliquid Portfolio</h1>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">HL</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Your Hyperliquid perpetuals positions and margin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://app.hyperliquid.xyz/trade"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Hyperliquid
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
        <div className="card bg-gradient-to-br from-green-100 to-slate-50 dark:from-green-900/50 dark:to-slate-800 border-green-200 dark:border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Account Value</p>
              <p className="text-2xl font-bold">{formatCurrency(accountInfo?.accountValue || 0)}</p>
              {lastUpdate && (
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                  Updated {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
            <Wallet className="h-8 w-8 text-green-500 dark:text-green-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">USDC Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(accountInfo?.totalRawUsd || 0)}</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                Withdrawable: {formatCurrency(accountInfo?.withdrawable || 0)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500 dark:text-blue-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Unrealized PnL</p>
              <p className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalUnrealizedPnl)}
              </p>
            </div>
            {totalUnrealizedPnl >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-500 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-500 dark:text-red-400" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Open Positions</p>
              <p className="text-2xl font-bold">{accountInfo?.positions?.length || 0}</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                Notional: {formatCurrency(totalPositionValue)}
              </p>
            </div>
            <PieChart className="h-8 w-8 text-purple-500 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Margin Usage */}
      {accountInfo && accountInfo.totalMarginUsed > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Margin Usage</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (accountInfo.totalMarginUsed / accountInfo.accountValue) > 0.8
                      ? 'bg-red-500'
                      : (accountInfo.totalMarginUsed / accountInfo.accountValue) > 0.5
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((accountInfo.totalMarginUsed / accountInfo.accountValue) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-sm text-slate-500 dark:text-gray-400">
              {formatCurrency(accountInfo.totalMarginUsed)} / {formatCurrency(accountInfo.accountValue)}
              <span className="ml-2 text-slate-500 dark:text-gray-500">
                ({((accountInfo.totalMarginUsed / accountInfo.accountValue) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Open Positions */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Open Positions</h2>
        {accountInfo?.positions && accountInfo.positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-500 dark:text-gray-400 text-sm border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-3">Asset</th>
                  <th className="pb-3">Side</th>
                  <th className="pb-3">Size</th>
                  <th className="pb-3">Entry Price</th>
                  <th className="pb-3">Position Value</th>
                  <th className="pb-3">PnL</th>
                  <th className="pb-3">ROE</th>
                  <th className="pb-3">Leverage</th>
                  <th className="pb-3">Liq. Price</th>
                </tr>
              </thead>
              <tbody>
                {accountInfo.positions
                  .sort((a, b) => Math.abs(b.positionValue) - Math.abs(a.positionValue))
                  .map((pos) => {
                    const isLong = pos.szi > 0;
                    const isProfitable = pos.unrealizedPnl >= 0;

                    return (
                      <tr key={pos.coin} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{pos.coin}</span>
                            <span className="text-xs text-slate-500 dark:text-gray-500">PERP</span>
                          </div>
                        </td>
                        <td className={`py-3 font-medium ${isLong ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </td>
                        <td className="py-3 font-mono">{formatAmount(Math.abs(pos.szi))}</td>
                        <td className="py-3 font-mono">{formatCurrency(pos.entryPx)}</td>
                        <td className="py-3 font-mono">{formatCurrency(Math.abs(pos.positionValue))}</td>
                        <td className={`py-3 font-mono font-medium ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(pos.unrealizedPnl)}
                        </td>
                        <td className={`py-3 ${pos.returnOnEquity >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatPercent(pos.returnOnEquity)}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            pos.leverage > 10 ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' :
                            pos.leverage > 5 ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                            'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                          }`}>
                            {pos.leverage.toFixed(1)}x
                          </span>
                        </td>
                        <td className="py-3 font-mono">
                          {pos.liquidationPx ? (
                            <span className="text-yellow-600 dark:text-yellow-400">{formatCurrency(pos.liquidationPx)}</span>
                          ) : (
                            <span className="text-slate-500 dark:text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No open positions</p>
            <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
              Your Hyperliquid perpetuals positions will appear here
            </p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <Percent className="h-5 w-5 text-green-500 dark:text-green-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-600 dark:text-gray-300">
              <strong>Funding Rates:</strong> Hyperliquid pays funding hourly. Positive rates mean longs pay shorts, negative rates mean shorts pay longs.
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
              Visit the DalyFunding page to see current funding rate arbitrage opportunities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
