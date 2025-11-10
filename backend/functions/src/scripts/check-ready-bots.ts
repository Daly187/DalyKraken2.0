/**
 * Check which bots are ready for first entry
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function checkReadyBots() {
  try {
    const snapshot = await db.collection('dcaBots').where('status', '==', 'active').get();
    const bots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Find bots with 0 entries and bullish trend
    const readyBots = bots.filter((bot: any) =>
      bot.currentEntryCount === 0 &&
      bot.trendAlignmentEnabled &&
      bot.techScore >= 50 &&
      bot.trendScore >= 50 &&
      bot.recommendation === 'bullish'
    );

    console.log('Bots ready for first entry (0 entries + bullish trend):');
    console.log('Total:', readyBots.length);
    console.log('');

    readyBots.forEach((bot: any) => {
      console.log(`- ${bot.symbol}: Tech ${bot.techScore}, Trend ${bot.trendScore}, Entries: ${bot.currentEntryCount}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkReadyBots().then(() => {
  process.exit(0);
});
