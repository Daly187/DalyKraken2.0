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

async function checkADABot() {
  // Get the ADA order
  const orders = await db.collection('pendingOrders')
    .where('pair', '==', 'ADA/USD')
    .where('side', '==', 'sell')
    .get();

  if (orders.empty) {
    console.log('No ADA sell order found');
    process.exit(0);
  }

  const orderData = orders.docs[0].data();
  console.log('=== ADA SELL ORDER ===');
  console.log('Volume:', orderData.volume);
  console.log('Amount:', orderData.amount);
  console.log('Bot ID:', orderData.botId);

  // Get the bot
  const bot = await db.collection('dcaBots').doc(orderData.botId).get();
  const botData = bot.data();
  console.log('\n=== ADA BOT ===');
  console.log('Symbol:', botData.symbol);
  console.log('Status:', botData.status);

  // Get entries from the CORRECT subcollection
  const entries = await db.collection('dcaBots')
    .doc(orderData.botId)
    .collection('entries')
    .get();

  console.log('\n=== ADA BOT ENTRIES (from subcollection) ===');
  let totalFilledQty = 0;
  let filledCount = 0;

  entries.docs.forEach(doc => {
    const entry = doc.data();
    console.log(`Entry ${entry.entryNumber}: qty=${entry.quantity}, price=$${entry.price}, status=${entry.status}`);

    if (entry.status === 'filled') {
      totalFilledQty += entry.quantity;
      filledCount++;
    }
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Total entries: ${entries.size}`);
  console.log(`Filled entries: ${filledCount}`);
  console.log(`Total filled quantity: ${totalFilledQty.toFixed(8)}`);
  console.log(`Order volume: ${orderData.volume}`);
  console.log(`Difference: ${(parseFloat(orderData.volume) - totalFilledQty).toFixed(8)}`);
  console.log(`\nExpected sell volume (90%): ${(totalFilledQty * 0.9).toFixed(8)}`);

  process.exit(0);
}

checkADABot().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
