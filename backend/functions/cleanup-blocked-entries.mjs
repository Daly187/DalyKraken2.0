import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupBlockedEntries() {
  console.log('🧹 Cleaning up blocked entries from pendingOrders...\n');

  // Get all orders where entryConditionsMet === false
  const snapshot = await db
    .collection('pendingOrders')
    .where('status', '==', 'failed')
    .get();

  console.log(`Found ${snapshot.size} FAILED orders`);

  // Check which ones are blocked entries (have entryConditionsMet field)
  let blockedCount = 0;
  let validFailedCount = 0;
  const blockedOrderIds = [];
  const batch = db.batch();

  snapshot.forEach(doc => {
    const order = doc.data();

    // If it has entryConditionsMet === false, it's a blocked entry (audit log)
    if (order.entryConditionsMet === false) {
      blockedCount++;
      blockedOrderIds.push(doc.id);
      batch.delete(doc.ref);
    } else {
      // Real failed order (met requirements but execution failed)
      validFailedCount++;
    }
  });

  console.log(`\n📊 Analysis:`);
  console.log(`   Blocked entries (audit logs): ${blockedCount}`);
  console.log(`   Valid failed orders: ${validFailedCount}`);

  if (blockedCount === 0) {
    console.log('\n✅ No blocked entries to clean up!');
    return;
  }

  console.log(`\n🗑️  Deleting ${blockedCount} blocked entries...`);

  try {
    await batch.commit();
    console.log(`✅ Successfully deleted ${blockedCount} blocked entries`);
    console.log(`✅ Kept ${validFailedCount} valid failed orders`);
  } catch (error) {
    console.error('❌ Error deleting entries:', error);
  }
}

cleanupBlockedEntries()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
