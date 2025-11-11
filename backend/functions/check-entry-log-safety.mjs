import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkEntryLogSafety() {
  console.log('🔍 Checking Entry Log Safety Mechanisms...\n');

  // Get all orders
  const snapshot = await db.collection('pendingOrders').get();

  const stats = {
    total: 0,
    blocked: 0,
    valid: 0,
    failed: 0,
    pending: 0,
    retry: 0,
    processing: 0,
    completed: 0,
  };

  const blockedOrders = [];
  const validOrders = [];

  snapshot.forEach(doc => {
    const order = doc.data();
    stats.total++;
    stats[order.status]++;

    if (order.entryConditionsMet === false) {
      stats.blocked++;
      blockedOrders.push({
        id: doc.id,
        status: order.status,
        reason: order.blockedReason || order.reason,
        pair: order.pair,
        created: order.createdAt,
      });
    } else {
      stats.valid++;
      validOrders.push({
        id: doc.id,
        status: order.status,
        pair: order.pair,
        created: order.createdAt,
      });
    }
  });

  console.log('📊 Order Statistics:');
  console.log(`   Total Orders: ${stats.total}`);
  console.log(`   ✅ Valid Orders (can execute): ${stats.valid}`);
  console.log(`   🚫 Blocked Orders (audit only): ${stats.blocked}`);
  console.log('');
  console.log('📈 Status Breakdown:');
  console.log(`   PENDING: ${stats.pending || 0}`);
  console.log(`   PROCESSING: ${stats.processing || 0}`);
  console.log(`   RETRY: ${stats.retry || 0}`);
  console.log(`   COMPLETED: ${stats.completed || 0}`);
  console.log(`   FAILED: ${stats.failed || 0}`);
  console.log('');

  if (blockedOrders.length > 0) {
    console.log(`🚫 Blocked Orders (${blockedOrders.length}):`);
    blockedOrders.slice(0, 5).forEach(order => {
      console.log(`   ${order.pair} - ${order.status.toUpperCase()} - ${order.reason?.substring(0, 60)}`);
    });
    if (blockedOrders.length > 5) {
      console.log(`   ... and ${blockedOrders.length - 5} more`);
    }
    console.log('');
  }

  // Check for dangerous combinations
  const dangerous = blockedOrders.filter(o =>
    o.status === 'pending' || o.status === 'retry' || o.status === 'processing'
  );

  if (dangerous.length > 0) {
    console.log('⚠️  WARNING: Found blocked orders that might be picked up for execution:');
    dangerous.forEach(order => {
      console.log(`   ${order.id} - ${order.status.toUpperCase()} - ${order.reason}`);
    });
    console.log('   These should have status="failed" to prevent execution!');
  } else {
    console.log('✅ SAFETY CHECK PASSED: No blocked orders in executable statuses');
  }
}

checkEntryLogSafety()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
