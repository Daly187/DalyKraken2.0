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
  // Get all market data
  const marketSnapshot = await db.collection('marketData').get();

  console.log(`\n=== All Market Data (${marketSnapshot.size} entries) ===`);
  marketSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\n  ${data.symbol}:`);
    console.log(`    Price: ${data.price}`);
    console.log(`    Recommendation: ${data.recommendation}`);
    console.log(`    Tech Score: ${data.technicalScore}`);
    console.log(`    Trend Score: ${data.trendScore}`);
    console.log(`    Updated: ${data.updatedAt}`);
  });

  // Get all active bots
  const botsSnapshot = await db.collection('dcaBots').where('status', '==', 'active').get();
  console.log(`\n=== Active Bots (${botsSnapshot.size}) ===`);
  const botSymbols = [];
  botsSnapshot.forEach(doc => {
    const bot = doc.data();
    botSymbols.push(bot.symbol);
    console.log(`  ${bot.symbol}`);
  });

  console.log('\n=== Missing Market Data ===');
  const marketDataSymbols = [];
  marketSnapshot.forEach(doc => marketDataSymbols.push(doc.data().symbol));

  botSymbols.forEach(symbol => {
    if (!marketDataSymbols.includes(symbol)) {
      console.log(`  ❌ ${symbol}`);
    }
  });

  process.exit(0);
}

checkMarketData().catch(console.error);
