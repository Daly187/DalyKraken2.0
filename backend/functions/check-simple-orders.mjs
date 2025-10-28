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

async function checkOrders() {
  console.log('Checking all pending orders...\n');

  const allOrders = await db.collection('pendingOrders').get();
  
  console.log('Total orders:', allOrders.size);
  
  let pendingCount = 0;
  let failedCount = 0;
  let completedCount = 0;
  
  allOrders.forEach(doc => {
    const order = doc.data();
    if (order.status === 'pending') pendingCount++;
    if (order.status === 'failed') failedCount++;
    if (order.status === 'completed') completedCount++;
  });
  
  console.log('Pending:', pendingCount);
  console.log('Failed:', failedCount);
  console.log('Completed:', completedCount);
  console.log('');
  
  console.log('Recent pending/failed sell orders:');
  allOrders.forEach(doc => {
    const order = doc.data();
    if (order.side === 'sell' && (order.status === 'pending' || order.status === 'failed')) {
      console.log('  -', order.pair, order.status, 'attempts:', order.attempts || 0);
      if (order.lastError) {
        console.log('    Error:', order.lastError);
      }
    }
  });

  process.exit(0);
}

checkOrders();
