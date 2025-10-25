/**
 * Check Bot Exit Failures
 * Analyzes bots stuck in 'exiting' status and their failed orders
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'dalydough',
  });
}

const db = admin.firestore();

async function checkBotFailures() {
  console.log('=== Checking for Bot Exit Failures ===\n');

  try {
    // 1. Check for bots stuck in 'exiting' status
    console.log('1. Checking for bots in EXITING status...');
    const exitingBotsSnapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'exiting')
      .get();

    if (exitingBotsSnapshot.empty) {
      console.log('   No bots found in EXITING status');
    } else {
      console.log(`   Found ${exitingBotsSnapshot.size} bot(s) stuck in EXITING status:\n`);

      for (const doc of exitingBotsSnapshot.docs) {
        const bot = doc.data();
        console.log(`   Bot ID: ${doc.id}`);
        console.log(`   Symbol: ${bot.symbol}`);
        console.log(`   Status: ${bot.status}`);
        console.log(`   Updated At: ${bot.updatedAt}`);
        console.log(`   User ID: ${bot.userId}`);
        console.log(`   Current Entry Count: ${bot.currentEntryCount}`);
        console.log(`   Total Invested: $${bot.totalInvested || 0}`);
        console.log(`   Average Purchase Price: $${bot.averagePurchasePrice || 0}`);
        console.log('');

        // Get entries for this bot
        const entriesSnapshot = await db
          .collection('dcaBots')
          .doc(doc.id)
          .collection('entries')
          .get();

        console.log(`   Entries (${entriesSnapshot.size} total):`);
        entriesSnapshot.docs.forEach((entryDoc) => {
          const entry = entryDoc.data();
          console.log(`     - Entry #${entry.entryNumber}: ${entry.status}, $${entry.orderAmount}, ${entry.quantity} units @ $${entry.price}`);
        });
        console.log('');
      }
    }

    // 2. Check for failed orders related to bot exits
    console.log('2. Checking for FAILED orders (potential exit order failures)...');
    const failedOrdersSnapshot = await db
      .collection('pendingOrders')
      .where('status', '==', 'failed')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    if (failedOrdersSnapshot.empty) {
      console.log('   No failed orders found');
    } else {
      console.log(`   Found ${failedOrdersSnapshot.size} failed order(s):\n`);

      failedOrdersSnapshot.docs.forEach((doc) => {
        const order = doc.data();
        console.log(`   Order ID: ${doc.id}`);
        console.log(`   Bot ID: ${order.botId}`);
        console.log(`   Side: ${order.side.toUpperCase()}`);
        console.log(`   Pair: ${order.pair}`);
        console.log(`   Volume: ${order.volume}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created At: ${order.createdAt}`);
        console.log(`   Last Error: ${order.lastError}`);
        console.log(`   Attempts: ${order.attempts}/${order.maxAttempts}`);

        if (order.errors && order.errors.length > 0) {
          console.log(`   Error History:`);
          order.errors.slice(-3).forEach((err, i) => {
            console.log(`     ${i + 1}. [${err.timestamp}] ${err.error}`);
          });
        }
        console.log('');
      });
    }

    // 3. Check for orders in RETRY status (might be stuck)
    console.log('3. Checking for orders in RETRY status...');
    const retryOrdersSnapshot = await db
      .collection('pendingOrders')
      .where('status', '==', 'retry')
      .get();

    if (retryOrdersSnapshot.empty) {
      console.log('   No orders in RETRY status');
    } else {
      console.log(`   Found ${retryOrdersSnapshot.size} order(s) in RETRY status:\n`);

      retryOrdersSnapshot.docs.forEach((doc) => {
        const order = doc.data();
        console.log(`   Order ID: ${doc.id}`);
        console.log(`   Bot ID: ${order.botId}`);
        console.log(`   Side: ${order.side.toUpperCase()}`);
        console.log(`   Pair: ${order.pair}`);
        console.log(`   Next Retry At: ${order.nextRetryAt}`);
        console.log(`   Last Error: ${order.lastError}`);
        console.log(`   Attempts: ${order.attempts}/${order.maxAttempts}`);
        console.log('');
      });
    }

    // 4. Check recent bot execution logs for exit failures
    console.log('4. Checking recent bot execution logs for exit failures...');
    const execLogsSnapshot = await db
      .collection('botExecutions')
      .where('action', '==', 'exit')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (execLogsSnapshot.empty) {
      console.log('   No recent exit execution logs found');
    } else {
      console.log(`   Found ${execLogsSnapshot.size} recent exit execution(s):\n`);

      execLogsSnapshot.docs.forEach((doc) => {
        const log = doc.data();
        console.log(`   Log ID: ${doc.id}`);
        console.log(`   Bot ID: ${log.botId}`);
        console.log(`   Symbol: ${log.symbol}`);
        console.log(`   Success: ${log.success ? 'YES' : 'NO'}`);
        console.log(`   Timestamp: ${log.timestamp}`);
        console.log(`   Reason: ${log.reason}`);
        if (log.error) {
          console.log(`   Error: ${log.error}`);
        }
        if (log.orderId) {
          console.log(`   Order ID: ${log.orderId}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error checking bot failures:', error);
  }

  process.exit(0);
}

checkBotFailures();
