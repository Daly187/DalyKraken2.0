/**
 * Direct script to fix bot cycles in production
 * Run with: node fix-cycles-direct.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'dalydough',
});

const db = admin.firestore();

async function fixBotCycles() {
  console.log('[FixCycles] Starting bot cycle cleanup...');

  try {
    // Get all bots
    const botsSnapshot = await db.collection('dcaBots').get();
    console.log(`[FixCycles] Found ${botsSnapshot.size} bots to process`);

    let processed = 0;
    let fixed = 0;
    let errors = 0;

    for (const botDoc of botsSnapshot.docs) {
      const botId = botDoc.id;
      const botData = botDoc.data();

      try {
        processed++;
        console.log(`\n[FixCycles] Processing bot ${botId} (${botData.symbol})...`);

        // Initialize cycle tracking if missing
        const needsCycleInit = !botData.cycleId || !botData.cycleStartTime || !botData.cycleNumber;

        let cycleId = botData.cycleId;
        let cycleStartTime = botData.cycleStartTime;
        let cycleNumber = botData.cycleNumber;
        const previousCycles = botData.previousCycles || [];

        if (needsCycleInit) {
          // Determine cycle start time
          if (botData.lastExitTime) {
            // Bot has exited before, use lastExitTime as cycle start
            cycleStartTime = botData.lastExitTime;
            cycleNumber = (previousCycles.length || 0) + 1;
          } else {
            // Bot never exited, use creation time
            cycleStartTime = botData.createdAt || new Date().toISOString();
            cycleNumber = 1;
          }

          cycleId = `cycle_${new Date(cycleStartTime).getTime()}`;

          console.log(`[FixCycles] Initializing cycle tracking: cycleId=${cycleId}, cycleNumber=${cycleNumber}, cycleStartTime=${cycleStartTime}`);
        }

        // Get all entries for this bot
        const entriesSnapshot = await db
          .collection('dcaBots')
          .doc(botId)
          .collection('entries')
          .get();

        console.log(`[FixCycles] Found ${entriesSnapshot.size} entries`);

        // Filter entries to only include those from current cycle
        const cycleStartTimestamp = new Date(cycleStartTime).getTime();
        let entriesToKeep = 0;
        let entriesToDelete = 0;
        let totalInvested = 0;
        let totalVolume = 0;

        const batch = db.batch();

        for (const entryDoc of entriesSnapshot.docs) {
          const entry = entryDoc.data();
          const entryTimestamp = new Date(entry.timestamp).getTime();

          if (entryTimestamp < cycleStartTimestamp) {
            // Entry is from previous cycle, delete it
            console.log(`[FixCycles] Deleting old entry ${entryDoc.id} from ${entry.timestamp} (before cycle start ${cycleStartTime})`);
            batch.delete(entryDoc.ref);
            entriesToDelete++;
          } else {
            // Entry is from current cycle, update with cycle info
            const updates = {
              cycleId,
              cycleNumber,
            };

            // Add source if missing
            if (!entry.source) {
              updates.source = entry.orderId?.startsWith('O') ? 'bot_execution' : 'kraken_sync';
            }

            batch.update(entryDoc.ref, updates);
            entriesToKeep++;

            // Calculate totals only for filled entries
            if (entry.status === 'filled') {
              totalInvested += entry.orderAmount || 0;
              totalVolume += entry.quantity || 0;
            }
          }
        }

        // Commit entry updates/deletes
        await batch.commit();

        console.log(`[FixCycles] Entries: ${entriesToKeep} kept, ${entriesToDelete} deleted`);

        // Calculate average entry price
        const averageEntryPrice = totalVolume > 0 ? totalInvested / totalVolume : 0;

        // Update bot with correct cycle info and recalculated totals
        const botUpdates = {
          cycleId,
          cycleStartTime,
          cycleNumber,
          previousCycles,
          currentEntryCount: entriesToKeep,
          totalInvested,
          totalVolume,
          averageEntryPrice,
          averagePurchasePrice: averageEntryPrice,
          updatedAt: new Date().toISOString(),
        };

        await db.collection('dcaBots').doc(botId).update(botUpdates);

        console.log(`[FixCycles] ✅ Bot ${botId} (${botData.symbol}) fixed: cycle=${cycleNumber}, entries=${entriesToKeep}, invested=$${totalInvested.toFixed(2)}`);
        fixed++;

      } catch (error) {
        console.error(`[FixCycles] Error processing bot ${botId}:`, error.message);
        errors++;
      }
    }

    console.log(`\n[FixCycles] ✅ Cleanup complete!`);
    console.log(`[FixCycles] Processed: ${processed}, Fixed: ${fixed}, Errors: ${errors}`);

  } catch (error) {
    console.error('[FixCycles] Fatal error:', error.message);
    throw error;
  }
}

// Run the script
fixBotCycles()
  .then(() => {
    console.log('[FixCycles] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[FixCycles] Script failed:', error);
    process.exit(1);
  });
