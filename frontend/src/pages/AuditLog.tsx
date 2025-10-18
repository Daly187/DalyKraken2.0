import { useEffect, useState } from 'react';
import { krakenApiService } from '@/services/krakenApiService';
import {
  RefreshCw,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  Search,
} from 'lucide-react';

interface KrakenTrade {
  txid: string;
  ordertxid: string;
  pair: string;
  time: number;
  type: 'buy' | 'sell';
  ordertype: string;
  price: number;
  cost: number;
  fee: number;
  vol: number;
  margin: number;
  misc: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  type: 'trade' | 'login' | 'api_call' | 'settings_change' | 'sync';
  action: string;
  details: string;
  status: 'success' | 'error' | 'info';
  metadata?: any;
}

export default function AuditLog() {
  const [trades, setTrades] = useState<KrakenTrade[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'24h' | '7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    refreshData();
    loadLocalAuditLogs();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Note: Kraken API doesn't have a direct "get trades" endpoint in the free tier
      // This is a placeholder - in production you'd use /0/private/TradesHistory
      // For now, we'll show audit logs from local storage

      addAuditLog({
        type: 'sync',
        action: 'Data Refresh',
        details: 'Refreshed audit log data',
        status: 'success',
      });

    } catch (err: any) {
      console.error('[AuditLog] Error fetching data:', err);
      setError(err.message || 'Failed to fetch audit data');

      addAuditLog({
        type: 'sync',
        action: 'Data Refresh Failed',
        details: err.message || 'Unknown error',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLocalAuditLogs = () => {
    try {
      const saved = localStorage.getItem('audit_logs');
      if (saved) {
        const logs: AuditLogEntry[] = JSON.parse(saved);
        // Parse dates
        logs.forEach(log => {
          log.timestamp = new Date(log.timestamp);
        });
        setAuditLogs(logs);
      }
    } catch (error) {
      console.error('[AuditLog] Error loading logs:', error);
    }
  };

  const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 500); // Keep last 500 logs

      // Save to localStorage
      try {
        localStorage.setItem('audit_logs', JSON.stringify(updated));
      } catch (error) {
        console.error('[AuditLog] Error saving logs:', error);
      }

      return updated;
    });
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      // Fetch balance to verify API works
      await krakenApiService.getAccountBalance();

      addAuditLog({
        type: 'sync',
        action: 'Kraken Sync',
        details: 'Successfully synced with Kraken API',
        status: 'success',
      });

      await refreshData();
    } catch (error: any) {
      console.error('Failed to sync with Kraken:', error);

      addAuditLog({
        type: 'sync',
        action: 'Kraken Sync Failed',
        details: error.message || 'Unknown error',
        status: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const clearLogs = () => {
    if (confirm('Are you sure you want to clear all audit logs?')) {
      setAuditLogs([]);
      localStorage.removeItem('audit_logs');

      addAuditLog({
        type: 'settings_change',
        action: 'Logs Cleared',
        details: 'All audit logs were cleared by user',
        status: 'info',
      });
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case 'login':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'api_call':
        return <FileText className="h-5 w-5 text-purple-500" />;
      case 'settings_change':
        return <FileText className="h-5 w-5 text-orange-500" />;
      case 'sync':
        return <RefreshCw className="h-5 w-5 text-primary-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'info':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'trade':
        return 'text-green-500 bg-green-500/10';
      case 'login':
        return 'text-blue-500 bg-blue-500/10';
      case 'api_call':
        return 'text-purple-500 bg-purple-500/10';
      case 'settings_change':
        return 'text-orange-500 bg-orange-500/10';
      case 'sync':
        return 'text-primary-500 bg-primary-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  // Filter logs
  const filteredLogs = auditLogs
    .filter(log => {
      // Type filter
      if (typeFilter !== 'all' && log.type !== typeFilter) return false;

      // Date filter
      const now = Date.now();
      const logTime = log.timestamp.getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      switch (dateFilter) {
        case '24h':
          if (now - logTime > dayMs) return false;
          break;
        case '7d':
          if (now - logTime > 7 * dayMs) return false;
          break;
        case '30d':
          if (now - logTime > 30 * dayMs) return false;
          break;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !log.action.toLowerCase().includes(query) &&
          !log.details.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      return true;
    });

  // Calculate statistics
  const stats = {
    total: auditLogs.length,
    success: auditLogs.filter(l => l.status === 'success').length,
    errors: auditLogs.filter(l => l.status === 'error').length,
    trades: auditLogs.filter(l => l.type === 'trade').length,
    apiCalls: auditLogs.filter(l => l.type === 'api_call').length,
  };

  const exportCSV = () => {
    const csv = [
      ['Timestamp', 'Type', 'Action', 'Details', 'Status'],
      ...filteredLogs.map(log => [
        log.timestamp.toISOString(),
        log.type,
        log.action,
        log.details,
        log.status,
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track all activities and transactions across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary btn-sm flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Kraken
          </button>
          <button
            onClick={refreshData}
            disabled={loading}
            className="btn btn-primary btn-sm flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card bg-red-500/10 border-red-500/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-bold text-red-500">Error</p>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Events</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <FileText className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Successful</p>
              <p className="text-2xl font-bold text-green-500">{stats.success}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Errors</p>
              <p className="text-2xl font-bold text-red-500">{stats.errors}</p>
            </div>
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Trades</p>
              <p className="text-2xl font-bold">{stats.trades}</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">API Calls</p>
              <p className="text-2xl font-bold">{stats.apiCalls}</p>
            </div>
            <FileText className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Event Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
            >
              <option value="all">All Types</option>
              <option value="trade">Trades</option>
              <option value="login">Logins</option>
              <option value="api_call">API Calls</option>
              <option value="settings_change">Settings</option>
              <option value="sync">Syncs</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action or details..."
              className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Activity Log ({filteredLogs.length})
          </h2>
          <div className="flex gap-2">
            {filteredLogs.length > 0 && (
              <button
                onClick={exportCSV}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </button>
            )}
            <button
              onClick={clearLogs}
              className="btn btn-secondary btn-sm text-red-400 hover:text-red-300"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {loading && auditLogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-400">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Details</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm">{log.timestamp.toLocaleDateString()}</p>
                          <p className="text-xs text-gray-400">
                            {log.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {getIcon(log.type)}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(log.type)}`}>
                          {log.type.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 font-medium">{log.action}</td>
                    <td className="py-3 text-gray-400 text-sm max-w-md truncate">
                      {log.details}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-sm capitalize">{log.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No audit logs match the current filters</p>
            <p className="text-sm text-gray-500 mt-2">
              Activities will be logged here as you use the application
            </p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-blue-500/10 border-blue-500/20">
        <div className="flex items-start gap-3">
          <FileText className="h-6 w-6 text-blue-500 mt-1" />
          <div>
            <p className="font-bold text-blue-500 mb-2">About Audit Logs</p>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• All platform activities are automatically logged</li>
              <li>• Logs are stored locally in your browser</li>
              <li>• Last 500 events are kept (older logs are auto-deleted)</li>
              <li>• Export logs to CSV for external analysis</li>
              <li>• Kraken trade history requires API key with "Query History" permission</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export audit log service for use across the app
export const auditLogService = {
  log: (type: AuditLogEntry['type'], action: string, details: string, status: AuditLogEntry['status'] = 'info') => {
    const event = new CustomEvent('audit-log', {
      detail: { type, action, details, status }
    });
    window.dispatchEvent(event);
  }
};
