#!/usr/bin/env node

/**
 * Fix BCH Bot - Direct Firestore Update Script
 * Uses Firebase CLI authentication
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin with project ID
const app = initializeApp({
  projectId: 'dalydough',
});

const db = getFirestore(app);

async function fixBCHBot() {
  console.log('🔧 Starting BCH bot fix...\n');

  try {
    // Find BCH bot
    console.log('📍 Searching for BCH/USD bot...');
    const botsSnapshot = await db.collection('dcaBots')
      .where('symbol', '==', 'BCH/USD')
      .get();

    if (botsSnapshot.empty) {
      console.log('❌ No BCH/USD bot found');
      process.exit(1);
    }

    const botDoc = botsSnapshot.docs[0];
    const botId = botDoc.id;
    const botData = botDoc.data();

    console.log(`✅ Found BCH bot: ${botId}`);
    console.log(`   Status: ${botData.status}`);
    console.log(`   Current entry count: ${botData.currentEntryCount}`);
    console.log(`   Total invested: $${botData.totalInvested}`);
    console.log(`   Last exit time: ${botData.lastExitTime || 'Never'}\n`);

    // Determine cycle start time
    let cycleStartTime;
    let cycleNumber;

    if (botData.lastExitTime) {
      // Bot has exited before, use lastExitTime as cycle start
      cycleStartTime = botData.lastExitTime;
      cycleNumber = 2; // Second cycle after exit
      console.log(`📅 Using last exit time as cycle start: ${cycleStartTime}`);
    } else {
      // Bot never exited, use creation time
      cycleStartTime = botData.createdAt || new Date().toISOString();
      cycleNumber = 1;
      console.log(`📅 Using creation time as cycle start: ${cycleStartTime}`);
    }

    const cycleId = `cycle_${new Date(cycleStartTime).getTime()}`;
    console.log(`🆔 Generated cycle ID: ${cycleId}`);
    console.log(`🔢 Cycle number: ${cycleNumber}\n`);

    // Get all entries
    console.log('📥 Fetching all entries...');
    const entriesSnapshot = await db
      .collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .get();

    console.log(`   Found ${entriesSnapshot.size} total entries\n`);

    // Filter entries by cycle start time
    const cycleStartTimestamp = new Date(cycleStartTime).getTime();
    let entriesToKeep = 0;
    let entriesToDelete = 0;
    let totalInvested = 0;
    let totalVolume = 0;

    console.log('🔍 Processing entries:');
    const batch = db.batch();

    for (const entryDoc of entriesSnapshot.docs) {
      const entry = entryDoc.data();
      const entryTimestamp = new Date(entry.timestamp).getTime();
      const entryDate = new Date(entry.timestamp).toISOString();

      if (entryTimestamp < cycleStartTimestamp) {
        // Entry is from previous cycle, delete it
        console.log(`   ❌ DELETE: ${entryDoc.id}`);
        console.log(`      Date: ${entryDate} (BEFORE cycle start)`);
        console.log(`      Amount: $${entry.orderAmount}`);
        batch.delete(entryDoc.ref);
        entriesToDelete++;
      } else {
        // Entry is from current cycle, keep and update
        console.log(`   ✅ KEEP: ${entryDoc.id}`);
        console.log(`      Date: ${entryDate} (AFTER cycle start)`);
        console.log(`      Amount: $${entry.orderAmount}`);
        console.log(`      Status: ${entry.status}`);

        const updates = {
          cycleId,
          cycleNumber,
          source: entry.source || (entry.orderId?.startsWith('O') ? 'bot_execution' : 'kraken_sync'),
        };

        batch.update(entryDoc.ref, updates);
        entriesToKeep++;

        // Calculate totals only for filled entries
        if (entry.status === 'filled') {
          totalInvested += entry.orderAmount || 0;
          totalVolume += entry.quantity || 0;
        }
      }
      console.log('');
    }

    console.log('💾 Committing entry changes...');
    await batch.commit();
    console.log('✅ Entry changes committed\n');

    // Calculate averages
    const averageEntryPrice = totalVolume > 0 ? totalInvested / totalVolume : 0;

    console.log('📊 Calculated values:');
    console.log(`   Entries to keep: ${entriesToKeep}`);
    console.log(`   Entries to delete: ${entriesToDelete}`);
    console.log(`   Total invested: $${totalInvested.toFixed(2)}`);
    console.log(`   Total volume: ${totalVolume}`);
    console.log(`   Average entry price: $${averageEntryPrice.toFixed(2)}\n`);

    // Update bot document
    console.log('💾 Updating bot document...');
    const botUpdates = {
      cycleId,
      cycleStartTime,
      cycleNumber,
      previousCycles: botData.previousCycles || [],
      currentEntryCount: entriesToKeep,
      totalInvested,
      totalVolume,
      averageEntryPrice,
      averagePurchasePrice: averageEntryPrice,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('dcaBots').doc(botId).update(botUpdates);
    console.log('✅ Bot document updated\n');

    console.log('🎉 BCH BOT SUCCESSFULLY FIXED!');
    console.log('\n📋 Summary:');
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Cycle: ${cycleNumber} (${cycleId})`);
    console.log(`   Entries kept: ${entriesToKeep}`);
    console.log(`   Entries deleted: ${entriesToDelete}`);
    console.log(`   Current invested: $${totalInvested.toFixed(2)}`);
    console.log('\n✨ Refresh your Firestore console to see the changes!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
fixBCHBot();
