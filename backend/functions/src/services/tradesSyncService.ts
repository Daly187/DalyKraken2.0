/**
 * Trades Sync Service
 * Syncs Kraken trade history to live bot entries
 */

import { db } from '../db.js';
import { KrakenService } from './krakenService.js';
import { decryptKey } from './settingsStore.js';

interface KrakenTrade {
  ordertxid: string;
  postxid: string;
  pair: string;
  time: number;
  type: 'buy' | 'sell';
  ordertype: string;
  price: string;
  cost: string;
  fee: string;
  vol: string;
  margin: string;
  misc: string;
}

/**
 * Normalize Kraken pair names to match our bot symbols
 * Kraken uses formats like: ATOMUSD, XATOMZUSD, XXBTZUSD
 * We need to convert to: ATOM/USD, BTC/USD, etc.
 */
function normalizePair(krakenPair: string): string {
  // Direct mappings for all known pairs
  const mapping: Record<string, string> = {
    // Kraken format → Our format
    'ATOMUSD': 'ATOM/USD',
    'XATOMZUSD': 'ATOM/USD',
    'DOGEUSD': 'DOGE/USD',
    'XXDGZUSD': 'DOGE/USD',
    'XDGUSD': 'DOGE/USD',
    'GRTUSD': 'GRT/USD',
    'LINKUSD': 'LINK/USD',
    'ETHUSD': 'ETH/USD',
    'XETHZUSD': 'ETH/USD',
    'BTCUSD': 'BTC/USD',
    'XXBTZUSD': 'BTC/USD',
    'XBTUSD': 'BTC/USD',
    'ALGOUSD': 'ALGO/USD',
    'MANAUSD': 'MANA/USD',
    'DOTUSD': 'DOT/USD',
    'NEARUSD': 'NEAR/USD',
    'FILUSD': 'FIL/USD',
    'BCHUSD': 'BCH/USD',
    'SANDUSD': 'SAND/USD',
    'SOLUSD': 'SOL/USD',
    'ADAUSD': 'ADA/USD',
    'UNIUSD': 'UNI/USD',
    'AVAXUSD': 'AVAX/USD',
    'XLMUSD': 'XLM/USD',
    'XRPUSD': 'XRP/USD',
    'XXRPZUSD': 'XRP/USD',
    'LTCUSD': 'LTC/USD',
    'XLTCZUSD': 'LTC/USD',
    'GALAUSD': 'GALA/USD',
  };

  // Check direct mapping first
  if (mapping[krakenPair]) {
    return mapping[krakenPair];
  }

  // Fallback: Try to parse the pair automatically
  // Remove X prefix and Z suffix that Kraken adds, then split before USD
  let normalized = krakenPair
    .replace(/^X/, '')  // Remove leading X
    .replace(/^XX/, '') // Remove leading XX (for BTC, DOGE)
    .replace(/ZUSD$/, '') // Remove ZUSD suffix
    .replace(/USD$/, ''); // Remove USD suffix

  // Add /USD
  return `${normalized}/USD`;
}

export class TradesSyncService {
  /**
   * Sync trades for a specific user
   */
  async syncUserTrades(userId: string): Promise<{
    success: boolean;
    processed: number;
    added: number;
    skipped: number;
    errors: number;
  }> {
    console.log(`[TradesSync] Starting sync for user ${userId}`);

    let processed = 0;
    let added = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Get user's Kraken API keys
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
        console.log(`[TradesSync] No Kraken API keys for user ${userId}`);
        return { success: false, processed: 0, added: 0, skipped: 0, errors: 0 };
      }

      const activeKey = userData.krakenKeys.find((k: any) => k.isActive);
      if (!activeKey) {
        console.log(`[TradesSync] No active Kraken API key for user ${userId}`);
        return { success: false, processed: 0, added: 0, skipped: 0, errors: 0 };
      }

      const apiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
      const apiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

      // Get all active bots for this user
      const botsSnapshot = await db
        .collection('dcaBots')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();

      const botsBySymbol: Record<string, { id: string; [key: string]: any }> = {};
      botsSnapshot.forEach(doc => {
        const bot = doc.data();
        botsBySymbol[bot.symbol] = { id: doc.id, ...bot };
      });

      console.log(`[TradesSync] Found ${Object.keys(botsBySymbol).length} active bots for user ${userId}`);

      if (Object.keys(botsBySymbol).length === 0) {
        console.log(`[TradesSync] No active bots to sync for user ${userId}`);
        return { success: true, processed: 0, added: 0, skipped: 0, errors: 0 };
      }

      // Fetch trades from Kraken (last 7 days)
      const krakenClient = new KrakenService(apiKey, apiSecret);
      const startTime = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

      console.log(`[TradesSync] Fetching trades since ${new Date(startTime * 1000).toISOString()}`);

      const result = await krakenClient.getTradeHistory(startTime);
      const trades = result?.trades || result || {};
      const tradeIds = Object.keys(trades);

      console.log(`[TradesSync] Found ${tradeIds.length} trades from Kraken`);

      // Process each trade
      for (const txid of tradeIds) {
        const trade: KrakenTrade = trades[txid];
        processed++;

        // Only process buy orders
        if (trade.type !== 'buy') {
          continue;
        }

        const normalizedPair = normalizePair(trade.pair);
        const bot = botsBySymbol[normalizedPair];

        if (!bot) {
          console.log(`[TradesSync] No bot found for Kraken pair "${trade.pair}" → normalized "${normalizedPair}" (txid: ${txid})`);
          console.log(`[TradesSync] Available bot symbols:`, Object.keys(botsBySymbol).join(', '));
          skipped++;
          continue;
        }

        // Check if entry already exists
        const existingEntries = await db
          .collection('dcaBots')
          .doc(bot.id)
          .collection('entries')
          .where('orderId', '==', txid)
          .get();

        if (!existingEntries.empty) {
          skipped++;
          continue;
        }

        try {
          // Get current bot data
          const botDoc = await db.collection('dcaBots').doc(bot.id).get();
          const currentBot = botDoc.data();

          if (!currentBot) {
            console.warn(`[TradesSync] Bot ${bot.id} not found`);
            errors++;
            continue;
          }

          const executedPrice = parseFloat(trade.price);
          const executedVolume = parseFloat(trade.vol);
          const orderCost = parseFloat(trade.cost);

          // Calculate new bot statistics
          const newEntryCount = (currentBot.currentEntryCount || 0) + 1;
          const totalPreviousCost = (currentBot.averageEntryPrice || 0) * (currentBot.totalVolume || 0);
          const newTotalVolume = (currentBot.totalVolume || 0) + executedVolume;
          const newAverageEntryPrice = newTotalVolume > 0
            ? (totalPreviousCost + orderCost) / newTotalVolume
            : executedPrice;
          const newTotalInvested = (currentBot.totalInvested || 0) + orderCost;

          // Create entry
          const entryData = {
            botId: bot.id,
            entryNumber: newEntryCount,
            id: `${bot.id}_entry_${newEntryCount}`,
            orderAmount: orderCost,
            quantity: executedVolume,
            price: executedPrice,
            status: 'filled',
            timestamp: new Date(trade.time * 1000).toISOString(),
            orderId: txid,
            source: 'kraken_sync',
          };

          await db
            .collection('dcaBots')
            .doc(bot.id)
            .collection('entries')
            .add(entryData);

          // Update bot
          await db.collection('dcaBots').doc(bot.id).update({
            currentEntryCount: newEntryCount,
            averageEntryPrice: newAverageEntryPrice,
            averagePurchasePrice: newAverageEntryPrice,
            totalVolume: newTotalVolume,
            totalInvested: newTotalInvested,
            lastEntryPrice: executedPrice,
            lastEntryTime: new Date(trade.time * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
          });

          console.log(`[TradesSync] Added entry for bot ${bot.id} (${normalizedPair}): $${orderCost.toFixed(2)}`);
          added++;

        } catch (error: any) {
          console.error(`[TradesSync] Error processing trade ${txid}:`, error.message);
          errors++;
        }
      }

      console.log(`[TradesSync] Sync complete for user ${userId}: ${processed} processed, ${added} added, ${skipped} skipped, ${errors} errors`);

      return {
        success: true,
        processed,
        added,
        skipped,
        errors,
      };

    } catch (error: any) {
      console.error(`[TradesSync] Error syncing trades for user ${userId}:`, error.message);
      return {
        success: false,
        processed,
        added,
        skipped,
        errors: errors + 1,
      };
    }
  }

  /**
   * Sync trades for all users
   */
  async syncAllUsers(): Promise<{
    usersProcessed: number;
    totalAdded: number;
    totalSkipped: number;
    totalErrors: number;
  }> {
    console.log('[TradesSync] Starting sync for all users');

    let usersProcessed = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    try {
      // Get all users with Kraken keys
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();

        // Skip users without Kraken keys
        if (!userData.krakenKeys || userData.krakenKeys.length === 0) {
          continue;
        }

        const result = await this.syncUserTrades(userDoc.id);

        if (result.success) {
          usersProcessed++;
          totalAdded += result.added;
          totalSkipped += result.skipped;
          totalErrors += result.errors;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`[TradesSync] All users sync complete: ${usersProcessed} users, ${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors`);

      return {
        usersProcessed,
        totalAdded,
        totalSkipped,
        totalErrors,
      };

    } catch (error: any) {
      console.error('[TradesSync] Error in syncAllUsers:', error.message);
      return {
        usersProcessed,
        totalAdded,
        totalSkipped,
        totalErrors: totalErrors + 1,
      };
    }
  }
}

export const tradesSyncService = new TradesSyncService();
