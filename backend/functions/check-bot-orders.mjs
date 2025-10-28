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

async function checkBotOrders() {
  const botIds = ['3x7ZYcJcDGemb8kePQqz', 'iyqwj2mymkaiFMlPKl2D', 'xg1xxCNsxq4WDhYOMvUs'];

  for (const botId of botIds) {
    console.log('Bot:', botId);
    
    const ordersSnapshot = await db.collection('pendingOrders')
      .where('botId', '==', botId)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    console.log('  Found', ordersSnapshot.size, 'orders');
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      console.log('    -', order.side, order.status, '- attempts:', order.attempts || 0);
      if (order.lastError) {
        console.log('      Error:', order.lastError);
      }
    });
    console.log('');
  }

  process.exit(0);
}

checkBotOrders();
