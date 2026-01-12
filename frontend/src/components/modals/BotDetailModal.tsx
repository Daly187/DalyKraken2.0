/**
 * BotDetailModal - Full bot detail view in a modal popup
 *
 * UI-only change: Moved the existing inline-expanded bot detail view into a modal.
 * All existing actions (Edit, Pause/Resume, Exit Position, Delete) are preserved.
 * No business logic changes - just presentation.
 */

import { useState } from 'react';
import {
  X,
  Edit,
  Save,
  Trash2,
  LogOut,
  BarChart3,
  Zap,
  Settings,
  Target,
  Layers,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface BotDetailModalProps {
  bot: any;
  botWithTrend: any;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (bot: any) => void;
  onSaveEdit: (botId: string, formData: any) => void;
  onPauseResume: (bot: any) => void;
  onDelete: (botId: string) => void;
  onManualExit: (botId: string, symbol: string) => void;
  executing: boolean;
  trendDataTimestamp: number | null;
  formatCurrency: (value: number | undefined | null) => string;
  formatTrendTimestamp: (timestamp: number | null) => string;
  getTrendDisplay: (recommendation?: 'bullish' | 'bearish' | 'neutral') => {
    label: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
  };
  getDisplayStatus: (bot: any) => { status: string; displayText: string };
  getStatusColor: (status: string) => string;
  fetchDCABots: () => void;
  apiUrl: string;
}

export default function BotDetailModal({
  bot,
  botWithTrend,
  isOpen,
  onClose,
  onEdit,
  onSaveEdit,
  onPauseResume,
  onDelete,
  onManualExit,
  executing,
  trendDataTimestamp,
  formatCurrency,
  formatTrendTimestamp,
  getTrendDisplay,
  getDisplayStatus,
  getStatusColor,
  fetchDCABots,
  apiUrl,
}: BotDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});

  if (!isOpen || !bot) return null;

  const handleEditStart = () => {
    setIsEditing(true);
    setEditFormData({
      initialOrderAmount: bot.initialOrderAmount,
      tradeMultiplier: bot.tradeMultiplier,
      reEntryCount: bot.reEntryCount,
      stepPercent: bot.stepPercent,
      stepMultiplier: bot.stepMultiplier,
      tpTarget: bot.tpTarget,
      exitPercentage: bot.exitPercentage || 90,
      supportResistanceEnabled: bot.supportResistanceEnabled,
      reEntryDelay: bot.reEntryDelay,
      trendAlignmentEnabled: bot.trendAlignmentEnabled,
    });
  };

  const handleSave = () => {
    onSaveEdit(bot.id, editFormData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(bot.id);
    onClose();
  };

  const trend = getTrendDisplay(botWithTrend.recommendation);
  const TrendIcon = trend.icon;
  const displayStatus = getDisplayStatus(bot);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">{bot.symbol}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(displayStatus.status)}`}>
              {displayStatus.displayText}
            </span>
            <span className="text-sm text-gray-400">
              {bot.currentEntryCount || 0}/{bot.reEntryCount} entries
            </span>
            {bot.createdAt && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(bot.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Exit Status Indicators */}
          {bot.status === 'exiting' && bot.exitFailureReason && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5 animate-spin" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-1">Auto-Retrying Exit Order</h4>
                  <p className="text-xs text-yellow-300 mb-2">{bot.exitFailureReason}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {bot.exitFailureTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last attempt: {new Date(bot.exitFailureTime).toLocaleString()}
                      </span>
                    )}
                    {bot.exitAttempts && <span>Retry #{bot.exitAttempts}</span>}
                  </div>
                  <p className="text-xs text-yellow-400 mt-2">
                    System will automatically retry until success. No action needed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {bot.status === 'exit_failed' && bot.exitFailureReason && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-400 mb-1">Exit Order Failed (Manual Retry Required)</h4>
                  <p className="text-xs text-red-300 mb-2">{bot.exitFailureReason}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                    {bot.exitFailureTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(bot.exitFailureTime).toLocaleString()}
                      </span>
                    )}
                    {bot.exitAttempts && <span>Failed attempts: {bot.exitAttempts}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    This error cannot be auto-retried. Please fix the issue and click retry.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`${apiUrl}/dca-bots/${bot.id}/retry-exit`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'x-kraken-api-key': localStorage.getItem('krakenApiKey') || '',
                            'x-kraken-api-secret': localStorage.getItem('krakenApiSecret') || '',
                          },
                        });
                        if (response.ok) {
                          fetchDCABots();
                          alert('Exit retry initiated successfully');
                        } else {
                          const error = await response.json();
                          alert(`Retry failed: ${error.error}`);
                        }
                      } catch (error: any) {
                        alert(`Error: ${error.message}`);
                      }
                    }}
                    className="btn btn-sm bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry Exit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Performance Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Current Performance
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Invested</p>
                <p className="text-lg font-bold text-white">{formatCurrency(bot.totalInvested || 0)}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Holdings</p>
                <p className="text-lg font-bold text-purple-400">
                  {bot.totalQuantity ? bot.totalQuantity.toFixed(6) : '0.000000'}
                </p>
                <p className="text-xs text-gray-500">{bot.symbol.split('/')[0]}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Current Value</p>
                <p className="text-lg font-bold text-white">
                  {formatCurrency((bot.totalInvested || 0) + (bot.unrealizedPnL || 0))}
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Unrealized P&L</p>
                <p className={`text-lg font-bold ${bot.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(bot.unrealizedPnL || 0)}
                </p>
                <p className={`text-xs ${bot.unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {bot.unrealizedPnLPercent >= 0 ? '+' : ''}{bot.unrealizedPnLPercent?.toFixed(2)}%
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Avg Price</p>
                <p className="text-lg font-bold text-white">{formatCurrency(bot.averagePurchasePrice || 0)}</p>
                <p className="text-xs text-gray-500">Current: {formatCurrency(bot.currentPrice || 0)}</p>
              </div>
            </div>
          </div>

          {/* Market Analysis */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              Market Analysis
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">Market Trend</p>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${trend.bgColor} border ${trend.borderColor}`}>
                  <TrendIcon className={`h-5 w-5 ${trend.color}`} />
                  <span className={`text-sm font-bold ${trend.color}`}>{trend.label}</span>
                </div>
                <div className="mt-2 flex gap-2 text-xs text-gray-500">
                  <span>Tech: <span className={(botWithTrend.techScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}>{(botWithTrend.techScore || 0).toFixed(1)}</span></span>
                  <span>|</span>
                  <span>Trend: <span className={(botWithTrend.trendScore || 0) > 50 ? 'text-green-400' : 'text-red-400'}>{(botWithTrend.trendScore || 0).toFixed(1)}</span></span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Updated {formatTrendTimestamp(trendDataTimestamp)}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Current Price</p>
                <p className="text-lg font-bold text-white">{formatCurrency(bot.currentPrice || 0)}</p>
                <p className="text-xs text-gray-500">
                  {bot.currentPrice > bot.averagePurchasePrice ? '↑' : '↓'} from avg
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Next Entry Price</p>
                <p className="text-lg font-bold text-blue-400">
                  {bot.nextEntryPrice ? formatCurrency(bot.nextEntryPrice) : 'N/A'}
                </p>
                {bot.nextEntryPrice && bot.currentPrice && (
                  <p className="text-xs text-gray-500">
                    {((1 - bot.nextEntryPrice / bot.currentPrice) * 100).toFixed(2)}% drop needed
                  </p>
                )}
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">TP Target Price</p>
                <p className="text-lg font-bold text-green-400">
                  {bot.currentTpPrice ? formatCurrency(bot.currentTpPrice) : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Min {bot.tpTarget}% profit</p>
              </div>
            </div>
          </div>

          {/* Support & Resistance Levels */}
          {bot.supportResistanceEnabled && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                Support & Resistance Levels
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
                  Enabled
                </span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Current Support</p>
                  <p className="text-lg font-bold text-green-400">
                    {bot.currentSupport ? formatCurrency(bot.currentSupport) : formatCurrency((bot.currentPrice || 0) * 0.95)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bot.currentPrice && bot.currentSupport
                      ? `${(((bot.currentPrice - bot.currentSupport) / bot.currentPrice) * 100).toFixed(2)}% below`
                      : '~5% below current'}
                  </p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Current Resistance</p>
                  <p className="text-lg font-bold text-red-400">
                    {bot.currentResistance ? formatCurrency(bot.currentResistance) : formatCurrency((bot.currentPrice || 0) * 1.05)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bot.currentPrice && bot.currentResistance
                      ? `${(((bot.currentResistance - bot.currentPrice) / bot.currentPrice) * 100).toFixed(2)}% above`
                      : '~5% above current'}
                  </p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Next Support</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {bot.nextSupport ? formatCurrency(bot.nextSupport) : formatCurrency((bot.currentPrice || 0) * 0.90)}
                  </p>
                  <p className="text-xs text-gray-500">Entry trigger zone</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">S/R Status</p>
                  {bot.currentPrice && (
                    <>
                      {bot.currentPrice <= (bot.currentSupport || (bot.currentPrice * 0.95)) ? (
                        <p className="text-lg font-bold text-green-400">At Support</p>
                      ) : bot.currentPrice >= (bot.currentResistance || (bot.currentPrice * 1.05)) ? (
                        <p className="text-lg font-bold text-red-400">At Resistance</p>
                      ) : (
                        <p className="text-lg font-bold text-blue-400">In Range</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {bot.currentPrice <= (bot.currentSupport || (bot.currentPrice * 0.95))
                          ? 'Entry conditions met'
                          : 'Waiting for support'}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-xs text-purple-300">
                  <strong>S/R Strategy:</strong> Bot will only enter new positions when price crosses below the current support level,
                  reducing false entries during sideways movement and improving entry timing.
                </p>
              </div>
            </div>
          )}

          {/* Bot Configuration */}
          {isEditing ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Edit className="h-4 w-4 text-orange-400" />
                Edit Configuration
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Initial Amount ($)</label>
                  <input
                    type="number"
                    value={editFormData.initialOrderAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, initialOrderAmount: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Trade Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.tradeMultiplier}
                    onChange={(e) => setEditFormData({ ...editFormData, tradeMultiplier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Max Entries</label>
                  <input
                    type="number"
                    value={editFormData.reEntryCount}
                    onChange={(e) => setEditFormData({ ...editFormData, reEntryCount: parseInt(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Step %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.stepPercent}
                    onChange={(e) => setEditFormData({ ...editFormData, stepPercent: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Step Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.stepMultiplier}
                    onChange={(e) => setEditFormData({ ...editFormData, stepMultiplier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">TP Target %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.tpTarget}
                    onChange={(e) => setEditFormData({ ...editFormData, tpTarget: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Exit % (Sell on exit)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={editFormData.exitPercentage}
                    onChange={(e) => setEditFormData({ ...editFormData, exitPercentage: parseInt(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Keep {100 - (editFormData.exitPercentage || 90)}%</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">Re-Entry Delay (minutes)</label>
                  <input
                    type="number"
                    value={editFormData.reEntryDelay}
                    onChange={(e) => setEditFormData({ ...editFormData, reEntryDelay: parseInt(e.target.value) })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.trendAlignmentEnabled}
                    onChange={(e) => setEditFormData({ ...editFormData, trendAlignmentEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <label className="text-xs text-gray-400">Trend Alignment</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.supportResistanceEnabled}
                    onChange={(e) => setEditFormData({ ...editFormData, supportResistanceEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <label className="text-xs text-gray-400">Support/Resistance</label>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSave}
                  className="btn btn-primary btn-sm flex items-center gap-2"
                >
                  <Save className="h-3 w-3" />
                  Save Changes
                </button>
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-400" />
                Bot Configuration
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Initial Amount</p>
                  <p className="text-white font-medium">${bot.initialOrderAmount}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Trade Multiplier</p>
                  <p className="text-white font-medium">{bot.tradeMultiplier}x</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Step %</p>
                  <p className="text-white font-medium">{bot.stepPercent}%</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Step Multiplier</p>
                  <p className="text-white font-medium">{bot.stepMultiplier}x</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Max Entries</p>
                  <p className="text-white font-medium">{bot.reEntryCount}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">TP Target</p>
                  <p className="text-white font-medium">{bot.tpTarget}%</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Re-Entry Delay</p>
                  <p className="text-white font-medium">{bot.reEntryDelay}m</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Features</p>
                  <div className="flex gap-1 mt-1">
                    {bot.trendAlignmentEnabled && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">Trend</span>
                    )}
                    {bot.supportResistanceEnabled && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">S/R</span>
                    )}
                    {!bot.trendAlignmentEnabled && !bot.supportResistanceEnabled && (
                      <span className="text-gray-500 text-xs">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Entry History */}
          {bot.entries && bot.entries.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" />
                Entry History ({bot.entries.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {bot.entries.map((entry: any, index: number) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400 font-mono">#{entry.entryNumber}</span>
                      <span className="text-white font-medium">{formatCurrency(entry.price)}</span>
                      <span className="text-gray-400">{entry.quantity?.toFixed(6)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{formatCurrency(entry.orderAmount)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${entry.status === 'filled' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                        {entry.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-700 bg-slate-800/50">
          <div className="flex gap-2">
            {!isEditing && (
              <button
                onClick={handleEditStart}
                className="btn btn-secondary btn-sm flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Bot
              </button>
            )}
            <button
              onClick={() => onPauseResume(bot)}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              {bot.status === 'active' || bot.status === 'exiting' ? (
                <>
                  <Activity className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  Resume
                </>
              )}
            </button>
          </div>
          <div className="flex gap-2">
            {!isEditing && bot.currentEntryCount > 0 && (
              <button
                onClick={() => onManualExit(bot.id, bot.symbol)}
                disabled={executing}
                className="btn btn-warning btn-sm flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {executing ? 'Exiting...' : 'Exit Position'}
              </button>
            )}
            <button
              onClick={handleDelete}
              className="btn btn-danger btn-sm flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Bot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
