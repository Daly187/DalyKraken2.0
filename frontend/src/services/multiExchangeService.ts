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
   * Connect to Aster DEX WebSocket for funding rates
   * Note: Public market data doesn't require authentication
   */
  connectAster(symbols: string[]) {
    console.log(`[Aster] Connecting to WebSocket for ${symbols.length} symbols...`);

    const ws = new WebSocket('wss://fstream.asterdex.com');

    ws.onopen = () => {
      console.log('[Aster] WebSocket connected');

      // Subscribe to mark price streams in batches (max 50 symbols per subscription)
      const batchSize = 50;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const subscribeMsg = {
          method: 'SUBSCRIBE',
          params: batch.map(s => `${s.toLowerCase()}@markPrice`),
          id: Date.now() + i,
        };

        console.log(`[Aster] Subscribing to batch ${Math.floor(i / batchSize) + 1} (${batch.length} symbols)`);
        ws.send(JSON.stringify(subscribeMsg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Log subscription responses for debugging
        if (data.result === null && data.id) {
          console.log(`[Aster] Subscription confirmed (ID: ${data.id})`);
          return;
        }

        // Log errors from server
        if (data.error) {
          console.error('[Aster] Server error:', data.error);
          return;
        }

        // Handle mark price updates
        if (data.e === 'markPriceUpdate') {
          const fundingRate: FundingRate = {
            symbol: data.s.toUpperCase(),
            exchange: 'aster',
            rate: parseFloat(data.r) * 100, // Convert to percentage
            timestamp: data.E,
            nextFundingTime: data.T,
            markPrice: parseFloat(data.p),
          };

          this.fundingRates.set(`aster-${data.s.toUpperCase()}`, fundingRate);
          this.fundingCallbacks.forEach(cb => cb(fundingRate));
          console.log(`[Aster] Received funding rate for ${data.s}: ${fundingRate.rate.toFixed(4)}%`);
        }
      } catch (error) {
        console.error('[Aster] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Aster] WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log(`[Aster] WebSocket closed (Code: ${event.code}, Reason: ${event.reason || 'No reason provided'})`);
      this.wsConnections.delete('aster');

      // Don't reconnect if close was intentional (code 1000)
      if (event.code === 1000) {
        console.log('[Aster] WebSocket closed normally, not reconnecting');
        return;
      }

      // Reconnect after 5 seconds
      console.log('[Aster] Reconnecting in 5 seconds...');
      const reconnect = setTimeout(() => {
        this.connectAster(symbols);
      }, 5000);

      this.reconnectIntervals.set('aster', reconnect);
    };

    this.wsConnections.set('aster', ws);
  }

  /**
   * Connect to Hyperliquid WebSocket for funding rates
   */
  connectHyperliquid(symbols: string[]) {
    const credentials = this.getCredentials('hyperliquid');
    if (!credentials.privateKey || !credentials.walletAddress) {
      console.warn('[MultiExchange] Hyperliquid credentials not configured');
      return;
    }

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
    const hyperCreds = this.getCredentials('hyperliquid');
    const liquidCreds = this.getCredentials('liquid');

    // Aster: Always connect (public market data doesn't require auth)
    this.connectAster(symbols);

    // Hyperliquid: Requires credentials
    if (hyperCreds.privateKey && hyperCreds.walletAddress) {
      this.connectHyperliquid(symbols);
    }

    // Liquid: Requires credentials
    if (liquidCreds.apiToken && liquidCreds.apiSecret) {
      this.connectLiquid(symbols);
    }
  }
}

export const multiExchangeService = new MultiExchangeService();
