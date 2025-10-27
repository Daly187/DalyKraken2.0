#!/usr/bin/env node
/**
 * Clear failedApiKeys from a specific pending order
 * Usage: node clear-failed-keys.mjs <orderId>
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp({
  projectId: 'dalydough',
});
const db = getFirestore();

const orderId = process.argv[2];

if (!orderId) {
  console.error('Usage: node clear-failed-keys.mjs <orderId>');
  process.exit(1);
}

async function clearFailedKeys() {
  try {
    const orderRef = db.collection('pendingOrders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.error(`Order ${orderId} not found`);
      process.exit(1);
    }

    const order = orderDoc.data();
    console.log(`Current failedApiKeys:`, order.failedApiKeys || []);
    console.log(`Current status:`, order.status);
    console.log(`Current attempts:`, order.attempts);

    // Clear failedApiKeys and reset to PENDING
    await orderRef.update({
      failedApiKeys: [],
      status: 'pending',
      lastError: 'Manually cleared failed API keys - ready to retry',
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Cleared failedApiKeys for order ${orderId}`);
    console.log(`Order is now ready to retry with all available API keys`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

clearFailedKeys();
