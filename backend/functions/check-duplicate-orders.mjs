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

async function checkDuplicateOrders() {
  console.log('\n=== Checking for Duplicate Orders by Bot ===\n');

  const snapshot = await db.collection('pendingOrders')
    .where('status', 'in', ['pending', 'processing', 'retry'])
    .get();

  console.log('Total active pending orders:', snapshot.size);

  const botOrders = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    const botId = data.botId || 'unknown';
    if (!botOrders[botId]) {
      botOrders[botId] = [];
    }
    botOrders[botId].push({
      id: doc.id,
      status: data.status,
      side: data.side,
      volume: data.volume,
      pair: data.pair,
      createdAt: data.createdAt
    });
  });

  console.log('\nOrders grouped by bot:');
  for (const [botId, orders] of Object.entries(botOrders)) {
    const botDisplay = botId.length > 20 ? botId.substring(0, 20) + '...' : botId;
    console.log(`\nBot ${botDisplay}: ${orders.length} order(s)`);
    orders.forEach(o => {
      const idDisplay = o.id.substring(0, 15) + '...';
      const volDisplay = typeof o.volume === 'string' ? o.volume.substring(0, 10) : o.volume;
      console.log(`  - ${idDisplay} | ${o.status.padEnd(10)} | ${o.side.padEnd(4)} | ${o.pair.padEnd(10)} | ${volDisplay}`);
    });
  }

  // Find bots with duplicates
  const duplicates = Object.entries(botOrders).filter(([_, orders]) => orders.length > 1);
  if (duplicates.length > 0) {
    console.log('\n⚠️  BOTS WITH DUPLICATE ORDERS:');
    duplicates.forEach(([botId, orders]) => {
      console.log(`  Bot ${botId}: ${orders.length} duplicate orders`);
    });
  } else {
    console.log('\n✅ No bots with duplicate pending orders');
  }
}

checkDuplicateOrders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
