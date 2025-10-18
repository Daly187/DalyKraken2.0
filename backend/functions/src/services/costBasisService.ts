/**
 * Cost Basis Service
 *
 * Calculates accurate cost basis and P&L from Kraken trade history
 * Uses FIFO (First In, First Out) accounting method
 */

import { Firestore } from 'firebase-admin/firestore';
import { KrakenService } from './krakenService.js';

export interface Trade {
  ordertxid: string;
  postxid: string;
  pair: string;
  time: number;
  type: 'buy' | 'sell';
  ordertype: string;
  price: number;
  cost: number;
  fee: number;
  vol: number;
  margin: number;
  misc: string;
}

export interface CostBasisData {
  asset: string;
  totalQuantity: number;
  averageCost: number;
  totalCostBasis: number;
  trades: Trade[];
  lastUpdated: string;
}

export interface PositionPnL {
  asset: string;
  quantity: number;
  averageCost: number;
  totalCostBasis: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export class CostBasisService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Sync trade history from Kraken and calculate cost basis
   */
  async syncTradeHistory(userId: string, krakenService: KrakenService): Promise<void> {
    console.log('[CostBasisService] Syncing trade history for user:', userId);

    try {
      // Get trade history from Kraken with retry logic for rate limits
      let tradeHistory;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          tradeHistory = await krakenService.getTradeHistory();
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;

          // Check if it's a rate limit error
          if (error.message?.includes('rate limit') || error.message?.includes('EAPI:Rate limit')) {
            const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
            console.log(`[CostBasisService] Rate limit hit, waiting ${waitTime}ms before retry ${retries}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            if (retries >= maxRetries) {
              throw new Error('Kraken API rate limit exceeded. Please try again in a few minutes.');
            }
          } else {
            // Not a rate limit error, throw immediately
            throw error;
          }
        }
      }

      if (!tradeHistory || !tradeHistory.trades) {
        console.log('[CostBasisService] No trades found');
        return;
      }

      const trades = tradeHistory.trades;
      const tradeIds = Object.keys(trades);

      console.log(`[CostBasisService] Found ${tradeIds.length} trades`);

      // Process and store trades
      const batch = this.db.batch();
      let processedCount = 0;

      for (const tradeId of tradeIds) {
        const trade = trades[tradeId];

        // Store in Firestore
        const tradeRef = this.db
          .collection('users')
          .doc(userId)
          .collection('trades')
          .doc(tradeId);

        batch.set(tradeRef, {
          ...trade,
          tradeId,
          syncedAt: new Date().toISOString(),
        }, { merge: true });

        processedCount++;

        // Firestore batch limit is 500
        if (processedCount % 450 === 0) {
          await batch.commit();
          console.log(`[CostBasisService] Committed ${processedCount} trades`);
        }
      }

      // Commit remaining trades
      if (processedCount % 450 !== 0) {
        await batch.commit();
      }

      console.log(`[CostBasisService] Synced ${processedCount} trades total`);

      // Calculate cost basis for each asset
      await this.calculateCostBasis(userId);

    } catch (error: any) {
      console.error('[CostBasisService] Error syncing trade history:', error);
      throw error;
    }
  }

  /**
   * Calculate cost basis for all assets using FIFO method
   */
  async calculateCostBasis(userId: string): Promise<Map<string, CostBasisData>> {
    console.log('[CostBasisService] Calculating cost basis for user:', userId);

    try {
      // Get all trades from Firestore
      const tradesSnapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('trades')
        .orderBy('time', 'asc')
        .get();

      if (tradesSnapshot.empty) {
        console.log('[CostBasisService] No trades found in database');
        return new Map();
      }

      // Group trades by asset
      const tradesByAsset = new Map<string, Trade[]>();

      tradesSnapshot.forEach((doc) => {
        const trade = doc.data() as Trade;
        const asset = this.extractAssetFromPair(trade.pair);

        if (!tradesByAsset.has(asset)) {
          tradesByAsset.set(asset, []);
        }

        tradesByAsset.get(asset)!.push(trade);
      });

      // Calculate cost basis for each asset using FIFO
      const costBasisMap = new Map<string, CostBasisData>();

      for (const [asset, trades] of tradesByAsset.entries()) {
        const costBasis = this.calculateAssetCostBasis(asset, trades);
        costBasisMap.set(asset, costBasis);

        // Store in Firestore
        await this.db
          .collection('users')
          .doc(userId)
          .collection('costBasis')
          .doc(asset)
          .set(costBasis);
      }

      console.log(`[CostBasisService] Calculated cost basis for ${costBasisMap.size} assets`);

      return costBasisMap;

    } catch (error: any) {
      console.error('[CostBasisService] Error calculating cost basis:', error);
      throw error;
    }
  }

  /**
   * Calculate cost basis for a specific asset using FIFO
   */
  private calculateAssetCostBasis(asset: string, trades: Trade[]): CostBasisData {
    let totalQuantity = 0;
    let totalCost = 0;
    let totalFees = 0;

    // Process trades in chronological order (FIFO)
    for (const trade of trades) {
      if (trade.type === 'buy') {
        totalQuantity += trade.vol;
        totalCost += trade.cost;
        totalFees += trade.fee;
      } else if (trade.type === 'sell') {
        // For sells, reduce quantity but keep cost basis of remaining
        totalQuantity -= trade.vol;
      }
    }

    // Ensure we don't have negative quantity due to data issues
    totalQuantity = Math.max(0, totalQuantity);

    const totalCostBasis = totalCost + totalFees;
    const averageCost = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;

    return {
      asset,
      totalQuantity,
      averageCost,
      totalCostBasis,
      trades: trades.map(t => ({
        ordertxid: t.ordertxid,
        postxid: t.postxid,
        pair: t.pair,
        time: t.time,
        type: t.type,
        ordertype: t.ordertype,
        price: t.price,
        cost: t.cost,
        fee: t.fee,
        vol: t.vol,
        margin: t.margin,
        misc: t.misc,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get cost basis for user's current holdings
   */
  async getCostBasisForHoldings(
    userId: string,
    holdings: { asset: string; amount: number; currentPrice: number }[]
  ): Promise<Map<string, PositionPnL>> {
    const pnlMap = new Map<string, PositionPnL>();

    try {
      for (const holding of holdings) {
        const costBasisDoc = await this.db
          .collection('users')
          .doc(userId)
          .collection('costBasis')
          .doc(holding.asset)
          .get();

        let averageCost = 0;
        let totalCostBasis = 0;

        if (costBasisDoc.exists) {
          const costBasis = costBasisDoc.data() as CostBasisData;
          averageCost = costBasis.averageCost;
          totalCostBasis = holding.amount * averageCost;
        } else {
          // No cost basis found - asset might have been transferred in
          console.log(`[CostBasisService] No cost basis found for ${holding.asset}`);
          averageCost = holding.currentPrice; // Assume break-even
          totalCostBasis = holding.amount * averageCost;
        }

        const currentValue = holding.amount * holding.currentPrice;
        const unrealizedPnL = currentValue - totalCostBasis;
        const unrealizedPnLPercent = totalCostBasis > 0
          ? (unrealizedPnL / totalCostBasis) * 100
          : 0;

        pnlMap.set(holding.asset, {
          asset: holding.asset,
          quantity: holding.amount,
          averageCost,
          totalCostBasis,
          currentPrice: holding.currentPrice,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPercent,
        });
      }

      return pnlMap;

    } catch (error: any) {
      console.error('[CostBasisService] Error getting cost basis:', error);
      throw error;
    }
  }

  /**
   * Extract base asset from Kraken pair (e.g., XXBTZUSD -> XBT)
   */
  private extractAssetFromPair(pair: string): string {
    // Kraken uses X prefix for crypto and Z for fiat
    // XXBTZUSD -> XBT, XETHZUSD -> ETH, etc.
    let asset = pair.replace('ZUSD', '').replace('ZEUR', '');

    // Remove X prefix if present
    if (asset.startsWith('X')) {
      asset = asset.substring(1);
    }

    // Handle special cases
    const assetMap: Record<string, string> = {
      'XBT': 'XBT',
      'ETH': 'ETH',
      'XDG': 'DOGE',
      'XRP': 'XRP',
    };

    return assetMap[asset] || asset;
  }

  /**
   * Force refresh cost basis (manually triggered)
   */
  async refreshCostBasis(userId: string, krakenService: KrakenService): Promise<void> {
    console.log('[CostBasisService] Force refreshing cost basis for user:', userId);
    await this.syncTradeHistory(userId, krakenService);
  }
}

export default CostBasisService;
