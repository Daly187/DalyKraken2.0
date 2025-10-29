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

async function checkADAEntriesDetail() {
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
  const botId = orderData.botId;

  console.log('=== CHECKING ADA BOT ENTRIES IN DETAIL ===\n');

  // Get all entries with full details
  const entries = await db.collection('dcaBots')
    .doc(botId)
    .collection('entries')
    .get();

  console.log(`Found ${entries.size} total entries:\n`);

  entries.docs.forEach((doc, index) => {
    const entry = doc.data();
    console.log(`Entry ${index + 1} (Document ID: ${doc.id}):`);
    console.log(`  Entry Number: ${entry.entryNumber}`);
    console.log(`  Quantity: ${entry.quantity}`);
    console.log(`  Price: $${entry.price}`);
    console.log(`  Status: ${entry.status}`);
    console.log(`  Created: ${entry.createdAt || 'N/A'}`);
    console.log(`  Updated: ${entry.updatedAt || 'N/A'}`);
    console.log(`  Order ID: ${entry.orderId || 'N/A'}`);
    console.log('');
  });

  // Check for duplicates
  const filledEntries = entries.docs.filter(d => d.data().status === 'filled');
  console.log(`\n=== DUPLICATE CHECK ===`);
  console.log(`Filled entries count: ${filledEntries.length}`);

  if (filledEntries.length > 1) {
    console.log(`⚠️  WARNING: Multiple filled entries detected!`);
    console.log(`These should probably be consolidated or one should be removed.`);
  }

  process.exit(0);
}

checkADAEntriesDetail().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
