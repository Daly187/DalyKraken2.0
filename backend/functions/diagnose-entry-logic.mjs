import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

function calculateNextStepPercent(entryNumber, baseStepPercent, stepMultiplier) {
  if (entryNumber === 0) return baseStepPercent;
  return baseStepPercent * Math.pow(stepMultiplier, entryNumber);
}

async function diagnoseEntryLogic() {
  console.log('=== DIAGNOSING ENTRY LOGIC ISSUE ===\n');

  // Pick a bot with existing entries (DOT/USD)
  const botId = '0Gk6JcExh8hDYgJa3rhB'; // DOT/USD
  const botDoc = await db.collection('dcaBots').doc(botId).get();
  const bot = botDoc.data();

  console.log(`Bot: ${bot.symbol}`);
  console.log(`Step %: ${bot.stepPercent}%`);
  console.log(`Step Multiplier: ${bot.stepMultiplier}x`);
  console.log('');

  // Get filled entries
  const entriesSnapshot = await db.collection('dcaBots')
    .doc(botId)
    .collection('entries')
    .where('status', '==', 'filled')
    .orderBy('timestamp', 'desc')
    .get();

  const filledEntries = [];
  entriesSnapshot.docs.forEach(doc => {
    const entry = doc.data();
    filledEntries.push(entry);
  });

  console.log(`Filled Entries: ${filledEntries.length}`);
  filledEntries.forEach((entry, i) => {
    console.log(`  Entry ${i + 1}: Price=$${entry.price.toFixed(2)}, Qty=${entry.quantity.toFixed(8)}, Date=${new Date(entry.timestamp).toLocaleString()}`);
  });
  console.log('');

  // Simulate current price
  const currentPrice = 6.50; // Example current DOT price
  const lastEntryPrice = filledEntries[0].price;

  console.log(`Current Price: $${currentPrice.toFixed(2)}`);
  console.log(`Last Entry Price: $${lastEntryPrice.toFixed(2)}`);
  console.log('');

  // Calculate next step percent
  const nextStepPercent = calculateNextStepPercent(
    filledEntries.length,
    bot.stepPercent,
    bot.stepMultiplier
  );

  console.log('=== CURRENT (BROKEN) LOGIC ===');
  console.log(`Next step %: ${nextStepPercent.toFixed(2)}%`);

  // CURRENT (BROKEN) - calculates from current price
  const nextEntryPriceBroken = currentPrice * (1 - nextStepPercent / 100);
  console.log(`Next Entry Price (from CURRENT): $${nextEntryPriceBroken.toFixed(2)}`);
  console.log(`Would enter when price drops to: $${nextEntryPriceBroken.toFixed(2)}`);
  console.log(`Drop needed from current: ${((currentPrice - nextEntryPriceBroken) / currentPrice * 100).toFixed(2)}%`);
  console.log(`Current price > target? ${currentPrice > nextEntryPriceBroken ? 'YES - BLOCKED ❌' : 'NO - ALLOWED ✅'}`);
  console.log('');

  console.log('=== CORRECT LOGIC (from last entry) ===');

  // CORRECT - should calculate from last entry price
  const nextEntryPriceCorrect = lastEntryPrice * (1 - nextStepPercent / 100);
  console.log(`Next Entry Price (from LAST ENTRY): $${nextEntryPriceCorrect.toFixed(2)}`);
  console.log(`Would enter when price drops to: $${nextEntryPriceCorrect.toFixed(2)}`);
  console.log(`Drop needed from last entry: ${((lastEntryPrice - nextEntryPriceCorrect) / lastEntryPrice * 100).toFixed(2)}%`);
  console.log(`Current price > target? ${currentPrice > nextEntryPriceCorrect ? 'YES - BLOCKED ❌' : 'NO - ALLOWED ✅'}`);
  console.log('');

  console.log('=== COMPARISON ===');
  console.log(`Price difference: $${Math.abs(nextEntryPriceBroken - nextEntryPriceCorrect).toFixed(2)}`);
  console.log('');

  if (currentPrice > nextEntryPriceBroken && currentPrice <= nextEntryPriceCorrect) {
    console.log('🔴 PROBLEM IDENTIFIED:');
    console.log('   Current logic blocks entry, but correct logic would allow it!');
    console.log('   The bot SHOULD be entering but is being blocked by the broken logic.');
  } else if (currentPrice > nextEntryPriceBroken && currentPrice > nextEntryPriceCorrect) {
    console.log('⚠️  Both logics block entry - price needs to drop more.');
  } else {
    console.log('✅ Both logics allow entry - bot should be creating a pending order.');
  }

  process.exit(0);
}

diagnoseEntryLogic().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
