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
  paperMode: boolean; // Paper trading mode
  totalCapital: number; // Total USD allocated to strategy
  allocations: [30, 30, 20, 10, 10]; // Fixed allocation percentages
  rebalanceInterval: number; // In milliseconds (4 hours = 14400000)
  minSpreadThreshold: number; // Minimum spread to enter (e.g., 0.5%)
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
    paperMode: false,
    totalCapital: 10000,
    allocations: [30, 30, 20, 10, 10],
    rebalanceInterval: 4 * 60 * 60 * 1000, // 4 hours
    minSpreadThreshold: 0.5, // 0.5% minimum spread
    excludedSymbols: [],
    walletAddresses: {},
  };

  private positions: Map<string, StrategyPosition> = new Map();
  private rebalanceTimer: NodeJS.Timeout | null = null;
  private lastRebalanceTime: number = 0;
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
    // CRITICAL FIX: Hyperliquid shows 8-hour rate but pays hourly
    // Aster: Shows and pays 8-hour rate → 3 payments/day
    // HyperLiquid: Shows 8-hour rate but pays hourly → need to convert

    // Aster daily payments (8hr rate × 3 payments)
    const asterDailyPayments = asterRate.rate * 3;

    // Hyperliquid hourly rate = displayed 8hr rate / 8
    const hlHourlyRate = hlRate.rate / 8;
    // Hyperliquid daily payments (hourly rate × 24 payments)
    const hlDailyPayments = hlHourlyRate * 24;

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
   * Identify top 5 funding spreads
   */
  getTop5Spreads(
    asterRates: Map<string, FundingRate>,
    hlRates: Map<string, FundingRate>
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

    // Sort by spread (descending) and take top 5
    return spreads
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 5);
  }

  /**
   * Calculate position size based on rank and allocation
   */
  calculatePositionSize(rank: number): number {
    const allocation = this.config.allocations[rank - 1]; // rank 1-5 -> index 0-4
    return (this.config.totalCapital * allocation) / 100;
  }

  /**
   * Create a new arbitrage position
   */
  async createPosition(spread: FundingSpread, rank: number): Promise<StrategyPosition> {
    const allocation = this.config.allocations[rank - 1];
    const positionSize = this.calculatePositionSize(rank);
    const halfSize = positionSize / 2; // Split between long and short

    const longData = spread.longExchange === 'aster' ? spread.aster! : spread.hyperliquid!;
    const shortData = spread.shortExchange === 'aster' ? spread.aster! : spread.hyperliquid!;

    console.log(`[Arbitrage] Creating position: ${spread.canonical} (Rank ${rank}, ${allocation}%, $${positionSize.toFixed(2)})`);

    // Use the same price for both sides to avoid slippage
    // Use the average of both mark prices
    const executionPrice = (longData.markPrice + shortData.markPrice) / 2;

    // Execute the trade on both exchanges simultaneously
    const tradeResult = await exchangeTradeService.placeArbitrageTrade(
      spread.longExchange,
      spread.shortExchange,
      longData.symbol,
      shortData.symbol,
      executionPrice,
      halfSize
    );

    // Check if trade execution was successful
    if (!tradeResult.longOrder.success || !tradeResult.shortOrder.success) {
      console.error(`[Arbitrage] Failed to create position for ${spread.canonical}`);
      if (!tradeResult.longOrder.success) {
        console.error(`  Long order error: ${tradeResult.longOrder.error}`);
      }
      if (!tradeResult.shortOrder.success) {
        console.error(`  Short order error: ${tradeResult.shortOrder.error}`);
      }
      throw new Error(`Trade execution failed: ${tradeResult.longOrder.error || tradeResult.shortOrder.error}`);
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
      longSize: halfSize,
      longEntryPrice: tradeResult.longOrder.price || executionPrice,
      longCurrentPrice: tradeResult.longOrder.price || executionPrice,
      longFundingRate: longData.rate,

      // Short side
      shortExchange: spread.shortExchange,
      shortSymbol: shortData.symbol,
      shortSize: halfSize,
      shortEntryPrice: tradeResult.shortOrder.price || executionPrice,
      shortCurrentPrice: tradeResult.shortOrder.price || executionPrice,
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
    console.log(`  Long: ${spread.longExchange} @ $${position.longEntryPrice.toFixed(2)} (Order: ${tradeResult.longOrder.orderId})`);
    console.log(`  Short: ${spread.shortExchange} @ $${position.shortEntryPrice.toFixed(2)} (Order: ${tradeResult.shortOrder.orderId})`);

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
    console.log(`[Arbitrage] Starting rebalance...`);

    // PRE-TRADE VALIDATION: Check API keys and balances
    console.log(`[Arbitrage] Validating trading readiness...`);
    const validation = await exchangeTradeService.validateTradingReadiness(this.config.totalCapital);

    if (!validation.valid) {
      console.error(`[Arbitrage] Trading validation failed:`);
      validation.errors.forEach(error => console.error(`  ❌ ${error}`));

      // Send notification about validation failure
      const errorMessage =
        `⚠️ <b>Trading Validation Failed</b>\n\n` +
        validation.errors.map(e => `❌ ${e}`).join('\n') +
        `\n\nPlease fix these issues in Settings to enable trading.`;

      try {
        // Use notifyError if it exists, otherwise skip notification
        console.error('[Arbitrage] Validation failed - would send telegram alert');
      } catch (notifyError) {
        console.error('[Arbitrage] Could not send validation failure notification');
      }

      console.log(`[Arbitrage] Rebalance aborted due to validation failure`);
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

    const top5 = this.getTop5Spreads(asterRates, hlRates);
    const top5Symbols = new Set(top5.map(s => s.canonical));

    const positionsEntered: string[] = [];
    const positionsExited: string[] = [];

    // Close positions that fell out of top 5 (but only if spread is still positive)
    for (const [canonical, position] of this.positions) {
      if (!top5Symbols.has(canonical) && position.spread > 0) {
        console.log(`[Arbitrage] ${canonical} fell out of top 5 but spread is still positive (${position.spread.toFixed(4)}%), keeping until next rebalance`);
        // Don't exit yet - wait until next rebalance
      }
    }

    // Enter new positions for top 5
    for (let i = 0; i < top5.length; i++) {
      const spread = top5[i];
      const rank = i + 1;

      if (!this.positions.has(spread.canonical)) {
        // Check minimum spread threshold
        if (spread.spread >= this.config.minSpreadThreshold) {
          await this.createPosition(spread, rank);
          positionsEntered.push(spread.canonical);
        } else {
          console.log(`[Arbitrage] ${spread.canonical} spread (${spread.spread.toFixed(4)}%) below threshold (${this.config.minSpreadThreshold}%)`);
        }
      } else {
        // Position exists, just update rank/allocation if changed
        const position = this.positions.get(spread.canonical)!;
        if (position.rank !== rank) {
          console.log(`[Arbitrage] ${spread.canonical} rank changed: ${position.rank} → ${rank}`);
          position.rank = rank;
          position.allocation = this.config.allocations[rank - 1];
          // TODO: Adjust position size if allocation changed
        }
      }
    }

    // Record rebalance event
    this.rebalanceHistory.push({
      timestamp: Date.now(),
      positionsEntered,
      positionsExited,
      capitalReallocated: this.config.totalCapital,
      spreadsAtRebalance: top5,
    });

    this.lastRebalanceTime = Date.now();
    console.log(`[Arbitrage] Rebalance complete. Entered: ${positionsEntered.length}, Exited: ${positionsExited.length}`);

    // Send Telegram notification
    await telegramNotificationService.notifyRebalance(
      positionsEntered,
      positionsExited,
      this.positions.size
    );
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

    console.log(`[Arbitrage] Starting funding arbitrage strategy with $${this.config.totalCapital} capital`);
    console.log(`[Arbitrage] Mode: ${this.config.paperMode ? 'PAPER TRADING' : 'LIVE TRADING'}`);

    this.config.enabled = true;

    // Set exchange service paper mode
    exchangeTradeService.setPaperMode(this.config.paperMode);

    // In paper mode, use $100 starting capital (split between exchanges)
    if (this.config.paperMode) {
      this.config.totalCapital = 200; // $100 per exchange
      console.log(`[Arbitrage] Paper mode: Using $200 starting capital ($100 per exchange)`);
    }

    // Send Telegram notification
    await telegramNotificationService.notifyStrategyStarted(this.config.totalCapital);

    // Immediate rebalance
    this.rebalance(asterRates, hlRates);

    // Schedule rebalancing every 4 hours
    this.rebalanceTimer = setInterval(() => {
      this.rebalance(asterRates, hlRates);
    }, this.config.rebalanceInterval);

    // Monitor spreads every 10 seconds for negative exits
    this.spreadMonitorInterval = setInterval(() => {
      this.monitorSpreadsForExit();
    }, 10000);

    console.log(`[Arbitrage] Rebalancing scheduled every ${this.config.rebalanceInterval / (60 * 60 * 1000)} hours`);
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

    return {
      enabled: this.config.enabled,
      totalCapital: this.config.totalCapital,
      allocatedCapital,
      availableCapital: this.config.totalCapital - allocatedCapital,
      openPositions: openPositions.length,
      totalPnl,
      totalFundingEarned,
      lastRebalanceTime: this.lastRebalanceTime,
      nextRebalanceTime: this.lastRebalanceTime + this.config.rebalanceInterval,
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

    console.log('[Arbitrage] Resuming strategy after page reload...');

    // Set exchange service paper mode
    exchangeTradeService.setPaperMode(this.config.paperMode);

    // Schedule rebalancing every 4 hours
    this.rebalanceTimer = setInterval(() => {
      this.rebalance(asterRates, hlRates);
    }, this.config.rebalanceInterval);

    // Monitor spreads every 10 seconds for negative exits
    this.spreadMonitorInterval = setInterval(() => {
      this.monitorSpreadsForExit();
    }, 10000);

    console.log('[Arbitrage] Strategy resumed successfully');
  }
}

export const fundingArbitrageService = new FundingArbitrageService();
