import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function backfillBotStats() {
  console.log('=== Backfilling Bot Statistics ===\n');

  try {
    // Get all DCA bots
    const botsSnapshot = await db.collection('dcaBots').get();

    if (botsSnapshot.empty) {
      console.log('No bots found');
      return;
    }

    console.log(`Found ${botsSnapshot.size} bots\n`);

    for (const botDoc of botsSnapshot.docs) {
      const bot = botDoc.data();
      const botId = botDoc.id;

      console.log(`Processing bot: ${bot.symbol} (${botId})`);

      // Get all entries for this bot
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(botId)
        .collection('entries')
        .get();

      if (entriesSnapshot.empty) {
        console.log(`  No entries found for this bot`);
        continue;
      }

      console.log(`  Found ${entriesSnapshot.size} entries`);

      // Calculate stats from entries
      let totalInvested = 0;
      let totalVolume = 0;
      let entryCount = 0;

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();

        // Only count completed entries (you may need to adjust this based on your status values)
        if (entry.status === 'completed' || entry.status === 'filled') {
          const orderAmount = parseFloat(entry.orderAmount || 0);
          const quantity = parseFloat(entry.quantity || 0);
          const price = parseFloat(entry.price || 0);

          totalInvested += orderAmount;
          totalVolume += quantity;
          entryCount++;

          console.log(`    Entry ${entryCount}: $${orderAmount.toFixed(2)} at $${price.toFixed(2)}`);
        }
      }

      if (entryCount === 0) {
        console.log(`  No completed entries found`);
        continue;
      }

      // Calculate average purchase price
      const averagePurchasePrice = totalVolume > 0 ? totalInvested / totalVolume : 0;

      console.log(`  Total Invested: $${totalInvested.toFixed(2)}`);
      console.log(`  Total Volume: ${totalVolume.toFixed(8)}`);
      console.log(`  Entry Count: ${entryCount}`);
      console.log(`  Average Price: $${averagePurchasePrice.toFixed(2)}`);

      // Update bot document
      await db.collection('dcaBots').doc(botId).update({
        totalInvested: totalInvested,
        averagePurchasePrice: averagePurchasePrice,
        averageEntryPrice: averagePurchasePrice,
        totalVolume: totalVolume,
        currentEntryCount: entryCount,
        updatedAt: new Date().toISOString(),
      });

      console.log(`  ✓ Bot updated successfully\n`);
    }

    console.log('\n=== Backfill Complete ===');
  } catch (error) {
    console.error('Error backfilling bot stats:', error);
    throw error;
  }
}

// Run the backfill
backfillBotStats()
  .then(() => {
    console.log('\nBackfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  });
