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

async function checkBotStatus() {
  console.log('Checking DCA bot statuses...');

  try {
    const exitingBotsSnapshot = await db.collection('dcaBots')
      .where('status', '==', 'exiting')
      .get();

    console.log('Bots in exiting status:', exitingBotsSnapshot.size);
    exitingBotsSnapshot.forEach(doc => {
      const bot = doc.data();
      console.log('  -', bot.symbol, ':', bot.id);
    });

    const failedOrdersSnapshot = await db.collection('pendingOrders')
      .where('status', '==', 'failed')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    console.log('Recent failed orders:', failedOrdersSnapshot.size);
    failedOrdersSnapshot.forEach(doc => {
      const order = doc.data();
      console.log('  -', order.pair, order.side, ':', order.lastError);
    });

    const allPendingSnapshot = await db.collection('pendingOrders')
      .where('status', '==', 'pending')
      .get();

    console.log('All pending orders:', allPendingSnapshot.size);
    allPendingSnapshot.forEach(doc => {
      const order = doc.data();
      console.log('  -', order.pair, order.side, 'attempts:', order.attempts || 0);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkBotStatus();
