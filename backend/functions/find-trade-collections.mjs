/**
 * Find all collections that might contain trade data
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

async function findTradeCollections() {
  console.log('=== Searching for Trade Data ===\n');

  try {
    // Check common collection names
    const collectionsToCheck = [
      'trades',
      'tradeHistory',
      'transactions',
      'orders',
      'completedOrders',
      'executedOrders',
      'auditLog',
      'tradeLog'
    ];

    for (const collectionName of collectionsToCheck) {
      try {
        const snapshot = await db.collection(collectionName).limit(5).get();
        if (!snapshot.empty) {
          console.log(`\n✓ Found collection: ${collectionName} (${snapshot.size} documents)`);
          console.log('Sample document:');
          const sample = snapshot.docs[0].data();
          console.log(JSON.stringify(sample, null, 2));
        }
      } catch (error) {
        // Collection doesn't exist
      }
    }

    // Also check pendingOrders with completed status
    console.log('\n\nChecking completed orders in pendingOrders:');
    const completedOrders = await db
      .collection('pendingOrders')
      .where('status', '==', 'completed')
      .limit(10)
      .get();

    console.log(`Found ${completedOrders.size} completed orders`);
    if (!completedOrders.empty) {
      console.log('\nSample completed order:');
      console.log(JSON.stringify(completedOrders.docs[0].data(), null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
findTradeCollections()
  .then(() => {
    console.log('\n\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
