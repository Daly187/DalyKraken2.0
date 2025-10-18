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
  Activity,
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
  const [creating, setCreating] = useState(false);

  // Available trading pairs
  const availableSymbols = [
    'BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD',
    'DOGE/USD', 'DOT/USD', 'LINK/USD', 'MATIC/USD', 'UNI/USD',
    'AVAX/USD', 'ATOM/USD', 'LTC/USD', 'BCH/USD', 'XLM/USD',
    'ALGO/USD', 'NEAR/USD', 'FTM/USD', 'SAND/USD', 'MANA/USD',
  ];

  // Bot creation form state
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC/USD']);
  const [formData, setFormData] = useState({
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

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) => {
      if (prev.includes(symbol)) {
        // Don't allow deselecting all symbols
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  const selectAllSymbols = () => {
    setSelectedSymbols([...availableSymbols]);
  };

  const clearAllSymbols = () => {
    setSelectedSymbols(['BTC/USD']); // Keep at least one
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Create a bot for each selected symbol
      const createPromises = selectedSymbols.map((symbol) =>
        createDCABot({
          symbol,
          ...formData,
        })
      );

      await Promise.all(createPromises);

      // Reset form
      setSelectedSymbols(['BTC/USD']);
      setFormData({
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
      console.error('Failed to create bot(s):', error);
    } finally {
      setCreating(false);
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
        <div className="relative overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 pointer-events-none" />

          <div className="card relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                  Create New DCA Bot
                </h2>
                <p className="text-sm text-gray-400 mt-1">Configure your automated trading strategy</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                <Plus className="h-6 w-6 text-white" />
              </div>
            </div>

            <form onSubmit={handleCreateBot} className="space-y-6">
              {/* Symbol Selection */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                      <Target className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white">
                        Trading Pairs
                      </label>
                      <p className="text-xs text-gray-400">
                        <span className="text-primary-400 font-medium">{selectedSymbols.length}</span> selected
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllSymbols}
                      className="px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 text-xs font-medium transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllSymbols}
                      className="px-3 py-1.5 rounded-lg bg-slate-600/30 hover:bg-slate-600/50 text-gray-400 text-xs font-medium transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
                  {availableSymbols.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => toggleSymbol(symbol)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                        selectedSymbols.includes(symbol)
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 scale-105'
                          : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50 hover:text-gray-300'
                      }`}
                    >
                      {symbol.replace('/USD', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Summary */}
              {selectedSymbols.length > 0 && (
                <div className="relative p-5 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">Creation Preview</h3>
                      <span className="ml-auto px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-xs font-bold">
                        {selectedSymbols.length} Bot{selectedSymbols.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Initial Capital</p>
                        <p className="text-lg font-bold text-white">
                          ${formData.initialOrderAmount * selectedSymbols.length}
                        </p>
                        <p className="text-xs text-gray-500">${formData.initialOrderAmount} × {selectedSymbols.length}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Entries Each</p>
                        <p className="text-lg font-bold text-white">{formData.reEntryCount}</p>
                        <p className="text-xs text-gray-500">Max per bot</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Max Investment</p>
                        <p className="text-lg font-bold text-white">
                          ${(formData.initialOrderAmount * (Math.pow(formData.tradeMultiplier, formData.reEntryCount) - 1) / (formData.tradeMultiplier - 1) * selectedSymbols.length).toFixed(0)}
                        </p>
                        <p className="text-xs text-gray-500">If all entries fill</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Target Profit</p>
                        <p className="text-lg font-bold text-green-400">+{formData.tpTarget}%</p>
                        <p className="text-xs text-gray-500">Per bot minimum</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Grid */}
              <div className="grid md:grid-cols-3 gap-5">
                {/* Initial Order Amount */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    Initial Order Amount
                    <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.initialOrderAmount}
                      onChange={(e) => setFormData({ ...formData, initialOrderAmount: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                      required
                    />
                  </div>
                </div>

                {/* Trade Multiplier */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    Trade Multiplier
                    <span className="text-xs text-gray-500 font-normal">({formData.tradeMultiplier}x)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.tradeMultiplier}
                    onChange={(e) => setFormData({ ...formData, tradeMultiplier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Next: <span className="text-primary-400 font-medium">${formData.initialOrderAmount * formData.tradeMultiplier}</span>
                  </p>
                </div>

                {/* Re-Entry Count */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="h-4 w-4 text-purple-400" />
                    Max Re-Entries
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.reEntryCount}
                    onChange={(e) => setFormData({ ...formData, reEntryCount: parseInt(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                {/* Step Percent */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <TrendingDown className="h-4 w-4 text-orange-400" />
                    Step Percent
                    <span className="text-xs text-gray-500 font-normal">({formData.stepPercent}%)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.stepPercent}
                      onChange={(e) => setFormData({ ...formData, stepPercent: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Price drop trigger</p>
                </div>

                {/* Step Multiplier */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Activity className="h-4 w-4 text-pink-400" />
                    Step Multiplier
                    <span className="text-xs text-gray-500 font-normal">({formData.stepMultiplier}x)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.stepMultiplier}
                    onChange={(e) => setFormData({ ...formData, stepMultiplier: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    E2: {formData.stepPercent}%, E3: {formData.stepPercent * formData.stepMultiplier}%
                  </p>
                </div>

                {/* TP Target */}
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="h-4 w-4 text-green-400" />
                    TP Target
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.tpTarget}
                      onChange={(e) => setFormData({ ...formData, tpTarget: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Min from avg price</p>
                </div>

                {/* Re-Entry Delay */}
                <div className="group md:col-span-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <Clock className="h-4 w-4 text-yellow-400" />
                    Re-Entry Delay
                    <span className="text-xs text-gray-500 font-normal">({formData.reEntryDelay} minutes)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reEntryDelay}
                    onChange={(e) => setFormData({ ...formData, reEntryDelay: parseInt(e.target.value) })}
                    className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-2">Cooldown between re-entries (prevents over-trading)</p>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Support/Resistance Toggle */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-600/30 hover:border-slate-500/50 transition-colors">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.supportResistanceEnabled}
                      onChange={(e) => setFormData({ ...formData, supportResistanceEnabled: e.target.checked })}
                      className="mt-1 h-5 w-5 rounded-lg bg-slate-700 border-slate-600 text-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">Support/Resistance</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Wait for price to cross support level before entering
                      </p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      formData.supportResistanceEnabled
                        ? 'bg-primary-500/20 text-primary-300'
                        : 'bg-slate-700 text-gray-500'
                    }`}>
                      {formData.supportResistanceEnabled ? 'ON' : 'OFF'}
                    </div>
                  </label>
                </div>

                {/* Trend Alignment Toggle */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-600/30 hover:border-slate-500/50 transition-colors">
                  <label className="flex items-start gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.trendAlignmentEnabled}
                      onChange={(e) => setFormData({ ...formData, trendAlignmentEnabled: e.target.checked })}
                      className="mt-1 h-5 w-5 rounded-lg bg-slate-700 border-slate-600 text-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-white">Trend Alignment</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Only enter positions when both tech & trend scores are bullish
                      </p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      formData.trendAlignmentEnabled
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-slate-700 text-gray-500'
                    }`}>
                      {formData.trendAlignmentEnabled ? 'ON' : 'OFF'}
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className={`flex-1 relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 ${
                    creating || selectedSymbols.length === 0
                      ? 'bg-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40'
                  }`}
                  disabled={creating || selectedSymbols.length === 0}
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {creating ? (
                      <>
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating {selectedSymbols.length} Bot{selectedSymbols.length > 1 ? 's' : ''}...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        <span>Create {selectedSymbols.length} Bot{selectedSymbols.length > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-4 rounded-xl font-medium text-gray-300 bg-slate-800/50 border border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all"
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>

              {/* Selected Symbols Preview */}
              {selectedSymbols.length > 1 && !creating && (
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-600/30">
                  <p className="text-xs text-gray-400 mb-2">Selected symbols:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSymbols.map((symbol) => (
                      <span
                        key={symbol}
                        className="px-2 py-1 rounded-md bg-primary-500/10 text-primary-300 text-xs font-medium"
                      >
                        {symbol.replace('/USD', '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
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
