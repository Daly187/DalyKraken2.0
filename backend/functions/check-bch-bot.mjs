import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function checkBCHBot() {
  console.log('=== CHECKING BCH BOT ===\n');

  const bots = await db.collection('dcaBots')
    .where('symbol', '==', 'BCH/USD')
    .get();

  if (bots.empty) {
    console.log('No BCH/USD bot found');
    process.exit(1);
  }

  const bot = bots.docs[0].data();
  const botId = bots.docs[0].id;

  console.log('Bot ID:', botId);
  console.log('Status:', bot.status);
  console.log('Symbol:', bot.symbol);
  console.log('Tech Score:', bot.techScore);
  console.log('Trend Score:', bot.trendScore);
  console.log('Exit Percentage:', bot.exitPercentage || 'NOT SET');
  console.log('Created:', bot.createdAt);
  console.log('Updated:', bot.updatedAt);
  console.log('\nCurrent Entry Count:', bot.currentEntryCount || 0);
  console.log('Max Entries:', bot.maxEntries);

  const orders = await db.collection('pendingOrders')
    .where('pair', '==', 'BCH/USD')
    .where('side', '==', 'sell')
    .get();

  console.log('\n=== PENDING SELL ORDERS ===');
  console.log('Found', orders.size, 'BCH sell order(s)');

  orders.docs.forEach(doc => {
    const order = doc.data();
    console.log('\nOrder ID:', doc.id);
    console.log('  Status:', order.status);
    console.log('  Volume:', order.volume, 'BCH');
    console.log('  Amount:', order.amount);
    console.log('  Created:', order.createdAt);
  });

  process.exit(0);
}

checkBCHBot().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
