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

async function fixExitPercentage() {
  console.log('Fixing exitPercentage for bots in exiting status...\n');

  const exitingBots = await db.collection('dcaBots')
    .where('status', '==', 'exiting')
    .get();

  for (const doc of exitingBots.docs) {
    const bot = doc.data();
    if (!bot.exitPercentage) {
      console.log('Setting exitPercentage=90 for', bot.symbol);
      await db.collection('dcaBots').doc(doc.id).update({
        exitPercentage: 90,
        updatedAt: new Date().toISOString()
      });
    }
  }

  console.log('\nClearing failed API keys from orders...\n');

  const allOrders = await db.collection('pendingOrders').get();
  for (const doc of allOrders.docs) {
    const order = doc.data();
    if (order.side === 'sell' && order.failedApiKeys?.length > 0) {
      console.log('Clearing failed keys for', order.pair);
      await db.collection('pendingOrders').doc(doc.id).update({
        failedApiKeys: [],
        status: 'pending',
        attempts: 0,
        lastError: null,
        updatedAt: new Date().toISOString()
      });
    }
  }

  console.log('\nDone! Orders ready to retry.');
  process.exit(0);
}

fixExitPercentage();
