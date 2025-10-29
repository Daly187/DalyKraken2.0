import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkStatus() {
  // Check BCH bot status
  const botsSnapshot = await db.collection('dcaBots').where('symbol', '==', 'BCH/USD').get();

  console.log('\n=== BCH Bot Status ===');
  botsSnapshot.forEach(doc => {
    const bot = doc.data();
    console.log(`  ID: ${doc.id}`);
    console.log(`  Status: ${bot.status}`);
    console.log(`  Entries: ${bot.currentEntryCount}/${bot.maxEntries}`);
    console.log(`  Symbol: ${bot.symbol}`);
    console.log(`  Tech Score: ${bot.techScore}`);
    console.log(`  Trend Score: ${bot.trendScore}`);
    console.log(`  Exit Percentage: ${bot.exitPercentage || 90}%`);
  });

  // Check pending orders for BCH
  const ordersSnapshot = await db.collection('pendingOrders').get();
  const bchOrders = [];
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    if (order.symbol === 'BCH/USD' || order.pair === 'BCH/USD') {
      bchOrders.push({ id: doc.id, ...order });
    }
  });

  console.log(`\n=== Pending BCH Orders (${bchOrders.length}) ===`);
  bchOrders.forEach(order => {
    console.log(`  ${order.id}:`);
    console.log(`    Side: ${order.side}`);
    console.log(`    Volume: ${order.volume}`);
    console.log(`    Status: ${order.status}`);
    console.log(`    Retry: ${order.shouldRetry}`);
    console.log(`    Created: ${order.createdAt}`);
  });

  // Check balance cache
  const cacheDoc = await db.collection('krakenBalanceCache').doc('latest').get();
  const cache = cacheDoc.data();
  console.log(`\n=== Balance Cache ===`);
  console.log(`  Source: ${cache?.source}`);
  console.log(`  BCH Balance: ${cache?.balances?.BCH || 0}`);
  console.log(`  Updated: ${cache?.updatedAt?.toDate() || 'N/A'}`);

  process.exit(0);
}

checkStatus().catch(console.error);
