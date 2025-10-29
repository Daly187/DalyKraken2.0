import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkMarketData() {
  // Get BCH market data
  const marketSnapshot = await db.collection('marketData').where('symbol', '==', 'BCH/USD').get();

  console.log('\n=== BCH Market Data ===');
  if (marketSnapshot.empty) {
    console.log('  ❌ No market data found for BCH/USD');
  } else {
    marketSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  ID: ${doc.id}`);
      console.log(`  Price: ${data.price}`);
      console.log(`  Recommendation: ${data.recommendation}`);
      console.log(`  Tech Score: ${data.technicalScore}`);
      console.log(`  Trend Score: ${data.trendScore}`);
      console.log(`  Updated: ${data.updatedAt}`);
    });
  }

  process.exit(0);
}

checkMarketData().catch(console.error);
