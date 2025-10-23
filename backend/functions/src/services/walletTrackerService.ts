/**
 * Wallet Tracker Service
 * Tracks on-chain wallets, scores their performance, and generates copy trading signals
 */

import { db } from '../db.js';
import { Timestamp } from 'firebase-admin/firestore';

export interface TrackedWallet {
  id: string;
  address: string;
  chain: 'ethereum' | 'solana' | 'arbitrum' | 'optimism' | 'base';
  nickname?: string;
  addedAt: Timestamp;
  isActive: boolean;
  score: number;

  // Performance metrics (35% weight)
  performance: {
    pnl30d: number;
    pnl90d: number;
    pnlAllTime: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    consistency: number; // % of positive weeks
  };

  // Risk metrics (30% weight)
  risk: {
    maxDrawdown30d: number;
    maxDrawdown90d: number;
    volatility: number;
    avgHoldTime: number; // hours
    largestLoss: number;
    downsideDeviation: number;
    sortinoRatio: number;
  };

  // Execution quality (20% weight)
  execution: {
    avgSlippage: number;
    avgFeePercent: number;
    avgTradeSize: number;
    liquidityScore: number; // 0-100
    avgGasPercent: number;
  };

  // Signal quality (15% weight)
  signal: {
    latencyTolerance: number; // seconds before PnL turns negative
    repeatability: number; // pattern consistency score 0-100
    tradeFrequency: number; // trades per week
    followability: number; // 0-100 (simple trades = high)
  };

  // Activity stats
  stats: {
    totalTrades: number;
    tradesLast30d: number;
    lastTradeAt: Timestamp;
    avgTradesPerWeek: number;
    trackingStartedAt: Timestamp;
  };
}

export interface WalletSignal {
  id: string;
  walletId: string;
  walletAddress: string;
  chain: string;
  timestamp: Timestamp;

  // Trade details
  type: 'buy' | 'sell' | 'swap';
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  price: number;
  txHash: string;
  protocol: string; // uniswap, sushi, jupiter, etc.

  // Copy trading analysis
  krakenPair?: string; // mapped Kraken pair if available
  copyable: boolean;
  skipReason?: string;

  // Status
  status: 'pending' | 'copied' | 'skipped' | 'failed';
  processedAt?: Timestamp;
}

export interface CopyTradePosition {
  id: string;
  userId: string;
  signalId: string;
  walletId: string;
  walletAddress: string;

  // Trade details
  pair: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  quantity: number;
  investedAmount: number;

  // P&L
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  fees: number;

  // Risk management
  stopLoss?: number;
  takeProfit?: number;

  // Status
  status: 'open' | 'closing' | 'closed';
  openedAt: Timestamp;
  closedAt?: Timestamp;
  duration?: string;

  // Kraken order IDs
  entryOrderId?: string;
  exitOrderId?: string;
}

export interface TrackerConfig {
  userId: string;
  enabled: boolean;
  simulationMode: boolean;

  // Allocation settings
  totalAllocationPercent: number; // % of account for this strategy
  perWalletAllocationPercent: number; // % per wallet (e.g., 5%)
  maxPerWalletTotal: number; // max total exposure per wallet
  perTradeAllocationPercent: number; // % per trade (e.g., 1%)
  maxPositionSize: number; // max $ per position

  // Risk limits
  dailyLossCapPercent: number; // per wallet
  maxConcurrentPositions: number;
  stopLossPercent: number;
  takeProfitPercent?: number;

  // Signal filters
  minWalletScore: number;
  maxPriceMovementBps: number; // skip if price moved too much
  minLiquidityUSD: number;

  // Execution
  useMarketOrders: boolean;
  maxSlippagePercent: number;

  updatedAt: Timestamp;
}

export class WalletTrackerService {
  /**
   * Get all tracked wallets for a user
   */
  async getTrackedWallets(userId: string): Promise<TrackedWallet[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .where('isActive', '==', true)
      .orderBy('score', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TrackedWallet));
  }

  /**
   * Get a specific wallet's details
   */
  async getWalletDetails(userId: string, walletId: string): Promise<TrackedWallet | null> {
    const doc = await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .doc(walletId)
      .get();

    if (!doc.exists) return null;

    return {
      id: doc.id,
      ...doc.data()
    } as TrackedWallet;
  }

  /**
   * Add a wallet to track
   */
  async addWallet(
    userId: string,
    address: string,
    chain: TrackedWallet['chain'],
    nickname?: string
  ): Promise<string> {
    // Check if wallet already exists
    const existing = await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .where('address', '==', address)
      .where('chain', '==', chain)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Reactivate if exists but inactive
      const walletId = existing.docs[0].id;
      await db
        .collection('users')
        .doc(userId)
        .collection('trackedWallets')
        .doc(walletId)
        .update({ isActive: true });
      return walletId;
    }

    // Create new wallet entry with default values
    const newWallet: Omit<TrackedWallet, 'id'> = {
      address,
      chain,
      nickname,
      addedAt: Timestamp.now(),
      isActive: true,
      score: 50, // default until calculated

      performance: {
        pnl30d: 0,
        pnl90d: 0,
        pnlAllTime: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        consistency: 0,
      },

      risk: {
        maxDrawdown30d: 0,
        maxDrawdown90d: 0,
        volatility: 0,
        avgHoldTime: 0,
        largestLoss: 0,
        downsideDeviation: 0,
        sortinoRatio: 0,
      },

      execution: {
        avgSlippage: 0,
        avgFeePercent: 0,
        avgTradeSize: 0,
        liquidityScore: 0,
        avgGasPercent: 0,
      },

      signal: {
        latencyTolerance: 30,
        repeatability: 50,
        tradeFrequency: 0,
        followability: 50,
      },

      stats: {
        totalTrades: 0,
        tradesLast30d: 0,
        lastTradeAt: Timestamp.now(),
        avgTradesPerWeek: 0,
        trackingStartedAt: Timestamp.now(),
      },
    };

    const docRef = await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .add(newWallet);

    return docRef.id;
  }

  /**
   * Remove (deactivate) a tracked wallet
   */
  async removeWallet(userId: string, walletId: string): Promise<void> {
    await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .doc(walletId)
      .update({ isActive: false });
  }

  /**
   * Calculate composite score for a wallet (0-100)
   * Based on performance (35%), risk (30%), execution (20%), signal (15%)
   */
  calculateWalletScore(wallet: TrackedWallet): number {
    const perfScore = this.calculatePerformanceScore(wallet.performance);
    const riskScore = this.calculateRiskScore(wallet.risk);
    const execScore = this.calculateExecutionScore(wallet.execution);
    const signalScore = this.calculateSignalScore(wallet.signal);

    const compositeScore =
      perfScore * 0.35 +
      riskScore * 0.30 +
      execScore * 0.20 +
      signalScore * 0.15;

    return Math.round(Math.max(0, Math.min(100, compositeScore)));
  }

  /**
   * Calculate performance sub-score (0-100)
   */
  private calculatePerformanceScore(perf: TrackedWallet['performance']): number {
    let score = 50; // baseline

    // 30-day PnL (max +30 points)
    score += Math.min(30, Math.max(-30, perf.pnl30d * 3));

    // Win rate (max +15 points)
    if (perf.winRate > 0) {
      score += (perf.winRate - 50) * 0.3; // 70% win rate = +6 points
    }

    // Profit factor (max +10 points)
    if (perf.profitFactor > 1) {
      score += Math.min(10, (perf.profitFactor - 1) * 5);
    }

    // Sharpe ratio (max +10 points)
    if (perf.sharpeRatio > 0) {
      score += Math.min(10, perf.sharpeRatio * 3);
    }

    // Consistency (max +5 points)
    score += perf.consistency * 0.05;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate risk sub-score (0-100)
   */
  private calculateRiskScore(risk: TrackedWallet['risk']): number {
    let score = 100; // start high, penalize risk

    // Max drawdown penalty (up to -40 points)
    if (risk.maxDrawdown30d > 0) {
      score -= Math.min(40, risk.maxDrawdown30d * 1.6); // 25% DD = -40 pts
    }

    // Volatility penalty (up to -25 points)
    score -= Math.min(25, risk.volatility * 2.5);

    // Large loss penalty (up to -20 points)
    if (risk.largestLoss > 10) {
      score -= Math.min(20, (risk.largestLoss - 10) * 2);
    }

    // Sortino ratio bonus (up to +10 points)
    if (risk.sortinoRatio > 0) {
      score += Math.min(10, risk.sortinoRatio * 2);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate execution quality sub-score (0-100)
   */
  private calculateExecutionScore(exec: TrackedWallet['execution']): number {
    let score = 50; // baseline

    // Liquidity score (max +30 points)
    score += (exec.liquidityScore - 50) * 0.6;

    // Low slippage bonus (max +10 points)
    if (exec.avgSlippage < 0.5) {
      score += 10;
    } else {
      score -= Math.min(20, exec.avgSlippage * 4);
    }

    // Low fee bonus (max +5 points)
    score += Math.max(-10, 5 - exec.avgFeePercent * 2);

    // Reasonable trade size (max +5 points)
    if (exec.avgTradeSize > 1000 && exec.avgTradeSize < 100000) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate signal quality sub-score (0-100)
   */
  private calculateSignalScore(signal: TrackedWallet['signal']): number {
    let score = 50; // baseline

    // Latency tolerance bonus (max +25 points)
    if (signal.latencyTolerance > 60) {
      score += 25; // very copyable
    } else if (signal.latencyTolerance > 30) {
      score += 15; // moderately copyable
    } else if (signal.latencyTolerance < 10) {
      score -= 20; // hard to copy
    }

    // Repeatability (max +15 points)
    score += (signal.repeatability - 50) * 0.3;

    // Trade frequency (max +10 points)
    if (signal.tradeFrequency >= 3 && signal.tradeFrequency <= 20) {
      score += 10; // optimal frequency
    } else if (signal.tradeFrequency < 1) {
      score -= 10; // too infrequent
    } else if (signal.tradeFrequency > 30) {
      score -= 5; // possibly too active
    }

    // Followability (max +10 points)
    score += (signal.followability - 50) * 0.2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get recent signals from tracked wallets
   */
  async getRecentSignals(userId: string, limit: number = 50): Promise<WalletSignal[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('walletSignals')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WalletSignal));
  }

  /**
   * Get tracker configuration
   */
  async getConfig(userId: string): Promise<TrackerConfig | null> {
    const doc = await db
      .collection('users')
      .doc(userId)
      .collection('trackerConfig')
      .doc('settings')
      .get();

    if (!doc.exists) {
      return this.createDefaultConfig(userId);
    }

    return {
      ...doc.data(),
      userId
    } as TrackerConfig;
  }

  /**
   * Update tracker configuration
   */
  async updateConfig(userId: string, config: Partial<TrackerConfig>): Promise<void> {
    await db
      .collection('users')
      .doc(userId)
      .collection('trackerConfig')
      .doc('settings')
      .set({
        ...config,
        updatedAt: Timestamp.now()
      }, { merge: true });
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(userId: string): Promise<TrackerConfig> {
    const defaultConfig: TrackerConfig = {
      userId,
      enabled: false,
      simulationMode: true,

      totalAllocationPercent: 30,
      perWalletAllocationPercent: 10,
      maxPerWalletTotal: 5000,
      perTradeAllocationPercent: 2,
      maxPositionSize: 1000,

      dailyLossCapPercent: 2,
      maxConcurrentPositions: 10,
      stopLossPercent: 5,
      takeProfitPercent: undefined,

      minWalletScore: 60,
      maxPriceMovementBps: 50,
      minLiquidityUSD: 1000000,

      useMarketOrders: true,
      maxSlippagePercent: 0.5,

      updatedAt: Timestamp.now(),
    };

    await db
      .collection('users')
      .doc(userId)
      .collection('trackerConfig')
      .doc('settings')
      .set(defaultConfig);

    return defaultConfig;
  }

  /**
   * Record a new signal from a wallet (webhook/manual entry)
   */
  async recordSignal(userId: string, signal: Omit<WalletSignal, 'id'>): Promise<string> {
    const docRef = await db
      .collection('users')
      .doc(userId)
      .collection('walletSignals')
      .add(signal);

    return docRef.id;
  }

  /**
   * Update wallet statistics after processing a signal
   */
  async updateWalletStats(
    userId: string,
    walletId: string,
    updates: Partial<TrackedWallet>
  ): Promise<void> {
    await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .doc(walletId)
      .update(updates);
  }
}

export const walletTrackerService = new WalletTrackerService();
