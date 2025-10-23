/**
 * Copy Trading Service
 * Executes copy trades with risk management and position tracking
 */

import { db } from '../db.js';
import { Timestamp } from 'firebase-admin/firestore';
import { KrakenService } from './krakenService.js';
import { orderQueueService } from './orderQueueService.js';
import { OrderType } from '../types/orderQueue.js';
import {
  walletTrackerService,
  WalletSignal,
  CopyTradePosition,
  TrackerConfig,
  TrackedWallet
} from './walletTrackerService.js';

export interface CopyTradeResult {
  success: boolean;
  positionId?: string;
  orderId?: string;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface PositionCloseResult {
  success: boolean;
  realizedPnL?: number;
  realizedPnLPercent?: number;
  error?: string;
}

export class CopyTradingService {
  private krakenService: KrakenService;

  // Asset mapping: on-chain token -> Kraken pair
  private readonly ASSET_MAPPING: Record<string, string> = {
    'WETH': 'ETH/USD',
    'ETH': 'ETH/USD',
    'WBTC': 'BTC/USD',
    'BTC': 'BTC/USD',
    'SOL': 'SOL/USD',
    'USDC': 'USDC/USD',
    'USDT': 'USDT/USD',
    'DAI': 'DAI/USD',
    'LINK': 'LINK/USD',
    'UNI': 'UNI/USD',
    'AAVE': 'AAVE/USD',
    'MATIC': 'MATIC/USD',
    'AVAX': 'AVAX/USD',
    'DOT': 'DOT/USD',
    'ATOM': 'ATOM/USD',
    'ADA': 'ADA/USD',
    'XRP': 'XRP/USD',
    'LTC': 'LTC/USD',
    'BCH': 'BCH/USD',
    'DOGE': 'DOGE/USD',
  };

  constructor() {
    this.krakenService = new KrakenService();
  }

  /**
   * Process a wallet signal and potentially copy the trade
   */
  async processSignal(
    userId: string,
    signal: WalletSignal,
    apiKey?: string,
    apiSecret?: string
  ): Promise<CopyTradeResult> {
    console.log(`[CopyTrading] Processing signal ${signal.id} from wallet ${signal.walletAddress}`);

    try {
      // Get configuration
      const config = await walletTrackerService.getConfig(userId);
      if (!config) {
        return { success: false, error: 'Configuration not found' };
      }

      // Check if strategy is enabled
      if (!config.enabled) {
        return {
          success: false,
          skipped: true,
          skipReason: 'Strategy disabled'
        };
      }

      // Get wallet details
      const wallet = await walletTrackerService.getWalletDetails(userId, signal.walletId);
      if (!wallet) {
        return {
          success: false,
          skipped: true,
          skipReason: 'Wallet not found'
        };
      }

      // Pre-trade checks
      const checks = await this.preTradeChecks(userId, signal, wallet, config);
      if (!checks.passed) {
        console.log(`[CopyTrading] Pre-trade check failed: ${checks.reason}`);
        return {
          success: false,
          skipped: true,
          skipReason: checks.reason
        };
      }

      // Map to Kraken pair
      const krakenPair = this.mapToKrakenPair(signal);
      if (!krakenPair) {
        return {
          success: false,
          skipped: true,
          skipReason: `Token ${signal.tokenOut} not available on Kraken`
        };
      }

      // Check current price on Kraken
      const currentPrice = await this.getCurrentPrice(krakenPair, apiKey, apiSecret);
      if (!currentPrice) {
        return {
          success: false,
          skipped: true,
          skipReason: 'Could not fetch current price'
        };
      }

      // Check price movement since signal
      const priceMovement = this.calculatePriceMovement(signal.price, currentPrice);
      if (Math.abs(priceMovement) > config.maxPriceMovementBps) {
        return {
          success: false,
          skipped: true,
          skipReason: `Price moved ${priceMovement.toFixed(0)}bps (max ${config.maxPriceMovementBps}bps)`
        };
      }

      // Calculate position size
      const positionSize = await this.calculatePositionSize(userId, signal, wallet, config, apiKey, apiSecret);
      if (positionSize <= 0) {
        return {
          success: false,
          skipped: true,
          skipReason: 'Position size too small or allocation limit reached'
        };
      }

      // In simulation mode, just record the trade
      if (config.simulationMode) {
        const positionId = await this.recordSimulatedPosition(
          userId,
          signal,
          krakenPair,
          currentPrice,
          positionSize,
          config
        );
        console.log(`[CopyTrading] Simulated trade recorded: ${positionId}`);
        return {
          success: true,
          positionId,
          skipped: false
        };
      }

      // Execute the trade on Kraken
      const result = await this.executeTrade(
        userId,
        signal,
        krakenPair,
        currentPrice,
        positionSize,
        config,
        apiKey,
        apiSecret
      );

      return result;

    } catch (error: any) {
      console.error(`[CopyTrading] Error processing signal:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Perform pre-trade safety checks
   */
  private async preTradeChecks(
    userId: string,
    signal: WalletSignal,
    wallet: TrackedWallet,
    config: TrackerConfig
  ): Promise<{ passed: boolean; reason?: string }> {
    // Check wallet score threshold
    if (wallet.score < config.minWalletScore) {
      return {
        passed: false,
        reason: `Wallet score ${wallet.score} below minimum ${config.minWalletScore}`
      };
    }

    // Check if wallet is active
    if (!wallet.isActive) {
      return { passed: false, reason: 'Wallet is not active' };
    }

    // Check concurrent positions limit
    const openPositions = await this.getOpenPositions(userId);
    if (openPositions.length >= config.maxConcurrentPositions) {
      return {
        passed: false,
        reason: `Max concurrent positions (${config.maxConcurrentPositions}) reached`
      };
    }

    // Check daily loss cap for this wallet
    const dailyPnL = await this.getWalletDailyPnL(userId, wallet.id);
    const accountValue = 10000; // TODO: Get actual account value
    const maxDailyLoss = accountValue * (config.dailyLossCapPercent / 100);

    if (dailyPnL < -maxDailyLoss) {
      return {
        passed: false,
        reason: `Daily loss cap hit for wallet (${dailyPnL.toFixed(2)} < -${maxDailyLoss.toFixed(2)})`
      };
    }

    // Check if signal is too old (older than 5 minutes)
    const signalAge = Date.now() - signal.timestamp.toMillis();
    if (signalAge > 5 * 60 * 1000) {
      return {
        passed: false,
        reason: 'Signal too old (>5 minutes)'
      };
    }

    return { passed: true };
  }

  /**
   * Map on-chain token to Kraken trading pair
   */
  private mapToKrakenPair(signal: WalletSignal): string | null {
    // For buy signals, we care about tokenOut (what they bought)
    const token = signal.type === 'buy' || signal.type === 'swap'
      ? signal.tokenOut
      : signal.tokenIn;

    const normalized = token.toUpperCase();
    return this.ASSET_MAPPING[normalized] || null;
  }

  /**
   * Get current price for a Kraken pair
   */
  private async getCurrentPrice(
    pair: string,
    apiKey?: string,
    apiSecret?: string
  ): Promise<number | null> {
    try {
      const ticker = await this.krakenService.getTicker(pair);
      if (ticker && ticker.price) {
        return ticker.price;
      }
      return null;
    } catch (error) {
      console.error(`[CopyTrading] Error fetching price for ${pair}:`, error);
      return null;
    }
  }

  /**
   * Calculate price movement in basis points
   */
  private calculatePriceMovement(oldPrice: number, newPrice: number): number {
    return ((newPrice - oldPrice) / oldPrice) * 10000; // basis points
  }

  /**
   * Calculate position size based on allocation rules
   */
  private async calculatePositionSize(
    userId: string,
    signal: WalletSignal,
    wallet: TrackedWallet,
    config: TrackerConfig,
    apiKey?: string,
    apiSecret?: string
  ): Promise<number> {
    // Get account balance
    const accountValue = 10000; // TODO: Fetch actual account value from Kraken

    // Calculate available allocation for this strategy
    const strategyAllocation = accountValue * (config.totalAllocationPercent / 100);

    // Calculate per-trade allocation
    const perTradeAllocation = accountValue * (config.perTradeAllocationPercent / 100);

    // Apply caps
    let positionSize = Math.min(
      perTradeAllocation,
      config.maxPositionSize,
      strategyAllocation * 0.2 // Max 20% of strategy allocation per trade
    );

    // Check wallet-specific exposure limit
    const walletExposure = await this.getWalletTotalExposure(userId, wallet.id);
    const remainingWalletAllocation = config.maxPerWalletTotal - walletExposure;

    if (remainingWalletAllocation <= 0) {
      console.log(`[CopyTrading] Wallet ${wallet.id} allocation exhausted`);
      return 0;
    }

    positionSize = Math.min(positionSize, remainingWalletAllocation);

    // Adjust based on wallet score (higher score = slightly larger allocation)
    const scoreFactor = 0.8 + (wallet.score / 100) * 0.4; // 0.8 to 1.2x
    positionSize *= scoreFactor;

    // Ensure minimum viable trade size
    const minTradeSize = 10; // $10 minimum
    if (positionSize < minTradeSize) {
      return 0;
    }

    return Math.floor(positionSize);
  }

  /**
   * Get total exposure for a specific wallet
   */
  private async getWalletTotalExposure(userId: string, walletId: string): Promise<number> {
    const positions = await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .where('walletId', '==', walletId)
      .where('status', '==', 'open')
      .get();

    let totalExposure = 0;
    positions.forEach(doc => {
      const pos = doc.data() as CopyTradePosition;
      totalExposure += pos.investedAmount;
    });

    return totalExposure;
  }

  /**
   * Get daily PnL for a wallet's copied trades
   */
  private async getWalletDailyPnL(userId: string, walletId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const positions = await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .where('walletId', '==', walletId)
      .where('openedAt', '>=', Timestamp.fromDate(startOfDay))
      .get();

    let dailyPnL = 0;
    positions.forEach(doc => {
      const pos = doc.data() as CopyTradePosition;
      if (pos.status === 'open') {
        dailyPnL += pos.unrealizedPnL || 0;
      } else if (pos.status === 'closed' && pos.closedAt) {
        // For closed positions, use realized PnL
        dailyPnL += pos.unrealizedPnL || 0;
      }
    });

    return dailyPnL;
  }

  /**
   * Record a simulated position (paper trading)
   */
  private async recordSimulatedPosition(
    userId: string,
    signal: WalletSignal,
    krakenPair: string,
    entryPrice: number,
    positionSize: number,
    config: TrackerConfig
  ): Promise<string> {
    const quantity = positionSize / entryPrice;
    const stopLoss = config.stopLossPercent
      ? entryPrice * (1 - config.stopLossPercent / 100)
      : undefined;
    const takeProfit = config.takeProfitPercent
      ? entryPrice * (1 + config.takeProfitPercent / 100)
      : undefined;

    const position: Omit<CopyTradePosition, 'id'> = {
      userId,
      signalId: signal.id,
      walletId: signal.walletId,
      walletAddress: signal.walletAddress,
      pair: krakenPair,
      side: signal.type === 'buy' || signal.type === 'swap' ? 'buy' : 'sell',
      entryPrice,
      currentPrice: entryPrice,
      targetPrice: entryPrice * 1.01, // 1% target by default
      quantity,
      investedAmount: positionSize,
      currentValue: positionSize,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      fees: positionSize * 0.0026, // 0.26% Kraken fee
      stopLoss,
      takeProfit,
      status: 'open',
      openedAt: Timestamp.now(),
    };

    const docRef = await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .add(position);

    // Update signal status
    await db
      .collection('users')
      .doc(userId)
      .collection('walletSignals')
      .doc(signal.id)
      .update({
        status: 'copied',
        copyable: true,
        processedAt: Timestamp.now()
      });

    return docRef.id;
  }

  /**
   * Execute a real trade on Kraken
   */
  private async executeTrade(
    userId: string,
    signal: WalletSignal,
    krakenPair: string,
    entryPrice: number,
    positionSize: number,
    config: TrackerConfig,
    apiKey?: string,
    apiSecret?: string
  ): Promise<CopyTradeResult> {
    try {
      const quantity = positionSize / entryPrice;
      const side = signal.type === 'buy' || signal.type === 'swap' ? 'buy' : 'sell';

      // Add order to queue
      const order = await orderQueueService.createOrder({
        userId,
        botId: signal.walletId,
        pair: krakenPair,
        type: config.useMarketOrders ? OrderType.MARKET : OrderType.LIMIT,
        side,
        volume: quantity.toFixed(8),
        amount: positionSize,
        price: config.useMarketOrders ? undefined : entryPrice.toString(),
        reason: 'copy_trading',
      });

      console.log(`[CopyTrading] Order ${order.id} queued for execution`);

      // Create position record
      const positionId = await this.recordSimulatedPosition(
        userId,
        signal,
        krakenPair,
        entryPrice,
        positionSize,
        config
      );

      // Update position with order ID
      await db
        .collection('users')
        .doc(userId)
        .collection('copyPositions')
        .doc(positionId)
        .update({ entryOrderId: order.id });

      return {
        success: true,
        positionId,
        orderId: order.id,
        skipped: false
      };

    } catch (error: any) {
      console.error(`[CopyTrading] Error executing trade:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all open positions
   */
  async getOpenPositions(userId: string): Promise<CopyTradePosition[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .where('status', '==', 'open')
      .orderBy('openedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CopyTradePosition));
  }

  /**
   * Close a position
   */
  async closePosition(
    userId: string,
    positionId: string,
    apiKey?: string,
    apiSecret?: string
  ): Promise<PositionCloseResult> {
    try {
      const positionDoc = await db
        .collection('users')
        .doc(userId)
        .collection('copyPositions')
        .doc(positionId)
        .get();

      if (!positionDoc.exists) {
        return { success: false, error: 'Position not found' };
      }

      const position = { id: positionDoc.id, ...positionDoc.data() } as CopyTradePosition;

      if (position.status !== 'open') {
        return { success: false, error: 'Position is not open' };
      }

      // Get config to check if simulation mode
      const config = await walletTrackerService.getConfig(userId);

      if (config?.simulationMode) {
        // Just mark as closed in simulation
        await db
          .collection('users')
          .doc(userId)
          .collection('copyPositions')
          .doc(positionId)
          .update({
            status: 'closed',
            closedAt: Timestamp.now()
          });

        return {
          success: true,
          realizedPnL: position.unrealizedPnL,
          realizedPnLPercent: position.unrealizedPnLPercent
        };
      }

      // Execute exit order on Kraken
      const side = position.side === 'buy' ? 'sell' : 'buy'; // Opposite side to close

      const order = await orderQueueService.createOrder({
        userId,
        botId: position.walletId,
        pair: position.pair,
        type: OrderType.MARKET,
        side,
        volume: position.quantity.toFixed(8),
        amount: position.currentValue,
        reason: 'copy_trading_exit',
      });

      // Update position
      await db
        .collection('users')
        .doc(userId)
        .collection('copyPositions')
        .doc(positionId)
        .update({
          status: 'closing',
          exitOrderId: order.id
        });

      return {
        success: true,
        realizedPnL: position.unrealizedPnL,
        realizedPnLPercent: position.unrealizedPnLPercent
      };

    } catch (error: any) {
      console.error(`[CopyTrading] Error closing position:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update position with current price and recalculate P&L
   */
  async updatePositionPnL(
    userId: string,
    positionId: string,
    currentPrice: number
  ): Promise<void> {
    const positionDoc = await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .doc(positionId)
      .get();

    if (!positionDoc.exists) return;

    const position = positionDoc.data() as CopyTradePosition;

    const currentValue = position.quantity * currentPrice;
    const unrealizedPnL = currentValue - position.investedAmount - position.fees;
    const unrealizedPnLPercent = (unrealizedPnL / position.investedAmount) * 100;

    await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .doc(positionId)
      .update({
        currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent
      });
  }

  /**
   * Get trade history
   */
  async getTradeHistory(userId: string, limit: number = 50): Promise<CopyTradePosition[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('copyPositions')
      .where('status', '==', 'closed')
      .orderBy('closedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CopyTradePosition));
  }
}

export const copyTradingService = new CopyTradingService();
