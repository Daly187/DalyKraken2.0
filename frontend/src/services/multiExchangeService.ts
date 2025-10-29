/**
 * Multi-Exchange Service for Aster, Hyperliquid, and Liquid
 * Handles WebSocket connections, funding rate monitoring, and trade execution
 */

export interface FundingRate {
  symbol: string;
  exchange: 'aster' | 'hyperliquid' | 'liquid';
  rate: number;
  timestamp: number;
  nextFundingTime: number;
  markPrice: number;
}

export interface LiquidityCheck {
  symbol: string;
  exchange: string;
  volume24h: number;
  bidDepth: number;
  askDepth: number;
  spread: number;
  isLiquid: boolean;
  timestamp: number;
}

export interface FundingPosition {
  id: string;
  exchange: 'aster' | 'hyperliquid' | 'liquid';
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  entryFundingRate: number;
  currentFundingRate: number;
  fundingEarned: number;
  pnl: number;
  status: 'open' | 'closed';
  entryTime: number;
  exitTime?: number;
  exitPrice?: number;
}

export interface ExchangeConfig {
  enabled: boolean;
  minVolume24h: number;
  maxSpreadPercent: number;
  minBidAskDepth: number;
  fundingRateThreshold: number;
  positionSize: number;
}

class MultiExchangeService {
  private wsConnections: Map<string, WebSocket> = new Map();
  private fundingRates: Map<string, FundingRate> = new Map();
  private liquidityData: Map<string, LiquidityCheck> = new Map();
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private fundingCallbacks: Set<(funding: FundingRate) => void> = new Set();
  private liquidityCallbacks: Set<(liquidity: LiquidityCheck) => void> = new Set();

  /**
   * Get API credentials from localStorage
   */
  private getCredentials(exchange: 'aster' | 'hyperliquid' | 'liquid') {
    switch (exchange) {
      case 'aster':
        return {
          apiKey: localStorage.getItem('aster_api_key') || '',
          apiSecret: localStorage.getItem('aster_api_secret') || '',
        };
      case 'hyperliquid':
        return {
          privateKey: localStorage.getItem('hyperliquid_private_key') || '',
          walletAddress: localStorage.getItem('hyperliquid_wallet_address') || '',
        };
      case 'liquid':
        return {
          apiToken: localStorage.getItem('liquid_api_token') || '',
          apiSecret: localStorage.getItem('liquid_api_secret') || '',
        };
    }
  }

  /**
   * Connect to AsterDEX Futures WebSocket for funding rates
   * Note: Using AsterDEX public API (no authentication required for market data)
   * Endpoint: wss://fstream.asterdex.com
   */
  connectAster(symbols: string[]) {
    console.log(`[AsterDEX] Connecting to WebSocket for ${symbols.length} symbols...`);

    // AsterDEX Futures WebSocket endpoint (Binance-compatible API)
    const ws = new WebSocket('wss://fstream.asterdex.com/ws');

    ws.onopen = () => {
      console.log('[AsterDEX] WebSocket connected');

      // Subscribe to mark price streams in batches
      // AsterDEX/Binance has a limit of ~200 streams per subscription
      // We'll use 100 streams per batch to be safe
      const batchSize = 100;
      let subscriptionsSent = 0;

      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const streams = batch.map(s => `${s.toLowerCase()}@markPrice`);

        const subscribeMsg = {
          method: 'SUBSCRIBE',
          params: streams,
          id: Date.now() + i,
        };

        // Send subscriptions with a small delay to avoid overwhelming the server
        setTimeout(() => {
          ws.send(JSON.stringify(subscribeMsg));
          subscriptionsSent++;
          console.log(`[AsterDEX] Sent subscription batch ${subscriptionsSent} (${batch.length} streams)`);
        }, i * 100); // 100ms delay between batches
      }

      console.log(`[AsterDEX] Queued ${Math.ceil(symbols.length / batchSize)} subscription batches for ${symbols.length} symbols`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Log subscription responses for debugging
        if (data.result === null && data.id) {
          console.log(`[AsterDEX] Subscription confirmed (ID: ${data.id})`);
          return;
        }

        // Log errors from server
        if (data.error) {
          console.error('[AsterDEX] Server error:', data.error);
          return;
        }

        // Handle mark price updates (AsterDEX format - same as Binance)
        // Event type: markPriceUpdate
        // Fields: e (event), E (time), s (symbol), p (mark price), r (funding rate), T (next funding time)
        if (data.e === 'markPriceUpdate') {
          const fundingRate: FundingRate = {
            symbol: data.s.toUpperCase(),
            exchange: 'aster',
            rate: parseFloat(data.r) * 100, // Convert to percentage (0.00010000 -> 0.01%)
            timestamp: data.E,
            nextFundingTime: data.T,
            markPrice: parseFloat(data.p),
          };

          this.fundingRates.set(`aster-${data.s}`, fundingRate);
          this.fundingCallbacks.forEach(cb => cb(fundingRate));

          // Log first few updates for debugging
          if (this.fundingRates.size <= 5) {
            console.log(`[AsterDEX] ${data.s}: Rate=${fundingRate.rate.toFixed(4)}%, Mark=$${fundingRate.markPrice.toFixed(2)}, Next=${new Date(fundingRate.nextFundingTime).toLocaleTimeString()}`);
          }
        }
      } catch (error) {
        console.error('[AsterDEX] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[AsterDEX] WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log(`[AsterDEX] WebSocket closed (Code: ${event.code}, Reason: ${event.reason || 'No reason provided'})`);
      this.wsConnections.delete('aster');

      // Don't reconnect if close was intentional (code 1000)
      if (event.code === 1000) {
        console.log('[AsterDEX] WebSocket closed normally, not reconnecting');
        return;
      }

      // Reconnect after 5 seconds
      console.log('[AsterDEX] Reconnecting in 5 seconds...');
      const reconnect = setTimeout(() => {
        this.connectAster(symbols);
      }, 5000);

      this.reconnectIntervals.set('aster', reconnect);
    };

    this.wsConnections.set('aster', ws);
  }

  /**
   * Connect to Hyperliquid for funding rates using REST API
   * Note: HyperLiquid funding is paid HOURLY (not 8-hourly)
   * Uses REST API polling instead of WebSocket for simplicity
   */
  connectHyperliquid(symbols: string[]) {
    console.log(`[HyperLiquid] Initializing funding rate polling for all assets...`);

    // Fetch funding rates immediately
    this.fetchHyperliquidFunding();

    // Poll every 60 seconds for updates (funding paid hourly)
    const pollInterval = setInterval(() => {
      this.fetchHyperliquidFunding();
    }, 60000);

    this.reconnectIntervals.set('hyperliquid', pollInterval as any);
    console.log(`[HyperLiquid] Polling started - updating every 60 seconds`);
  }

  /**
   * Fetch current funding rates from HyperLiquid REST API
   */
  private async fetchHyperliquidFunding() {
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });

      const data = await response.json();

      // data[0] = metadata, data[1] = array of asset contexts
      const assetCtxs = data[1];

      assetCtxs.forEach((asset: any, index: number) => {
        const meta = data[0].universe[index];

        // Convert HyperLiquid coin name to our symbol format (e.g., "BTC" -> "BTCUSDT")
        const symbol = `${meta.name}USDT`;

        const fundingRate: FundingRate = {
          symbol: symbol,
          exchange: 'hyperliquid',
          rate: parseFloat(asset.funding) * 100, // Convert to percentage (hourly rate)
          timestamp: Date.now(),
          nextFundingTime: Date.now() + (60 * 60 * 1000), // Next hour
          markPrice: parseFloat(asset.markPx),
        };

        this.fundingRates.set(`hyperliquid-${symbol}`, fundingRate);
        this.fundingCallbacks.forEach(cb => cb(fundingRate));
      });

      console.log(`[HyperLiquid] Updated funding rates for ${assetCtxs.length} assets`);

    } catch (error) {
      console.error('[HyperLiquid] Error fetching funding rates:', error);
    }
  }

  /**
   * OLD WebSocket implementation (kept for reference)
   */
  private connectHyperliquidWebSocket_OLD(symbols: string[]) {
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      console.log('[Hyperliquid] WebSocket connected');

      // Subscribe to asset context for funding rates
      symbols.forEach(symbol => {
        const subscribeMsg = {
          method: 'subscribe',
          subscription: {
            type: 'activeAssetCtx',
            coin: symbol,
          },
        };
        ws.send(JSON.stringify(subscribeMsg));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.channel === 'activeAssetCtx' && data.data) {
          const ctx = data.data;
          const fundingRate: FundingRate = {
            symbol: ctx.coin,
            exchange: 'hyperliquid',
            rate: parseFloat(ctx.funding) * 100, // Convert to percentage
            timestamp: Date.now(),
            nextFundingTime: ctx.nextFunding || 0,
            markPrice: parseFloat(ctx.markPx),
          };

          this.fundingRates.set(`hyperliquid-${ctx.coin}`, fundingRate);
          this.fundingCallbacks.forEach(cb => cb(fundingRate));
        }
      } catch (error) {
        console.error('[Hyperliquid] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Hyperliquid] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Hyperliquid] WebSocket closed, reconnecting...');
      this.wsConnections.delete('hyperliquid');

      const reconnect = setTimeout(() => {
        this.connectHyperliquid(symbols);
      }, 5000);

      this.reconnectIntervals.set('hyperliquid', reconnect);
    };

    this.wsConnections.set('hyperliquid', ws);
  }

  /**
   * Connect to Liquid WebSocket for market data
   */
  connectLiquid(symbols: string[]) {
    const credentials = this.getCredentials('liquid');
    if (!credentials.apiToken || !credentials.apiSecret) {
      console.warn('[MultiExchange] Liquid credentials not configured');
      return;
    }

    const ws = new WebSocket(
      'wss://tap.liquid.com/app/LiquidTapClient?protocol=7&client=js&version=4.4.0&flash=false'
    );

    ws.onopen = () => {
      console.log('[Liquid] WebSocket connected');

      // Subscribe to order books for each symbol
      symbols.forEach(symbol => {
        const pair = symbol.toLowerCase().replace('/', '');

        ws.send(JSON.stringify({
          event: 'pusher:subscribe',
          data: { channel: `price_ladders_cash_${pair}_buy` },
        }));

        ws.send(JSON.stringify({
          event: 'pusher:subscribe',
          data: { channel: `price_ladders_cash_${pair}_sell` },
        }));

        ws.send(JSON.stringify({
          event: 'pusher:subscribe',
          data: { channel: `executions_cash_${pair}` },
        }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Liquid uses Pusher protocol - handle order book and trade updates
        if (data.event === 'updated') {
          console.log('[Liquid] Market data update:', data.channel);
        }
      } catch (error) {
        console.error('[Liquid] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Liquid] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Liquid] WebSocket closed, reconnecting...');
      this.wsConnections.delete('liquid');

      const reconnect = setTimeout(() => {
        this.connectLiquid(symbols);
      }, 5000);

      this.reconnectIntervals.set('liquid', reconnect);
    };

    this.wsConnections.set('liquid', ws);
  }

  /**
   * Check liquidity before executing trade
   */
  async checkLiquidity(
    exchange: 'aster' | 'hyperliquid' | 'liquid',
    symbol: string,
    config: ExchangeConfig
  ): Promise<LiquidityCheck> {
    // This would make REST API calls to check 24h volume and order book depth
    // For now, returning mock data structure
    const liquidityCheck: LiquidityCheck = {
      symbol,
      exchange,
      volume24h: 0,
      bidDepth: 0,
      askDepth: 0,
      spread: 0,
      isLiquid: false,
      timestamp: Date.now(),
    };

    // TODO: Implement actual REST API calls for each exchange

    return liquidityCheck;
  }

  /**
   * Get current funding rate for a symbol on an exchange
   */
  getFundingRate(exchange: 'aster' | 'hyperliquid' | 'liquid', symbol: string): FundingRate | null {
    return this.fundingRates.get(`${exchange}-${symbol}`) || null;
  }

  /**
   * Get all current funding rates
   */
  getAllFundingRates(): FundingRate[] {
    return Array.from(this.fundingRates.values());
  }

  /**
   * Subscribe to funding rate updates
   */
  onFundingRateUpdate(callback: (funding: FundingRate) => void) {
    this.fundingCallbacks.add(callback);
    return () => this.fundingCallbacks.delete(callback);
  }

  /**
   * Subscribe to liquidity updates
   */
  onLiquidityUpdate(callback: (liquidity: LiquidityCheck) => void) {
    this.liquidityCallbacks.add(callback);
    return () => this.liquidityCallbacks.delete(callback);
  }

  /**
   * Disconnect all WebSocket connections
   */
  disconnectAll() {
    this.wsConnections.forEach((ws, key) => {
      console.log(`[MultiExchange] Disconnecting ${key}`);
      ws.close();
    });

    this.reconnectIntervals.forEach(interval => clearTimeout(interval));

    this.wsConnections.clear();
    this.reconnectIntervals.clear();
  }

  /**
   * Connect to all configured exchanges
   */
  connectAll(symbols: string[]) {
    const liquidCreds = this.getCredentials('liquid');

    // AsterDEX: Always connect (public market data doesn't require auth)
    this.connectAster(symbols);

    // HyperLiquid: Always connect (public market data doesn't require auth)
    this.connectHyperliquid(symbols);

    // Liquid: Requires credentials
    if (liquidCreds.apiToken && liquidCreds.apiSecret) {
      this.connectLiquid(symbols);
    }
  }
}

export const multiExchangeService = new MultiExchangeService();
