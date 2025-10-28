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
  const allOrders = await db.collection('pendingOrders').get();
  
  console.log('Total orders:', allOrders.size);
  console.log('');
  
  allOrders.forEach(doc => {
    const order = doc.data();
    if (order.side === 'sell') {
      console.log('Pair:', order.pair);
      console.log('  Status:', order.status);
      console.log('  Attempts:', order.attempts || 0);
      console.log('  Last Error:', order.lastError || 'None');
      if (order.txid) {
        console.log('  SUCCESS - TXID:', order.txid);
      }
      console.log('');
    }
  });

  process.exit(0);
}

checkOrders();
