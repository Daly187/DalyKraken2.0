import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
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
} from 'lucide-react';
import type { DCABotConfig } from '@/types';

export default function DalyDCA() {
  const dcaBots = useStore((state) => state.dcaBots);
  const fetchDCABots = useStore((state) => state.fetchDCABots);
  const createDCABot = useStore((state) => state.createDCABot);
  const pauseDCABot = useStore((state) => state.pauseDCABot);
  const resumeDCABot = useStore((state) => state.resumeDCABot);
  const deleteDCABot = useStore((state) => state.deleteDCABot);

  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);

  // Bot creation form state
  const [formData, setFormData] = useState({
    symbol: 'BTC/USD',
    initialOrderAmount: 10,
    tradeMultiplier: 2,
    reEntryCount: 8,
    stepPercent: 1,
    stepMultiplier: 2,
    tpTarget: 3,
    supportResistanceEnabled: false,
    reEntryDelay: 888,
    trendAlignmentEnabled: true,
  });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      await fetchDCABots();
    } catch (error) {
      console.error('Failed to refresh DCA bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDCABot(formData);
      // Reset form
      setFormData({
        symbol: 'BTC/USD',
        initialOrderAmount: 10,
        tradeMultiplier: 2,
        reEntryCount: 8,
        stepPercent: 1,
        stepMultiplier: 2,
        tpTarget: 3,
        supportResistanceEnabled: false,
        reEntryDelay: 888,
        trendAlignmentEnabled: true,
      });
    } catch (error) {
      console.error('Failed to create bot:', error);
    }
  };

  const handlePauseResume = async (bot: any) => {
    try {
      if (bot.status === 'active') {
        await pauseDCABot(bot.id);
      } else if (bot.status === 'paused') {
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
      } catch (error) {
        console.error('Failed to delete bot:', error);
      }
    }
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'paused':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'completed':
        return 'text-blue-500 bg-blue-500/10';
      case 'stopped':
        return 'text-gray-500 bg-gray-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const activeBots = dcaBots.filter((bot) => bot.status === 'active');
  const totalInvested = dcaBots.reduce((sum, bot) => sum + (bot.totalInvested || 0), 0);
  const totalUnrealizedPnL = dcaBots.reduce((sum, bot) => sum + (bot.unrealizedPnL || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">DalyDCA Strategy</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary btn-sm flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          {showCreateForm ? 'Hide Form' : 'Create Bot'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Bots</p>
              <p className="text-xl font-bold">{activeBots.length}</p>
            </div>
            <Play className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Bots</p>
              <p className="text-xl font-bold">{dcaBots.length}</p>
            </div>
            <Settings className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Invested</p>
              <p className="text-xl font-bold">{formatCurrency(totalInvested)}</p>
            </div>
            <DollarSign className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unrealized P&L</p>
              <p className={`text-xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(totalUnrealizedPnL)}
              </p>
            </div>
            {totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="h-10 w-10 text-green-500" />
            ) : (
              <TrendingDown className="h-10 w-10 text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Bot Creation Form */}
      {showCreateForm && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Create New DCA Bot</h2>
          <form onSubmit={handleCreateBot}>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Symbol */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="e.g., BTC/USD"
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                  required
                />
              </div>

              {/* Initial Order Amount */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Initial Order Amount (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.initialOrderAmount}
                  onChange={(e) => setFormData({ ...formData, initialOrderAmount: parseFloat(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                  required
                />
              </div>

              {/* Trade Multiplier */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Trade Multiplier
                  <span className="text-xs ml-2">(default: 2x)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formData.tradeMultiplier}
                  onChange={(e) => setFormData({ ...formData, tradeMultiplier: parseFloat(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Next order: ${formData.initialOrderAmount * formData.tradeMultiplier}
                </p>
              </div>

              {/* Re-Entry Count */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Re-Entry Count
                  <span className="text-xs ml-2">(default: 8)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.reEntryCount}
                  onChange={(e) => setFormData({ ...formData, reEntryCount: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                />
              </div>

              {/* Step Percent */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Step Percent (%)
                  <span className="text-xs ml-2">(default: 1%)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.stepPercent}
                  onChange={(e) => setFormData({ ...formData, stepPercent: parseFloat(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Price drop triggers re-entry
                </p>
              </div>

              {/* Step Multiplier */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Step Multiplier
                  <span className="text-xs ml-2">(default: 2x)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formData.stepMultiplier}
                  onChange={(e) => setFormData({ ...formData, stepMultiplier: parseFloat(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Entry 2: {formData.stepPercent}%, Entry 3: {formData.stepPercent * formData.stepMultiplier}%
                </p>
              </div>

              {/* TP Target */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  TP Target (%)
                  <span className="text-xs ml-2">(default: 3%)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.tpTarget}
                  onChange={(e) => setFormData({ ...formData, tpTarget: parseFloat(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum TP from avg price
                </p>
              </div>

              {/* Re-Entry Delay */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Re-Entry Delay (minutes)
                  <span className="text-xs ml-2">(default: 888)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.reEntryDelay}
                  onChange={(e) => setFormData({ ...formData, reEntryDelay: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Delay between re-entries
                </p>
              </div>

              {/* Support/Resistance Toggle */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supportResistanceEnabled}
                    onChange={(e) => setFormData({ ...formData, supportResistanceEnabled: e.target.checked })}
                    className="mr-3 h-5 w-5 rounded"
                  />
                  <div>
                    <span className="text-sm text-gray-400">Support/Resistance</span>
                    <p className="text-xs text-gray-500">
                      Wait for support cross
                    </p>
                  </div>
                </label>
              </div>

              {/* Trend Alignment Toggle */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.trendAlignmentEnabled}
                    onChange={(e) => setFormData({ ...formData, trendAlignmentEnabled: e.target.checked })}
                    className="mr-3 h-5 w-5 rounded"
                  />
                  <div>
                    <span className="text-sm text-gray-400">Trend Alignment</span>
                    <p className="text-xs text-gray-500">
                      Only enter on bullish signals
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button type="submit" className="btn btn-primary">
                <Plus className="mr-2 h-4 w-4" />
                Create Bot
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Live Bots Table */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Live Bots</h2>
          <button
            onClick={refreshData}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {dcaBots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-3">Symbol</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Entries</th>
                  <th className="pb-3">Avg Price</th>
                  <th className="pb-3">Current Price</th>
                  <th className="pb-3">Invested</th>
                  <th className="pb-3">P&L</th>
                  <th className="pb-3">TP Target</th>
                  <th className="pb-3">Next Entry</th>
                  <th className="pb-3">Trend</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dcaBots.map((bot) => (
                  <tr key={bot.id} className="border-t border-slate-700">
                    <td className="py-3 font-medium">{bot.symbol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(bot.status)}`}>
                        {bot.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">
                      {bot.currentEntryCount || 0}/{bot.reEntryCount}
                    </td>
                    <td className="py-3 text-gray-400">
                      {formatCurrency(bot.averagePurchasePrice || 0)}
                    </td>
                    <td className="py-3 text-gray-400">
                      {formatCurrency(bot.currentPrice || 0)}
                    </td>
                    <td className="py-3 text-gray-400">
                      {formatCurrency(bot.totalInvested || 0)}
                    </td>
                    <td className="py-3">
                      <div className={bot.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
                        <div className="font-medium">{formatCurrency(bot.unrealizedPnL || 0)}</div>
                        <div className="text-xs">
                          {bot.unrealizedPnLPercent ? bot.unrealizedPnLPercent.toFixed(2) : '0.00'}%
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-gray-400">
                      {bot.currentTpPrice ? formatCurrency(bot.currentTpPrice) : 'N/A'}
                    </td>
                    <td className="py-3 text-gray-400">
                      {bot.nextEntryPrice ? formatCurrency(bot.nextEntryPrice) : 'N/A'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {bot.trendAlignmentEnabled ? (
                          <>
                            {bot.techScore > 50 && bot.trendScore > 50 ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            <span className="text-xs text-gray-400">
                              {bot.techScore || 0}/{bot.trendScore || 0}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">Off</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePauseResume(bot)}
                          className="btn btn-sm btn-secondary"
                          title={bot.status === 'active' ? 'Pause' : 'Resume'}
                        >
                          {bot.status === 'active' ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(bot.id)}
                          className="btn btn-sm btn-danger"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No active DCA bots</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Bot
            </button>
          </div>
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
