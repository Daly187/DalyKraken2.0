/**
 * Multi-Exchange Service for Aster, Hyperliquid, and Lighter
 * Handles WebSocket connections, funding rate monitoring, and three-way arbitrage
 */

import { symbolMappingEngine, MatchedPair, AssetInfo } from './symbolMappingEngine';
import { unifiedSymbolMapper, type ThreeWayArbitrageOpportunity } from './unifiedSymbolMapping';
import { lighterService, type LighterFundingData } from './lighterService';
import { threeWayArbitrageService } from './threeWayArbitrageService';

export interface FundingRate {
  symbol: string;
  exchange: 'aster' | 'hyperliquid' | 'lighter';
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
  exchange: 'aster' | 'hyperliquid' | 'lighter';
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
  private lighterInitialized: boolean = false;

  /**
   * Get API credentials from localStorage
   */
  private getCredentials(exchange: 'aster' | 'hyperliquid' | 'lighter') {
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
      case 'lighter':
        return {
          // Lighter doesn't require authentication for market data
          apiKey: localStorage.getItem('lighter_api_key') || '',
          apiSecret: localStorage.getItem('lighter_api_secret') || '',
        };
    }
  }

  /**
   * Fetch all available perpetual symbols from AsterDEX
   */
  private async fetchAsterSymbols(): Promise<string[]> {
    try {
      const response = await fetch('https://fapi.asterdex.com/fapi/v1/exchangeInfo');
      const data = await response.json();

      const perpetuals = data.symbols
        .filter((s: any) =>
          s.contractType === 'PERPETUAL' &&
          s.status === 'TRADING'
        )
        .map((s: any) => s.symbol);

      console.log(`[AsterDEX] Discovered ${perpetuals.length} perpetual contracts`);
      return perpetuals;
    } catch (error) {
      console.error('[AsterDEX] Error fetching exchange info:', error);
      return [];
    }
  }

  /**
   * Connect to AsterDEX Futures WebSocket for funding rates
   * Note: Using AsterDEX public API (no authentication required for market data)
   * Endpoint: wss://fstream.asterdex.com
   */
  async connectAster(symbols?: string[]) {
    // If no symbols provided, fetch all available perpetuals
    if (!symbols || symbols.length === 0) {
      symbols = await this.fetchAsterSymbols();
    }

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
   * Connect to Lighter for funding rates using REST API
   * Note: Lighter funding is paid HOURLY
   * Uses REST API polling instead of WebSocket
   */
  async connectLighter() {
    console.log(`[Lighter] Initializing funding rate polling...`);

    try {
      // Initialize Lighter service (fetch markets)
      if (!this.lighterInitialized) {
        await lighterService.initialize();
        this.lighterInitialized = true;
      }

      // Fetch funding rates immediately
      await this.fetchLighterFunding();

      // Poll every 60 seconds for updates (funding paid hourly)
      const pollInterval = setInterval(() => {
        this.fetchLighterFunding();
      }, 60000);

      this.reconnectIntervals.set('lighter', pollInterval as any);
      console.log(`[Lighter] Polling started - updating every 60 seconds`);
    } catch (error) {
      console.error('[Lighter] Initialization error:', error);
    }
  }

  /**
   * Fetch current funding rates from Lighter REST API
   */
  private async fetchLighterFunding() {
    try {
      const fundingRates = await lighterService.getAllFundingRates();

      fundingRates.forEach((funding: LighterFundingData, symbol: string) => {
        const fundingRate: FundingRate = {
          symbol: symbol,
          exchange: 'lighter',
          rate: funding.fundingRate * 100, // Convert to percentage
          timestamp: funding.timestamp,
          nextFundingTime: funding.nextFundingTime,
          markPrice: funding.markPrice,
        };

        this.fundingRates.set(`lighter-${symbol}`, fundingRate);
        this.fundingCallbacks.forEach(cb => cb(fundingRate));
      });

      console.log(`[Lighter] Updated funding rates for ${fundingRates.size} assets`);

    } catch (error) {
      console.error('[Lighter] Error fetching funding rates:', error);
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
   * Check liquidity before executing trade
   */
  async checkLiquidity(
    exchange: 'aster' | 'hyperliquid' | 'lighter',
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
  getFundingRate(exchange: 'aster' | 'hyperliquid' | 'lighter', symbol: string): FundingRate | null {
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
  async connectAll(symbols?: string[]) {
    // AsterDEX: Always connect, auto-discover all perpetuals if no symbols provided
    this.connectAster(symbols);

    // HyperLiquid: Always connect (public market data doesn't require auth)
    this.connectHyperliquid(symbols || []);

    // Lighter: Always connect (public market data doesn't require auth)
    await this.connectLighter();
  }

  /**
   * Get matched pairs with arbitrage opportunities
   */
  getMatchedPairs(): MatchedPair[] {
    const asterAssets: AssetInfo[] = [];
    const hlAssets: AssetInfo[] = [];

    // Convert funding rates to AssetInfo format
    this.fundingRates.forEach((rate) => {
      const assetInfo: AssetInfo = {
        symbol: rate.symbol,
        exchange: rate.exchange,
        fundingRate: rate.rate,
        markPrice: rate.markPrice,
      };

      if (rate.exchange === 'aster') {
        asterAssets.push(assetInfo);
      } else if (rate.exchange === 'hyperliquid') {
        hlAssets.push(assetInfo);
      }
    });

    // Log for debugging
    if (asterAssets.length > 0 && hlAssets.length > 0) {
      console.log(`[Symbol Matching] AsterDEX: ${asterAssets.length} assets, HyperLiquid: ${hlAssets.length} assets`);

      // Log a sample of unmatched symbols for debugging
      const matched = symbolMappingEngine.matchAssets(asterAssets, hlAssets);
      const matchedCanonicals = new Set(matched.filter(p => p.aster && p.hyperliquid).map(p => p.canonical));

      const asterNormalized = asterAssets.map(a => ({ symbol: a.symbol, ...symbolMappingEngine.normalizeSymbol(a.symbol) }));
      const hlNormalized = hlAssets.map(a => ({ symbol: a.symbol, ...symbolMappingEngine.normalizeSymbol(a.symbol) }));

      const asterFailedNormalization = asterNormalized.filter(a => !a.canonical);
      const hlFailedNormalization = hlNormalized.filter(a => !a.canonical);

      const asterOnlyOneExchange = asterNormalized.filter(a => a.canonical && !matchedCanonicals.has(a.canonical));
      const hlOnlyOneExchange = hlNormalized.filter(a => a.canonical && !matchedCanonicals.has(a.canonical));

      console.log(`\n========================================`);
      console.log(`📊 MATCHED PAIRS SUMMARY`);
      console.log(`========================================`);
      console.log(`✅ MATCHED PAIRS: ${matchedCanonicals.size} common pairs`);
      console.log(`📈 AsterDEX only: ${asterOnlyOneExchange.length} pairs`);
      console.log(`📉 HyperLiquid only: ${hlOnlyOneExchange.length} pairs`);
      console.log(`❌ Failed normalization: AsterDEX ${asterFailedNormalization.length}, HyperLiquid ${hlFailedNormalization.length}`);
      console.log(`========================================`);
      console.log(`\n🔗 Matched pairs available for arbitrage:`);
      console.log(Array.from(matchedCanonicals).sort().join(', '));
      console.log(`\n[Sample Failed Norm AsterDEX]:`, asterFailedNormalization.slice(0, 10).map(a => a.symbol).join(', '));
      console.log(`[Sample Failed Norm HyperLiquid]:`, hlFailedNormalization.slice(0, 10).map(a => a.symbol).join(', '));
      console.log(`[Sample AsterDEX Only]:`, asterOnlyOneExchange.slice(0, 10).map(a => `${a.symbol}→${a.canonical}`).join(', '));
      console.log(`[Sample HyperLiquid Only]:`, hlOnlyOneExchange.slice(0, 10).map(a => `${a.symbol}→${a.canonical}`).join(', '));
    }

    return symbolMappingEngine.matchAssets(asterAssets, hlAssets);
  }

  /**
   * Get arbitrage opportunities sorted by absolute spread
   */
  getArbitrageOpportunities(minSpreadPercent: number = 0.01): MatchedPair[] {
    return this.getMatchedPairs()
      .filter(pair =>
        pair.aster &&
        pair.hyperliquid &&
        pair.spread !== undefined &&
        Math.abs(pair.spread) >= minSpreadPercent
      )
      .sort((a, b) => Math.abs(b.spread!) - Math.abs(a.spread!));
  }

  /**
   * Get assets available on only one exchange
   */
  getExclusiveAssets(): { asterOnly: MatchedPair[]; hyperliquidOnly: MatchedPair[] } {
    const allPairs = this.getMatchedPairs();

    return {
      asterOnly: allPairs.filter(pair => pair.aster && !pair.hyperliquid),
      hyperliquidOnly: allPairs.filter(pair => pair.hyperliquid && !pair.aster),
    };
  }

  /**
   * Get three-way arbitrage opportunities using unified symbol mapping
   */
  getThreeWayArbitrageOpportunities(): ThreeWayArbitrageOpportunity[] {
    // Organize funding rates by exchange
    const asterRates = new Map<string, any>();
    const hlRates = new Map<string, any>();
    const lighterRates = new Map<string, any>();

    this.fundingRates.forEach((rate) => {
      const rateData = {
        fundingRate: rate.rate / 100, // Convert back from percentage
        markPrice: rate.markPrice,
        indexPrice: rate.markPrice, // Use mark price as index if not available
        nextFundingTime: rate.nextFundingTime,
      };

      if (rate.exchange === 'aster') {
        asterRates.set(rate.symbol, rateData);
      } else if (rate.exchange === 'hyperliquid') {
        // Convert HyperLiquid symbol format (BTCUSDT) to just asset name (BTC)
        const assetName = rate.symbol.replace('USDT', '');
        hlRates.set(assetName, {
          ...rateData,
          funding_rate: rateData.fundingRate,
          mark_price: rateData.markPrice,
          index_price: rateData.indexPrice,
          next_funding_time: rateData.nextFundingTime,
        });
      } else if (rate.exchange === 'lighter') {
        lighterRates.set(rate.symbol, rateData);
      }
    });

    // Analyze opportunities using the three-way arbitrage service
    const opportunities = threeWayArbitrageService.analyzeOpportunities(
      asterRates,
      hlRates,
      lighterRates
    );

    console.log(`[Three-Way Arbitrage] Found ${opportunities.length} opportunities`);

    // Log sample of opportunities
    if (opportunities.length > 0) {
      const top5 = opportunities.slice(0, 5);
      console.log('[Top 5 Opportunities]:');
      top5.forEach(opp => {
        if (opp.bestOpportunity) {
          console.log(`  ${opp.canonical}: ${opp.bestOpportunity.longExchange} (long) vs ${opp.bestOpportunity.shortExchange} (short) = ${opp.bestOpportunity.spreadApr.toFixed(2)}% APR`);
        }
      });
    }

    return opportunities;
  }

  /**
   * Get three-way arbitrage metrics
   */
  getThreeWayArbitrageMetrics() {
    const opportunities = this.getThreeWayArbitrageOpportunities();
    return threeWayArbitrageService.getMetrics(opportunities);
  }

  /**
   * Filter three-way opportunities by minimum spread
   */
  filterThreeWayBySpread(minAprSpread: number = 5): ThreeWayArbitrageOpportunity[] {
    const opportunities = this.getThreeWayArbitrageOpportunities();
    return threeWayArbitrageService.filterByMinSpread(opportunities, minAprSpread);
  }

  /**
   * Get funding rates organized by exchange for three-way analysis
   */
  getFundingRatesByExchange(): {
    aster: Map<string, FundingRate>;
    hyperliquid: Map<string, FundingRate>;
    lighter: Map<string, FundingRate>;
  } {
    const byExchange = {
      aster: new Map<string, FundingRate>(),
      hyperliquid: new Map<string, FundingRate>(),
      lighter: new Map<string, FundingRate>(),
    };

    this.fundingRates.forEach((rate) => {
      if (rate.exchange === 'aster') {
        byExchange.aster.set(rate.symbol, rate);
      } else if (rate.exchange === 'hyperliquid') {
        byExchange.hyperliquid.set(rate.symbol, rate);
      } else if (rate.exchange === 'lighter') {
        byExchange.lighter.set(rate.symbol, rate);
      }
    });

    return byExchange;
  }
}

export const multiExchangeService = new MultiExchangeService();
