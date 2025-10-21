/**
 * Script to clear circuit breakers and reset failed API key status
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

async function clearCircuitBreakers() {
  console.log('=== Clearing Circuit Breakers ===\n');

  try {
    // Get all orders that have failed API keys tracked
    const ordersSnapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', ['retry', 'processing'])
      .get();

    console.log(`Found ${ordersSnapshot.size} orders in retry/processing state\n`);

    let updatedOrders = 0;

    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();

      if (order.failedApiKeys && order.failedApiKeys.length > 0) {
        console.log(`Order ${orderDoc.id}: Clearing ${order.failedApiKeys.length} failed API key(s)`);
        console.log(`  Failed keys: ${order.failedApiKeys.join(', ')}`);

        // Clear failed API keys array
        await db.collection('pendingOrders').doc(orderDoc.id).update({
          failedApiKeys: [],
          updatedAt: new Date().toISOString(),
        });

        updatedOrders++;
      }
    }

    console.log(`\n✓ Cleared failed API keys for ${updatedOrders} orders`);
    console.log('\nCircuit breakers are now cleared!');
    console.log('Orders should now retry with all available API keys.');
  } catch (error) {
    console.error('Error clearing circuit breakers:', error);
    throw error;
  }
}

// Run the script
clearCircuitBreakers()
  .then(() => {
    console.log('\nComplete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
