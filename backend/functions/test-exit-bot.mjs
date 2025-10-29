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

async function testExitLogic() {
  console.log('Testing exit logic for DCA bots...\n');

  // Get all active bots
  const botsSnapshot = await db.collection('dcaBots')
    .where('status', '==', 'active')
    .get();

  console.log(`Found ${botsSnapshot.size} active bots\n`);

  for (const doc of botsSnapshot.docs) {
    const bot = { id: doc.id, ...doc.data() };

    console.log(`Bot: ${bot.id} (${bot.symbol})`);
    console.log(`  Current Entries: ${bot.currentEntryCount || 0}`);
    console.log(`  Has TP Price: ${bot.currentTpPrice ? 'Yes' : 'No'}`);
    console.log(`  TP Target: ${bot.tpTarget}%`);
    console.log(`  Current Price: ${bot.currentPrice || 'N/A'}`);
    console.log(`  Avg Purchase Price: ${bot.averagePurchasePrice || 'N/A'}`);

    if (bot.currentEntryCount > 0 && bot.currentTpPrice && bot.currentPrice) {
      const priceAboveTP = bot.currentPrice >= bot.currentTpPrice;
      const gain = ((bot.currentPrice - bot.averagePurchasePrice) / bot.averagePurchasePrice) * 100;

      console.log(`  Price above TP: ${priceAboveTP ? 'YES' : 'NO'}`);
      console.log(`  Current gain: ${gain.toFixed(2)}%`);

      if (priceAboveTP) {
        console.log(`  ✅ QUALIFIES FOR EXIT!`);
      }
    }

    console.log('');
  }

  // Check if pendingOrders collection exists and has any docs
  const ordersSnapshot = await db.collection('pendingOrders').limit(1).get();

  if (ordersSnapshot.empty) {
    console.log('❌ pendingOrders collection is empty or does not exist');
  } else {
    console.log(`✅ pendingOrders collection exists with ${ordersSnapshot.size}+ documents`);
  }

  process.exit(0);
}

testExitLogic().catch(console.error);
