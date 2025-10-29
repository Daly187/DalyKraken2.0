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

async function cleanupZeroBalanceBots() {
  console.log('=== CLEANING UP BOTS WITH ZERO BALANCE ===\n');

  // 1. Get all bots in exiting status
  const exitingBots = await db.collection('dcaBots')
    .where('status', '==', 'exiting')
    .get();

  console.log(`Found ${exitingBots.size} bots in exiting status\n`);

  for (const botDoc of exitingBots.docs) {
    const bot = botDoc.data();
    console.log(`\nBot: ${bot.symbol} (${botDoc.id})`);

    // 2. Find and delete pending sell orders for this bot
    const ordersSnapshot = await db.collection('pendingOrders')
      .where('botId', '==', botDoc.id)
      .where('side', '==', 'sell')
      .get();

    console.log(`  Found ${ordersSnapshot.size} pending sell orders`);

    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      console.log(`    Deleting order: ${order.pair} (${order.status})`);
      await orderDoc.ref.delete();
    }

    // 3. Mark bot as completed (will be checked by processDCABots next run)
    console.log(`  Marking bot as completed`);
    await db.collection('dcaBots').doc(botDoc.id).update({
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });
  }

  console.log('\n=== CLEANUP COMPLETE ===');
  console.log('All bots marked as completed and their orders deleted.');
  console.log('The updated processDCABots function will handle this automatically in the future.');

  process.exit(0);
}

cleanupZeroBalanceBots().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
