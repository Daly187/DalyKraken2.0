/**
 * Backfill missing txids for DCA bot entries by matching against Kraken trade history
 */

import * as admin from 'firebase-admin';
import { KrakenService } from '../src/services/krakenService.js';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface DCABotEntry {
  id: string;
  botId: string;
  entryNumber: number;
  orderAmount: number;
  price: number;
  quantity: number;
  timestamp: string;
  orderId?: string;
  status: string;
  txid?: string;
}

interface KrakenTrade {
  ordertxid: string;
  pair: string;
  time: number;
  type: string;
  ordertype: string;
  price: string;
  cost: string;
  fee: string;
  vol: string;
  margin: string;
  misc: string;
}

async function backfillTxids() {
  try {
    console.log('[Backfill] Starting txid backfill process...');

    // Get Kraken credentials from environment or prompt
    const apiKey = process.env.KRAKEN_API_KEY;
    const apiSecret = process.env.KRAKEN_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[Backfill] Error: KRAKEN_API_KEY and KRAKEN_API_SECRET must be set');
      console.error('[Backfill] Usage: KRAKEN_API_KEY=xxx KRAKEN_API_SECRET=yyy npm run backfill-txids');
      process.exit(1);
    }

    const krakenService = new KrakenService(apiKey, apiSecret);

    // Get all DCA bots
    const botsSnapshot = await db.collection('dcaBots').get();
    console.log(`[Backfill] Found ${botsSnapshot.size} bots`);

    let totalEntries = 0;
    let entriesWithTxid = 0;
    let entriesWithoutTxid = 0;
    let entriesUpdated = 0;

    // For each bot, get entries and check for missing txids
    for (const botDoc of botsSnapshot.docs) {
      const botId = botDoc.id;
      const botData = botDoc.data();
      console.log(`\n[Backfill] Processing bot ${botId} (${botData.symbol})`);

      // Get all entries for this bot
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(botId)
        .collection('entries')
        .get();

      const entries = entriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DCABotEntry[];

      console.log(`[Backfill]   Found ${entries.length} entries`);
      totalEntries += entries.length;

      // Filter entries that don't have txid but are filled
      const entriesNeedingTxid = entries.filter(
        (e) => e.status === 'filled' && !e.txid
      );

      entriesWithTxid += entries.length - entriesNeedingTxid.length;
      entriesWithoutTxid += entriesNeedingTxid.length;

      if (entriesNeedingTxid.length === 0) {
        console.log(`[Backfill]   All entries have txids, skipping`);
        continue;
      }

      console.log(`[Backfill]   ${entriesNeedingTxid.length} entries need txid`);

      // Get trade history from Kraken
      // We'll get trades from the earliest entry timestamp
      const earliestEntry = entries.reduce((earliest, e) =>
        new Date(e.timestamp) < new Date(earliest.timestamp) ? e : earliest
      );

      const startTime = Math.floor(new Date(earliestEntry.timestamp).getTime() / 1000);
      console.log(`[Backfill]   Fetching Kraken trades since ${earliestEntry.timestamp}`);

      try {
        const tradesHistory = await krakenService.getTradeHistory(startTime);

        if (!tradesHistory || !tradesHistory.trades) {
          console.log(`[Backfill]   No trades found in Kraken history`);
          continue;
        }

        const trades = tradesHistory.trades as Record<string, KrakenTrade>;
        const tradeEntries = Object.entries(trades);
        console.log(`[Backfill]   Found ${tradeEntries.length} trades in Kraken history`);

        // Match entries to trades
        for (const entry of entriesNeedingTxid) {
          console.log(`[Backfill]   Matching entry ${entry.id}:`, {
            price: entry.price,
            quantity: entry.quantity,
            timestamp: entry.timestamp,
          });

          // Find matching trade by price, quantity, and timestamp
          const entryTime = new Date(entry.timestamp).getTime() / 1000;
          const matchingTrade = tradeEntries.find(([txid, trade]) => {
            const tradePrice = parseFloat(trade.price);
            const tradeVol = parseFloat(trade.vol);
            const tradeTime = trade.time;

            // Match criteria:
            // 1. Price within 1% tolerance
            // 2. Volume within 1% tolerance
            // 3. Time within 5 minutes (300 seconds)
            const priceMatch = Math.abs(tradePrice - entry.price) / entry.price < 0.01;
            const volMatch = Math.abs(tradeVol - entry.quantity) / entry.quantity < 0.01;
            const timeMatch = Math.abs(tradeTime - entryTime) < 300;

            return priceMatch && volMatch && timeMatch && trade.type === 'buy';
          });

          if (matchingTrade) {
            const [txid, trade] = matchingTrade;
            console.log(`[Backfill]     ✓ Matched to txid: ${txid}`, {
              tradePrice: trade.price,
              tradeVol: trade.vol,
              tradeTime: new Date(trade.time * 1000).toISOString(),
            });

            // Update the entry with the txid
            await db
              .collection('dcaBots')
              .doc(botId)
              .collection('entries')
              .doc(entry.id)
              .update({ txid });

            entriesUpdated++;
          } else {
            console.log(`[Backfill]     ✗ No matching trade found`);
          }
        }
      } catch (error) {
        console.error(`[Backfill]   Error fetching Kraken trades for bot ${botId}:`, error);
      }
    }

    console.log('\n[Backfill] ========== Summary ==========');
    console.log(`[Backfill] Total entries: ${totalEntries}`);
    console.log(`[Backfill] Entries with txid: ${entriesWithTxid}`);
    console.log(`[Backfill] Entries without txid: ${entriesWithoutTxid}`);
    console.log(`[Backfill] Entries updated: ${entriesUpdated}`);
    console.log('[Backfill] ========== Complete ==========');

    process.exit(0);
  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillTxids();
