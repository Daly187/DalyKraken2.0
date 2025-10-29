import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkDetail() {
  // Get BCH bot
  const botsSnapshot = await db.collection('dcaBots').where('symbol', '==', 'BCH/USD').get();

  if (botsSnapshot.empty) {
    console.log('No BCH bot found');
    process.exit(1);
  }

  const botDoc = botsSnapshot.docs[0];
  const bot = botDoc.data();

  console.log('\n=== BCH Bot Details ===');
  console.log(`ID: ${botDoc.id}`);
  console.log(`Status: ${bot.status}`);
  console.log(`Symbol: ${bot.symbol}`);
  console.log(`\nPositions:`);
  console.log(`  Current Entries: ${bot.currentEntryCount}`);
  console.log(`  Max Entries: ${bot.maxEntries}`);
  console.log(`  Average Purchase Price: $${bot.averagePurchasePrice || 'N/A'}`);
  console.log(`  Total Invested: $${bot.totalInvested || 'N/A'}`);
  console.log(`  Total Quantity: ${bot.totalQuantity || 'N/A'} BCH`);
  console.log(`\nTarget Prices:`);
  console.log(`  TP Target (%): ${bot.tpTarget || 'N/A'}%`);
  console.log(`  Current TP Price: $${bot.currentTpPrice || 'N/A'}`);
  console.log(`  Min TP Price: $${bot.minTpPrice || 'N/A'}`);
  console.log(`\nMarket Analysis:`);
  console.log(`  Tech Score: ${bot.techScore || 'N/A'}`);
  console.log(`  Trend Score: ${bot.trendScore || 'N/A'}`);
  console.log(`  Recommendation: ${bot.recommendation || 'N/A'}`);
  console.log(`\nExit Settings:`);
  console.log(`  Exit Percentage: ${bot.exitPercentage || 90}%`);
  console.log(`\nOther:`);
  console.log(`  Updated At: ${bot.updatedAt}`);

  process.exit(0);
}

checkDetail().catch(console.error);
