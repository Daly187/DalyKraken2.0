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

async function resetCircuitBreakerAndOrders() {
  console.log('=== RESETTING CIRCUIT BREAKER AND ORDERS ===\n');

  // 1. Clear circuit breaker state
  console.log('1. Clearing circuit breaker state...');
  const circuitBreakerDocs = await db.collection('circuitBreaker').get();
  console.log(`   Found ${circuitBreakerDocs.size} circuit breaker entries`);

  for (const doc of circuitBreakerDocs.docs) {
    await doc.ref.delete();
    console.log(`   Deleted circuit breaker entry: ${doc.id}`);
  }

  // 2. Reset all failed sell orders to pending
  console.log('\n2. Resetting failed sell orders...');
  const failedOrders = await db.collection('pendingOrders')
    .where('side', '==', 'sell')
    .where('status', '==', 'failed')
    .get();

  console.log(`   Found ${failedOrders.size} failed sell orders`);

  for (const doc of failedOrders.docs) {
    const order = doc.data();
    console.log(`   Resetting ${order.pair} (${doc.id})`);

    await db.collection('pendingOrders').doc(doc.id).update({
      status: 'pending',
      attempts: 0,
      lastError: null,
      failedApiKeys: [],
      nextRetryAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  console.log('\n=== RESET COMPLETE ===');
  console.log('All circuit breakers cleared and orders ready to retry.');

  process.exit(0);
}

resetCircuitBreakerAndOrders().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
