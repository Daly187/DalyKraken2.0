/**
 * Check bots stuck in exiting status
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkExitingBots() {
  console.log('=== Checking Bots in EXITING Status ===\n');

  try {
    // Get all bots in exiting status
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'exiting')
      .get();

    console.log(`Found ${botsSnapshot.size} bots in EXITING status\n`);

    for (const botDoc of botsSnapshot.docs) {
      const bot = botDoc.data();
      console.log(`\n--- ${bot.symbol} (${botDoc.id}) ---`);
      console.log(`  Status: ${bot.status}`);
      console.log(`  Current Entry Count: ${bot.currentEntryCount || 0}`);
      console.log(`  Average Purchase Price: $${bot.averagePurchasePrice || 0}`);
      console.log(`  Total Invested: $${bot.totalInvested || 0}`);
      console.log(`  Total Volume: ${bot.totalVolume || 0}`);
      console.log(`  Updated At: ${bot.updatedAt || 'Unknown'}`);

      // Check for entries
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(botDoc.id)
        .collection('entries')
        .get();

      console.log(`  Total Entries: ${entriesSnapshot.size}`);

      const filledEntries = entriesSnapshot.docs.filter(doc => doc.data().status === 'filled');
      console.log(`  Filled Entries: ${filledEntries.length}`);

      // Check for pending SELL orders
      const pendingOrders = await db
        .collection('pendingOrders')
        .where('botId', '==', botDoc.id)
        .where('side', '==', 'sell')
        .get();

      console.log(`  Pending SELL Orders: ${pendingOrders.size}`);

      if (pendingOrders.size > 0) {
        pendingOrders.forEach(orderDoc => {
          const order = orderDoc.data();
          console.log(`    Order ${orderDoc.id}:`);
          console.log(`      Status: ${order.status}`);
          console.log(`      Volume: ${order.volume}`);
          console.log(`      Created: ${order.createdAt}`);
          console.log(`      Last Error: ${order.lastError || 'None'}`);
          console.log(`      Attempts: ${order.attempts || 0}/${order.maxAttempts || 5}`);
          if (order.nextRetryAt) {
            const retryTime = new Date(order.nextRetryAt);
            const now = new Date();
            const diff = Math.floor((retryTime - now) / 1000);
            console.log(`      Next Retry: ${order.nextRetryAt} (${diff > 0 ? `in ${diff}s` : `${Math.abs(diff)}s ago`})`);
          }
        });
      } else {
        console.log(`  NO PENDING SELL ORDERS FOUND - Bot stuck without exit order!`);
      }

      // Skip executions for now - would need index
      // Check bot executions for exit attempts
      // const execLogs = await db
      //   .collection('botExecutions')
      //   .where('botId', '==', botDoc.id)
      //   .where('action', '==', 'exit')
      //   .orderBy('timestamp', 'desc')
      //   .limit(3)
      //   .get();
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

checkExitingBots()
  .then(() => {
    console.log('\n\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
