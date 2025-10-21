import admin from 'firebase-admin';

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (error) {
  // Already initialized
}

const db = admin.firestore();

async function checkBotStatus(symbol: string) {
  try {
    console.log(`\n=== Checking bot for ${symbol} ===\n`);

    // Find bot by symbol
    const botsSnapshot = await db.collection('dcaBots')
      .where('symbol', '==', symbol)
      .get();

    if (botsSnapshot.empty) {
      console.log(`❌ No bot found for ${symbol}`);
      return;
    }

    const botDoc = botsSnapshot.docs[0];
    const botData = botDoc.data();
    const botId = botDoc.id;

    console.log(`Bot ID: ${botId}`);
    console.log(`Status: ${botData.status}`);
    console.log(`Stored totalInvested: $${botData.totalInvested || 0}`);
    console.log(`Stored currentEntryCount: ${botData.currentEntryCount || 0}`);
    console.log(`Stored averagePurchasePrice: $${botData.averagePurchasePrice || 0}`);
    console.log(`Last Exit Time: ${botData.lastExitTime || 'Never'}`);
    console.log(`Last Exit Price: $${botData.lastExitPrice || 0}`);

    // Check entries
    const entriesSnapshot = await db
      .collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .get();

    console.log(`\n📊 Entries in subcollection: ${entriesSnapshot.size}`);

    if (entriesSnapshot.size > 0) {
      console.log(`\nEntry Details:`);
      entriesSnapshot.docs.forEach((doc, index) => {
        const entry = doc.data();
        console.log(`  ${index + 1}. ${entry.status} - $${entry.orderAmount} at $${entry.price} (${new Date(entry.timestamp).toLocaleString()})`);
      });
    }

    // Check for pending orders
    const ordersSnapshot = await db.collection('pendingOrders')
      .where('botId', '==', botId)
      .get();

    console.log(`\n📋 Pending Orders: ${ordersSnapshot.size}`);

    if (ordersSnapshot.size > 0) {
      console.log(`\nOrder Details:`);
      ordersSnapshot.docs.forEach((doc, index) => {
        const order = doc.data();
        console.log(`  ${index + 1}. ${order.status} - ${order.side} ${order.volume} at $${order.price || 'market'}`);
        console.log(`      Created: ${new Date(order.createdAt).toLocaleString()}`);
        if (order.lastError) {
          console.log(`      Error: ${order.lastError}`);
        }
      });
    }

    console.log(`\n✅ Check complete!\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get symbol from command line
const symbol = process.argv[2] || 'BCH/USD';
checkBotStatus(symbol);
