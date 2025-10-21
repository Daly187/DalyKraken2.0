/**
 * Backfill bot entries from Kraken - Manual version
 * Usage: node backfill-manual.mjs YOUR_API_KEY YOUR_API_SECRET
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import KrakenClient from 'kraken-api';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

/**
 * Normalize Kraken pair names to match our bot symbols
 */
function normalizePair(krakenPair) {
  const mapping = {
    'XATOMZUSD': 'ATOM/USD',
    'ATOMUSD': 'ATOM/USD',
    'XXDGZUSD': 'DOGE/USD',
    'DOGEUSD': 'DOGE/USD',
    'GRTUSD': 'GRT/USD',
    'LINKUSD': 'LINK/USD',
    'XETHZUSD': 'ETH/USD',
    'XXBTZUSD': 'BTC/USD',
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
    'LTCUSD': 'LTC/USD',
    'GALAUSD': 'GALA/USD',
  };

  return mapping[krakenPair] || krakenPair;
}

async function backfillFromKraken(apiKey, apiSecret) {
  console.log('=== Backfilling from Kraken Trade History ===\n');

  try {
    const krakenClient = new KrakenClient(apiKey, apiSecret);

    // Get all active bots
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'active')
      .get();

    const botsBySymbol = {};
    botsSnapshot.forEach(doc => {
      const bot = doc.data();
      botsBySymbol[bot.symbol] = { id: doc.id, ...bot };
    });

    console.log(`Found ${Object.keys(botsBySymbol).length} active bots\n`);
    console.log('Bot symbols:', Object.keys(botsBySymbol).join(', '));

    // Fetch trades from Kraken (last 7 days)
    const startTime = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    console.log(`\nFetching trades from Kraken since ${new Date(startTime * 1000).toISOString()}...\n`);

    const tradesResponse = await krakenClient.api('TradesHistory', {
      start: startTime,
    });

    const trades = tradesResponse.result?.trades || {};
    const tradeIds = Object.keys(trades);

    console.log(`Found ${tradeIds.length} trades on Kraken\n`);

    let processed = 0;
    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const txid of tradeIds) {
      const trade = trades[txid];
      processed++;

      // Only process buy orders
      if (trade.type !== 'buy') {
        continue;
      }

      // Normalize the pair
      const normalizedPair = normalizePair(trade.pair);

      console.log(`\n[${processed}/${tradeIds.length}] Trade ${txid}`);
      console.log(`  Pair: ${trade.pair} → ${normalizedPair}`);
      console.log(`  Type: ${trade.type}`);
      console.log(`  Volume: ${trade.vol}`);
      console.log(`  Price: ${trade.price}`);
      console.log(`  Cost: $${trade.cost}`);
      console.log(`  Time: ${new Date(trade.time * 1000).toISOString()}`);

      // Find matching bot
      const bot = botsBySymbol[normalizedPair];
      if (!bot) {
        console.log(`  ⊘ No active bot found for ${normalizedPair}`);
        skipped++;
        continue;
      }

      console.log(`  ✓ Found bot: ${bot.id}`);

      // Check if entry already exists for this txid
      const existingEntries = await db
        .collection('dcaBots')
        .doc(bot.id)
        .collection('entries')
        .where('orderId', '==', txid)
        .get();

      if (!existingEntries.empty) {
        console.log(`  ⊘ Entry already exists for this trade`);
        skipped++;
        continue;
      }

      try {
        // Get current bot data
        const botDoc = await db.collection('dcaBots').doc(bot.id).get();
        const currentBot = botDoc.data();

        const executedPrice = parseFloat(trade.price);
        const executedVolume = parseFloat(trade.vol);
        const orderCost = parseFloat(trade.cost);

        // Calculate new bot statistics
        const newEntryCount = (currentBot.currentEntryCount || 0) + 1;
        const totalPreviousCost = (currentBot.averageEntryPrice || 0) * (currentBot.totalVolume || 0);
        const newTotalVolume = (currentBot.totalVolume || 0) + executedVolume;
        const newAverageEntryPrice = newTotalVolume > 0 ? (totalPreviousCost + orderCost) / newTotalVolume : executedPrice;
        const newTotalInvested = (currentBot.totalInvested || 0) + orderCost;

        // Create entry in the entries subcollection
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
          source: 'kraken_backfill',
        };

        await db
          .collection('dcaBots')
          .doc(bot.id)
          .collection('entries')
          .add(entryData);

        console.log(`  ✓ Created entry ${newEntryCount} for bot ${bot.id}`);

        // Update bot fields
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

        console.log(`  ✓ Updated bot: entries=${newEntryCount}, avgPrice=$${newAverageEntryPrice.toFixed(2)}, volume=${newTotalVolume.toFixed(8)}, invested=$${newTotalInvested.toFixed(2)}`);

        added++;

        // Small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  ✗ Error processing trade:`, error.message);
        errors++;
      }
    }

    console.log('\n\n=== Backfill Complete ===');
    console.log(`Processed: ${processed} trades`);
    console.log(`Added: ${added} new entries`);
    console.log(`Skipped: ${skipped} (no bot or already exists)`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Get API keys from command line arguments
const apiKey = process.argv[2];
const apiSecret = process.argv[3];

if (!apiKey || !apiSecret) {
  console.error('Usage: node backfill-manual.mjs YOUR_API_KEY YOUR_API_SECRET');
  console.error('\nPlease provide your Kraken API key and secret as arguments.');
  process.exit(1);
}

// Run the backfill
backfillFromKraken(apiKey, apiSecret)
  .then(() => {
    console.log('\nBackfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  });
