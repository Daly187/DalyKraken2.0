/**
 * Multi-Exchange Funding Strategy Monitor
 *
 * This Cloud Function monitors open funding positions across Aster, Hyperliquid, and Liquid
 * exchanges. It runs on a schedule to check funding rates, liquidity, and manage positions.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firestore
const db = admin.firestore();

interface FundingPosition {
  userId: string;
  exchange: 'aster' | 'hyperliquid' | 'liquid';
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  entryFundingRate: number;
  currentPrice: number;
  currentFundingRate: number;
  fundingEarned: number;
  unrealizedPnL: number;
  status: 'open' | 'closing' | 'closed';
  stopLoss?: number;
  takeProfit?: number;
  lastFundingPayment: number;
  nextFundingPayment: number;
}

interface ExchangeConfig {
  enabled: boolean;
  fundingRateThreshold: number;
  positionSize: number;
  maxLeverage: number;
  minVolume24h: number;
  maxSpread: number;
  minBidAskDepth: number;
  autoExecute: boolean;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxOpenPositions: number;
  maxDailyLoss: number;
}

/**
 * Scheduled function to monitor funding positions
 * Runs every minute to check positions and execute exits if needed
 */
export const monitorFundingPositions = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    console.log('[FundingMonitor] Starting position monitoring...');

    try {
      // Get all open positions
      const positionsSnapshot = await db
        .collection('fundingPositions')
        .where('status', '==', 'open')
        .get();

      console.log(`[FundingMonitor] Found ${positionsSnapshot.size} open positions`);

      // Process each position
      const promises = positionsSnapshot.docs.map(async (doc) => {
        const position = doc.data() as FundingPosition;
        const positionId = doc.id;

        try {
          await checkPosition(positionId, position);
        } catch (error) {
          console.error(`[FundingMonitor] Error checking position ${positionId}:`, error);
          // Continue with other positions
        }
      });

      await Promise.all(promises);

      console.log('[FundingMonitor] Position monitoring completed');
    } catch (error) {
      console.error('[FundingMonitor] Error in monitoring function:', error);
      throw error;
    }
  });

/**
 * Check a single position for exit conditions
 */
async function checkPosition(positionId: string, position: FundingPosition): Promise<void> {
  console.log(`[FundingMonitor] Checking position ${positionId} (${position.exchange} ${position.symbol})`);

  // Fetch current market data
  const marketData = await fetchMarketData(position.exchange, position.symbol);

  if (!marketData) {
    console.warn(`[FundingMonitor] Could not fetch market data for ${position.exchange} ${position.symbol}`);
    return;
  }

  // Update current price and funding rate
  const updatedPosition: Partial<FundingPosition> = {
    currentPrice: marketData.markPrice,
    currentFundingRate: marketData.fundingRate,
    unrealizedPnL: calculateUnrealizedPnL(position, marketData.markPrice),
  };

  // Check exit conditions
  const shouldExit = await shouldExitPosition(position, marketData);

  if (shouldExit.exit) {
    console.log(`[FundingMonitor] Exiting position ${positionId}: ${shouldExit.reason}`);

    // Execute exit order
    try {
      const exitOrder = await executeExitOrder(position, marketData.markPrice);

      // Update position status
      await db.collection('fundingPositions').doc(positionId).update({
        status: 'closed',
        exitPrice: exitOrder.executedPrice,
        exitTime: Date.now(),
        exitReason: shouldExit.reason,
        exitOrderId: exitOrder.orderId,
        realizedPnL: exitOrder.realizedPnL,
        updatedAt: Date.now(),
      });

      // Remove from monitoring queue
      await removeFromMonitoring(positionId);

      // Send notification
      await sendExitNotification(position.userId, position, shouldExit.reason, exitOrder.realizedPnL);
    } catch (error) {
      console.error(`[FundingMonitor] Error executing exit for ${positionId}:`, error);

      // Update position with error
      await db.collection('fundingPositions').doc(positionId).update({
        status: 'open', // Keep as open, will retry
        lastError: (error as Error).message,
        updatedAt: Date.now(),
      });
    }
  } else {
    // Just update current data
    await db.collection('fundingPositions').doc(positionId).update({
      ...updatedPosition,
      updatedAt: Date.now(),
    });

    // Update monitoring queue
    await db.collection('tradeMonitoring').doc(positionId).update({
      lastCheckTime: Date.now(),
      nextCheckTime: Date.now() + 60000, // Check again in 1 minute
      updatedAt: Date.now(),
    });
  }
}

/**
 * Fetch current market data from exchange
 */
async function fetchMarketData(exchange: string, symbol: string): Promise<any> {
  // TODO: Implement actual API calls to each exchange
  // For now, return mock data

  switch (exchange) {
    case 'aster':
      // Call Aster API to get mark price and funding rate
      // GET https://fapi.asterdex.com/fapi/v1/premiumIndex?symbol=BTCUSDT
      return {
        markPrice: 45000 + Math.random() * 1000,
        fundingRate: 0.01 + Math.random() * 0.02,
        volume24h: 1500000000,
        spread: 0.02,
        bidDepth: 500000,
        askDepth: 480000,
      };

    case 'hyperliquid':
      // Call Hyperliquid API via WebSocket or REST
      return {
        markPrice: 45000 + Math.random() * 1000,
        fundingRate: 0.01 + Math.random() * 0.02,
        volume24h: 2100000000,
        spread: 0.015,
        bidDepth: 600000,
        askDepth: 590000,
      };

    case 'liquid':
      // Call Liquid API
      return {
        markPrice: 45000 + Math.random() * 1000,
        fundingRate: 0,  // Liquid may not have funding (spot)
        volume24h: 800000000,
        spread: 0.03,
        bidDepth: 300000,
        askDepth: 290000,
      };

    default:
      return null;
  }
}

/**
 * Calculate unrealized P&L
 */
function calculateUnrealizedPnL(position: FundingPosition, currentPrice: number): number {
  const priceDiff = currentPrice - position.entryPrice;
  const multiplier = position.side === 'long' ? 1 : -1;
  return priceDiff * position.size * multiplier;
}

/**
 * Check if position should be exited
 */
async function shouldExitPosition(
  position: FundingPosition,
  marketData: any
): Promise<{ exit: boolean; reason?: string }> {
  // Get user's exchange config
  const configDoc = await db.collection('exchangeConfigs').doc(position.userId).get();

  if (!configDoc.exists) {
    return { exit: false };
  }

  const config = configDoc.data()![position.exchange] as ExchangeConfig;

  // Check stop loss
  if (position.stopLoss && marketData.markPrice <= position.stopLoss) {
    return { exit: true, reason: 'stop_loss' };
  }

  // Check take profit
  if (position.takeProfit && marketData.markPrice >= position.takeProfit) {
    return { exit: true, reason: 'take_profit' };
  }

  // Check funding rate mean reversion
  if (Math.abs(marketData.fundingRate) < config.fundingRateThreshold * 0.3) {
    return { exit: true, reason: 'funding_rate_low' };
  }

  // Check liquidity degradation
  if (marketData.volume24h < config.minVolume24h) {
    return { exit: true, reason: 'low_liquidity' };
  }

  if (marketData.spread > config.maxSpread) {
    return { exit: true, reason: 'wide_spread' };
  }

  // Check if funding payment is near
  const timeToNextFunding = position.nextFundingPayment - Date.now();
  if (timeToNextFunding < 300000 && timeToNextFunding > 0) {
    // Less than 5 minutes to funding - hold position
    return { exit: false };
  }

  return { exit: false };
}

/**
 * Execute exit order on exchange
 */
async function executeExitOrder(
  position: FundingPosition,
  exitPrice: number
): Promise<{ orderId: string; executedPrice: number; realizedPnL: number }> {
  // TODO: Implement actual exchange API calls

  const executedPrice = exitPrice; // In reality, may have slippage
  const realizedPnL = calculateUnrealizedPnL(position, executedPrice) + position.fundingEarned;

  return {
    orderId: `EXIT-${Date.now()}`,
    executedPrice,
    realizedPnL,
  };
}

/**
 * Remove position from monitoring queue
 */
async function removeFromMonitoring(positionId: string): Promise<void> {
  await db.collection('tradeMonitoring').doc(positionId).delete();
}

/**
 * Send exit notification to user
 */
async function sendExitNotification(
  userId: string,
  position: FundingPosition,
  reason: string,
  pnl: number
): Promise<void> {
  // TODO: Implement Telegram notification
  console.log(`[Notification] Position exited for user ${userId}: ${position.symbol} ${reason} P&L: $${pnl.toFixed(2)}`);
}

/**
 * Scheduled function to record funding rates
 * Runs every 5 minutes to snapshot current funding rates
 */
export const recordFundingRates = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    console.log('[FundingRates] Recording funding rates...');

    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
    const exchanges = ['aster', 'hyperliquid', 'liquid'] as const;

    const batch = db.batch();
    let count = 0;

    for (const exchange of exchanges) {
      for (const symbol of symbols) {
        try {
          const marketData = await fetchMarketData(exchange, symbol);

          if (marketData) {
            const docId = `${exchange}-${symbol}-${Date.now()}`;
            const docRef = db.collection('fundingRateHistory').doc(docId);

            batch.set(docRef, {
              exchange,
              symbol,
              fundingRate: marketData.fundingRate,
              annualizedRate: marketData.fundingRate * 365 * 3, // 3 payments per day
              markPrice: marketData.markPrice,
              indexPrice: marketData.markPrice, // Approximate
              openInterest: 0, // TODO: Fetch from exchange
              volume24h: marketData.volume24h,
              timestamp: Date.now(),
              fundingTime: Date.now(),
              nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
              premium: 0,
              createdAt: Date.now(),
            });

            count++;
          }
        } catch (error) {
          console.error(`[FundingRates] Error fetching ${exchange} ${symbol}:`, error);
        }
      }
    }

    await batch.commit();
    console.log(`[FundingRates] Recorded ${count} funding rates`);
  });
