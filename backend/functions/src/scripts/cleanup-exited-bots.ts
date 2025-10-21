/**
 * Cleanup script to delete entries from bots that have exited
 * Run this to fix bots that exited before the entry deletion fix was deployed
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (error) {
  // Already initialized
}

const db = admin.firestore();

async function cleanupExitedBots() {
  try {
    console.log('\n=== Cleaning up exited bots ===\n');

    // Find all active bots that have totalInvested = 0 but have entries
    const botsSnapshot = await db.collection('dcaBots')
      .where('status', '==', 'active')
      .where('totalInvested', '==', 0)
      .where('currentEntryCount', '==', 0)
      .get();

    console.log(`Found ${botsSnapshot.size} bots with status=active, totalInvested=0, currentEntryCount=0`);

    if (botsSnapshot.empty) {
      console.log('✅ No bots need cleanup!');
      return;
    }

    for (const botDoc of botsSnapshot.docs) {
      const botData = botDoc.data();
      const botId = botDoc.id;
      const symbol = botData.symbol;

      console.log(`\n📊 Checking bot: ${symbol} (${botId})`);

      // Check if this bot has entries
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(botId)
        .collection('entries')
        .get();

      if (entriesSnapshot.size === 0) {
        console.log(`  ✅ No entries to clean up`);
        continue;
      }

      console.log(`  ⚠️  Found ${entriesSnapshot.size} stale entries that should have been deleted`);
      console.log(`  🗑️  Deleting entries...`);

      // Delete all entries in a batch
      const batch = db.batch();
      entriesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        console.log(`     - Deleting entry: ${doc.id}`);
      });

      await batch.commit();
      console.log(`  ✅ Successfully deleted ${entriesSnapshot.size} entries for ${symbol}`);
    }

    console.log('\n✅ Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

cleanupExitedBots();
