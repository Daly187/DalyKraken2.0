import type { LivePrice } from '@/types';

type PriceListener = (prices: Map<string, LivePrice>) => void;
type ConnectionStatusListener = (status: ConnectionStatus) => void;

interface ConnectionStatus {
  connected: boolean;
  endpoint: string;
  reconnectAttempts: number;
  lastError: string | null;
  usingFallback: boolean;
}

interface KrakenApiKey {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  isActive: boolean;
  type: 'primary' | 'fallback1' | 'fallback2';
}

class LivePriceService {
  private prices: Map<string, LivePrice> = new Map();
  private listeners: Set<PriceListener> = new Set();
  private statusListeners: Set<ConnectionStatusListener> = new Set();
  private krakenWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private currentApiKeyIndex = 0;
  private connectionStatus: ConnectionStatus = {
    connected: false,
    endpoint: 'wss://ws.kraken.com/',
    reconnectAttempts: 0,
    lastError: null,
    usingFallback: false,
  };
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = Date.now();

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

  subscribeStatus(listener: ConnectionStatusListener): () => void {
    this.statusListeners.add(listener);

    // Immediately call with current status
    listener({ ...this.connectionStatus });

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    this.statusListeners.forEach(listener => {
      try {
        listener({ ...this.connectionStatus });
      } catch (error) {
        console.error('[LivePriceService] Error in status listener:', error);
      }
    });
  }

  private getActiveApiKeys(): KrakenApiKey[] {
    try {
      const savedKeys = localStorage.getItem('kraken_api_keys');
      if (savedKeys) {
        const keys: KrakenApiKey[] = JSON.parse(savedKeys);
        return keys.filter(k => k.isActive).sort((a, b) => {
          const order = { primary: 0, fallback1: 1, fallback2: 2 };
          return order[a.type] - order[b.type];
        });
      }
    } catch (error) {
      console.error('[LivePriceService] Error loading API keys:', error);
    }
    return [];
  }

  connectKraken(symbols: string[]): void {
    if (this.krakenWs?.readyState === WebSocket.OPEN) {
      // Already connected, just subscribe to new symbols
      this.subscribeToSymbols(symbols);
      return;
    }

    this.subscribedSymbols = new Set(symbols);

    const apiKeys = this.getActiveApiKeys();
    const usingFallback = this.currentApiKeyIndex > 0;

    if (apiKeys.length > 0 && this.currentApiKeyIndex < apiKeys.length) {
      const currentKey = apiKeys[this.currentApiKeyIndex];
      console.log(`[LivePriceService] Using ${currentKey.name} (${currentKey.type})`);
    }

    // Kraken public WebSocket doesn't require authentication for market data
    const wsUrl = 'wss://ws.kraken.com/';
    this.krakenWs = new WebSocket(wsUrl);

    this.updateConnectionStatus({
      endpoint: wsUrl,
      usingFallback,
      lastError: null,
    });

    this.krakenWs.onopen = () => {
      console.log('[LivePriceService] Connected to Kraken WebSocket');
      this.reconnectAttempts = 0;
      this.currentApiKeyIndex = 0; // Reset on successful connection
      this.updateConnectionStatus({
        connected: true,
        reconnectAttempts: 0,
        usingFallback: false,
      });
      this.subscribeToSymbols(symbols);
      this.startHeartbeatMonitor();
    };

    this.krakenWs.onmessage = (event) => {
      this.lastHeartbeat = Date.now();
      try {
        const data = JSON.parse(event.data);
        this.handleKrakenMessage(data);
      } catch (error) {
        console.error('[LivePriceService] Error parsing message:', error);
      }
    };

    this.krakenWs.onerror = (error) => {
      console.error('[LivePriceService] WebSocket error:', error);
      this.updateConnectionStatus({
        lastError: 'WebSocket connection error',
      });
    };

    this.krakenWs.onclose = (event) => {
      console.log('[LivePriceService] Kraken WebSocket closed', event.code, event.reason);
      this.updateConnectionStatus({
        connected: false,
        lastError: `Connection closed: ${event.reason || 'Unknown reason'}`,
      });
      this.stopHeartbeatMonitor();
      this.reconnect();
    };
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();
    this.lastHeartbeat = Date.now();

    // Check for heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

      // If no message in 60 seconds, connection might be stale
      if (timeSinceLastHeartbeat > 60000) {
        console.warn('[LivePriceService] No heartbeat detected, reconnecting...');
        this.disconnectKraken();
        const symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
          this.connectKraken(symbols);
        }
      }
    }, 30000);
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnectKraken(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeatMonitor();

    if (this.krakenWs) {
      this.krakenWs.close();
      this.krakenWs = null;
    }

    this.subscribedSymbols.clear();
    this.updateConnectionStatus({
      connected: false,
    });
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
    this.persistPrices();
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

    this.persistPrices();
    this.notifyListeners();
  }

  private persistPrices(): void {
    try {
      const pricesObj: Record<string, LivePrice> = {};
      this.prices.forEach((price, symbol) => {
        pricesObj[symbol] = price;
      });
      localStorage.setItem('live_prices_cache', JSON.stringify(pricesObj));
    } catch (error) {
      console.error('[LivePriceService] Failed to persist prices:', error);
    }
  }

  loadCachedPrices(): void {
    try {
      const cached = localStorage.getItem('live_prices_cache');
      if (cached) {
        const pricesObj = JSON.parse(cached);
        Object.entries(pricesObj).forEach(([symbol, price]) => {
          this.prices.set(symbol, price as LivePrice);
        });
        console.log('[LivePriceService] Loaded', this.prices.size, 'cached prices');
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[LivePriceService] Failed to load cached prices:', error);
    }
  }

  private subscribeToSymbols(symbols: string[]): void {
    if (!this.krakenWs || this.krakenWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Convert our symbols to Kraken format and filter to supported pairs
    const pairs = symbols
      .map(s => this.toKrakenPair(s))
      .filter(p => p !== null) as string[];

    console.log('[LivePriceService] Subscribing to pairs:', pairs);

    // Subscribe to each pair individually with a small delay to avoid rate limits
    pairs.forEach((pair, index) => {
      setTimeout(() => {
        try {
          if (this.krakenWs && this.krakenWs.readyState === WebSocket.OPEN) {
            // Subscribe to ticker
            this.krakenWs.send(JSON.stringify({
              event: 'subscribe',
              pair: [pair],
              subscription: { name: 'ticker' }
            }));
          }
        } catch (error) {
          console.error(`[LivePriceService] Error subscribing to ${pair}:`, error);
        }
      }, index * 100); // 100ms delay between each subscription
    });
  }

  private toKrakenPair(symbol: string): string | null {
    // Strip .F suffix for futures contracts - map to spot pair
    let cleanSymbol = symbol;
    if (symbol.endsWith('.F')) {
      cleanSymbol = symbol.slice(0, -2);
      console.log(`[LivePriceService] Mapping futures ${symbol} to spot pair ${cleanSymbol}`);
    }

    // Kraken uses specific naming conventions
    // Map of our symbols to Kraken WebSocket pair names
    const krakenPairMap: Record<string, string> = {
      // Major cryptocurrencies
      'BTC/USD': 'XBT/USD',
      'ETH/USD': 'ETH/USD',
      'SOL/USD': 'SOL/USD',
      'XRP/USD': 'XRP/USD',
      'ADA/USD': 'ADA/USD',
      'DOGE/USD': 'XDG/USD',
      'DOT/USD': 'DOT/USD',
      'MATIC/USD': 'MATIC/USD',
      'AVAX/USD': 'AVAX/USD',
      'LINK/USD': 'LINK/USD',
      'UNI/USD': 'UNI/USD',
      'ATOM/USD': 'ATOM/USD',
      'LTC/USD': 'LTC/USD',
      'BCH/USD': 'BCH/USD',
      'ETC/USD': 'ETC/USD',

      // DeFi tokens
      'AAVE/USD': 'AAVE/USD',
      'COMP/USD': 'COMP/USD',
      'MKR/USD': 'MKR/USD',
      'SNX/USD': 'SNX/USD',
      'CRV/USD': 'CRV/USD',
      'SUSHI/USD': 'SUSHI/USD',
      'YFI/USD': 'YFI/USD',
      'BAL/USD': 'BAL/USD',
      '1INCH/USD': '1INCH/USD',

      // Layer 1 & 2
      'ALGO/USD': 'ALGO/USD',
      'XLM/USD': 'XLM/USD',
      'XTZ/USD': 'XTZ/USD',
      'EOS/USD': 'EOS/USD',
      'TRX/USD': 'TRX/USD',
      'FIL/USD': 'FIL/USD',
      'NEAR/USD': 'NEAR/USD',
      'FTM/USD': 'FTM/USD',
      'MINA/USD': 'MINA/USD',
      'FLOW/USD': 'FLOW/USD',

      // Infrastructure & Oracles
      'GRT/USD': 'GRT/USD',
      'BAND/USD': 'BAND/USD',
      'API3/USD': 'API3/USD',

      // Metaverse & Gaming
      'MANA/USD': 'MANA/USD',
      'SAND/USD': 'SAND/USD',
      'AXS/USD': 'AXS/USD',
      'ENJ/USD': 'ENJ/USD',
      'GALA/USD': 'GALA/USD',

      // Other popular tokens
      'APE/USD': 'APE/USD',
      'LDO/USD': 'LDO/USD',
      'OP/USD': 'OP/USD',
      'ARB/USD': 'ARB/USD',
      'IMX/USD': 'IMX/USD',
      'BLUR/USD': 'BLUR/USD',

      // Additional altcoins
      'AKT/USD': 'AKT/USD',      // Akash Network
      'APT/USD': 'APT/USD',      // Aptos
      'BADGER/USD': 'BADGER/USD', // Badger DAO
      'FET/USD': 'FET/USD',      // Fetch.ai
      'GHST/USD': 'GHST/USD',    // Aavegotchi
      'ICX/USD': 'ICX/USD',      // ICON
      'INJ/USD': 'INJ/USD',      // Injective
      'KSM/USD': 'KSM/USD',      // Kusama
      'MNGO/USD': 'MNGO/USD',    // Mango Markets
      'ORCA/USD': 'ORCA/USD',    // Orca
      'PAXG/USD': 'PAXG/USD',    // Paxos Gold
      'PHA/USD': 'PHA/USD',      // Phala Network
      'QTUM/USD': 'QTUM/USD',    // Qtum
      'RARI/USD': 'RARI/USD',    // Rarible
      'RAY/USD': 'RAY/USD',      // Raydium
      'RPL/USD': 'RPL/USD',      // Rocket Pool
      'SDN/USD': 'SDN/USD',      // Shiden Network
      'SRM/USD': 'SRM/USD',      // Serum
      'XRT/USD': 'XRT/USD',      // Robonomics
      'ZRX/USD': 'ZRX/USD',      // 0x Protocol
    };

    return krakenPairMap[cleanSymbol] || null;
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
      if (data.status === 'error') {
        console.error('[LivePriceService] Subscription error:', data.pair, data.errorMessage);
      } else if (data.status === 'subscribed') {
        console.log('[LivePriceService] Subscribed to:', data.pair);
      }
    } else if (data.event === 'systemStatus') {
      console.log('[LivePriceService] System status:', data.status);
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
    // Convert Kraken pair format to our standard format
    // Kraken returns pairs like "XBT/USD", "ETH/USD", etc.
    let formatted = krakenPair
      .replace('XBT/', 'BTC/')
      .replace('XBT', 'BTC')
      .replace('XDG/', 'DOGE/')
      .replace('XDG', 'DOGE');

    // Add slash if not present
    if (!formatted.includes('/')) {
      // Find the currency separator (usually last 3-4 chars are the quote currency)
      const match = formatted.match(/^([A-Z0-9]+)(USD|EUR|GBP|BTC|ETH)$/);
      if (match) {
        formatted = `${match[1]}/${match[2]}`;
      }
    }

    return formatted;
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[LivePriceService] Max reconnection attempts reached, trying fallback...');
      this.tryFallbackConnection();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[LivePriceService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.updateConnectionStatus({
      reconnectAttempts: this.reconnectAttempts,
    });

    this.reconnectTimeout = setTimeout(() => {
      const symbols = Array.from(this.subscribedSymbols);
      if (symbols.length > 0) {
        this.connectKraken(symbols);
      }
    }, delay);
  }

  private tryFallbackConnection(): void {
    const apiKeys = this.getActiveApiKeys();

    // Try next API key if available
    if (this.currentApiKeyIndex < apiKeys.length - 1) {
      this.currentApiKeyIndex++;
      this.reconnectAttempts = 0;

      console.log(`[LivePriceService] Switching to fallback API key (index ${this.currentApiKeyIndex})`);

      this.updateConnectionStatus({
        usingFallback: true,
        reconnectAttempts: 0,
        lastError: 'Primary connection failed, using fallback',
      });

      const symbols = Array.from(this.subscribedSymbols);
      if (symbols.length > 0) {
        setTimeout(() => {
          this.connectKraken(symbols);
        }, 2000);
      }
    } else {
      // All fallbacks exhausted, reset and try again later
      console.error('[LivePriceService] All API keys exhausted, will retry in 60s');
      this.currentApiKeyIndex = 0;
      this.reconnectAttempts = 0;

      this.updateConnectionStatus({
        lastError: 'All connection attempts failed, retrying...',
        usingFallback: false,
      });

      setTimeout(() => {
        const symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
          this.connectKraken(symbols);
        }
      }, 60000);
    }
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
