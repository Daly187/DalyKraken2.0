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

async function checkOrderDetails() {
  const allOrders = await db.collection('pendingOrders').get();
  
  console.log('Sell order details:\n');
  allOrders.forEach(doc => {
    const order = doc.data();
    if (order.side === 'sell') {
      console.log('Pair:', order.pair);
      console.log('  Volume:', order.volume);
      console.log('  Amount (USD):', order.amount);
      console.log('  Price:', order.price);
      console.log('  Status:', order.status);
      console.log('  Bot ID:', order.botId);
      console.log('');
    }
  });

  process.exit(0);
}

checkOrderDetails();
