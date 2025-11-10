/**
 * Manual trigger script for ALGO bot
 * Tests the complete execution flow end-to-end with verbose logging
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DCABotService } from '../services/dcaBotService.js';
import { KrakenService } from '../services/krakenService.js';
import { decryptKey } from '../services/settingsStore.js';

// Initialize Firebase (only if not already initialized)
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function triggerAlgoBot() {
  try {
    console.log('='.repeat(80));
    console.log('MANUAL TRIGGER: ALGO BOT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    // Find ALGO bot
    console.log('Step 1: Finding ALGO/USD bot...');
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
    const userId = botData.userId;

    console.log(`✅ Found ALGO bot:`);
    console.log(`   Bot ID: ${botId}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Status: ${botData.status}`);
    console.log(`   Symbol: ${botData.symbol}\n`);

    // Get user's API keys
    console.log('Step 2: Retrieving user API keys...');
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
      console.log('❌ No Kraken API keys found for user');
      return;
    }

    const activeKey = userData.krakenKeys.find((k: any) => k.isActive);
    if (!activeKey) {
      console.log('❌ No active Kraken API key found');
      return;
    }

    console.log(`✅ Found active API key (encrypted: ${activeKey.encrypted})`);

    const krakenApiKey = activeKey.encrypted
      ? decryptKey(activeKey.apiKey)
      : activeKey.apiKey;
    const krakenApiSecret = activeKey.encrypted
      ? decryptKey(activeKey.apiSecret)
      : activeKey.apiSecret;

    if (!krakenApiKey || !krakenApiSecret) {
      console.log('❌ Failed to decrypt API keys');
      return;
    }

    console.log(`✅ API keys ready (key length: ${krakenApiKey.length}, secret length: ${krakenApiSecret.length})\n`);

    // Create services
    console.log('Step 3: Initializing services...');
    const dcaBotService = new DCABotService(db);
    console.log(`✅ DCABotService initialized\n`);

    // Process the bot
    console.log('Step 4: Processing bot with full logging...');
    console.log('-'.repeat(80));

    const result = await dcaBotService.processBot(botId, krakenApiKey, krakenApiSecret);

    console.log('-'.repeat(80));
    console.log('\nStep 5: Processing Result:');
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Action: ${result.action || 'none'}`);
    console.log(`   Reason: ${result.reason}`);

    if (result.processed && result.action === 'entry') {
      console.log('\n✅ SUCCESS: Entry order created!');
      console.log('\nStep 6: Verifying order creation...');

      // Check for pending orders
      const pendingOrdersSnapshot = await db
        .collection('pendingOrders')
        .where('botId', '==', botId)
        .where('status', 'in', ['pending', 'processing'])
        .get();

      if (!pendingOrdersSnapshot.empty) {
        console.log(`✅ Found ${pendingOrdersSnapshot.size} pending order(s):`);
        pendingOrdersSnapshot.forEach((doc) => {
          const order = doc.data();
          console.log(`\n   Order ID: ${doc.id}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Side: ${order.side}`);
          console.log(`   Volume: ${order.volume}`);
          console.log(`   Amount: $${order.amount}`);
          console.log(`   Price: $${order.price}`);
        });
      } else {
        console.log('⚠️  No pending orders found (might be already executed)');
      }

      // Check for bot entries
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(botId)
        .collection('entries')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (!entriesSnapshot.empty) {
        const latestEntry = entriesSnapshot.docs[0].data();
        console.log(`\n✅ Latest bot entry:`);
        console.log(`   Entry Number: ${latestEntry.entryNumber}`);
        console.log(`   Status: ${latestEntry.status}`);
        console.log(`   Price: $${latestEntry.price}`);
        console.log(`   Quantity: ${latestEntry.quantity}`);
        console.log(`   Amount: $${latestEntry.orderAmount}`);
        console.log(`   Timestamp: ${latestEntry.timestamp}`);
      }
    } else {
      console.log('\n⏸️  No entry executed');
      console.log(`   Reason: ${result.reason}`);

      if (!result.processed) {
        console.log('\nTroubleshooting:');
        console.log('   - Check if entry conditions are met (trend, price, etc.)');
        console.log('   - Review the logs above for specific blocking conditions');
        console.log('   - Run check-algo-bot.ts script for detailed condition check');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('MANUAL TRIGGER COMPLETE');
    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('\n❌ ERROR during manual trigger:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the trigger
console.log('Starting manual trigger for ALGO bot...\n');
triggerAlgoBot().then(() => {
  console.log('\nExiting...');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
