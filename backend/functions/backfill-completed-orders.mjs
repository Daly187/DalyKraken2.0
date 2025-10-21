/**
 * Backfill script to create bot entries for completed orders that executed but didn't update the database
 * This queries Kraken for actual execution details and creates the missing entries
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
 * Decrypt API key (if encrypted)
 */
function decryptKey(encryptedKey) {
  // If your keys are encrypted, implement decryption here
  // For now, assume they're not encrypted or return as-is
  return encryptedKey;
}

/**
 * Get user's Kraken API keys
 */
async function getUserApiKeys(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
    console.warn(`  No API keys found for user ${userId}`);
    return null;
  }

  // Get the first active key
  const activeKey = userData.krakenKeys.find(k => k.isActive);
  if (!activeKey) {
    console.warn(`  No active API keys found for user ${userId}`);
    return null;
  }

  return {
    apiKey: activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey,
    apiSecret: activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret,
  };
}

async function backfillCompletedOrders() {
  console.log('=== Backfilling Completed Orders ===\n');

  try {
    // Get all completed orders
    const completedOrdersSnapshot = await db
      .collection('pendingOrders')
      .where('status', '==', 'completed')
      .get();

    if (completedOrdersSnapshot.empty) {
      console.log('No completed orders found');
      return;
    }

    console.log(`Found ${completedOrdersSnapshot.size} completed orders\n`);

    let processed = 0;
    let skipped = 0;
    let updated = 0;
    let failed = 0;

    for (const orderDoc of completedOrdersSnapshot.docs) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;

      console.log(`\nProcessing order: ${orderId}`);
      console.log(`  Bot ID: ${order.botId}`);
      console.log(`  Pair: ${order.pair}`);
      console.log(`  Side: ${order.side}`);
      console.log(`  Volume: ${order.volume}`);
      console.log(`  Kraken Order ID: ${order.krakenOrderId || 'N/A'}`);

      processed++;

      // Skip if no botId (manual trades)
      if (!order.botId) {
        console.log(`  ⊘ Skipping: No bot ID (manual trade)`);
        skipped++;
        continue;
      }

      // Skip if no krakenOrderId
      if (!order.krakenOrderId) {
        console.log(`  ⊘ Skipping: No Kraken order ID`);
        skipped++;
        continue;
      }

      // Skip sell orders (exits) - these don't need entries
      if (order.side === 'sell') {
        console.log(`  ⊘ Skipping: Sell order (exit)`);
        skipped++;
        continue;
      }

      try {
        // Check if bot exists
        const botDoc = await db.collection('dcaBots').doc(order.botId).get();
        if (!botDoc.exists) {
          console.log(`  ⊘ Skipping: Bot not found`);
          skipped++;
          continue;
        }

        const bot = botDoc.data();

        // Check if entry already exists for this order
        const existingEntries = await db
          .collection('dcaBots')
          .doc(order.botId)
          .collection('entries')
          .where('orderId', '==', order.krakenOrderId)
          .get();

        if (!existingEntries.empty) {
          console.log(`  ⊘ Skipping: Entry already exists`);
          skipped++;
          continue;
        }

        // Get user's API keys to query Kraken
        const apiKeys = await getUserApiKeys(order.userId);
        if (!apiKeys) {
          console.log(`  ⊘ Skipping: No API keys available`);
          skipped++;
          continue;
        }

        // Query Kraken for order details
        console.log(`  → Querying Kraken for execution details...`);
        const krakenClient = new KrakenClient(apiKeys.apiKey, apiKeys.apiSecret);

        let executedPrice;
        let executedVolume;

        try {
          const orderDetails = await krakenClient.api('QueryOrders', {
            txid: order.krakenOrderId,
          });

          if (orderDetails.result && orderDetails.result[order.krakenOrderId]) {
            const orderInfo = orderDetails.result[order.krakenOrderId];
            executedPrice = parseFloat(orderInfo.price || orderInfo.avg_price || order.price || '0');
            executedVolume = parseFloat(orderInfo.vol_exec || orderInfo.vol || order.volume || '0');

            console.log(`  → Executed Price: $${executedPrice.toFixed(2)}`);
            console.log(`  → Executed Volume: ${executedVolume.toFixed(8)}`);
          } else {
            // Fallback to order parameters if query fails
            console.warn(`  → Could not fetch order details, using order parameters as fallback`);
            executedPrice = parseFloat(order.price || '0');
            executedVolume = parseFloat(order.volume || '0');
          }
        } catch (krakenError) {
          console.warn(`  → Kraken query failed: ${krakenError.message}, using order parameters`);
          executedPrice = parseFloat(order.price || '0');
          executedVolume = parseFloat(order.volume || '0');
        }

        // Calculate order cost
        const orderCost = executedPrice * executedVolume;

        // Calculate new bot statistics
        const currentEntryCount = (bot.currentEntryCount || 0) + 1;
        const totalPreviousCost = (bot.averageEntryPrice || 0) * (bot.totalVolume || 0);
        const newTotalVolume = (bot.totalVolume || 0) + executedVolume;
        const newAverageEntryPrice = newTotalVolume > 0 ? (totalPreviousCost + orderCost) / newTotalVolume : 0;
        const newTotalInvested = (bot.totalInvested || 0) + orderCost;

        // Create entry in the entries subcollection
        const entryData = {
          botId: order.botId,
          entryNumber: currentEntryCount,
          id: `${order.botId}_entry_${currentEntryCount}`,
          orderAmount: orderCost,
          quantity: executedVolume,
          price: executedPrice,
          status: 'filled',
          timestamp: order.completedAt || order.updatedAt || new Date().toISOString(),
          orderId: order.krakenOrderId,
        };

        await db
          .collection('dcaBots')
          .doc(order.botId)
          .collection('entries')
          .add(entryData);

        console.log(`  ✓ Created entry ${currentEntryCount} for bot ${order.botId}`);

        // Update bot fields
        await db.collection('dcaBots').doc(order.botId).update({
          currentEntryCount: currentEntryCount,
          averageEntryPrice: newAverageEntryPrice,
          averagePurchasePrice: newAverageEntryPrice,
          totalVolume: newTotalVolume,
          totalInvested: newTotalInvested,
          lastEntryPrice: executedPrice,
          lastEntryTime: order.completedAt || order.updatedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.log(`  ✓ Updated bot ${order.botId}: entry count ${currentEntryCount}, avg price $${newAverageEntryPrice.toFixed(2)}, total volume ${newTotalVolume.toFixed(8)}, total invested $${newTotalInvested.toFixed(2)}`);

        updated++;

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ Error processing order ${orderId}:`, error.message);
        failed++;
      }
    }

    console.log('\n=== Backfill Complete ===');
    console.log(`Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
  } catch (error) {
    console.error('Error backfilling completed orders:', error);
    throw error;
  }
}

// Run the backfill
backfillCompletedOrders()
  .then(() => {
    console.log('\nBackfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  });
