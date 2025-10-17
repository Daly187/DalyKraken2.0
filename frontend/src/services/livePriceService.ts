import type { LivePrice } from '@/types';

type PriceListener = (prices: Map<string, LivePrice>) => void;

class LivePriceService {
  private prices: Map<string, LivePrice> = new Map();
  private listeners: Set<PriceListener> = new Set();
  private krakenWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribedSymbols: Set<string> = new Set();

  subscribe(listener: PriceListener): () => void {
    this.listeners.add(listener);

    // Immediately call with current prices
    if (this.prices.size > 0) {
      listener(new Map(this.prices));
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  connectKraken(symbols: string[]): void {
    if (this.krakenWs?.readyState === WebSocket.OPEN) {
      // Already connected, just subscribe to new symbols
      this.subscribeToSymbols(symbols);
      return;
    }

    this.subscribedSymbols = new Set(symbols);
    this.krakenWs = new WebSocket('wss://ws.kraken.com/');

    this.krakenWs.onopen = () => {
      console.log('[LivePriceService] Connected to Kraken WebSocket');
      this.reconnectAttempts = 0;
      this.subscribeToSymbols(symbols);
    };

    this.krakenWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleKrakenMessage(data);
      } catch (error) {
        console.error('[LivePriceService] Error parsing message:', error);
      }
    };

    this.krakenWs.onerror = (error) => {
      console.error('[LivePriceService] WebSocket error:', error);
    };

    this.krakenWs.onclose = () => {
      console.log('[LivePriceService] Kraken WebSocket closed');
      this.reconnect();
    };
  }

  disconnectKraken(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.krakenWs) {
      this.krakenWs.close();
      this.krakenWs = null;
    }

    this.subscribedSymbols.clear();
  }

  getPrice(symbol: string): LivePrice | undefined {
    return this.prices.get(symbol);
  }

  getAllPrices(): Map<string, LivePrice> {
    return new Map(this.prices);
  }

  updatePrice(symbol: string, price: Partial<LivePrice>): void {
    const existing = this.prices.get(symbol);
    const updated: LivePrice = {
      symbol,
      price: price.price ?? existing?.price ?? 0,
      change24h: price.change24h ?? existing?.change24h ?? 0,
      changePercent24h: price.changePercent24h ?? existing?.changePercent24h ?? 0,
      high24h: price.high24h ?? existing?.high24h ?? 0,
      low24h: price.low24h ?? existing?.low24h ?? 0,
      volume24h: price.volume24h ?? existing?.volume24h ?? 0,
      timestamp: price.timestamp ?? Date.now(),
    };

    this.prices.set(symbol, updated);
    this.notifyListeners();
  }

  bulkUpdatePrices(updates: Map<string, Partial<LivePrice>>): void {
    updates.forEach((price, symbol) => {
      const existing = this.prices.get(symbol);
      const updated: LivePrice = {
        symbol,
        price: price.price ?? existing?.price ?? 0,
        change24h: price.change24h ?? existing?.change24h ?? 0,
        changePercent24h: price.changePercent24h ?? existing?.changePercent24h ?? 0,
        high24h: price.high24h ?? existing?.high24h ?? 0,
        low24h: price.low24h ?? existing?.low24h ?? 0,
        volume24h: price.volume24h ?? existing?.volume24h ?? 0,
        timestamp: price.timestamp ?? Date.now(),
      };
      this.prices.set(symbol, updated);
    });

    this.notifyListeners();
  }

  private subscribeToSymbols(symbols: string[]): void {
    if (!this.krakenWs || this.krakenWs.readyState !== WebSocket.OPEN) {
      return;
    }

    const pairs = symbols.map(s => s.replace('/', ''));

    // Subscribe to ticker
    this.krakenWs.send(JSON.stringify({
      event: 'subscribe',
      pair: pairs,
      subscription: { name: 'ticker' }
    }));

    // Subscribe to OHLC (1min by default)
    this.krakenWs.send(JSON.stringify({
      event: 'subscribe',
      pair: pairs,
      subscription: { name: 'ohlc', interval: 1 }
    }));
  }

  private handleKrakenMessage(data: any): void {
    if (Array.isArray(data)) {
      const channelName = data[data.length - 2];

      if (channelName === 'ticker') {
        this.handleTickerUpdate(data);
      } else if (channelName.startsWith('ohlc')) {
        this.handleOHLCUpdate(data);
      }
    } else if (data.event === 'subscriptionStatus') {
      console.log('[LivePriceService] Subscription status:', data.status, data.pair);
    } else if (data.event === 'heartbeat') {
      // Ignore heartbeats
    }
  }

  private handleTickerUpdate(data: any): void {
    const tickerData = data[1];
    const pair = data[3];
    const symbol = this.formatSymbol(pair);

    const price = parseFloat(tickerData.c[0]); // Last trade price
    const high24h = parseFloat(tickerData.h[1]); // 24h high
    const low24h = parseFloat(tickerData.l[1]); // 24h low
    const volume24h = parseFloat(tickerData.v[1]); // 24h volume
    const open24h = parseFloat(tickerData.o[1]); // 24h open

    const change24h = price - open24h;
    const changePercent24h = (change24h / open24h) * 100;

    this.updatePrice(symbol, {
      price,
      change24h,
      changePercent24h,
      high24h,
      low24h,
      volume24h,
      timestamp: Date.now(),
    });
  }

  private handleOHLCUpdate(data: any): void {
    // OHLC data can be used for charting but we primarily use ticker for live prices
    // Store for future use if needed
  }

  private formatSymbol(krakenPair: string): string {
    // Convert Kraken pair format (e.g., "XBT/USD") to our format (e.g., "BTC/USD")
    return krakenPair
      .replace('XBT', 'BTC')
      .replace(/([A-Z]+)([A-Z]{3})/, '$1/$2');
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[LivePriceService] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[LivePriceService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      const symbols = Array.from(this.subscribedSymbols);
      if (symbols.length > 0) {
        this.connectKraken(symbols);
      }
    }, delay);
  }

  private notifyListeners(): void {
    const pricesCopy = new Map(this.prices);
    this.listeners.forEach(listener => {
      try {
        listener(pricesCopy);
      } catch (error) {
        console.error('[LivePriceService] Error in listener:', error);
      }
    });
  }
}

export const livePriceService = new LivePriceService();
