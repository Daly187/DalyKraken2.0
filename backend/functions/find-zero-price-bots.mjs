import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findZeroPriceBots() {
  console.log('🔍 Checking Active DCA Bots for Zero Spot Prices...\n');

  try {
    // Query all active DCA bots
    const snapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'active')
      .get();

    console.log(`📊 Total Active Bots: ${snapshot.size}\n`);

    const allBots = [];
    const zeroPriceBots = [];
    const missingPriceBots = [];

    snapshot.forEach(doc => {
      const bot = { id: doc.id, ...doc.data() };
      allBots.push(bot);

      // Check if currentPrice is 0, undefined, or missing
      if (bot.currentPrice === undefined || bot.currentPrice === null) {
        missingPriceBots.push(bot);
      } else if (bot.currentPrice === 0) {
        zeroPriceBots.push(bot);
      }
    });

    const affectedBots = [...zeroPriceBots, ...missingPriceBots];

    if (affectedBots.length === 0) {
      console.log('✅ All active bots have valid spot prices!\n');
      return;
    }

    console.log(`❌ Found ${affectedBots.length} active bot(s) with zero/missing spot prices:\n`);
    console.log('═'.repeat(120));

    affectedBots.forEach((bot, index) => {
      console.log(`\n${index + 1}. Bot ID: ${bot.id}`);
      console.log('   ─'.repeat(60));
      console.log(`   Symbol:              ${bot.symbol || 'N/A'}`);
      console.log(`   Status:              ${bot.status}`);
      console.log(`   Spot Price:          ${bot.currentPrice === undefined || bot.currentPrice === null ? '❌ MISSING' : `$${bot.currentPrice.toFixed(2)} ❌`}`);
      console.log(`   Entry Count:         ${bot.currentEntryCount || 0} / ${bot.reEntryCount || 0}`);
      console.log(`   Avg Purchase Price:  ${bot.averagePurchasePrice ? `$${bot.averagePurchasePrice.toFixed(2)}` : 'N/A'}`);
      console.log(`   Total Invested:      ${bot.totalInvested ? `$${bot.totalInvested.toFixed(2)}` : '$0.00'}`);
      console.log(`   Total Quantity:      ${bot.totalQuantity ? bot.totalQuantity.toFixed(6) : '0.000000'}`);
      console.log(`   Initial Order Amt:   $${bot.initialOrderAmount || 0}`);
      console.log(`   Trade Multiplier:    ${bot.tradeMultiplier || 0}x`);
      console.log(`   Step Percent:        ${bot.stepPercent || 0}%`);
      console.log(`   TP Target:           ${bot.tpTarget || 0}%`);
      console.log(`   Trend Alignment:     ${bot.trendAlignmentEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`   Created At:          ${bot.createdAt ? new Date(bot.createdAt).toLocaleString() : 'N/A'}`);
      console.log(`   Updated At:          ${bot.updatedAt ? new Date(bot.updatedAt).toLocaleString() : 'N/A'}`);

      if (bot.lastEntryTime) {
        console.log(`   Last Entry:          ${new Date(bot.lastEntryTime).toLocaleString()}`);
      }
      if (bot.nextEntryPrice) {
        console.log(`   Next Entry Price:    $${bot.nextEntryPrice.toFixed(2)}`);
      }
    });

    console.log('\n' + '═'.repeat(120));
    console.log('\n📈 Summary:');
    console.log(`   Total Active Bots:        ${allBots.length}`);
    console.log(`   Bots with Zero Price:     ${zeroPriceBots.length}`);
    console.log(`   Bots with Missing Price:  ${missingPriceBots.length}`);
    console.log(`   Total Affected:           ${affectedBots.length} (${((affectedBots.length / allBots.length) * 100).toFixed(1)}%)`);
    console.log(`   Bots with Valid Prices:   ${allBots.length - affectedBots.length}\n`);

    // Group by symbol to see patterns
    const symbolGroups = affectedBots.reduce((acc, bot) => {
      const symbol = bot.symbol || 'Unknown';
      if (!acc[symbol]) acc[symbol] = 0;
      acc[symbol]++;
      return acc;
    }, {});

    if (Object.keys(symbolGroups).length > 0) {
      console.log('📊 Affected Bots by Symbol:');
      Object.entries(symbolGroups)
        .sort(([, a], [, b]) => b - a)
        .forEach(([symbol, count]) => {
          console.log(`   ${symbol}: ${count} bot(s)`);
        });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error querying bots:', error);
    process.exit(1);
  }
}

findZeroPriceBots()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
