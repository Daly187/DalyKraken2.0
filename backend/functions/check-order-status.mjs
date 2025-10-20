/**
 * Check status of pending orders
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkOrderStatus() {
  console.log('[Status] Checking all pending orders...\n');

  // Get orders by status
  const statuses = ['pending', 'processing', 'retry', 'completed', 'failed'];

  for (const status of statuses) {
    const snapshot = await db
      .collection('pendingOrders')
      .where('status', '==', status)
      .get();

    console.log(`\n=== ${status.toUpperCase()} ORDERS: ${snapshot.size} ===`);

    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        const order = doc.data();
        console.log(`  Order: ${order.id}`);
        console.log(`    User ID: ${order.userId}`);
        console.log(`    Bot ID: ${order.botId}`);
        console.log(`    Pair: ${order.pair}`);
        console.log(`    Side: ${order.side}`);
        console.log(`    Volume: ${order.volume}`);
        console.log(`    Amount: $${order.amount || 0}`);
        console.log(`    Created: ${order.createdAt}`);
        console.log(`    Updated: ${order.updatedAt}`);

        if (order.attempts) {
          console.log(`    Attempts: ${order.attempts}/${order.maxAttempts || 5}`);
        }

        if (order.lastError) {
          console.log(`    Last Error: ${order.lastError}`);
        }

        if (order.krakenOrderId) {
          console.log(`    Kraken Order ID: ${order.krakenOrderId}`);
        }

        if (order.nextRetryAt) {
          const retryTime = new Date(order.nextRetryAt);
          const now = new Date();
          const diff = Math.floor((retryTime - now) / 1000);
          console.log(`    Next Retry: ${order.nextRetryAt} (${diff > 0 ? `in ${diff}s` : `${Math.abs(diff)}s ago`})`);
        }

        console.log('');
      });
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const totalSnapshot = await db.collection('pendingOrders').count().get();
  console.log(`Total orders in queue: ${totalSnapshot.data().count}`);
}

// Run the script
checkOrderStatus()
  .then(() => {
    console.log('\n[Status] Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Status] Error:', error);
    process.exit(1);
  });
