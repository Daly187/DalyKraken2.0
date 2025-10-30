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

async function testBCHVolumeCalculation() {
  console.log('=== BCH VOLUME CALCULATION TEST ===\n');

  // Get BCH bot
  const botDoc = await db.collection('dcaBots').doc('3x7ZYcJcDGemb8kePQqz').get();
  const bot = botDoc.data();

  console.log('BCH Bot Info:');
  console.log('  Symbol:', bot.symbol);
  console.log('  Status:', bot.status);
  console.log('  Exit Percentage:', bot.exitPercentage || 90, '%');

  // Get filled entries (OLD APPROACH - what was being used)
  const entries = await db.collection('dcaBots')
    .doc('3x7ZYcJcDGemb8kePQqz')
    .collection('entries')
    .get();

  let totalFilledQty = 0;
  entries.docs.forEach(doc => {
    const entry = doc.data();
    if (entry.status === 'filled') {
      totalFilledQty += entry.quantity;
    }
  });

  console.log('\n=== OLD CALCULATION (from filled entries) ===');
  console.log('Total filled quantity:', totalFilledQty, 'BCH');
  console.log('90% of filled entries:', (totalFilledQty * 0.9).toFixed(8), 'BCH');

  // NEW APPROACH - actual Kraken balance (what portfolio shows)
  // Simulating the Kraken balance API response
  const actualKrakenBalance = 0.041292; // This is what portfolio shows

  console.log('\n=== NEW CALCULATION (from Kraken balance) ===');
  console.log('Actual Kraken balance:', actualKrakenBalance, 'BCH');
  console.log('90% of Kraken balance:', (actualKrakenBalance * 0.9).toFixed(8), 'BCH');

  console.log('\n=== COMPARISON ===');
  console.log('Difference:', (totalFilledQty - actualKrakenBalance).toFixed(8), 'BCH');
  console.log('');
  console.log('✅ OLD (incorrect): Pending order would be created with', (totalFilledQty * 0.9).toFixed(8), 'BCH');
  console.log('✅ NEW (correct):   Pending order will be created with', (actualKrakenBalance * 0.9).toFixed(8), 'BCH');

  process.exit(0);
}

testBCHVolumeCalculation().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
