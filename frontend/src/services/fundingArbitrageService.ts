/**
 * Funding Arbitrage Strategy Service
 * Implements delta-neutral cross-exchange funding rate arbitrage
 *
 * Strategy:
 * - Identify top 5 funding rate spreads between HyperLiquid and AsterDEX
 * - Allocate capital: 30%, 30%, 20%, 10%, 10%
 * - Long on exchange with higher rate, short on exchange with lower rate
 * - Rebalance every 4 hours
 * - Exit immediately if spread goes negative
 */

import { FundingRate } from './multiExchangeService';
import { exchangeTradeService } from './exchangeTradeService';
import { telegramNotificationService } from './telegramNotificationService';

export interface FundingSpread {
  canonical: string;
  aster: {
    symbol: string;
    rate: number;
    markPrice: number;
  } | null;
  hyperliquid: {
    symbol: string;
    rate: number;
    markPrice: number;
  } | null;
  spread: number; // Funding rate differential (percentage)
  annualSpread: number; // APR from spread
  longExchange: 'aster' | 'hyperliquid';
  shortExchange: 'aster' | 'hyperliquid';
  longRate: number;
  shortRate: number;
  timestamp: number;
}

export interface StrategyPosition {
  id: string;
  canonical: string;
  allocation: number; // Percentage of total capital (30, 30, 20, 10, 10)
  rank: number; // 1-5

  // Long side
  longExchange: 'aster' | 'hyperliquid';
  longSymbol: string;
  longSize: number; // In USD
  longEntryPrice: number;
  longCurrentPrice: number;
  longFundingRate: number;

  // Short side
  shortExchange: 'aster' | 'hyperliquid';
  shortSymbol: string;
  shortSize: number; // In USD
  shortEntryPrice: number;
  shortCurrentPrice: number;
  shortFundingRate: number;

  // P&L tracking
  spread: number; // Current funding spread
  entrySpread: number; // Entry funding spread
  fundingEarned: number; // Total funding collected
  pnl: number; // Total P&L (funding + price changes)

  status: 'open' | 'closing' | 'closed';
  entryTime: number;
  exitTime?: number;
  exitPrice?: number;
  exitReason?: 'negative_spread' | 'rebalance' | 'manual';
}

export interface StrategyConfig {
  enabled: boolean;
  totalCapital: number; // Capital PER EXCHANGE (not total combined)
  numberOfPairs: number; // Number of positions to trade (1-10)
  allocations: number[]; // Dynamic allocation percentages (must sum to 100%)
  rebalanceInterval: number; // Interval in minutes to re-scan and rebalance (default: 60 = 1 hour)
  minSpreadThreshold: number; // Minimum annualized spread to enter (e.g., 50 = 50% APR)
  fillTimeout: number; // Time to wait for both orders to fill (milliseconds)
  excludedSymbols: string[]; // Manual exclusions
  walletAddresses: {
    aster?: string;
    hyperliquid?: string;
  };
}

export interface RebalanceEvent {
  timestamp: number;
  positionsEntered: string[];
  positionsExited: string[];
  capitalReallocated: number;
  spreadsAtRebalance: FundingSpread[];
}

class FundingArbitrageService {
  private config: StrategyConfig = {
    enabled: false,
    totalCapital: 50, // Capital per exchange (e.g., $50 on Aster + $50 on HL = $100 total)
    numberOfPairs: 3, // Trade top 3 pairs by default
    allocations: [50, 30, 20], // Default: 50%, 30%, 20%
    rebalanceInterval: 60, // 60 minutes (1 hour) by default
    minSpreadThreshold: 50, // 50% APR minimum annualized spread
    fillTimeout: 30000, // 30 seconds to wait for order fills
    excludedSymbols: [],
    walletAddresses: {},
  };

  private positions: Map<string, StrategyPosition> = new Map();
  private rebalanceTimer: NodeJS.Timeout | null = null;
  private lastRebalanceTime: number = 0;
  private lastManualRebalanceTime: number = 0;
  private isRebalancing: boolean = false;
  private rebalanceHistory: RebalanceEvent[] = [];
  private closedPositions: StrategyPosition[] = []; // Track closed positions for history
  private spreadMonitorInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load persisted state on initialization
    this.loadState();
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    const state = {
      config: this.config,
      positions: Array.from(this.positions.entries()),
      lastRebalanceTime: this.lastRebalanceTime,
      rebalanceHistory: this.rebalanceHistory,
      closedPositions: this.closedPositions,
    };
    localStorage.setItem('arbitrage_strategy_state', JSON.stringify(state));
  }

  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem('arbitrage_strategy_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.config = state.config;
        this.positions = new Map(state.positions);
        this.lastRebalanceTime = state.lastRebalanceTime;
        this.rebalanceHistory = state.rebalanceHistory || [];
        this.closedPositions = state.closedPositions || [];
        console.log('[Arbitrage] State restored from localStorage');
      }
    } catch (error) {
      console.error('[Arbitrage] Error loading state:', error);
    }
  }

  /**
   * Clear persisted state
   */
  private clearState(): void {
    localStorage.removeItem('arbitrage_strategy_state');
  }

  /**
   * Calculate funding spread between two exchanges for a canonical symbol
   */
  calculateSpread(
    asterRate: FundingRate | null,
    hlRate: FundingRate | null
  ): FundingSpread | null {
    if (!asterRate || !hlRate) return null;

    // Determine which exchange has higher rate (long) and lower rate (short)
    const isAsterHigher = asterRate.rate > hlRate.rate;
    const spread = Math.abs(asterRate.rate - hlRate.rate);

    // Calculate annualized spread
    // Aster: Shows and pays 8-hour rate → 3 payments/day
    // HyperLiquid: API returns hourly rate → 24 payments/day

    // Aster daily payments (8hr rate × 3 payments)
    const asterDailyPayments = asterRate.rate * 3;

    // HyperLiquid daily payments (rate is already hourly × 24 payments)
    const hlDailyPayments = hlRate.rate * 24;

    // Daily spread
    const dailySpread = Math.abs(asterDailyPayments - hlDailyPayments);

    // Annualized spread
    const annualSpread = dailySpread * 365;

    return {
      canonical: asterRate.symbol, // Assuming both use same canonical format
      aster: {
        symbol: asterRate.symbol,
        rate: asterRate.rate,
        markPrice: asterRate.markPrice,
      },
      hyperliquid: {
        symbol: hlRate.symbol,
        rate: hlRate.rate,
        markPrice: hlRate.markPrice,
      },
      spread,
      annualSpread,
      longExchange: isAsterHigher ? 'aster' : 'hyperliquid',
      shortExchange: isAsterHigher ? 'hyperliquid' : 'aster',
      longRate: isAsterHigher ? asterRate.rate : hlRate.rate,
      shortRate: isAsterHigher ? hlRate.rate : asterRate.rate,
      timestamp: Date.now(),
    };
  }

  /**
   * Identify top N funding spreads
   */
  getTopSpreads(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>,
    count: number = 5
  ): FundingSpread[] {
    const spreads: FundingSpread[] = [];

    // Match symbols between exchanges
    asterRates.forEach((asterRate, symbol) => {
      const hlRate = hlRates.get(symbol);
      if (hlRate) {
        const spread = this.calculateSpread(asterRate, hlRate);
        if (spread && !this.config.excludedSymbols.includes(spread.canonical)) {
          spreads.push(spread);
        }
      }
    });

    // Filter out unrealistic spreads
    // Note: High spreads (>1000%) are VALID for extreme negative funding rates
    // Only filter if BOTH rates are extremely high (likely data error)
    const validSpreads = spreads.filter(s => {
      // Check if both individual rates are extreme (>10% per period = data error)
      const asterRateExtreme = s.aster && Math.abs(s.aster.rate) > 10;
      const hlRateExtreme = s.hyperliquid && Math.abs(s.hyperliquid.rate) > 10;

      if (asterRateExtreme && hlRateExtreme) {
        console.warn(`[FundingArbitrage] Filtering out ${s.canonical}: both rates extreme (likely data error)`);
        return false;
      }

      // Allow high spreads - they're valid for extreme negative funding!
      return true;
    });

    // Filter out high-price assets that won't work with available capital
    // Rule: Exclude assets where price > (totalCapital / 0.01)
    // Example: With $50 capital, exclude assets above $500
    const affordableSpreads = validSpreads.filter(s => {
      const avgPrice = ((s.aster?.markPrice || 0) + (s.hyperliquid?.markPrice || 0)) / 2;
      const maxAffordablePrice = this.config.totalCapital / 0.01;

      if (avgPrice > maxAffordablePrice) {
        console.warn(
          `[FundingArbitrage] Filtering out ${s.canonical}: price $${avgPrice.toFixed(2)} too high for capital $${this.config.totalCapital} ` +
          `(max affordable: $${maxAffordablePrice.toFixed(2)})`
        );
        return false;
      }
      return true;
    });

    // Sort by annualized spread (descending) to match threshold filtering
    return affordableSpreads
      .sort((a, b) => b.annualSpread - a.annualSpread)
      .slice(0, count);
  }

  /**
   * @deprecated Use getTopSpreads instead
   */
  getTop5Spreads(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>
  ): FundingSpread[] {
    return this.getTopSpreads(asterRates, hlRates, 5);
  }

  /**
   * Calculate position size based on rank and allocation
   */
  calculatePositionSize(rank: number): number {
    const allocation = this.config.allocations[rank - 1]; // rank 1-5 -> index 0-4
    return (this.config.totalCapital * allocation) / 100;
  }

  /**
   * Execute hedged entry with matched fill validation + market order hedge
   * Guarantees delta-neutral position or nothing
   */
  private async executeHedgedEntry(
    longExchange: 'aster' | 'hyperliquid',
    shortExchange: 'aster' | 'hyperliquid',
    longSymbol: string,
    shortSymbol: string,
    price: number,
    size: number
  ): Promise<{ success: boolean; longOrderId?: string; shortOrderId?: string; error?: string }> {
    console.log(`[HedgedEntry] Starting hedged entry for ${longSymbol}/${shortSymbol}`);
    console.log(`[HedgedEntry] Long: ${longExchange}, Short: ${shortExchange}, Price: ${price}, Size: $${size}`);

    try {
      // Step 1: Place both limit orders simultaneously
      console.log(`[HedgedEntry] Placing limit orders on both exchanges...`);
      console.log(`[HedgedEntry] Long will go to: ${longExchange}, Short will go to: ${shortExchange}`);

      // Dynamically route orders based on which exchange should be long/short
      const [longOrder, shortOrder] = await Promise.all([
        // Place long order on the correct exchange
        longExchange === 'aster'
          ? exchangeTradeService.placeAsterOrder({
              symbol: longSymbol,
              side: 'buy',
              size,
              price,
              orderType: 'LIMIT',
            }).catch(err => ({ success: false, error: err.message })) as Promise<any>
          : exchangeTradeService.placeHyperliquidOrder({
              symbol: longSymbol,
              side: 'buy',
              size,
              price,
              orderType: 'LIMIT',
            }).catch(err => ({ success: false, error: err.message })) as Promise<any>,
        // Place short order on the correct exchange
        shortExchange === 'aster'
          ? exchangeTradeService.placeAsterOrder({
              symbol: shortSymbol,
              side: 'sell',
              size,
              price,
              orderType: 'LIMIT',
            }).catch(err => ({ success: false, error: err.message })) as Promise<any>
          : exchangeTradeService.placeHyperliquidOrder({
              symbol: shortSymbol,
              side: 'sell',
              size,
              price,
              orderType: 'LIMIT',
            }).catch(err => ({ success: false, error: err.message })) as Promise<any>,
      ]);

      if (!longOrder.success || !shortOrder.success) {
        console.error(`[HedgedEntry] Failed to place orders`);
        return { success: false, error: `Order placement failed: ${longOrder.error || shortOrder.error}` };
      }

      console.log(`[HedgedEntry] Orders placed. Long: ${longOrder.orderId}, Short: ${shortOrder.orderId}`);

      // Step 2: Wait fillTimeout for both to fill
      console.log(`[HedgedEntry] Waiting ${this.config.fillTimeout}ms for fills...`);
      await new Promise(resolve => setTimeout(resolve, this.config.fillTimeout));

      // Step 3: Check fill status
      const [longStatus, shortStatus] = await Promise.all([
        exchangeTradeService.getOrderStatus(longExchange, longOrder.orderId!, longSymbol),
        exchangeTradeService.getOrderStatus(shortExchange, shortOrder.orderId!, shortSymbol),
      ]);

      const longFilled = longStatus === 'FILLED';
      const shortFilled = shortStatus === 'FILLED';

      console.log(`[HedgedEntry] Fill status - Long: ${longStatus}, Short: ${shortStatus}`);

      // Step 4: Handle outcomes
      if (longFilled && shortFilled) {
        // ✅ SUCCESS: Both filled, position is hedged
        console.log(`[HedgedEntry] ✅ SUCCESS: Both orders filled, position is hedged`);
        console.log(`[Telegram] ✅ Hedged Entry Success: ${longSymbol}/${shortSymbol}`);
        return { success: true, longOrderId: longOrder.orderId, shortOrderId: shortOrder.orderId };

      } else if (!longFilled && !shortFilled) {
        // ⚠️ Neither filled, cancel both and skip
        console.log(`[HedgedEntry] ⚠️ Neither order filled, cancelling both...`);
        await Promise.all([
          exchangeTradeService.cancelOrder(longExchange, longOrder.orderId!, longSymbol),
          exchangeTradeService.cancelOrder(shortExchange, shortOrder.orderId!, shortSymbol),
        ]);
        console.log(`[Telegram] ⚠️ No Fills: ${longSymbol}/${shortSymbol}`);
        return { success: false, error: 'No fills within timeout' };

      } else {
        // 🚨 PARTIAL FILL - EMERGENCY HEDGE WITH MARKET ORDER
        console.log(`[HedgedEntry] 🚨 PARTIAL FILL DETECTED - Emergency hedging with market order...`);

        if (longFilled && !shortFilled) {
          // Long filled, short didn't - cancel short and place market short to hedge
          console.log(`[HedgedEntry] Long filled, short didn't. Cancelling short and placing market order on ${shortExchange}...`);
          await exchangeTradeService.cancelOrder(shortExchange, shortOrder.orderId!, shortSymbol);

          // Place market order on the correct exchange for the short side
          const marketShort = shortExchange === 'aster'
            ? await exchangeTradeService.placeAsterOrder({
                symbol: shortSymbol,
                side: 'sell',
                size,
                price, // Use last price as estimate
                orderType: 'MARKET',
              })
            : await exchangeTradeService.placeHyperliquidOrder({
                symbol: shortSymbol,
                side: 'sell',
                size,
                price, // Use last price as estimate
                orderType: 'MARKET',
              });

          if (marketShort.success) {
            console.log(`[HedgedEntry] ✅ Hedged with market order: ${marketShort.orderId}`);
            console.log(`[Telegram] ⚠️ Partial Fill - Hedged with market order`);
            return { success: true, longOrderId: longOrder.orderId, shortOrderId: marketShort.orderId };
          } else {
            console.error(`[HedgedEntry] ❌ Failed to place market hedge order`);
            console.error(`[Telegram] 🚨 URGENT: Unhedged Position - ${longSymbol}/${shortSymbol}`);
            return { success: false, error: 'Failed to hedge with market order' };
          }

        } else if (shortFilled && !longFilled) {
          // Short filled, long didn't - cancel long and place market long to hedge
          console.log(`[HedgedEntry] Short filled, long didn't. Cancelling long and placing market order on ${longExchange}...`);
          await exchangeTradeService.cancelOrder(longExchange, longOrder.orderId!, longSymbol);

          // Place market order on the correct exchange for the long side
          const marketLong = longExchange === 'aster'
            ? await exchangeTradeService.placeAsterOrder({
                symbol: longSymbol,
                side: 'buy',
                size,
                price, // Use last price as estimate
                orderType: 'MARKET',
              })
            : await exchangeTradeService.placeHyperliquidOrder({
                symbol: longSymbol,
                side: 'buy',
                size,
                price, // Use last price as estimate
                orderType: 'MARKET',
              });

          if (marketLong.success) {
            console.log(`[HedgedEntry] ✅ Hedged with market order: ${marketLong.orderId}`);
            console.log(`[Telegram] ⚠️ Partial Fill - Hedged with market order`);
            return { success: true, longOrderId: marketLong.orderId, shortOrderId: shortOrder.orderId };
          } else {
            console.error(`[HedgedEntry] ❌ Failed to place market hedge order`);
            console.error(`[Telegram] 🚨 URGENT: Unhedged Position - ${longSymbol}/${shortSymbol}`);
            return { success: false, error: 'Failed to hedge with market order' };
          }
        }
      }

      return { success: false, error: 'Unknown hedging outcome' };

    } catch (error: any) {
      console.error(`[HedgedEntry] Error:`, error);
      console.error(`[Telegram] ❌ Hedged Entry Failed: ${longSymbol}/${shortSymbol} - ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new arbitrage position
   */
  async createPosition(spread: FundingSpread, rank: number): Promise<StrategyPosition> {
    const allocation = this.config.allocations[rank - 1];
    const positionSize = this.calculatePositionSize(rank);
    // positionSize is now the amount PER EXCHANGE (no halfSize needed)

    const longData = spread.longExchange === 'aster' ? spread.aster! : spread.hyperliquid!;
    const shortData = spread.shortExchange === 'aster' ? spread.aster! : spread.hyperliquid!;

    console.log(`[Arbitrage] Creating position: ${spread.canonical} (Rank ${rank}, ${allocation}%, $${positionSize.toFixed(2)} per exchange)`);

    // Use the same price for both sides to avoid slippage
    // Use the average of both mark prices
    const executionPrice = (longData.markPrice + shortData.markPrice) / 2;

    // Execute hedged entry with matched fill validation
    const hedgedResult = await this.executeHedgedEntry(
      spread.longExchange,
      spread.shortExchange,
      longData.symbol,
      shortData.symbol,
      executionPrice,
      positionSize
    );

    // Check if trade execution was successful
    if (!hedgedResult.success) {
      console.error(`[Arbitrage] Failed to create hedged position for ${spread.canonical}: ${hedgedResult.error}`);
      throw new Error(`Hedged entry failed: ${hedgedResult.error}`);
    }

    // Create position object with actual execution prices
    const position: StrategyPosition = {
      id: `${spread.canonical}-${Date.now()}`,
      canonical: spread.canonical,
      allocation,
      rank,

      // Long side
      longExchange: spread.longExchange,
      longSymbol: longData.symbol,
      longSize: positionSize,
      longEntryPrice: executionPrice,
      longCurrentPrice: executionPrice,
      longFundingRate: longData.rate,

      // Short side
      shortExchange: spread.shortExchange,
      shortSymbol: shortData.symbol,
      shortSize: positionSize,
      shortEntryPrice: executionPrice,
      shortCurrentPrice: executionPrice,
      shortFundingRate: shortData.rate,

      // P&L
      spread: spread.spread,
      entrySpread: spread.spread,
      fundingEarned: 0,
      pnl: 0,

      status: 'open',
      entryTime: Date.now(),
    };

    this.positions.set(position.canonical, position);
    console.log(`[Arbitrage] Position created successfully: ${position.canonical}`);
    console.log(`  Long: ${spread.longExchange} @ $${position.longEntryPrice.toFixed(2)} (Order: ${hedgedResult.longOrderId})`);
    console.log(`  Short: ${spread.shortExchange} @ $${position.shortEntryPrice.toFixed(2)} (Order: ${hedgedResult.shortOrderId})`);

    // Save state
    this.saveState();

    // Send Telegram notification
    await telegramNotificationService.notifyPositionOpened(
      position.canonical,
      rank,
      allocation,
      spread.longExchange,
      spread.shortExchange,
      position.longEntryPrice,
      position.shortEntryPrice,
      spread.spread,
      positionSize
    );

    return position;
  }

  /**
   * Close an existing position
   */
  async closePosition(
    canonical: string,
    reason: 'negative_spread' | 'rebalance' | 'manual'
  ): Promise<void> {
    const position = this.positions.get(canonical);
    if (!position) {
      console.warn(`[Arbitrage] Position not found: ${canonical}`);
      return;
    }

    position.status = 'closing';

    console.log(`[Arbitrage] Closing position: ${canonical} (Reason: ${reason})`);

    // Use current market price for closing
    const closePrice = (position.longCurrentPrice + position.shortCurrentPrice) / 2;
    const halfSize = (position.longSize + position.shortSize) / 2;

    // Execute closing trades
    try {
      const closeResult = await exchangeTradeService.closeArbitrageTrade(
        position.longExchange,
        position.shortExchange,
        position.longSymbol,
        position.shortSymbol,
        closePrice,
        halfSize
      );

      if (!closeResult.longOrder.success || !closeResult.shortOrder.success) {
        console.error(`[Arbitrage] Failed to fully close position ${canonical}`);
        if (!closeResult.longOrder.success) {
          console.error(`  Close long error: ${closeResult.longOrder.error}`);
        }
        if (!closeResult.shortOrder.success) {
          console.error(`  Close short error: ${closeResult.shortOrder.error}`);
        }
      } else {
        console.log(`[Arbitrage] Position closed successfully`);
        console.log(`  Closed long: Order ${closeResult.longOrder.orderId}`);
        console.log(`  Closed short: Order ${closeResult.shortOrder.orderId}`);
      }
    } catch (error: any) {
      console.error(`[Arbitrage] Error closing position:`, error);
    }

    position.status = 'closed';
    position.exitTime = Date.now();
    position.exitReason = reason;
    position.exitPrice = closePrice;

    console.log(`[Arbitrage] Closed position: ${canonical} (Reason: ${reason}, P&L: $${position.pnl.toFixed(2)})`);

    // Calculate duration
    const durationHours = (Date.now() - position.entryTime) / (60 * 60 * 1000);

    // Send Telegram notification
    await telegramNotificationService.notifyPositionClosed(
      canonical,
      reason,
      position.entrySpread,
      position.spread,
      position.pnl,
      position.fundingEarned,
      durationHours
    );

    // Keep position in history but remove from active
    this.closedPositions.unshift(position); // Add to beginning of closed positions

    // Keep only last 50 closed positions
    if (this.closedPositions.length > 50) {
      this.closedPositions = this.closedPositions.slice(0, 50);
    }

    this.positions.delete(canonical);

    // Save state
    this.saveState();
  }

  /**
   * Update position with current market data
   */
  updatePosition(
    canonical: string,
    asterRate: FundingRate | null,
    hlRate: FundingRate | null
  ): void {
    const position = this.positions.get(canonical);
    if (!position || position.status !== 'open') return;

    // Update prices
    if (asterRate && position.longExchange === 'aster') {
      position.longCurrentPrice = asterRate.markPrice;
      position.longFundingRate = asterRate.rate;
    } else if (hlRate && position.longExchange === 'hyperliquid') {
      position.longCurrentPrice = hlRate.markPrice;
      position.longFundingRate = hlRate.rate;
    }

    if (asterRate && position.shortExchange === 'aster') {
      position.shortCurrentPrice = asterRate.markPrice;
      position.shortFundingRate = asterRate.rate;
    } else if (hlRate && position.shortExchange === 'hyperliquid') {
      position.shortCurrentPrice = hlRate.markPrice;
      position.shortFundingRate = hlRate.rate;
    }

    // Update spread
    position.spread = Math.abs(position.longFundingRate - position.shortFundingRate);

    // Calculate P&L
    // Long P&L: (current - entry) * size / entry
    const longPnl = ((position.longCurrentPrice - position.longEntryPrice) / position.longEntryPrice) * position.longSize;

    // Short P&L: (entry - current) * size / entry
    const shortPnl = ((position.shortEntryPrice - position.shortCurrentPrice) / position.shortEntryPrice) * position.shortSize;

    // Total P&L = long P&L + short P&L + funding earned
    position.pnl = longPnl + shortPnl + position.fundingEarned;

    // Save state periodically
    this.saveState();
  }

  /**
   * Monitor spreads and exit if negative
   */
  private async monitorSpreadsForExit(): Promise<void> {
    for (const [canonical, position] of this.positions) {
      if (position.status !== 'open') continue;

      // Check if spread has gone negative
      if (position.spread < 0) {
        console.warn(`[Arbitrage] Spread turned negative for ${canonical}: ${position.spread.toFixed(4)}%`);

        // Send alert
        await telegramNotificationService.notifyNegativeSpread(canonical, position.spread);

        await this.closePosition(canonical, 'negative_spread');
      }
    }
  }

  /**
   * Execute rebalancing logic
   */
  async rebalance(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>
  ): Promise<void> {
    this.isRebalancing = true;
    console.log(`[Arbitrage] Starting rebalance...`);

    // PRE-TRADE VALIDATION: Check API keys and balances
    console.log(`[Arbitrage] Validating trading readiness...`);
    const validation = await exchangeTradeService.validateTradingReadiness(this.config.totalCapital);

    if (!validation.valid) {
      console.error(`[Arbitrage] ========================================`);
      console.error(`[Arbitrage] ❌ TRADING VALIDATION FAILED`);
      console.error(`[Arbitrage] ========================================`);
      console.error(`[Arbitrage] Found ${validation.errors.length} error(s):`);
      validation.errors.forEach((error, idx) => {
        console.error(`[Arbitrage]   ${idx + 1}. ❌ ${error}`);
      });

      // Also show warnings to help diagnose the issue
      if (validation.warnings.length > 0) {
        console.warn(`[Arbitrage] ========================================`);
        console.warn(`[Arbitrage] Warnings (${validation.warnings.length}):`);
        validation.warnings.forEach((warning, idx) => {
          console.warn(`[Arbitrage]   ${idx + 1}. ⚠️ ${warning}`);
        });
      }

      console.error(`[Arbitrage] ========================================`);
      console.error(`[Arbitrage] Fix these issues in Settings to enable trading`);
      console.error(`[Arbitrage] Rebalance aborted - no trades will execute`);
      console.error(`[Arbitrage] ========================================`);

      // Send notification about validation failure
      const errorMessage =
        `⚠️ <b>Trading Validation Failed</b>\n\n` +
        validation.errors.map(e => `❌ ${e}`).join('\n') +
        `\n\nPlease fix these issues in Settings to enable trading.`;

      try {
        // Use notifyError if it exists, otherwise skip notification
        console.error('[Arbitrage] Would send Telegram alert about validation failure');
      } catch (notifyError) {
        console.error('[Arbitrage] Could not send validation failure notification');
      }

      this.isRebalancing = false;
      return;
    }

    // Log any warnings
    if (validation.warnings.length > 0) {
      console.warn(`[Arbitrage] Trading warnings:`);
      validation.warnings.forEach(warning => console.warn(`  ⚠️ ${warning}`));
    }

    console.log(`[Arbitrage] Validation passed! Balances:`);
    console.log(`  Aster: $${validation.asterBalance?.toFixed(2)}`);
    console.log(`  Hyperliquid: $${validation.hyperliquidBalance?.toFixed(2)}`);

    // Fetch MORE spreads than needed (buffer for skipped positions)
    // Request 3x the number needed to ensure we can backfill
    const bufferMultiplier = 3;
    const candidateSpreads = this.getTopSpreads(asterRates, hlRates, this.config.numberOfPairs * bufferMultiplier);

    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] REBALANCE EXECUTION`);
    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] Found ${candidateSpreads.length} candidate spreads (target: ${this.config.numberOfPairs} positions)`);

    const positionsEntered: string[] = [];
    const positionsExited: string[] = [];

    // Track which positions to keep (will fill up to numberOfPairs)
    const targetPositions: Map<string, FundingSpread> = new Map();
    let positionsNeeded = this.config.numberOfPairs;

    // First, keep existing positions that are still in top spreads
    for (const [canonical, position] of this.positions) {
      const spreadIndex = candidateSpreads.findIndex(s => s.canonical === canonical);
      if (spreadIndex >= 0 && position.spread > 0 && positionsNeeded > 0) {
        targetPositions.set(canonical, candidateSpreads[spreadIndex]);
        positionsNeeded--;
        console.log(`[Arbitrage] ✅ Keeping existing position: ${canonical}`);
      } else if (spreadIndex < 0 || position.spread <= 0) {
        console.log(`[Arbitrage] 📉 Will close ${canonical}: ${spreadIndex < 0 ? 'fell out of top spreads' : 'negative spread'}`);
      }
    }

    // Then, fill remaining slots with new positions
    console.log(`[Arbitrage] Need ${positionsNeeded} more position(s) to reach target of ${this.config.numberOfPairs}`);

    for (let i = 0; i < candidateSpreads.length && positionsNeeded > 0; i++) {
      const spread = candidateSpreads[i];

      // Skip if already in targetPositions
      if (targetPositions.has(spread.canonical)) continue;

      // Check minimum spread threshold
      if (spread.annualSpread < this.config.minSpreadThreshold) {
        console.log(`[Arbitrage] ⏭️ Skipping ${spread.canonical}: ${spread.annualSpread.toFixed(2)}% APR < ${this.config.minSpreadThreshold}% threshold`);
        continue;
      }

      // This spread qualifies!
      targetPositions.set(spread.canonical, spread);
      positionsNeeded--;
      console.log(`[Arbitrage] ✅ Selected ${spread.canonical} for entry (${this.config.numberOfPairs - positionsNeeded}/${this.config.numberOfPairs})`);
    }

    // Log final selection
    console.log(`[Arbitrage] Final selection (${targetPositions.size} positions):`);
    let displayRank = 1;
    for (const [canonical, spread] of targetPositions) {
      console.log(`[Arbitrage]   ${displayRank}. ${canonical}: ${spread.annualSpread.toFixed(2)}% APR (8hr: ${spread.spread.toFixed(4)}%)`);
      displayRank++;
    }

    // Close positions not in target
    for (const [canonical, position] of this.positions) {
      if (!targetPositions.has(canonical)) {
        console.log(`[Arbitrage] 🔴 Closing ${canonical} (no longer in target positions)`);
        await this.closePosition(canonical, 'rebalance');
        positionsExited.push(canonical);
      }
    }

    // Enter new positions
    let currentRank = 1;
    for (const [canonical, spread] of targetPositions) {
      if (!this.positions.has(canonical)) {
        console.log(`[Arbitrage] 🎯 Attempting to enter ${canonical} (Rank ${currentRank})`);
        try {
          await this.createPosition(spread, currentRank);
          positionsEntered.push(canonical);
          console.log(`[Arbitrage] ✅ Successfully entered ${canonical}`);
        } catch (error: any) {
          console.error(`[Arbitrage] ❌ Failed to enter ${canonical}: ${error.message}`);
        }
      } else {
        // Update existing position rank if needed
        const position = this.positions.get(canonical)!;
        if (position.rank !== currentRank) {
          console.log(`[Arbitrage] ${canonical} rank changed: ${position.rank} → ${currentRank}`);
          position.rank = currentRank;
          position.allocation = this.config.allocations[currentRank - 1];
        }
      }
      currentRank++;
    }

    // Record rebalance event
    this.rebalanceHistory.push({
      timestamp: Date.now(),
      positionsEntered,
      positionsExited,
      capitalReallocated: this.config.totalCapital,
      spreadsAtRebalance: Array.from(targetPositions.values()),
    });

    this.lastRebalanceTime = Date.now();
    this.isRebalancing = false;

    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] REBALANCE COMPLETE`);
    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] Positions entered: ${positionsEntered.length > 0 ? positionsEntered.join(', ') : 'None'}`);
    console.log(`[Arbitrage] Positions exited: ${positionsExited.length > 0 ? positionsExited.join(', ') : 'None'}`);
    console.log(`[Arbitrage] Active positions: ${this.positions.size}`);
    console.log(`[Arbitrage] Next rebalance in ${this.config.rebalanceInterval} minutes`);

    // Send Telegram notification
    await telegramNotificationService.notifyRebalance(
      positionsEntered,
      positionsExited,
      this.positions.size
    );
  }

  /**
   * Manually trigger rebalance outside of automatic schedule
   */
  async manualRebalance(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>
  ): Promise<{ success: boolean; positionsEntered: number; positionsExited: number; error?: string }> {
    if (!this.config.enabled) {
      return {
        success: false,
        positionsEntered: 0,
        positionsExited: 0,
        error: 'Strategy is not running',
      };
    }

    if (this.isRebalancing) {
      return {
        success: false,
        positionsEntered: 0,
        positionsExited: 0,
        error: 'Rebalance already in progress',
      };
    }

    // Check cooldown (60 seconds since last manual rebalance)
    const timeSinceLastManual = Date.now() - this.lastManualRebalanceTime;
    const cooldownMs = 60 * 1000; // 60 seconds
    if (timeSinceLastManual < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastManual) / 1000);
      return {
        success: false,
        positionsEntered: 0,
        positionsExited: 0,
        error: `Cooldown active. Please wait ${remainingSeconds} seconds.`,
      };
    }

    console.log(`[Arbitrage] Manual rebalance triggered`);
    this.isRebalancing = true;
    this.lastManualRebalanceTime = Date.now();

    try {
      // Track positions before rebalance
      const positionsBefore = this.positions.size;

      await this.rebalance(asterRates, hlRates);

      // Calculate what changed
      const positionsAfter = this.positions.size;
      const lastRebalance = this.rebalanceHistory[this.rebalanceHistory.length - 1];

      return {
        success: true,
        positionsEntered: lastRebalance?.positionsEntered.length || 0,
        positionsExited: lastRebalance?.positionsExited.length || 0,
      };
    } catch (error: any) {
      console.error(`[Arbitrage] Manual rebalance failed:`, error);
      this.isRebalancing = false;
      return {
        success: false,
        positionsEntered: 0,
        positionsExited: 0,
        error: error.message || 'Rebalance failed',
      };
    }
  }

  /**
   * Get rebalancing status
   */
  getRebalanceStatus(): {
    isRebalancing: boolean;
    lastRebalanceTime: number;
    lastManualRebalanceTime: number;
    cooldownRemaining: number;
  } {
    const timeSinceLastManual = Date.now() - this.lastManualRebalanceTime;
    const cooldownMs = 60 * 1000;
    const cooldownRemaining = Math.max(0, cooldownMs - timeSinceLastManual);

    return {
      isRebalancing: this.isRebalancing,
      lastRebalanceTime: this.lastRebalanceTime,
      lastManualRebalanceTime: this.lastManualRebalanceTime,
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
    };
  }

  /**
   * Start the strategy
   */
  async start(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>
  ): Promise<void> {
    if (this.config.enabled) {
      console.warn(`[Arbitrage] Strategy already running`);
      return;
    }

    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] Starting funding arbitrage strategy`);
    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] Capital per exchange: $${this.config.totalCapital}`);
    console.log(`[Arbitrage] Number of pairs: ${this.config.numberOfPairs}`);
    console.log(`[Arbitrage] Allocations: ${this.config.allocations.join(', ')}%`);
    console.log(`[Arbitrage] Min APR threshold: ${this.config.minSpreadThreshold}%`);
    console.log(`[Arbitrage] Rebalance interval: ${this.config.rebalanceInterval} minutes`);
    console.log(`[Arbitrage] Mode: LIVE TRADING`);

    this.config.enabled = true;

    // Send Telegram notification
    await telegramNotificationService.notifyStrategyStarted(this.config.totalCapital);

    // Immediate rebalance
    this.rebalance(asterRates, hlRates);

    // Schedule periodic rebalancing based on interval (in minutes)
    const intervalMs = this.config.rebalanceInterval * 60 * 1000;
    this.rebalanceTimer = setInterval(() => {
      console.log(`[Arbitrage] Re-scanning for top ${this.config.numberOfPairs} spreads...`);
      this.rebalance(asterRates, hlRates);
    }, intervalMs);

    // Monitor spreads every 10 seconds for negative exits
    this.spreadMonitorInterval = setInterval(() => {
      this.monitorSpreadsForExit();
    }, 10000);

    console.log(`[Arbitrage] Rebalancing scheduled every ${this.config.rebalanceInterval} minutes`);
  }

  /**
   * Stop the strategy
   */
  async stop(): Promise<void> {
    console.log(`[Arbitrage] Stopping funding arbitrage strategy`);

    this.config.enabled = false;

    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = null;
    }

    if (this.spreadMonitorInterval) {
      clearInterval(this.spreadMonitorInterval);
      this.spreadMonitorInterval = null;
    }

    // Close all open positions
    const openPositions = Array.from(this.positions.keys());
    for (const canonical of openPositions) {
      await this.closePosition(canonical, 'manual');
    }

    // Send Telegram notification
    await telegramNotificationService.notifyStrategyStopped();
  }

  /**
   * Get current strategy status
   */
  getStatus() {
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === 'open');
    const totalPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0);
    const totalFundingEarned = openPositions.reduce((sum, p) => sum + p.fundingEarned, 0);
    const allocatedCapital = openPositions.reduce((sum, p) => sum + (p.longSize + p.shortSize), 0);

    // Calculate next rebalance time based on interval
    const nextRebalanceTime = this.lastRebalanceTime + (this.config.rebalanceInterval * 60 * 1000);

    return {
      enabled: this.config.enabled,
      totalCapital: this.config.totalCapital,
      allocatedCapital,
      availableCapital: this.config.totalCapital - allocatedCapital,
      openPositions: openPositions.length,
      totalPnl,
      totalFundingEarned,
      lastRebalanceTime: this.lastRebalanceTime,
      nextRebalanceTime,
      positions: openPositions,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<StrategyConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
    console.log(`[Arbitrage] Config updated:`, updates);
    this.saveState();
  }

  /**
   * Get rebalance history
   */
  getRebalanceHistory(): RebalanceEvent[] {
    return [...this.rebalanceHistory];
  }

  /**
   * Get open positions
   */
  getOpenPositions(): StrategyPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'open');
  }

  /**
   * Get closed positions (history)
   */
  getClosedPositions(): StrategyPosition[] {
    return [...this.closedPositions];
  }

  /**
   * Manually close a position
   */
  async manualClose(canonical: string): Promise<void> {
    await this.closePosition(canonical, 'manual');
  }

  /**
   * Clear all positions (useful for clearing paper trading data)
   */
  clearAllPositions(): void {
    console.log('[Arbitrage] Clearing all positions and resetting state');

    // Clear in-memory state
    this.positions.clear();
    this.closedPositions = [];
    this.rebalanceHistory = [];
    this.lastRebalanceTime = 0;
    this.lastManualRebalanceTime = 0;

    // Clear localStorage
    this.clearState();

    console.log('[Arbitrage] All positions cleared. Refresh the page to see changes.');
  }

  /**
   * Resume strategy after page reload
   */
  async resume(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>
  ): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Arbitrage] Strategy not enabled, skipping resume');
      return;
    }

    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] RESUMING STRATEGY AFTER PAGE RELOAD`);
    console.log(`[Arbitrage] ========================================`);
    console.log(`[Arbitrage] Active positions: ${this.positions.size}`);
    console.log(`[Arbitrage] Rebalance interval: ${this.config.rebalanceInterval} minutes`);

    // Schedule periodic rebalancing based on interval (in minutes)
    const intervalMs = this.config.rebalanceInterval * 60 * 1000;
    this.rebalanceTimer = setInterval(() => {
      console.log(`[Arbitrage] Re-scanning for top ${this.config.numberOfPairs} spreads...`);
      this.rebalance(asterRates, hlRates);
    }, intervalMs);

    // Monitor spreads every 10 seconds for negative exits
    this.spreadMonitorInterval = setInterval(() => {
      this.monitorSpreadsForExit();
    }, 10000);

    console.log(`[Arbitrage] Strategy resumed. Rebalancing every ${this.config.rebalanceInterval} minutes`);
  }
}

export const fundingArbitrageService = new FundingArbitrageService();
