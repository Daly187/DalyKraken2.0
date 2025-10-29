import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkPendingOrders() {
  console.log('Checking pending orders in Firestore...\n');

  // Check all pending orders
  const ordersSnapshot = await db.collection('pendingOrders').get();

  if (ordersSnapshot.empty) {
    console.log('❌ No documents found in pendingOrders collection!');
    console.log('This collection might not exist yet.\n');
  } else {
    console.log(`✅ Found ${ordersSnapshot.size} documents in pendingOrders collection:\n`);

    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      console.log(`Order ID: ${doc.id}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Bot ID: ${order.botId}`);
      console.log(`  Pair: ${order.pair}`);
      console.log(`  Side: ${order.side}`);
      console.log(`  Volume: ${order.volume}`);
      console.log(`  Created: ${order.createdAt}`);
      console.log('');
    });
  }

  // Check active bots
  const botsSnapshot = await db.collection('dcaBots')
    .where('status', '==', 'active')
    .get();

  console.log(`\nFound ${botsSnapshot.size} active DCA bots:\n`);

  botsSnapshot.forEach(doc => {
    const bot = doc.data();
    console.log(`Bot ID: ${doc.id}`);
    console.log(`  Symbol: ${bot.symbol}`);
    console.log(`  Status: ${bot.status}`);
    console.log(`  Entry Count: ${bot.currentEntryCount || 0}/${bot.reEntryCount}`);
    console.log('');
  });

  process.exit(0);
}

checkPendingOrders().catch(console.error);
