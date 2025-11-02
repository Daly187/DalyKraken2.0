#!/usr/bin/env node
/**
 * Check status of pending orders
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'dalydough' });
const db = getFirestore();

async function checkOrders() {
  try {
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}\n`);

    // Get all pending/retry orders
    const snapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', ['pending', 'retry', 'processing'])
      .get();

    if (snapshot.empty) {
      console.log('No pending/retry orders found');
      return;
    }

    console.log(`Found ${snapshot.size} orders:\n`);

    snapshot.forEach((doc) => {
      const order = doc.data();
      const nextRetry = order.nextRetryAt ? new Date(order.nextRetryAt) : null;
      const isReady = !nextRetry || nextRetry <= now;

      console.log(`Order ID: ${doc.id}`);
      console.log(`  Pair: ${order.pair}`);
      console.log(`  Side: ${order.side}`);
      console.log(`  Volume: ${order.volume}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Attempts: ${order.attempts}`);
      console.log(`  Last Error: ${order.lastError || 'None'}`);
      console.log(`  Failed API Keys: ${JSON.stringify(order.failedApiKeys || [])}`);
      console.log(`  Next Retry At: ${order.nextRetryAt || 'N/A'}`);
      console.log(`  Ready for execution: ${isReady ? 'YES ✓' : 'NO (waiting for retry time)'}`);

      if (nextRetry && !isReady) {
        const waitSeconds = Math.ceil((nextRetry - now) / 1000);
        console.log(`  Wait time: ${waitSeconds} seconds`);
      }

      console.log('');
    });
  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkOrders();
