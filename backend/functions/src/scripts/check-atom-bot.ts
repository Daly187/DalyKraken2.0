/**
 * Debug script to check ATOM bot status and identify blocking issues
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DCABotService } from '../services/dcaBotService.js';
import { KrakenService } from '../services/krakenService.js';
import { MarketAnalysisService } from '../services/marketAnalysisService.js';

// Initialize Firebase (only if not already initialized)
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function checkAtomBot() {
  try {
    console.log('='.repeat(80));
    console.log('ATOM BOT DEBUG CHECK');
    console.log('='.repeat(80));

    // Find ATOM bot
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('symbol', '==', 'ATOM/USD')
      .get();

    if (botsSnapshot.empty) {
      console.log('❌ No ATOM/USD bot found');
      return;
    }

    const botDoc = botsSnapshot.docs[0];
    const botData = botDoc.data();
    const botId = botDoc.id;

    console.log(`\n✅ Found ATOM bot: ${botId}`);
    console.log(`   Status: ${botData.status}`);
    console.log(`   Symbol: ${botData.symbol}`);
    console.log(`   User ID: ${botData.userId}`);

    // Get current market data
    console.log('\n' + '-'.repeat(80));
    console.log('MARKET DATA');
    console.log('-'.repeat(80));

    const krakenService = new KrakenService();
    const ticker = await krakenService.getTicker('ATOM/USD');
    const currentPrice = ticker.price;

    console.log(`\nCurrent Price: $${currentPrice}`);

    // Get bot entries
    const entriesSnapshot = await db
      .collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .get();

    const filledEntries = entriesSnapshot.docs.filter(
      (doc) => doc.data().status === 'filled'
    );

    console.log(`\nCurrent Entry Count: ${filledEntries.length}`);
    console.log(`Max Re-entries: ${botData.reEntryCount}`);

    // Check trend and S/R
    console.log('\n' + '-'.repeat(80));
    console.log('TREND & SUPPORT/RESISTANCE ANALYSIS');
    console.log('-'.repeat(80));

    const marketAnalysis = new MarketAnalysisService();
    const analysis = await marketAnalysis.analyzeTrend('ATOM/USD');

    console.log(`\nTech Score: ${analysis.techScore.toFixed(0)}`);
    console.log(`Trend Score: ${analysis.trendScore.toFixed(0)}`);
    console.log(`Recommendation: ${analysis.recommendation}`);
    console.log(`Support: ${analysis.support ? '$' + analysis.support.toFixed(4) : 'N/A'}`);
    console.log(`Resistance: ${analysis.resistance ? '$' + analysis.resistance.toFixed(4) : 'N/A'}`);

    // Bot configuration
    console.log('\n' + '-'.repeat(80));
    console.log('BOT CONFIGURATION');
    console.log('-'.repeat(80));

    console.log(`\nTrend Alignment: ${botData.trendAlignmentEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Support/Resistance: ${botData.supportResistanceEnabled ? '✅ Enabled' : '❌ Disabled'}`);

    // Check entry conditions
    console.log('\n' + '-'.repeat(80));
    console.log('ENTRY CONDITIONS CHECK');
    console.log('-'.repeat(80));

    // For first entry (0 entries)
    if (filledEntries.length === 0) {
      console.log(`\n📝 This is a FIRST ENTRY attempt`);

      // Check trend requirement
      console.log(`\n1. Trend Check (required for first entry):`);
      if (analysis.recommendation === 'bullish') {
        console.log(`   ✅ PASS: Trend is bullish`);
      } else {
        console.log(`   ❌ FAIL: Trend is ${analysis.recommendation} (needs bullish)`);
      }

      // Check S/R if enabled
      if (botData.supportResistanceEnabled) {
        console.log(`\n2. Support/Resistance Check (enabled):`);
        console.log(`   Current Support: $${analysis.support?.toFixed(4)}`);
        console.log(`   Current Price: $${currentPrice.toFixed(4)}`);
        console.log(`   Price vs Support: ${currentPrice > (analysis.support || 0) ? 'Above' : 'Below'}`);

        if (currentPrice > (analysis.support || 0)) {
          console.log(`   ⚠️  WAITING: Price needs to cross BELOW support ($${analysis.support?.toFixed(4)}) to trigger entry`);
          console.log(`   📊 S/R Strategy: Bot will only enter when price crosses below current support level`);
          console.log(`   💡 This reduces false entries during sideways movement`);
        } else {
          console.log(`   ✅ PASS: Price is below support - ready to enter`);
        }
      } else {
        console.log(`\n2. Support/Resistance Check: ⏭️  Skipped (disabled)`);
      }

      // Summary
      console.log(`\n` + '='.repeat(80));
      console.log(`ENTRY DECISION SUMMARY`);
      console.log('='.repeat(80));

      const trendPass = analysis.recommendation === 'bullish';
      const srPass = !botData.supportResistanceEnabled || (currentPrice <= (analysis.support || 0));

      if (trendPass && srPass) {
        console.log(`\n✅ Bot SHOULD enter on next trigger`);
        console.log(`   All conditions are met`);
      } else {
        console.log(`\n❌ Bot WILL NOT enter yet`);
        if (!trendPass) {
          console.log(`   ❌ Trend: ${analysis.recommendation} (needs bullish)`);
        }
        if (!srPass && botData.supportResistanceEnabled) {
          console.log(`   ❌ S/R: Price above support (needs to cross below $${analysis.support?.toFixed(4)})`);
        }
      }
    }

    // Check pending orders
    console.log('\n' + '-'.repeat(80));
    console.log('PENDING ORDERS');
    console.log('-'.repeat(80));

    const pendingOrdersSnapshot = await db
      .collection('pendingOrders')
      .where('botId', '==', botId)
      .where('status', 'in', ['pending', 'processing', 'retry'])
      .get();

    if (pendingOrdersSnapshot.empty) {
      console.log('\n✅ No pending orders found');
    } else {
      console.log(`\n⚠️  Found ${pendingOrdersSnapshot.size} pending order(s):`);
      pendingOrdersSnapshot.forEach((doc) => {
        const order = doc.data();
        console.log(`\n   Order ID: ${doc.id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Side: ${order.side}`);
        console.log(`   Volume: ${order.volume}`);
        console.log(`   Created: ${order.createdAt}`);
        if (order.lastError) {
          console.log(`   Last Error: ${order.lastError}`);
        }
      });
    }

    // Check recent scheduler logs
    console.log('\n' + '-'.repeat(80));
    console.log('RECENT SCHEDULER ACTIVITY');
    console.log('-'.repeat(80));

    const recentLogs = await db
      .collection('systemLogs')
      .where('type', '==', 'dca_bot_processing')
      .orderBy('timestamp', 'desc')
      .limit(3)
      .get();

    if (!recentLogs.empty) {
      console.log(`\nLast 3 scheduler runs:\n`);
      recentLogs.docs.forEach((doc, index) => {
        const log = doc.data();
        console.log(`${index + 1}. ${log.timestamp}`);
        console.log(`   Total Bots: ${log.summary?.totalBots || 0}`);
        console.log(`   Processed: ${log.summary?.processed || 0}`);
        console.log(`   Entries: ${log.summary?.entries || 0}`);
        console.log(`   Exits: ${log.summary?.exits || 0}`);

        // Find this bot's result
        const atomResult = log.details?.find((d: any) => d.symbol === 'ATOM/USD');
        if (atomResult) {
          console.log(`   ATOM Bot: ${atomResult.processed ? '✅ Processed' : '⏸️  Skipped'} - ${atomResult.reason}`);
        }
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('DEBUG CHECK COMPLETE');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error checking ATOM bot:', error);
  }
}

// Run the check
checkAtomBot().then(() => {
  console.log('\nCheck complete. Exiting...');
  process.exit(0);
});
