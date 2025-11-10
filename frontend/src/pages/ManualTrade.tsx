import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { krakenApiService } from '@/services/krakenApiService';
import { exchangeTradeService } from '@/services/exchangeTradeService';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowDownUp,
  Shield,
  Target,
} from 'lucide-react';

type Exchange = 'kraken' | 'aster' | 'hyperliquid';

interface OrderForm {
  pair: string;
  type: 'buy' | 'sell';
  volume: string;
  price: string;
  stopLoss: string;
  takeProfit: string;
}

interface TradingPair {
  pair: string;
  symbol: string;
  price: number;
  change24h: number;
}

interface Position {
  id: string;
  exchange: Exchange;
  pair: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

export default function ManualTrade() {
  const livePrices = useStore((state) => state.livePrices);
  const fetchLivePrices = useStore((state) => state.fetchLivePrices);

  const [selectedExchange, setSelectedExchange] = useState<Exchange>('kraken');
  const [orderForm, setOrderForm] = useState<OrderForm>({
    pair: '',
    type: 'buy',
    volume: '',
    price: '',
    stopLoss: '',
    takeProfit: '',
  });

  const [loading, setLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [estimatedTotal, setEstimatedTotal] = useState<number>(0);
  const [positions, setPositions] = useState<Position[]>([]);

  // Available trading pairs - filter based on selected exchange
  const tradingPairs: TradingPair[] = Array.from(livePrices.values()).map(
    (price) => ({
      pair: price.symbol.replace('/', ''),
      symbol: price.symbol,
      price: price.price,
      change24h: price.change24h,
    })
  );

  // Initialize exchange trade service with dynamic precision on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('[ManualTrade] Initializing exchange trade service with dynamic precision...');
        await exchangeTradeService.initialize();
        console.log('[ManualTrade] ✅ Exchange trade service ready with all trading pairs');
      } catch (error) {
        console.error('[ManualTrade] Failed to initialize exchange trade service:', error);
      }
    };

    initializeServices();
  }, []);

  // Load positions from localStorage on mount
  useEffect(() => {
    const savedPositions = localStorage.getItem('manual_trade_positions');
    if (savedPositions) {
      try {
        setPositions(JSON.parse(savedPositions));
      } catch (error) {
        console.error('Failed to load positions:', error);
      }
    }
  }, []);

  // Save positions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('manual_trade_positions', JSON.stringify(positions));
  }, [positions]);

  // Monitor positions for SL/TP triggers
  useEffect(() => {
    if (positions.length === 0) return;

    const interval = setInterval(() => {
      positions.forEach(async (position) => {
        const currentPrice = livePrices.get(position.pair.replace('USDT', ''))?.price;
        if (!currentPrice) return;

        let shouldClose = false;
        let reason = '';

        // Check Stop Loss
        if (position.stopLoss) {
          if (position.side === 'buy' && currentPrice <= position.stopLoss) {
            shouldClose = true;
            reason = `Stop Loss hit at $${currentPrice.toFixed(2)}`;
          } else if (position.side === 'sell' && currentPrice >= position.stopLoss) {
            shouldClose = true;
            reason = `Stop Loss hit at $${currentPrice.toFixed(2)}`;
          }
        }

        // Check Take Profit
        if (position.takeProfit) {
          if (position.side === 'buy' && currentPrice >= position.takeProfit) {
            shouldClose = true;
            reason = `Take Profit hit at $${currentPrice.toFixed(2)}`;
          } else if (position.side === 'sell' && currentPrice <= position.takeProfit) {
            shouldClose = true;
            reason = `Take Profit hit at $${currentPrice.toFixed(2)}`;
          }
        }

        if (shouldClose) {
          console.log(`[Manual Trade] Closing position: ${reason}`);
          await closePosition(position, reason);
        }
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [positions, livePrices]);

  useEffect(() => {
    // Fetch live prices and balance on mount
    fetchLivePrices();
    fetchBalance();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLivePrices();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLivePrices, selectedExchange]);

  const fetchBalance = async () => {
    try {
      if (selectedExchange === 'kraken') {
        const balances = await krakenApiService.getAccountBalance();
        const usdBalance = balances.find((b) => b.asset === 'USD');
        if (usdBalance) {
          setAvailableBalance(usdBalance.availableBalance);
        }
      } else if (selectedExchange === 'aster') {
        // Fetch Aster balance
        const asterApiKey = localStorage.getItem('aster_api_key');
        const asterApiSecret = localStorage.getItem('aster_api_secret');

        if (asterApiKey && asterApiSecret) {
          const timestamp = Date.now();
          const params = `timestamp=${timestamp}`;
          const crypto = await import('crypto-js');
          const signature = crypto.default.HmacSHA256(params, asterApiSecret).toString();

          const response = await fetch(`https://sapi.asterdex.com/api/v1/account?${params}&signature=${signature}`, {
            headers: { 'X-MBX-APIKEY': asterApiKey },
          });

          if (response.ok) {
            const data = await response.json();
            let balance = 0;
            if (data.balances && Array.isArray(data.balances)) {
              balance = data.balances.reduce((total: number, asset: any) => {
                return total + parseFloat(asset.free || '0') + parseFloat(asset.locked || '0');
              }, 0);
            }
            setAvailableBalance(balance);
          }
        }
      } else if (selectedExchange === 'hyperliquid') {
        // Fetch HyperLiquid balance
        const wallet = localStorage.getItem('hyperliquid_wallet_address');
        if (wallet) {
          const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'clearinghouseState',
              user: wallet,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const balance = parseFloat(data.marginSummary?.accountValue || '0');
            setAvailableBalance(balance);
          }
        }
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

  const handleExchangeChange = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    // Reset form when changing exchanges
    setOrderForm({
      pair: '',
      type: 'buy',
      volume: '',
      price: '',
      stopLoss: '',
      takeProfit: '',
    });
    // Fetch new balance
    setTimeout(() => fetchBalance(), 100);
  };

  const closePosition = async (position: Position, reason: string) => {
    try {
      const positionSize = position.volume * position.entryPrice;
      const currentPrice = livePrices.get(position.pair.replace('USDT', ''))?.price || position.entryPrice;

      // Execute opposite order to close position
      if (position.exchange === 'kraken') {
        await krakenApiService.placeMarketOrder(
          position.pair,
          position.side === 'buy' ? 'sell' : 'buy',
          position.volume,
          currentPrice
        );
      } else if (position.exchange === 'aster') {
        await exchangeTradeService.placeAsterOrder({
          symbol: position.pair,
          side: position.side === 'buy' ? 'sell' : 'buy',
          size: positionSize,
          price: currentPrice,
          orderType: 'MARKET',
        });
      } else if (position.exchange === 'hyperliquid') {
        await exchangeTradeService.placeHyperliquidOrder({
          symbol: position.pair,
          side: position.side === 'buy' ? 'sell' : 'buy',
          size: positionSize,
          price: currentPrice,
          orderType: 'MARKET',
        });
      }

      // Remove position from list
      setPositions((prev) => prev.filter((p) => p.id !== position.id));

      setOrderStatus({
        type: 'success',
        message: `Position closed: ${reason}`,
      });
    } catch (error: any) {
      console.error('Failed to close position:', error);
      setOrderStatus({
        type: 'error',
        message: `Failed to close position: ${error.message}`,
      });
    }
  };

  const handleSubmitOrder = async () => {
    // Validate form
    if (!orderForm.pair || !orderForm.volume || !orderForm.price) {
      setOrderStatus({
        type: 'error',
        message: 'Please fill in all required fields',
      });
      return;
    }

    const volume = parseFloat(orderForm.volume);
    const price = parseFloat(orderForm.price);
    const stopLoss = orderForm.stopLoss ? parseFloat(orderForm.stopLoss) : undefined;
    const takeProfit = orderForm.takeProfit ? parseFloat(orderForm.takeProfit) : undefined;

    if (volume <= 0 || price <= 0) {
      setOrderStatus({
        type: 'error',
        message: 'Volume and price must be greater than 0',
      });
      return;
    }

    // Validate SL/TP levels
    if (orderForm.type === 'buy') {
      if (stopLoss && stopLoss >= price) {
        setOrderStatus({
          type: 'error',
          message: 'Stop Loss must be below entry price for BUY orders',
        });
        return;
      }
      if (takeProfit && takeProfit <= price) {
        setOrderStatus({
          type: 'error',
          message: 'Take Profit must be above entry price for BUY orders',
        });
        return;
      }
    } else {
      if (stopLoss && stopLoss <= price) {
        setOrderStatus({
          type: 'error',
          message: 'Stop Loss must be above entry price for SELL orders',
        });
        return;
      }
      if (takeProfit && takeProfit >= price) {
        setOrderStatus({
          type: 'error',
          message: 'Take Profit must be below entry price for SELL orders',
        });
        return;
      }
    }

    setLoading(true);
    setOrderStatus({ type: null, message: '' });

    try {
      const positionSize = volume * price;

      if (selectedExchange === 'kraken') {
        await krakenApiService.placeMarketOrder(
          orderForm.pair,
          orderForm.type,
          volume,
          price
        );
      } else if (selectedExchange === 'aster') {
        const orderResult = await exchangeTradeService.placeAsterOrder({
          symbol: orderForm.pair + 'USDT',
          side: orderForm.type,
          size: positionSize,
          price: price,
          orderType: 'MARKET',
        });

        if (!orderResult.success) {
          throw new Error(orderResult.error || 'Order failed');
        }
      } else if (selectedExchange === 'hyperliquid') {
        const orderResult = await exchangeTradeService.placeHyperliquidOrder({
          symbol: orderForm.pair,
          side: orderForm.type,
          size: positionSize,
          price: price,
          orderType: 'MARKET',
        });

        if (!orderResult.success) {
          throw new Error(orderResult.error || 'Order failed');
        }
      }

      const orderType = orderForm.type.toUpperCase();
      const total = volume * price;

      // Create position if SL or TP is set
      if (stopLoss || takeProfit) {
        const newPosition: Position = {
          id: `${Date.now()}-${Math.random()}`,
          exchange: selectedExchange,
          pair: orderForm.pair,
          side: orderForm.type,
          entryPrice: price,
          volume: volume,
          stopLoss,
          takeProfit,
          timestamp: Date.now(),
        };
        setPositions((prev) => [...prev, newPosition]);
      }

      setOrderStatus({
        type: 'success',
        message: `${orderType} order submitted on ${selectedExchange.toUpperCase()}! ${volume} ${orderForm.pair} @ $${price.toFixed(2)} (Total: $${total.toFixed(2)})${stopLoss ? ` | SL: $${stopLoss.toFixed(2)}` : ''}${takeProfit ? ` | TP: $${takeProfit.toFixed(2)}` : ''}`,
      });

      // Reset form
      setOrderForm({
        pair: '',
        type: 'buy',
        volume: '',
        price: '',
        stopLoss: '',
        takeProfit: '',
      });

      // Refresh balance
      fetchBalance();
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
            <p className="text-slate-400 mt-2">Execute orders across multiple exchanges</p>
          </div>
          <button
            onClick={() => fetchLivePrices()}
            className="group relative px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
          >
            <RefreshCw className="inline mr-2 h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
            Refresh Prices
          </button>
        </div>

        {/* Exchange Selection */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Select Exchange</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleExchangeChange('kraken')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                selectedExchange === 'kraken'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30 scale-105'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <div className="text-lg font-bold">Kraken</div>
              <div className="text-xs opacity-75 mt-1">Centralized Exchange</div>
            </button>
            <button
              onClick={() => handleExchangeChange('aster')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                selectedExchange === 'aster'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 scale-105'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <div className="text-lg font-bold">AsterDEX</div>
              <div className="text-xs opacity-75 mt-1">Decentralized Exchange</div>
            </button>
            <button
              onClick={() => handleExchangeChange('hyperliquid')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                selectedExchange === 'hyperliquid'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/30 scale-105'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <div className="text-lg font-bold">HyperLiquid</div>
              <div className="text-xs opacity-75 mt-1">Decentralized Perpetuals</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Form */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center">
                <ArrowDownUp className="mr-3 h-6 w-6 text-purple-400" />
                Place Order on {selectedExchange.charAt(0).toUpperCase() + selectedExchange.slice(1)}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Stop Loss & Take Profit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    <Shield className="inline h-4 w-4 mr-1 text-red-400" />
                    Stop Loss (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={orderForm.stopLoss}
                    onChange={(e) =>
                      setOrderForm((prev) => ({ ...prev, stopLoss: e.target.value }))
                    }
                    placeholder="Exit price if market goes against you"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    <Target className="inline h-4 w-4 mr-1 text-green-400" />
                    Take Profit (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={orderForm.takeProfit}
                    onChange={(e) =>
                      setOrderForm((prev) => ({ ...prev, takeProfit: e.target.value }))
                    }
                    placeholder="Exit price to lock in profits"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
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
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br backdrop-blur-xl border ${
              selectedExchange === 'kraken' ? 'from-purple-500/10 border-purple-500/20' :
              selectedExchange === 'aster' ? 'from-pink-500/10 border-pink-500/20' :
              'from-cyan-500/10 border-cyan-500/20'
            }`}>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  {selectedExchange.charAt(0).toUpperCase() + selectedExchange.slice(1)} Balance
                </h3>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${
                    selectedExchange === 'kraken' ? 'text-purple-400' :
                    selectedExchange === 'aster' ? 'text-pink-400' :
                    'text-cyan-400'
                  }`}>
                    {formatCurrency(availableBalance)}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">Available</p>
                </div>
              </div>
            </div>

            {/* Open Positions */}
            {positions.length > 0 && (
              <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Open Positions ({positions.length})</h3>
                  <div className="space-y-3">
                    {positions.map((position) => {
                      const currentPrice = livePrices.get(position.pair.replace('USDT', ''))?.price || position.entryPrice;
                      const pnl = position.side === 'buy'
                        ? (currentPrice - position.entryPrice) * position.volume
                        : (position.entryPrice - currentPrice) * position.volume;
                      const pnlPercent = (pnl / (position.entryPrice * position.volume)) * 100;

                      return (
                        <div key={position.id} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-semibold text-white">{position.pair}</div>
                              <div className="text-xs text-slate-400">{position.exchange}</div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              position.side === 'buy'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {position.side.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between text-slate-400">
                              <span>Entry:</span>
                              <span>{formatCurrency(position.entryPrice)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Current:</span>
                              <span>{formatCurrency(currentPrice)}</span>
                            </div>
                            {position.stopLoss && (
                              <div className="flex justify-between text-red-400">
                                <span>SL:</span>
                                <span>{formatCurrency(position.stopLoss)}</span>
                              </div>
                            )}
                            {position.takeProfit && (
                              <div className="flex justify-between text-green-400">
                                <span>TP:</span>
                                <span>{formatCurrency(position.takeProfit)}</span>
                              </div>
                            )}
                            <div className={`flex justify-between font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              <span>P&L:</span>
                              <span>{formatCurrency(pnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                            </div>
                          </div>
                          <button
                            onClick={() => closePosition(position, 'Manual close')}
                            className="w-full mt-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-semibold transition-colors"
                          >
                            Close Position
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Trading Info */}
            <div className="relative overflow-hidden rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Trading Info</h3>
                <div className="space-y-3 text-sm text-slate-400">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Orders execute as market orders at current price</p>
                  </div>
                  <div className="flex items-start">
                    <Shield className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-red-400" />
                    <p>Stop Loss automatically closes position if price hits SL level</p>
                  </div>
                  <div className="flex items-start">
                    <Target className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-green-400" />
                    <p>Take Profit automatically closes position at TP level</p>
                  </div>
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <p>Configure API keys in Settings for each exchange</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Trading Pairs */}
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
