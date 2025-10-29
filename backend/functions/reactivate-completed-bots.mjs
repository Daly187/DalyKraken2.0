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

async function reactivateCompletedBots() {
  console.log('Finding completed bots to reactivate...\n');

  // Get all completed bots
  const botsSnapshot = await db.collection('dcaBots')
    .where('status', '==', 'completed')
    .get();

  console.log(`Found ${botsSnapshot.size} completed bots\n`);

  const batch = db.batch();
  let count = 0;

  for (const doc of botsSnapshot.docs) {
    const bot = { id: doc.id, ...doc.data() };

    // Only reactivate if they have entries (positions)
    if (bot.currentEntryCount > 0) {
      console.log(`Reactivating: ${bot.id} (${bot.symbol}) - ${bot.currentEntryCount} entries`);

      batch.update(doc.ref, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      });

      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`\n✅ Reactivated ${count} bots`);
  } else {
    console.log('\n No bots to reactivate');
  }

  process.exit(0);
}

reactivateCompletedBots().catch(console.error);
