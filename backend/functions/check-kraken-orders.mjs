/**
 * Check if orders actually executed on Kraken but didn't update our database
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

async function checkKrakenOrders() {
  console.log('=== Checking Orders on Kraken ===\n');

  try {
    // Get user's API keys
    const userId = 'SpuaL2eGO3Nkh0kk2wkl'; // From the logs
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
      console.error('No API keys found for user');
      return;
    }

    const activeKey = userData.krakenKeys.find(k => k.isActive);
    if (!activeKey) {
      console.error('No active API keys found');
      return;
    }

    const apiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
    const apiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

    console.log(`Using API key: ${activeKey.name}\n`);

    const krakenClient = new KrakenClient(apiKey, apiSecret);

    // Get all processing/retry orders
    const ordersSnapshot = await db
      .collection('pendingOrders')
      .where('status', 'in', ['processing', 'retry', 'pending'])
      .where('userId', '==', userId)
      .get();

    console.log(`Found ${ordersSnapshot.size} orders in processing/retry/pending state\n`);

    // Get closed orders from Kraken (last 24 hours)
    console.log('Fetching closed orders from Kraken...\n');

    try {
      const closedOrdersResponse = await krakenClient.api('ClosedOrders', {
        start: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
      });

      const closedOrders = closedOrdersResponse.result?.closed || {};
      console.log(`Found ${Object.keys(closedOrders).length} closed orders on Kraken in last 24 hours\n`);

      // Check each of our pending orders
      for (const orderDoc of ordersSnapshot.docs) {
        const order = orderDoc.data();
        console.log(`\n--- Order: ${orderDoc.id} ---`);
        console.log(`  Bot: ${order.botId}`);
        console.log(`  Pair: ${order.pair}`);
        console.log(`  Side: ${order.side}`);
        console.log(`  Volume: ${order.volume}`);
        console.log(`  Amount: $${order.amount}`);
        console.log(`  Status in DB: ${order.status}`);
        console.log(`  Created: ${order.createdAt}`);
        console.log(`  UserRef: ${order.userref}`);

        // Search for this order in Kraken's closed orders by userref
        const matchingKrakenOrder = Object.entries(closedOrders).find(
          ([txid, krakenOrder]) => krakenOrder.userref === order.userref
        );

        if (matchingKrakenOrder) {
          const [txid, krakenOrder] = matchingKrakenOrder;
          console.log(`  ✓ FOUND ON KRAKEN!`);
          console.log(`    Txid: ${txid}`);
          console.log(`    Status: ${krakenOrder.status}`);
          console.log(`    Executed Price: ${krakenOrder.price || krakenOrder.avg_price || 'N/A'}`);
          console.log(`    Executed Volume: ${krakenOrder.vol_exec || krakenOrder.vol || 'N/A'}`);
          console.log(`    → This order executed on Kraken but didn't update our database!`);
        } else {
          console.log(`  ✗ NOT FOUND on Kraken (may not have executed yet)`);
        }
      }

      // Also show recent Kraken orders that might not be in our system
      console.log('\n\n=== Recent Kraken Orders (Last 24h) ===');
      for (const [txid, krakenOrder] of Object.entries(closedOrders)) {
        console.log(`\nTxid: ${txid}`);
        console.log(`  Pair: ${krakenOrder.descr?.pair || 'N/A'}`);
        console.log(`  Type: ${krakenOrder.descr?.type || 'N/A'}`);
        console.log(`  Volume: ${krakenOrder.vol || 'N/A'}`);
        console.log(`  Price: ${krakenOrder.price || krakenOrder.avg_price || 'N/A'}`);
        console.log(`  Status: ${krakenOrder.status || 'N/A'}`);
        console.log(`  UserRef: ${krakenOrder.userref || 'none'}`);
        console.log(`  Close Time: ${new Date(krakenOrder.closetm * 1000).toISOString()}`);
      }

    } catch (krakenError) {
      console.error('\nError fetching from Kraken:', krakenError.message);

      // Try to get open orders instead
      try {
        console.log('\nChecking open orders...');
        const openOrdersResponse = await krakenClient.api('OpenOrders');
        const openOrders = openOrdersResponse.result?.open || {};
        console.log(`Found ${Object.keys(openOrders).length} open orders on Kraken`);

        for (const [txid, krakenOrder] of Object.entries(openOrders)) {
          console.log(`\nOpen Txid: ${txid}`);
          console.log(`  Pair: ${krakenOrder.descr?.pair || 'N/A'}`);
          console.log(`  Type: ${krakenOrder.descr?.type || 'N/A'}`);
          console.log(`  Volume: ${krakenOrder.vol || 'N/A'}`);
          console.log(`  UserRef: ${krakenOrder.userref || 'none'}`);
        }
      } catch (openError) {
        console.error('Error fetching open orders:', openError.message);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
checkKrakenOrders()
  .then(() => {
    console.log('\n\nCheck complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
