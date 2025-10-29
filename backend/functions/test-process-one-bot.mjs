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

async function testProcessBot() {
  console.log('Testing bot processing for ADA bot...\n');

  // Get the ADA bot
  const botId = 'iyqwj2mymkaiFMlPKl2D'; // ADA bot from your list
  const botDoc = await db.collection('dcaBots').doc(botId).get();

  if (!botDoc.exists) {
    console.log('Bot not found!');
    process.exit(1);
  }

  const bot = { id: botDoc.id, ...botDoc.data() };

  console.log('Bot Data:');
  console.log(`  ID: ${bot.id}`);
  console.log(`  Symbol: ${bot.symbol}`);
  console.log(`  Status: ${bot.status}`);
  console.log(`  Entry Count: ${bot.currentEntryCount}`);
  console.log(`  Avg Purchase Price: ${bot.averagePurchasePrice}`);
  console.log(`  TP Target: ${bot.tpTarget}%`);
  console.log(`  Current TP Price (stored): ${bot.currentTpPrice || 'NOT SET'}`);
  console.log('');

  // Calculate what currentTpPrice should be
  if (bot.averagePurchasePrice) {
    const calculatedTpPrice = bot.averagePurchasePrice * (1 + bot.tpTarget / 100);
    console.log(`  Calculated TP Price: ${calculatedTpPrice}`);
    console.log('');
  }

  // Get user's API keys
  const userDoc = await db.collection('users').doc(bot.userId).get();
  const userData = userDoc.data();

  if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
    console.log('No Kraken keys found for user');
    process.exit(1);
  }

  const activeKey = userData.krakenKeys.find(k => k.isActive);
  if (!activeKey) {
    console.log('No active Kraken key');
    process.exit(1);
  }

  console.log('User has active Kraken keys ✅\n');

  // Check conditions for exit
  console.log('Exit conditions:');
  console.log(`  1. Has entries: ${bot.currentEntryCount > 0 ? 'YES' : 'NO'}`);
  console.log(`  2. Has currentTpPrice: ${bot.currentTpPrice ? 'YES' : 'NO'}`);

  if (bot.currentEntryCount > 0 && !bot.currentTpPrice) {
    console.log('\n⚠️  PROBLEM: Bot has entries but NO currentTpPrice set!');
    console.log('  This means exit check is being SKIPPED even if price qualifies');
  }

  process.exit(0);
}

testProcessBot().catch(console.error);
