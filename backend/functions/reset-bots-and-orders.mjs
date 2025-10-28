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

async function resetBotsAndOrders() {
  console.log('Resetting exiting bots to active status...\n');

  // Reset bots from exiting to active
  const exitingBots = await db.collection('dcaBots')
    .where('status', '==', 'exiting')
    .get();
  
  for (const doc of exitingBots.docs) {
    const bot = doc.data();
    console.log('Resetting bot:', bot.symbol);
    await db.collection('dcaBots').doc(doc.id).update({
      status: 'active',
      updatedAt: new Date().toISOString()
    });
  }
  
  console.log('\nDeleting stuck sell orders...\n');
  
  // Delete all sell orders
  const allOrders = await db.collection('pendingOrders').get();
  for (const doc of allOrders.docs) {
    const order = doc.data();
    if (order.side === 'sell') {
      console.log('Deleting order:', order.pair, order.status);
      await db.collection('pendingOrders').doc(doc.id).delete();
    }
  }
  
  console.log('\nDone! Bots reset to active, sell orders deleted.');
  console.log('The processDCABots function will recreate sell orders with the new fee buffer.');
  
  process.exit(0);
}

resetBotsAndOrders();
