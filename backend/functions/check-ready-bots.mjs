import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function checkReadyBots() {
  console.log('=== CHECKING BOTS READY TO RE-ENTER ===\n');

  // Get all bots
  const botsSnapshot = await db.collection('dcaBots').get();

  console.log(`Found ${botsSnapshot.docs.length} active bots\n`);

  for (const botDoc of botsSnapshot.docs) {
    const bot = botDoc.data();
    const botId = botDoc.id;

    // Get filled entries
    const entriesSnapshot = await db.collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .where('status', '==', 'filled')
      .get();

    const filledCount = entriesSnapshot.docs.length;
    const maxEntries = bot.reEntryCount || 5;

    console.log(`Bot: ${bot.symbol} (${botId})`);
    console.log(`  Status: ${bot.status}`);
    console.log(`  Filled Entries: ${filledCount}/${maxEntries}`);
    console.log(`  Trend Alignment: ${bot.trendAlignmentEnabled ? 'ON' : 'OFF'}`);
    console.log(`  Support/Resistance: ${bot.supportResistanceEnabled ? 'ON' : 'OFF'}`);

    if (bot.lastEntryTime) {
      const lastEntryTime = new Date(bot.lastEntryTime).getTime();
      const timeSinceLastEntry = Date.now() - lastEntryTime;
      const delayMs = (bot.reEntryDelay || 5) * 60 * 1000;
      const minutesSince = Math.round(timeSinceLastEntry / 60000);
      const minutesRequired = bot.reEntryDelay || 5;

      console.log(`  Last Entry: ${minutesSince} minutes ago (delay: ${minutesRequired} minutes)`);
      console.log(`  Delay Met: ${timeSinceLastEntry >= delayMs ? '✅ YES' : '❌ NO'}`);
    }

    // Check for pending orders
    const pendingOrders = await db.collection('pendingOrders')
      .where('botId', '==', botId)
      .where('status', '==', 'pending')
      .get();

    console.log(`  Pending Orders: ${pendingOrders.docs.length}`);

    if (pendingOrders.docs.length > 0) {
      console.log(`  ⚠️  Has pending orders - will skip`);
    } else if (filledCount >= maxEntries) {
      console.log(`  ⚠️  Max entries reached`);
    } else {
      console.log(`  ✅ Ready for re-entry (if price/trend conditions met)`);
    }

    console.log('');
  }

  process.exit(0);
}

checkReadyBots().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
