import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function checkFullSellFlow() {
  console.log('=== CHECKING FULL SELL ORDER FLOW ===\n');

  // 1. Check bots in exiting status
  console.log('1. BOTS IN EXITING STATUS:');
  const exitingBots = await db.collection('dcaBots')
    .where('status', '==', 'exiting')
    .get();

  exitingBots.forEach(doc => {
    const bot = doc.data();
    console.log('   Symbol:', bot.symbol);
    console.log('   Exit %:', bot.exitPercentage || 'NOT SET');
  });
  console.log('   Total:', exitingBots.size, '\n');

  // 2. Check pending sell orders
  console.log('2. PENDING SELL ORDERS:');
  const allOrders = await db.collection('pendingOrders').get();

  const sellOrders = [];
  allOrders.forEach(doc => {
    const order = doc.data();
    if (order.side === 'sell') {
      sellOrders.push({ id: doc.id, ...order });
    }
  });

  sellOrders.forEach(order => {
    console.log('   Pair:', order.pair);
    console.log('      Status:', order.status);
    console.log('      Volume:', order.volume);
    console.log('      Attempts:', order.attempts || 0);
    console.log('      Last Error:', order.lastError || 'None');
    console.log('      Failed Keys:', order.failedApiKeys?.length || 0);
    console.log('');
  });
  console.log('   Total sell orders:', sellOrders.length, '\n');

  // 3. Check if orders have correct pair format
  console.log('3. PAIR FORMAT CHECK:');
  sellOrders.forEach(order => {
    const hasSlash = order.pair.includes('/');
    console.log('   ', order.pair, ':', hasSlash ? 'HAS slash' : 'MISSING slash');
  });
  console.log('');

  // 4. Check volume precision
  console.log('4. VOLUME PRECISION CHECK:');
  sellOrders.forEach(order => {
    const decimals = order.volume.toString().split('.')[1]?.length || 0;
    console.log('   ', order.pair, ':', order.volume, '(', decimals, 'decimals)');
  });
  console.log('');

  // 5. Summary
  console.log('5. ISSUES TO CHECK:');
  const issues = [];

  if (sellOrders.some(o => o.status === 'processing')) {
    issues.push('- Orders stuck in PROCESSING (API timeout?)');
  }

  if (sellOrders.some(o => o.failedApiKeys?.length > 0)) {
    issues.push('- API keys marked as failed');
  }

  if (sellOrders.some(o => o.lastError?.includes('Insufficient'))) {
    issues.push('- Insufficient funds errors');
  }

  if (sellOrders.some(o => !o.pair.includes('/'))) {
    issues.push('- Pair format missing slash in DB');
  }

  if (issues.length === 0) {
    console.log('   No issues in DB. Check Firebase logs for Kraken response.');
  } else {
    issues.forEach(issue => console.log('   ', issue));
  }

  process.exit(0);
}

checkFullSellFlow();
