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

async function resetFailedOrders() {
  console.log('Resetting failed sell orders...\n');

  const allOrders = await db.collection('pendingOrders').get();
  
  let resetCount = 0;
  
  for (const doc of allOrders.docs) {
    const order = doc.data();
    if (order.side === 'sell' && order.status === 'failed') {
      console.log('Resetting order:', order.pair);
      await db.collection('pendingOrders').doc(doc.id).update({
        status: 'pending',
        attempts: 0,
        lastError: null,
        failedApiKeys: [],
        updatedAt: new Date().toISOString()
      });
      resetCount++;
    }
  }
  
  console.log('\nReset', resetCount, 'failed orders to pending');
  process.exit(0);
}

resetFailedOrders();
