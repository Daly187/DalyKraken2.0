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

async function checkBCHHoldings() {
  const botDoc = await db.collection('dcaBots').doc('3x7ZYcJcDGemb8kePQqz').get();
  const bot = botDoc.data();
  
  console.log('=== BCH BOT HOLDINGS ===');
  console.log('Bot ID:', '3x7ZYcJcDGemb8kePQqz');
  console.log('Symbol:', bot.symbol);
  console.log('Current Entry Count:', bot.currentEntryCount);
  console.log('Exit Percentage:', bot.exitPercentage || 90);
  
  // Get entries
  const entries = await db.collection('dcaBots')
    .doc('3x7ZYcJcDGemb8kePQqz')
    .collection('entries')
    .get();
  
  console.log('\n=== ENTRIES ===');
  let totalFilledQty = 0;
  entries.docs.forEach(doc => {
    const entry = doc.data();
    console.log(`Entry ${entry.entryNumber}: status=${entry.status}, qty=${entry.quantity}`);
    if (entry.status === 'filled') {
      totalFilledQty += entry.quantity;
    }
  });
  
  console.log('\n=== CALCULATION ===');
  console.log('Total filled quantity:', totalFilledQty);
  console.log('Exit percentage:', bot.exitPercentage || 90, '%');
  console.log('Expected sell volume (90%):', totalFilledQty * 0.9);
  console.log('\n=== PENDING ORDER ===');
  console.log('Actual volume in pending order:', 0.05578732);
  console.log('Difference:', Math.abs(totalFilledQty * 0.9 - 0.05578732));
  
  process.exit(0);
}

checkBCHHoldings().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
