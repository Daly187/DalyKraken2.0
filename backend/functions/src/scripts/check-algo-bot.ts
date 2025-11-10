/**
 * Debug script to check ALGO bot status and identify blocking issues
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DCABotService } from '../services/dcaBotService.js';
import { KrakenService } from '../services/krakenService.js';
import { orderQueueService } from '../services/orderQueueService.js';
import { OrderStatus } from '../types/orderQueue.js';

// Initialize Firebase (only if not already initialized)
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function checkAlgoBot() {
  try {
    console.log('='.repeat(80));
    console.log('ALGO BOT DEBUG CHECK');
    console.log('='.repeat(80));

    // Find ALGO bot
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('symbol', '==', 'ALGO/USD')
      .get();

    if (botsSnapshot.empty) {
      console.log('❌ No ALGO/USD bot found');
      return;
    }

    const botDoc = botsSnapshot.docs[0];
    const botData = botDoc.data();
    const botId = botDoc.id;

    console.log(`\n✅ Found ALGO bot: ${botId}`);
    console.log(`   Status: ${botData.status}`);
    console.log(`   Symbol: ${botData.symbol}`);
    console.log(`   User ID: ${botData.userId}`);

    // Check for pending orders
    console.log('\n' + '-'.repeat(80));
    console.log('CHECKING FOR PENDING ORDERS');
    console.log('-'.repeat(80));

    const pendingOrdersSnapshot = await db
      .collection('pendingOrders')
      .where('botId', '==', botId)
      .get();

    if (pendingOrdersSnapshot.empty) {
      console.log('✅ No pending orders found for this bot');
    } else {
      console.log(`⚠️  Found ${pendingOrdersSnapshot.size} pending order(s):`);
      pendingOrdersSnapshot.forEach((doc) => {
        const order = doc.data();
        console.log(`\n   Order ID: ${doc.id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Side: ${order.side}`);
        console.log(`   Volume: ${order.volume}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log(`   Updated: ${order.updatedAt}`);
        console.log(`   Attempts: ${order.attempts}/${order.maxAttempts}`);
        if (order.lastError) {
          console.log(`   Last Error: ${order.lastError}`);
        }
        if (order.status === OrderStatus.RETRY && order.nextRetryAt) {
          const retryTime = new Date(order.nextRetryAt);
          const now = new Date();
          const minutesUntilRetry = Math.round((retryTime.getTime() - now.getTime()) / 60000);
          console.log(`   Next Retry: ${order.nextRetryAt} (${minutesUntilRetry} minutes from now)`);
        }
      });
    }

    // Get bot entries
    console.log('\n' + '-'.repeat(80));
    console.log('CHECKING BOT ENTRIES');
    console.log('-'.repeat(80));

    const entriesSnapshot = await db
      .collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .get();

    console.log(`Total entries: ${entriesSnapshot.size}`);
    const filledEntries = entriesSnapshot.docs.filter(
      (doc) => doc.data().status === 'filled'
    );
    const pendingEntries = entriesSnapshot.docs.filter(
      (doc) => doc.data().status === 'pending'
    );

    console.log(`   Filled entries: ${filledEntries.length}`);
    console.log(`   Pending entries: ${pendingEntries.length}`);

    if (pendingEntries.length > 0) {
      console.log('\n   ⚠️  Pending entries found:');
      pendingEntries.forEach((doc) => {
        const entry = doc.data();
        console.log(`      Entry ${entry.entryNumber}: ${entry.status} (order: ${entry.orderId})`);
      });
    }

    // Check bot entry conditions
    console.log('\n' + '-'.repeat(80));
    console.log('CHECKING ENTRY CONDITIONS');
    console.log('-'.repeat(80));

    // Get current price
    const krakenService = new KrakenService();
    const ticker = await krakenService.getTicker('ALGO/USD');
    const currentPrice = ticker.price;

    console.log(`\nCurrent Price: $${currentPrice}`);
    console.log(`Current Entry Count: ${filledEntries.length}`);
    console.log(`Max Re-entries: ${botData.reEntryCount}`);
    console.log(`Re-entry Delay: ${botData.reEntryDelay} minutes`);

    // Calculate next entry price
    if (filledEntries.length > 0) {
      const sortedEntries = filledEntries
        .map((doc) => doc.data())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastEntry = sortedEntries[0];
      const nextStepPercent =
        botData.stepPercent * Math.pow(botData.stepMultiplier, filledEntries.length);
      const nextEntryPrice = lastEntry.price * (1 - nextStepPercent / 100);

      console.log(`\nLast Entry Price: $${lastEntry.price.toFixed(4)}`);
      console.log(`Next Entry Price: $${nextEntryPrice.toFixed(4)}`);
      console.log(`Next Step %: ${nextStepPercent.toFixed(2)}%`);
      console.log(
        `Price Drop Needed: ${(((currentPrice - nextEntryPrice) / currentPrice) * 100).toFixed(2)}%`
      );

      if (currentPrice <= nextEntryPrice) {
        console.log('✅ Price condition MET for re-entry');
      } else {
        console.log('❌ Price condition NOT MET (price needs to drop more)');
      }

      // Check re-entry delay
      const lastEntryTime = new Date(lastEntry.timestamp);
      const timeSinceLastEntry = Date.now() - lastEntryTime.getTime();
      const delayMs = botData.reEntryDelay * 60 * 1000;
      const minutesSinceLastEntry = Math.round(timeSinceLastEntry / 60000);

      console.log(`\nLast Entry Time: ${lastEntry.timestamp}`);
      console.log(`Time Since Last Entry: ${minutesSinceLastEntry} minutes`);
      console.log(`Required Delay: ${botData.reEntryDelay} minutes`);

      if (timeSinceLastEntry >= delayMs) {
        console.log('✅ Re-entry delay MET');
      } else {
        const remainingMinutes = Math.round((delayMs - timeSinceLastEntry) / 60000);
        console.log(`❌ Re-entry delay NOT MET (${remainingMinutes} minutes remaining)`);
      }
    } else {
      // First entry
      console.log(`\nThis would be the FIRST entry`);
      console.log(`✅ No price drop requirement for first entry (trend check only)`);
      console.log(`   Note: Price drops only apply to re-entries`);
    }

    // Check trend alignment
    console.log('\n' + '-'.repeat(80));
    console.log('CHECKING TREND ALIGNMENT');
    console.log('-'.repeat(80));

    console.log(`\nTrend Alignment Enabled: ${botData.trendAlignmentEnabled}`);
    console.log(`Support/Resistance Enabled: ${botData.supportResistanceEnabled}`);

    // Use DCA bot service to check entry conditions
    const dcaBotService = new DCABotService(db);
    const liveBot = await dcaBotService.getBotById(botId, krakenService);

    if (liveBot) {
      console.log(`\nTech Score: ${liveBot.techScore?.toFixed(0) || 'N/A'}`);
      console.log(`Trend Score: ${liveBot.trendScore?.toFixed(0) || 'N/A'}`);
      console.log(`Recommendation: ${liveBot.recommendation || 'N/A'}`);
      console.log(`Support: ${liveBot.support ? '$' + liveBot.support.toFixed(4) : 'N/A'}`);
      console.log(`Resistance: ${liveBot.resistance ? '$' + liveBot.resistance.toFixed(4) : 'N/A'}`);

      // Check if should enter
      const entryCheck = await dcaBotService.shouldEnterPosition(liveBot, currentPrice);
      console.log(`\nEntry Check Result:`);
      console.log(`   Should Enter: ${entryCheck.shouldEnter ? '✅ YES' : '❌ NO'}`);
      console.log(`   Reason: ${entryCheck.reason}`);
    }

    // Check recent execution logs
    console.log('\n' + '-'.repeat(80));
    console.log('RECENT EXECUTION LOGS');
    console.log('-'.repeat(80));

    const logsSnapshot = await db
      .collection('botExecutions')
      .where('botId', '==', botId)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (logsSnapshot.empty) {
      console.log('No execution logs found');
    } else {
      console.log(`\nShowing ${logsSnapshot.size} most recent execution logs:\n`);
      logsSnapshot.docs.forEach((doc, index) => {
        const log = doc.data();
        console.log(`${index + 1}. ${log.timestamp}`);
        console.log(`   Action: ${log.action}`);
        console.log(`   Success: ${log.success ? '✅' : '❌'}`);
        console.log(`   Reason: ${log.reason || log.error || 'N/A'}`);
        if (log.price) {
          console.log(`   Price: $${log.price.toFixed(4)}`);
        }
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('DEBUG CHECK COMPLETE');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error checking ALGO bot:', error);
  }
}

// Run the check
checkAlgoBot().then(() => {
  console.log('\nCheck complete. Exiting...');
  process.exit(0);
});
