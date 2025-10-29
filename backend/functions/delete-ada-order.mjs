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

async function deleteADAOrder() {
  console.log('Deleting ADA sell order...\n');

  // Get the ADA order
  const orders = await db.collection('pendingOrders')
    .where('pair', '==', 'ADA/USD')
    .where('side', '==', 'sell')
    .get();

  if (orders.empty) {
    console.log('No ADA sell order found');
    process.exit(0);
  }

  const orderId = orders.docs[0].id;
  const order = orders.docs[0].data();

  console.log(`Found order ${orderId}`);
  console.log(`  Volume: ${order.volume} ADA`);
  console.log(`  Status: ${order.status}`);

  await db.collection('pendingOrders').doc(orderId).delete();

  console.log('\n✅ Order deleted successfully');
  console.log('Next processDCABots run will create a new order with correct volume');

  process.exit(0);
}

deleteADAOrder().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
