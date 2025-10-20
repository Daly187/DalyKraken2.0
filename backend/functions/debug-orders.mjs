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
  console.log('\n=== Checking Pending Orders ===\n');

  const snapshot = await db.collection('pendingOrders').get();

  if (snapshot.empty) {
    console.log('No pending orders found!');
    return;
  }

  console.log(`Found ${snapshot.size} total pending orders:\n`);

  const statusCounts = {};
  snapshot.forEach((doc) => {
    const order = doc.data();
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

    console.log(`Order ${doc.id}:`);
    console.log(`  Pair: ${order.pair}`);
    console.log(`  Side: ${order.side}`);
    console.log(`  Volume: ${order.volume}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Attempts: ${order.attempts}/${order.maxAttempts}`);
    console.log(`  Created: ${order.createdAt}`);
    console.log(`  Updated: ${order.updatedAt}`);
    if (order.lastError) {
      console.log(`  Last Error: ${order.lastError}`);
    }
    console.log('');
  });

  console.log('\n=== Status Summary ===');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`${status}: ${count}`);
  });
}

checkPendingOrders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
