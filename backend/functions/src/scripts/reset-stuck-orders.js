/**
 * Quick script to reset stuck PROCESSING orders to RETRY
 * Run with: node lib/scripts/reset-stuck-orders.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '../../../service-account-key.json');
let serviceAccount;

try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('Error: Could not find service account key file');
  console.error('Please ensure service-account-key.json exists in backend/functions/');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function resetStuckOrders() {
  console.log('[Reset] Finding stuck PROCESSING orders...\n');

  const cutoffTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

  const snapshot = await db
    .collection('pendingOrders')
    .where('status', '==', 'processing')
    .where('updatedAt', '<', cutoffTime)
    .get();

  if (snapshot.empty) {
    console.log('[Reset] No stuck orders found!');
    return 0;
  }

  console.log(`[Reset] Found ${snapshot.size} stuck orders\n`);

  const batch = db.batch();
  const now = new Date().toISOString();

  snapshot.forEach((doc) => {
    const order = doc.data();
    console.log(`[Reset] Resetting order: ${order.id}`);
    console.log(`  - Pair: ${order.pair}`);
    console.log(`  - Side: ${order.side}`);
    console.log(`  - Volume: ${order.volume}`);
    console.log(`  - Stuck since: ${order.updatedAt}`);
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
  });

  await batch.commit();

  console.log(`\n[Reset] ✅ Successfully reset ${snapshot.size} stuck orders to RETRY status`);
  console.log('[Reset] They will be executed on the next scheduler run (within 1 minute)');

  return snapshot.size;
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
