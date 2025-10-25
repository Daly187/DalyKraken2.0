/**
 * Fix Stuck Exit Orders
 * Recovers bots stuck in 'exiting' status and cleans up stuck sell orders
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'dalydough',
  });
}

const db = admin.firestore();

async function fixStuckExitOrders() {
  console.log('=== Fixing Stuck Exit Orders ===\n');

  try {
    let fixedBots = 0;
    let fixedOrders = 0;

    // 1. Find and fix bots stuck in 'exiting' status
    console.log('1. Finding bots stuck in EXITING status...');
    const exitingBotsSnapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'exiting')
      .get();

    if (exitingBotsSnapshot.empty) {
      console.log('   ✅ No bots stuck in EXITING status\n');
    } else {
      console.log(`   Found ${exitingBotsSnapshot.size} bot(s) stuck in EXITING status\n`);

      for (const doc of exitingBotsSnapshot.docs) {
        const bot = doc.data();
        console.log(`   Bot ID: ${doc.id}`);
        console.log(`   Symbol: ${bot.symbol}`);
        console.log(`   Status: ${bot.status}`);
        console.log(`   Updated At: ${bot.updatedAt}`);

        // Check if there's a related sell order
        const sellOrdersSnapshot = await db
          .collection('pendingOrders')
          .where('botId', '==', doc.id)
          .where('side', '==', 'sell')
          .where('status', 'in', ['processing', 'retry', 'failed'])
          .get();

        if (!sellOrdersSnapshot.empty) {
          console.log(`   Found ${sellOrdersSnapshot.size} stuck sell order(s) for this bot`);

          // Mark sell orders as failed
          for (const orderDoc of sellOrdersSnapshot.docs) {
            const order = orderDoc.data();
            console.log(`     - Marking order ${orderDoc.id} as FAILED (${order.errors?.length || 0} previous errors)`);

            await orderDoc.ref.update({
              status: 'failed',
              lastError: 'Order abandoned - bot recovered from stuck exiting state',
              updatedAt: new Date().toISOString(),
            });

            fixedOrders++;
          }
        }

        // Reset bot to active status
        console.log(`   Resetting bot ${doc.id} to ACTIVE status...`);

        await doc.ref.update({
          status: 'active',
          updatedAt: new Date().toISOString(),
          lastFailedExitReason: 'Bot was stuck in exiting status and was manually recovered',
          lastFailedExitTime: new Date().toISOString(),
        });

        // Log the recovery
        await db.collection('botExecutions').add({
          id: `${doc.id}_recovery_${Date.now()}`,
          botId: doc.id,
          action: 'recovery',
          symbol: bot.symbol,
          price: 0,
          quantity: 0,
          amount: 0,
          reason: 'Bot recovered from stuck exiting status by fix-stuck-exit-orders script',
          timestamp: new Date().toISOString(),
          success: true,
        });

        console.log(`   ✅ Bot ${doc.id} recovered and reset to ACTIVE\n`);
        fixedBots++;
      }
    }

    // 2. Find and fix sell orders with excessive retry attempts
    console.log('2. Finding sell orders with excessive retry attempts...');
    const allSellOrdersSnapshot = await db
      .collection('pendingOrders')
      .where('side', '==', 'sell')
      .where('status', 'in', ['processing', 'retry'])
      .get();

    if (allSellOrdersSnapshot.empty) {
      console.log('   ✅ No sell orders in PROCESSING/RETRY status\n');
    } else {
      console.log(`   Found ${allSellOrdersSnapshot.size} sell order(s) in PROCESSING/RETRY status\n`);

      for (const orderDoc of allSellOrdersSnapshot.docs) {
        const order = orderDoc.data();
        const errorCount = order.errors?.length || 0;

        // If order has more than 50 errors, it's stuck in infinite loop
        if (errorCount > 50) {
          console.log(`   Order ID: ${orderDoc.id}`);
          console.log(`   Bot ID: ${order.botId}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Error Count: ${errorCount}`);
          console.log(`   Created: ${order.createdAt}`);
          console.log(`   Last Error: ${order.lastError}`);

          // Mark as permanently failed
          await orderDoc.ref.update({
            status: 'failed',
            lastError: `Order abandoned after ${errorCount} failed attempts (infinite retry loop detected)`,
            updatedAt: new Date().toISOString(),
          });

          console.log(`   ✅ Order ${orderDoc.id} marked as FAILED\n`);
          fixedOrders++;

          // Reset associated bot if stuck in exiting
          const botDoc = await db.collection('dcaBots').doc(order.botId).get();
          if (botDoc.exists) {
            const bot = botDoc.data();
            if (bot.status === 'exiting') {
              console.log(`   Resetting associated bot ${order.botId} to ACTIVE...`);

              await botDoc.ref.update({
                status: 'active',
                updatedAt: new Date().toISOString(),
                lastFailedExitReason: `Exit order ${orderDoc.id} abandoned after ${errorCount} attempts`,
                lastFailedExitTime: new Date().toISOString(),
              });

              console.log(`   ✅ Bot ${order.botId} recovered\n`);
              fixedBots++;
            }
          }
        }
      }
    }

    // 3. Summary
    console.log('=== Recovery Summary ===');
    console.log(`Bots recovered: ${fixedBots}`);
    console.log(`Orders fixed: ${fixedOrders}`);

    if (fixedBots > 0 || fixedOrders > 0) {
      console.log('\n✅ Recovery complete! Bots are now back to ACTIVE status.');
      console.log('   - You can now manually retry exits or modify bot settings');
      console.log('   - Check the Firebase Console to verify bot states');
    } else {
      console.log('\n✅ No issues found - all bots and orders are healthy!');
    }

  } catch (error) {
    console.error('❌ Error during recovery:', error);
  }

  process.exit(0);
}

fixStuckExitOrders();
