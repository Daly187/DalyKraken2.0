import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function cleanupTestBot() {
  const botId = process.argv[2];

  if (!botId) {
    console.log('Usage: node cleanup-test-bot.mjs <botId>');
    process.exit(1);
  }

  console.log(`\nCleaning up test bot: ${botId}\n`);

  // Delete pending orders for this bot
  const ordersSnapshot = await db.collection('pendingOrders')
    .where('botId', '==', botId)
    .get();

  console.log(`Found ${ordersSnapshot.size} pending order(s)`);

  for (const doc of ordersSnapshot.docs) {
    await doc.ref.delete();
    console.log(`✅ Deleted pending order: ${doc.id}`);
  }

  // Delete the bot
  const botDoc = await db.collection('dcaBots').doc(botId).get();
  if (botDoc.exists) {
    await botDoc.ref.delete();
    console.log(`✅ Deleted bot: ${botId}`);
  } else {
    console.log(`⚠️  Bot not found: ${botId}`);
  }

  console.log('\nCleanup complete!\n');
  process.exit(0);
}

cleanupTestBot().catch(console.error);
