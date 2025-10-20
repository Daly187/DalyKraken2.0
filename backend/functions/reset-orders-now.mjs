/**
 * Quick script to reset stuck PROCESSING orders to RETRY
 * Run with: node reset-orders-now.mjs
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

async function resetStuckOrders() {
  console.log('[Reset] Finding stuck PROCESSING orders...\n');

  const cutoffTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago

  const snapshot = await db
    .collection('pendingOrders')
    .where('status', '==', 'processing')
    .get();

  if (snapshot.empty) {
    console.log('[Reset] No orders in PROCESSING status found!');
    return 0;
  }

  console.log(`[Reset] Found ${snapshot.size} orders in PROCESSING status\n`);

  const batch = db.batch();
  const now = new Date().toISOString();
  let resetCount = 0;

  snapshot.forEach((doc) => {
    const order = doc.data();
    const updatedAtTime = new Date(order.updatedAt).getTime();
    const isStuck = (Date.now() - updatedAtTime) > 10 * 60 * 1000; // >10 minutes

    if (!isStuck) {
      console.log(`[Reset] Skipping order ${order.id} - updated ${Math.floor((Date.now() - updatedAtTime) / 1000)}s ago`);
      return;
    }

    console.log(`[Reset] Resetting order: ${order.id}`);
    console.log(`  - Pair: ${order.pair}`);
    console.log(`  - Side: ${order.side}`);
    console.log(`  - Volume: ${order.volume}`);
    console.log(`  - Stuck since: ${order.updatedAt} (${Math.floor((Date.now() - updatedAtTime) / 60000)} minutes ago)`);
    console.log('');

    batch.update(doc.ref, {
      status: 'retry',
      nextRetryAt: now, // Immediate retry
      updatedAt: now,
      lastError: 'Order was stuck in PROCESSING state and was automatically reset',
      errors: [
        ...(order.errors || []),
        {
          timestamp: now,
          error: 'Stuck in PROCESSING, auto-reset to RETRY',
        },
      ],
    });

    resetCount++;
  });

  if (resetCount === 0) {
    console.log('[Reset] No stuck orders found (all PROCESSING orders are recent)');
    return 0;
  }

  await batch.commit();

  console.log(`\n[Reset] ✅ Successfully reset ${resetCount} stuck orders to RETRY status`);
  console.log('[Reset] They will be executed on the next scheduler run (within 1 minute)');

  return resetCount;
}

// Run the script
resetStuckOrders()
  .then((count) => {
    console.log(`\n[Reset] Complete! Reset ${count} orders`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Reset] Error:', error);
    process.exit(1);
  });
