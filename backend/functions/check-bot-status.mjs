/**
 * Check bot status and why they might not be creating orders
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkBotStatus() {
  console.log('=== Checking Bot Status ===\n');

  try {
    // Get all active bots
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'active')
      .get();

    console.log(`Found ${botsSnapshot.size} active bots\n`);

    for (const botDoc of botsSnapshot.docs) {
      const bot = botDoc.data();
      console.log(`\n--- ${bot.symbol} (${botDoc.id}) ---`);
      console.log(`  Status: ${bot.status}`);
      console.log(`  Current Entry Count: ${bot.currentEntryCount || 0}`);
      console.log(`  Max Re-entries: ${bot.reEntryCount}`);
      console.log(`  Average Entry Price: $${bot.averageEntryPrice || 0}`);
      console.log(`  Total Invested: $${bot.totalInvested || 0}`);
      console.log(`  Total Volume: ${bot.totalVolume || 0}`);
      console.log(`  Last Entry Time: ${bot.lastEntryTime || 'Never'}`);
      console.log(`  Next Entry Price: $${bot.nextEntryPrice || 'N/A'}`);

      // Check for pending orders
      const pendingOrders = await db
        .collection('pendingOrders')
        .where('botId', '==', botDoc.id)
        .where('status', 'in', ['pending', 'processing', 'retry'])
        .get();

      console.log(`  Pending Orders: ${pendingOrders.size}`);

      // Determine if it should enter
      if (bot.currentEntryCount === 0) {
        console.log(`  ✓ Should create FIRST ENTRY (no checks needed)`);
      } else if (bot.currentEntryCount >= bot.reEntryCount) {
        console.log(`  ✗ Max re-entries reached (${bot.currentEntryCount}/${bot.reEntryCount})`);
      } else if (bot.lastEntryTime) {
        const lastEntryTime = new Date(bot.lastEntryTime).getTime();
        const timeSinceLastEntry = Date.now() - lastEntryTime;
        const delayMs = (bot.reEntryDelay || 0) * 60 * 1000;
        const minutesRemaining = Math.round((delayMs - timeSinceLastEntry) / 60000);

        if (timeSinceLastEntry < delayMs) {
          console.log(`  ⏳ Re-entry delay not met (${minutesRemaining} minutes remaining)`);
        } else {
          console.log(`  ✓ Re-entry delay met`);
        }
      } else {
        console.log(`  ✓ Should check price and market conditions`);
      }

      if (pendingOrders.size > 0) {
        console.log(`  ⚠️  Already has pending order - won't create new one`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

checkBotStatus()
  .then(() => {
    console.log('\n\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
