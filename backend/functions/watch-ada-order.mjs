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

async function watchADAOrder() {
  console.log('Watching ADA sell order...\n');

  // Get the ADA order
  const orders = await db.collection('pendingOrders')
    .where('pair', '==', 'ADA/USD')
    .where('side', '==', 'sell')
    .get();

  if (orders.empty) {
    console.log('❌ No ADA sell order found');
    return;
  }

  const order = orders.docs[0].data();
  const orderId = orders.docs[0].id;

  console.log('=== ADA SELL ORDER ===');
  console.log(`Order ID: ${orderId}`);
  console.log(`Status: ${order.status}`);
  console.log(`Volume: ${order.volume} ADA`);
  console.log(`Amount: $${order.amount}`);
  console.log(`Attempts: ${order.attempts || 0}`);
  console.log(`Last Error: ${order.lastError || 'None'}`);
  console.log(`Updated At: ${order.updatedAt || order.createdAt}`);

  // Expected volume should be 90% of Kraken balance (15.84)
  const expectedVolume = 15.84 * 0.9;
  console.log(`\n✓ Expected volume (90% of 15.84 ADA): ${expectedVolume.toFixed(8)} ADA`);

  const volumeMatch = Math.abs(parseFloat(order.volume) - expectedVolume) < 0.01;

  if (volumeMatch) {
    console.log('✅ ORDER VOLUME IS CORRECT!');
  } else {
    console.log('⚠️  ORDER VOLUME IS INCORRECT');
    console.log(`   Current: ${order.volume} ADA`);
    console.log(`   Expected: ${expectedVolume.toFixed(8)} ADA`);
  }

  process.exit(0);
}

watchADAOrder().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
