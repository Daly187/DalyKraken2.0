/**
 * Show all audit trail entries to understand the structure
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function showAuditEntries() {
  console.log('=== All Audit Trail Entries ===\n');

  try {
    // Get all recent audit entries
    const auditSnapshot = await db
      .collection('auditLog')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    console.log(`Found ${auditSnapshot.size} audit entries\n`);

    for (const doc of auditSnapshot.docs) {
      const audit = doc.data();
      console.log(`\n--- ${doc.id} ---`);
      console.log(JSON.stringify(audit, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
showAuditEntries()
  .then(() => {
    console.log('\n\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
