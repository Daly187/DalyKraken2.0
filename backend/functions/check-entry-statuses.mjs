import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkEntryStatuses() {
  console.log('=== Checking Entry Statuses ===\n');

  const botsSnapshot = await db.collection('dcaBots').limit(5).get();

  for (const botDoc of botsSnapshot.docs) {
    const bot = botDoc.data();
    const botId = botDoc.id;

    console.log(`Bot: ${bot.symbol} (${botId})`);

    const entriesSnapshot = await db
      .collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .limit(3)
      .get();

    if (entriesSnapshot.empty) {
      console.log('  No entries\n');
      continue;
    }

    entriesSnapshot.forEach(entryDoc => {
      const entry = entryDoc.data();
      console.log(`  Entry: status="${entry.status}", orderAmount=${entry.orderAmount}, quantity=${entry.quantity}, price=${entry.price}`);
    });

    console.log('');
  }
}

checkEntryStatuses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
