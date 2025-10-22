/**
 * Depeg Monitoring Service
 * Monitors stablecoin prices and identifies arbitrage opportunities
 */

import { Firestore } from 'firebase-admin/firestore';
import { KrakenService } from './krakenService.js';

export interface StablecoinPrice {
  pair: string;
  symbol: string;
  currentPrice: number;
  pegPrice: number;
  depegPercentage: number;
  depegAmount: number;
  volume24h: number;
  priceChange24h: number;
  lastUpdate: string;
  bid: number;
  ask: number;
  spread: number;
  liquidityDepth: number;
}

export interface DepegOpportunity {
  id: string;
  pair: string;
  type: 'buy' | 'sell';
  entryPrice: number;
  targetPrice: number;
  depegPercentage: number;
  estimatedProfit: number;
  estimatedProfitPercent: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  detectedAt: string;
  status: 'pending' | 'active' | 'monitoring';
}

export interface DepegPosition {
  id: string;
  userId: string;
  pair: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  quantity: number;
  investedAmount: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: string;
  status: 'open' | 'closing' | 'closed';
  orderId?: string;
  exitOrderId?: string;
  closedAt?: string;
  realizedPnL?: number;
}

export interface DepegConfig {
  enabled: boolean;
  autoExecute: boolean;
  minDepegThreshold: number;
  maxDepegThreshold: number;
  maxAllocationPercent: number;
  maxPositionSize: number;
  minProfitTarget: number;
  stopLossPercent: number;
  slippageTolerance: number;
  feeTierPercent: number;
  enabledPairs: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export class DepegMonitorService {
  private db: Firestore;
  private krakenService: KrakenService;

  // Stablecoin pairs to monitor
  private readonly STABLECOIN_PAIRS = [
    'USDTZUSD',  // USDT/USD
    'USDCZUSD',  // USDC/USD
    'DAIUSD',    // DAI/USD
    'PYUSDUSD',  // PYUSD/USD
  ];

  // Map display names to Kraken pair names
  private readonly PAIR_MAP: Record<string, string> = {
    'USDT/USD': 'USDTZUSD',
    'USDC/USD': 'USDCZUSD',
    'DAI/USD': 'DAIUSD',
    'PYUSD/USD': 'PYUSDUSD',
    'TUSD/USD': 'TUSDUSD',
    'USDD/USD': 'USDDUSD',
  };

  constructor(db: Firestore) {
    this.db = db;
    this.krakenService = new KrakenService();
  }

  /**
   * Get current prices for all stablecoins
   */
  async getStablecoinPrices(enabledPairs?: string[]): Promise<StablecoinPrice[]> {
    const pairsToMonitor = enabledPairs && enabledPairs.length > 0
      ? enabledPairs.map(p => this.PAIR_MAP[p]).filter(Boolean)
      : this.STABLECOIN_PAIRS;

    const prices: StablecoinPrice[] = [];

    for (const krakenPair of pairsToMonitor) {
      try {
        const ticker = await this.krakenService.getTicker(krakenPair);

        const displayPair = Object.keys(this.PAIR_MAP).find(k => this.PAIR_MAP[k] === krakenPair) || krakenPair;
        const symbol = displayPair.split('/')[0];

        const currentPrice = ticker.price;
        const pegPrice = 1.0;
        const depegAmount = currentPrice - pegPrice;
        const depegPercentage = (depegAmount / pegPrice) * 100;
        const spread = ticker.ask - ticker.bid;

        prices.push({
          pair: displayPair,
          symbol,
          currentPrice,
          pegPrice,
          depegPercentage,
          depegAmount,
          volume24h: ticker.volume24h,
          priceChange24h: ticker.changePercent24h,
          lastUpdate: new Date().toISOString(),
          bid: ticker.bid,
          ask: ticker.ask,
          spread,
          liquidityDepth: ticker.volume24h * 0.001, // Rough estimate
        });
      } catch (error) {
        console.error(`[DepegMonitor] Error fetching ${krakenPair}:`, error);
      }
    }

    return prices;
  }

  /**
   * Detect arbitrage opportunities based on config
   */
  async detectOpportunities(
    prices: StablecoinPrice[],
    config: DepegConfig
  ): Promise<DepegOpportunity[]> {
    const opportunities: DepegOpportunity[] = [];

    for (const price of prices) {
      const absDepeg = Math.abs(price.depegPercentage);

      // Check if depeg is within actionable range
      if (absDepeg < config.minDepegThreshold || absDepeg > config.maxDepegThreshold) {
        continue;
      }

      // Calculate if profit after fees meets minimum target
      const estimatedProfitPercent = absDepeg - (config.feeTierPercent * 2); // Round-trip fees
      if (estimatedProfitPercent < config.minProfitTarget) {
        continue;
      }

      // Determine trade type
      const type: 'buy' | 'sell' = price.depegPercentage < 0 ? 'buy' : 'sell';

      // Calculate entry and target prices
      const entryPrice = type === 'buy' ? price.ask : price.bid; // Use ask for buy, bid for sell
      const targetPrice = 1.0;

      // Estimate profit on $10,000 position
      const estimatedProfit = (Math.abs(targetPrice - entryPrice) / entryPrice) * Math.min(config.maxPositionSize, 10000);

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(absDepeg, price.volume24h, config);

      // Calculate confidence score
      const confidence = this.calculateConfidence(absDepeg, price.volume24h, riskLevel);

      opportunities.push({
        id: `opp_${Date.now()}_${price.symbol}`,
        pair: price.pair,
        type,
        entryPrice,
        targetPrice,
        depegPercentage: price.depegPercentage,
        estimatedProfit,
        estimatedProfitPercent,
        riskLevel,
        confidence,
        detectedAt: new Date().toISOString(),
        status: 'pending',
      });
    }

    return opportunities;
  }

  /**
   * Calculate risk level based on depeg magnitude and volume
   */
  private calculateRiskLevel(
    absDepeg: number,
    volume24h: number,
    config: DepegConfig
  ): 'low' | 'medium' | 'high' {
    // Higher depeg = higher risk (potential fundamental issue)
    if (absDepeg > 2.0) return 'high';
    if (absDepeg > 1.0) return 'medium';

    // Low volume = higher risk (illiquidity)
    if (volume24h < 100000000) return 'medium'; // < $100M

    // Conservative risk level setting
    if (config.riskLevel === 'conservative' && absDepeg > 0.7) return 'medium';

    return 'low';
  }

  /**
   * Calculate confidence score (0-100)
   */
  private calculateConfidence(
    absDepeg: number,
    volume24h: number,
    riskLevel: string
  ): number {
    let confidence = 100;

    // Reduce confidence for larger depegs (may indicate problem)
    if (absDepeg > 1.5) confidence -= 20;
    else if (absDepeg > 1.0) confidence -= 10;
    else if (absDepeg > 0.7) confidence -= 5;

    // Reduce confidence for low volume
    if (volume24h < 100000000) confidence -= 15; // < $100M
    else if (volume24h < 500000000) confidence -= 5; // < $500M

    // Risk level adjustment
    if (riskLevel === 'high') confidence -= 20;
    else if (riskLevel === 'medium') confidence -= 10;

    return Math.max(50, Math.min(100, confidence)); // Clamp between 50-100
  }

  /**
   * Execute a depeg trade
   */
  async executeTrade(
    userId: string,
    opportunity: DepegOpportunity,
    config: DepegConfig,
    apiKey: string,
    apiSecret: string
  ): Promise<DepegPosition> {
    const krakenService = new KrakenService(apiKey, apiSecret);

    // Calculate position size
    const positionSize = Math.min(config.maxPositionSize, 10000); // For now, use max or $10k
    const krakenPair = this.PAIR_MAP[opportunity.pair];

    try {
      let orderId: string;
      let quantity: number;

      if (opportunity.type === 'buy') {
        // Buy stablecoin at discount
        quantity = positionSize / opportunity.entryPrice;

        const response = await krakenService.placeBuyOrder(
          krakenPair,
          quantity,
          'market'
        );

        orderId = response.result.txid[0];

        console.log(`[DepegMonitor] BUY order placed: ${orderId} for ${quantity} ${opportunity.pair}`);
      } else {
        // Sell stablecoin at premium
        quantity = positionSize / opportunity.entryPrice;

        const response = await krakenService.placeSellOrder(
          krakenPair,
          quantity,
          'market'
        );

        orderId = response.result.txid[0];

        console.log(`[DepegMonitor] SELL order placed: ${orderId} for ${quantity} ${opportunity.pair}`);
      }

      // Create position record
      const position: DepegPosition = {
        id: `pos_${Date.now()}_${userId}`,
        userId,
        pair: opportunity.pair,
        side: opportunity.type,
        entryPrice: opportunity.entryPrice,
        currentPrice: opportunity.entryPrice,
        targetPrice: opportunity.targetPrice,
        quantity,
        investedAmount: positionSize,
        currentValue: positionSize,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        openedAt: new Date().toISOString(),
        status: 'open',
        orderId,
      };

      // Save to Firestore
      await this.db
        .collection('users')
        .doc(userId)
        .collection('depegPositions')
        .doc(position.id)
        .set(position);

      console.log(`[DepegMonitor] Position saved: ${position.id}`);

      return position;
    } catch (error: any) {
      console.error('[DepegMonitor] Trade execution error:', error);
      throw new Error(`Failed to execute trade: ${error.message}`);
    }
  }

  /**
   * Update all open positions with current prices
   */
  async updatePositions(userId: string): Promise<void> {
    const positionsSnapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('depegPositions')
      .where('status', '==', 'open')
      .get();

    if (positionsSnapshot.empty) {
      return;
    }

    const pairsToUpdate = [...new Set(positionsSnapshot.docs.map(doc => doc.data().pair))];
    const currentPrices: Record<string, number> = {};

    // Fetch current prices
    for (const pair of pairsToUpdate) {
      try {
        const krakenPair = this.PAIR_MAP[pair];
        const ticker = await this.krakenService.getTicker(krakenPair);
        currentPrices[pair] = ticker.price;
      } catch (error) {
        console.error(`[DepegMonitor] Error fetching price for ${pair}:`, error);
      }
    }

    // Update each position
    const batch = this.db.batch();

    for (const doc of positionsSnapshot.docs) {
      const position = doc.data() as DepegPosition;
      const currentPrice = currentPrices[position.pair];

      if (!currentPrice) continue;

      const currentValue = position.quantity * currentPrice;
      const unrealizedPnL = position.side === 'buy'
        ? currentValue - position.investedAmount
        : position.investedAmount - currentValue;
      const unrealizedPnLPercent = (unrealizedPnL / position.investedAmount) * 100;

      batch.update(doc.ref, {
        currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent,
      });
    }

    await batch.commit();
    console.log(`[DepegMonitor] Updated ${positionsSnapshot.size} positions`);
  }

  /**
   * Close a position (execute exit trade)
   */
  async closePosition(
    positionId: string,
    userId: string,
    apiKey: string,
    apiSecret: string
  ): Promise<DepegPosition> {
    const positionDoc = await this.db
      .collection('users')
      .doc(userId)
      .collection('depegPositions')
      .doc(positionId)
      .get();

    if (!positionDoc.exists) {
      throw new Error('Position not found');
    }

    const position = positionDoc.data() as DepegPosition;

    if (position.status !== 'open') {
      throw new Error('Position is not open');
    }

    const krakenService = new KrakenService(apiKey, apiSecret);
    const krakenPair = this.PAIR_MAP[position.pair];

    try {
      let exitOrderId: string;
      let exitPrice: number;

      // Reverse the original trade
      if (position.side === 'buy') {
        // We bought, now sell
        const response = await krakenService.placeSellOrder(
          krakenPair,
          position.quantity,
          'market'
        );

        exitOrderId = response.result.txid[0];
        exitPrice = position.currentPrice; // Approximate

        console.log(`[DepegMonitor] SELL order placed to close position: ${exitOrderId}`);
      } else {
        // We sold, now buy back
        const response = await krakenService.placeBuyOrder(
          krakenPair,
          position.quantity,
          'market'
        );

        exitOrderId = response.result.txid[0];
        exitPrice = position.currentPrice; // Approximate

        console.log(`[DepegMonitor] BUY order placed to close position: ${exitOrderId}`);
      }

      // Calculate realized P&L
      const realizedPnL = position.unrealizedPnL;

      // Update position
      await this.db
        .collection('users')
        .doc(userId)
        .collection('depegPositions')
        .doc(positionId)
        .update({
          status: 'closed',
          closedAt: new Date().toISOString(),
          exitOrderId,
          realizedPnL,
        });

      // Save to trade history
      await this.db
        .collection('users')
        .doc(userId)
        .collection('depegTradeHistory')
        .add({
          positionId,
          pair: position.pair,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice,
          quantity: position.quantity,
          profit: realizedPnL,
          profitPercent: position.unrealizedPnLPercent,
          fees: (position.investedAmount * 0.0026 * 2), // Approximate fees
          netProfit: realizedPnL - (position.investedAmount * 0.0026 * 2),
          duration: this.calculateDuration(position.openedAt),
          openedAt: position.openedAt,
          closedAt: new Date().toISOString(),
        });

      console.log(`[DepegMonitor] Position closed: ${positionId} with P&L: $${realizedPnL.toFixed(2)}`);

      return {
        ...position,
        status: 'closed',
        closedAt: new Date().toISOString(),
        exitOrderId,
        realizedPnL,
      };
    } catch (error: any) {
      console.error('[DepegMonitor] Error closing position:', error);
      throw new Error(`Failed to close position: ${error.message}`);
    }
  }

  /**
   * Calculate duration string
   */
  private calculateDuration(openedAt: string): string {
    const now = new Date();
    const opened = new Date(openedAt);
    const diffMs = now.getTime() - opened.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ${diffHours % 24}h`;
  }

  /**
   * Get user's depeg configuration
   */
  async getConfig(userId: string): Promise<DepegConfig> {
    const configDoc = await this.db
      .collection('users')
      .doc(userId)
      .collection('settings')
      .doc('depegConfig')
      .get();

    if (!configDoc.exists) {
      // Return default config
      return {
        enabled: false,
        autoExecute: false,
        minDepegThreshold: 0.5,
        maxDepegThreshold: 5.0,
        maxAllocationPercent: 50,
        maxPositionSize: 10000,
        minProfitTarget: 0.5,
        stopLossPercent: 3.0,
        slippageTolerance: 0.1,
        feeTierPercent: 0.26,
        enabledPairs: ['USDT/USD', 'USDC/USD', 'DAI/USD', 'PYUSD/USD'],
        riskLevel: 'moderate',
      };
    }

    return configDoc.data() as DepegConfig;
  }

  /**
   * Update user's depeg configuration
   */
  async updateConfig(userId: string, config: Partial<DepegConfig>): Promise<void> {
    await this.db
      .collection('users')
      .doc(userId)
      .collection('settings')
      .doc('depegConfig')
      .set(config, { merge: true });

    console.log(`[DepegMonitor] Config updated for user ${userId}`);
  }

  /**
   * Get all open positions for user
   */
  async getOpenPositions(userId: string): Promise<DepegPosition[]> {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('depegPositions')
      .where('status', '==', 'open')
      .get();

    return snapshot.docs.map(doc => doc.data() as DepegPosition);
  }

  /**
   * Get trade history for user
   */
  async getTradeHistory(userId: string, limit: number = 50): Promise<any[]> {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('depegTradeHistory')
      .orderBy('closedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
