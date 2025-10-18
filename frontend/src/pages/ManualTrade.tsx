import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { krakenApiService } from '@/services/krakenApiService';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowDownUp,
} from 'lucide-react';

interface OrderForm {
  pair: string;
  type: 'buy' | 'sell';
  volume: string;
  price: string;
}

interface TradingPair {
  pair: string;
  symbol: string;
  price: number;
  change24h: number;
}

export default function ManualTrade() {
  const livePrices = useStore((state) => state.livePrices);
  const fetchLivePrices = useStore((state) => state.fetchLivePrices);

  const [orderForm, setOrderForm] = useState<OrderForm>({
    pair: '',
    type: 'buy',
    volume: '',
    price: '',
  });

  const [loading, setLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [estimatedTotal, setEstimatedTotal] = useState<number>(0);

  // Available trading pairs
  const tradingPairs: TradingPair[] = Array.from(livePrices.values()).map(
    (price) => ({
      pair: price.symbol.replace('/', ''),
      symbol: price.symbol,
      price: price.price,
      change24h: price.change24h,
    })
  );

  useEffect(() => {
    // Fetch live prices and balance on mount
    fetchLivePrices();
    fetchBalance();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLivePrices();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  const fetchBalance = async () => {
    try {
      const balances = await krakenApiService.getAccountBalance();
      // Find USD balance
      const usdBalance = balances.find((b) => b.asset === 'USD');
      if (usdBalance) {
        setAvailableBalance(usdBalance.availableBalance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  // Calculate estimated total
  useEffect(() => {
    const volume = parseFloat(orderForm.volume) || 0;
    const price = parseFloat(orderForm.price) || 0;
    setEstimatedTotal(volume * price);
  }, [orderForm.volume, orderForm.price]);

  // Auto-fill price when pair is selected
  const handlePairChange = (pair: string) => {
    setOrderForm((prev) => ({ ...prev, pair }));
    const selectedPair = tradingPairs.find((p) => p.pair === pair);
    if (selectedPair) {
      setOrderForm((prev) => ({
        ...prev,
        price: selectedPair.price.toString(),
      }));
    }
  };

  const handleSubmitOrder = async () => {
    // Validate form
    if (!orderForm.pair || !orderForm.volume || !orderForm.price) {
      setOrderStatus({
        type: 'error',
        message: 'Please fill in all fields',
      });
      return;
    }

    const volume = parseFloat(orderForm.volume);
    const price = parseFloat(orderForm.price);

    if (volume <= 0 || price <= 0) {
      setOrderStatus({
        type: 'error',
        message: 'Volume and price must be greater than 0',
      });
      return;
    }

    setLoading(true);
    setOrderStatus({ type: null, message: '' });

    try {
      // Place market order via Kraken API
      const result = await krakenApiService.placeMarketOrder(
        orderForm.pair,
        orderForm.type,
        volume,
        price
      );

      const orderType = orderForm.type.toUpperCase();
      const total = volume * price;

      setOrderStatus({
        type: 'success',
        message: `${orderType} order submitted successfully! ${volume} ${orderForm.pair} @ $${price.toFixed(2)} (Total: $${total.toFixed(2)})${result.txid ? ` - Order ID: ${result.txid.join(', ')}` : ''}`,
      });

      // Reset form
      setOrderForm({
        pair: '',
        type: 'buy',
        volume: '',
        price: '',
      });
    } catch (error: any) {
      setOrderStatus({
        type: 'error',
        message: error.message || 'Failed to submit order',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const selectedPair = tradingPairs.find((p) => p.pair === orderForm.pair);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Manual Trade
            </h1>
            <p className="text-slate-400 mt-2">Execute market orders on Kraken</p>
          </div>
          <button
            onClick={() => fetchLivePrices()}
            className="group relative px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
          >
            <RefreshCw className="inline mr-2 h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
            Refresh Prices
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Form */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center">
                <ArrowDownUp className="mr-3 h-6 w-6 text-purple-400" />
                Place Market Order
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Type Toggle */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Order Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setOrderForm((prev) => ({ ...prev, type: 'buy' }))}
                    className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                      orderForm.type === 'buy'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <TrendingUp className="inline mr-2 h-5 w-5" />
                    BUY
                  </button>
                  <button
                    onClick={() => setOrderForm((prev) => ({ ...prev, type: 'sell' }))}
                    className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                      orderForm.type === 'sell'
                        ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <TrendingDown className="inline mr-2 h-5 w-5" />
                    SELL
                  </button>
                </div>
              </div>

              {/* Trading Pair Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Trading Pair
                </label>
                <select
                  value={orderForm.pair}
                  onChange={(e) => handlePairChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a trading pair</option>
                  {tradingPairs.map((pair) => (
                    <option key={pair.pair} value={pair.pair}>
                      {pair.symbol} - {formatCurrency(pair.price)} ({formatPercent(pair.change24h)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Volume Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Volume (Amount)
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={orderForm.volume}
                  onChange={(e) =>
                    setOrderForm((prev) => ({ ...prev, volume: e.target.value }))
                  }
                  placeholder="0.00000000"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Price Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Price (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={orderForm.price}
                  onChange={(e) =>
                    setOrderForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Estimated Total */}
              {estimatedTotal > 0 && (
                <div className="p-4 bg-slate-700/30 rounded-xl border border-slate-600/50">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Estimated Total:</span>
                    <span className="text-2xl font-bold text-purple-400">
                      {formatCurrency(estimatedTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Order Status Messages */}
              {orderStatus.type && (
                <div
                  className={`p-4 rounded-xl border ${
                    orderStatus.type === 'success'
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  <div className="flex items-center">
                    {orderStatus.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 mr-2" />
                    )}
                    <span className="font-semibold">{orderStatus.message}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitOrder}
                disabled={loading}
                className={`w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all duration-300 ${
                  orderForm.type === 'buy'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-green-500/30 hover:shadow-green-500/50'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-red-500/30 hover:shadow-red-500/50'
                } hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <RefreshCw className="inline mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <DollarSign className="inline mr-2 h-5 w-5" />
                )}
                {loading ? 'Submitting...' : `${orderForm.type.toUpperCase()} ${orderForm.pair || 'Asset'}`}
              </button>
            </div>
          </div>

          {/* Order Summary & Info */}
          <div className="space-y-6">
            {/* Selected Pair Info */}
            {selectedPair && (
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-purple-500/20">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {selectedPair.symbol}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Current Price:</span>
                      <span className="text-xl font-bold text-white">
                        {formatCurrency(selectedPair.price)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">24h Change:</span>
                      <span
                        className={`font-bold ${
                          selectedPair.change24h >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {formatPercent(selectedPair.change24h)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Account Balance */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500/10 via-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-cyan-500/20">
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Available Balance</h3>
                <div className="text-center">
                  <p className="text-3xl font-bold text-cyan-400">
                    {formatCurrency(availableBalance)}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">USD</p>
                </div>
              </div>
            </div>

            {/* Trading Info */}
            <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Trading Info</h3>
                <div className="space-y-3 text-sm text-slate-400">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Market orders execute immediately at the current market price</p>
                  </div>
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Trading fees apply to all orders</p>
                  </div>
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Ensure you have sufficient balance before placing orders</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Market Prices */}
        <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Available Trading Pairs
            </h2>
          </div>

          {tradingPairs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700/50">
                    <th className="pb-4 pt-4 pl-6 font-semibold">Pair</th>
                    <th className="pb-4 pt-4 font-semibold">Price</th>
                    <th className="pb-4 pt-4 pr-6 font-semibold">24h Change</th>
                  </tr>
                </thead>
                <tbody>
                  {tradingPairs.map((pair) => (
                    <tr
                      key={pair.pair}
                      className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-200 cursor-pointer"
                      onClick={() => handlePairChange(pair.pair)}
                    >
                      <td className="py-4 pl-6">
                        <span className="font-semibold text-white">{pair.symbol}</span>
                      </td>
                      <td className="py-4 text-slate-300 font-mono">
                        {formatCurrency(pair.price)}
                      </td>
                      <td className="py-4 pr-6">
                        <span
                          className={`text-sm px-2 py-0.5 rounded ${
                            pair.change24h >= 0
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {formatPercent(pair.change24h)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No trading pairs available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
