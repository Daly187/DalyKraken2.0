/**
 * Check recent DCA bot scheduler runs
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function checkRecentRuns() {
  try {
    console.log('Checking recent DCA bot scheduler runs...\n');

    // Get recent system logs
    const logsSnapshot = await db
      .collection('systemLogs')
      .where('type', '==', 'dca_bot_processing')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (logsSnapshot.empty) {
      console.log('❌ No recent DCA bot runs found in systemLogs');
      return;
    }

    console.log(`Found ${logsSnapshot.size} recent run(s):\n`);

    logsSnapshot.docs.forEach((doc, index) => {
      const log = doc.data();
      console.log(`${index + 1}. Run at: ${log.timestamp}`);
      console.log(`   Completed: ${log.completedAt || 'N/A'}`);
      console.log(`   Total Bots: ${log.summary?.totalBots || 0}`);
      console.log(`   Processed: ${log.summary?.processed || 0}`);
      console.log(`   Entries: ${log.summary?.entries || 0}`);
      console.log(`   Exits: ${log.summary?.exits || 0}`);
      console.log(`   Skipped: ${log.summary?.skipped || 0}`);
      console.log(`   Failed: ${log.summary?.failed || 0}`);

      if (log.summary?.reasonCounts) {
        console.log(`\n   Skip/Fail Reasons:`);
        Object.entries(log.summary.reasonCounts)
          .sort(([, a]: any, [, b]: any) => (b as number) - (a as number))
          .forEach(([reason, count]) => {
            console.log(`     - ${reason}: ${count}`);
          });
      }

      // Show details for bots that were ready
      if (log.details && Array.isArray(log.details)) {
        const readyBots = log.details.filter((d: any) =>
          d.reason?.includes('ready') ||
          d.reason?.includes('Ready') ||
          d.reason?.includes('bullish')
        );

        if (readyBots.length > 0) {
          console.log(`\n   Bots ready to enter (${readyBots.length}):`);
          readyBots.forEach((bot: any) => {
            console.log(`     - ${bot.symbol}: ${bot.reason}`);
          });
        }

        // Show bots that entered
        const enteredBots = log.details.filter((d: any) => d.action === 'entry');
        if (enteredBots.length > 0) {
          console.log(`\n   ✅ Bots that ENTERED (${enteredBots.length}):`);
          enteredBots.forEach((bot: any) => {
            console.log(`     - ${bot.symbol}: ${bot.reason}`);
          });
        }

        // Show bots that failed
        const failedBots = log.details.filter((d: any) => d.failed);
        if (failedBots.length > 0) {
          console.log(`\n   ❌ Bots that FAILED (${failedBots.length}):`);
          failedBots.forEach((bot: any) => {
            console.log(`     - ${bot.symbol}: ${bot.reason}`);
          });
        }
      }

      console.log('\n' + '-'.repeat(80) + '\n');
    });

  } catch (error) {
    console.error('Error checking recent runs:', error);
  }
}

checkRecentRuns().then(() => {
  console.log('Check complete.');
  process.exit(0);
});
