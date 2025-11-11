import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const botsSnapshot = await db.collection('dcaBots').where('status', '==', 'active').get();

console.log(`\n=== ACTIVE DCA BOTS (${botsSnapshot.size} total) ===\n`);

const bots = [];
botsSnapshot.forEach(doc => {
  const data = doc.data();
  bots.push({
    symbol: data.symbol,
    currentPrice: data.currentPrice || 0,
    entries: data.currentEntryCount || 0,
    avgPrice: data.averageEntryPrice || 0
  });
});

bots.sort((a, b) => a.symbol.localeCompare(b.symbol));

console.log('Symbol'.padEnd(15) + 'Current Price'.padEnd(18) + 'Entries'.padEnd(10) + 'Avg Price');
console.log('-'.repeat(60));

bots.forEach(bot => {
  const price = bot.currentPrice > 0 ? `$${bot.currentPrice.toFixed(4)}` : '$0.00 ❌';
  const avgPrice = bot.avgPrice > 0 ? `$${bot.avgPrice.toFixed(4)}` : 'N/A';
  console.log(bot.symbol.padEnd(15) + price.padEnd(18) + bot.entries.toString().padEnd(10) + avgPrice);
});

const zeroPriceBots = bots.filter(b => b.currentPrice === 0);
console.log(`\n⚠️  Bots with $0.00 price: ${zeroPriceBots.length}/${bots.length}`);
if (zeroPriceBots.length > 0) {
  console.log('Symbols: ' + zeroPriceBots.map(b => b.symbol).join(', '));
}

process.exit(0);
