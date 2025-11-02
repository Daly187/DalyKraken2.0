import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./backend/functions/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkStatus() {
  // Check ADA bot status
  const adaBotSnapshot = await db.collection('dcaBots').doc('iyqwj2mymkaiFMlPKl2D').get();
  const adaBot = adaBotSnapshot.data();

  console.log('\n=== ADA Bot Status ===');
  console.log(`  ID: ${adaBotSnapshot.id}`);
  console.log(`  Status: ${adaBot.status}`);
  console.log(`  Entries: ${adaBot.currentEntryCount}/${adaBot.maxEntries}`);
  console.log(`  Symbol: ${adaBot.symbol}`);

  // Check pending orders
  const ordersSnapshot = await db.collection('pendingOrders').get();
  console.log(`\n=== Pending Orders (${ordersSnapshot.size}) ===`);
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    if (order.symbol === 'ADA/USD' || order.pair === 'ADA/USD') {
      console.log(`  ${doc.id}: ${order.side} ${order.volume} ${order.symbol || order.pair} - ${order.status}`);
    }
  });

  // Check balance cache
  const cacheDoc = await db.collection('krakenBalanceCache').doc('latest').get();
  const cache = cacheDoc.data();
  console.log(`\n=== Balance Cache ===`);
  console.log(`  Source: ${cache?.source}`);
  console.log(`  ADA Balance: ${cache?.balances?.ADA || 0}`);
  console.log(`  Updated: ${cache?.updatedAt?.toDate() || 'N/A'}`);

  process.exit(0);
}

checkStatus().catch(console.error);
