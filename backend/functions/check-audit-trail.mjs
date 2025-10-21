/**
 * Check audit trail for executed trades
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkAuditTrail() {
  console.log('=== Checking Audit Trail ===\n');

  try {
    // Get recent audit entries
    const auditSnapshot = await db
      .collection('auditLog')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    console.log(`Found ${auditSnapshot.size} recent audit entries\n`);

    let buyTrades = [];
    let sellTrades = [];

    for (const doc of auditSnapshot.docs) {
      const audit = doc.data();

      // Look for trade executions
      if (audit.action === 'trade_executed' || audit.action === 'order_executed' ||
          audit.action === 'buy' || audit.action === 'sell' ||
          (audit.type && (audit.type === 'buy' || audit.type === 'sell'))) {

        const trade = {
          id: doc.id,
          timestamp: audit.timestamp,
          action: audit.action,
          type: audit.type || audit.side,
          pair: audit.pair || audit.symbol,
          volume: audit.volume || audit.quantity,
          price: audit.price,
          amount: audit.amount || audit.cost,
          txid: audit.txid || audit.orderId,
          botId: audit.botId,
          userId: audit.userId,
          ...audit
        };

        if (trade.type === 'buy') {
          buyTrades.push(trade);
        } else if (trade.type === 'sell') {
          sellTrades.push(trade);
        }
      }
    }

    console.log(`\n=== BUY TRADES (${buyTrades.length}) ===`);
    for (const trade of buyTrades) {
      console.log(`\nTimestamp: ${trade.timestamp}`);
      console.log(`  Pair: ${trade.pair}`);
      console.log(`  Volume: ${trade.volume}`);
      console.log(`  Price: ${trade.price}`);
      console.log(`  Amount: $${trade.amount}`);
      console.log(`  Txid: ${trade.txid}`);
      console.log(`  Bot ID: ${trade.botId || 'N/A'}`);
      console.log(`  User ID: ${trade.userId || 'N/A'}`);
    }

    console.log(`\n\n=== SELL TRADES (${sellTrades.length}) ===`);
    for (const trade of sellTrades) {
      console.log(`\nTimestamp: ${trade.timestamp}`);
      console.log(`  Pair: ${trade.pair}`);
      console.log(`  Volume: ${trade.volume}`);
      console.log(`  Price: ${trade.price}`);
      console.log(`  Amount: $${trade.amount}`);
      console.log(`  Txid: ${trade.txid}`);
      console.log(`  Bot ID: ${trade.botId || 'N/A'}`);
      console.log(`  User ID: ${trade.userId || 'N/A'}`);
    }

    // Check if these trades have corresponding entries in bot subcollections
    console.log('\n\n=== CHECKING BOT ENTRIES ===');
    for (const trade of buyTrades) {
      if (!trade.botId) {
        console.log(`\nTrade ${trade.txid || 'unknown'}: No botId, skipping`);
        continue;
      }

      console.log(`\nChecking trade for bot ${trade.botId}:`);
      console.log(`  Txid: ${trade.txid}`);
      console.log(`  Pair: ${trade.pair}`);
      console.log(`  Amount: $${trade.amount}`);

      // Check if entry exists
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(trade.botId)
        .collection('entries')
        .where('orderId', '==', trade.txid)
        .get();

      if (entriesSnapshot.empty) {
        console.log(`  ⚠️  NO ENTRY FOUND - This trade needs to be added!`);
      } else {
        console.log(`  ✓ Entry exists (${entriesSnapshot.size} found)`);
      }
    }

  } catch (error) {
    console.error('Error checking audit trail:', error);
    throw error;
  }
}

// Run the script
checkAuditTrail()
  .then(() => {
    console.log('\n\nCheck complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
