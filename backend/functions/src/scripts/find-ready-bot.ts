/**
 * Find which bot should be entering right now
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { MarketAnalysisService } from '../services/marketAnalysisService.js';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function findReadyBot() {
  try {
    console.log('Checking all bots with 0 entries for entry readiness...\n');

    const snapshot = await db.collection('dcaBots').where('status', '==', 'active').get();
    const bots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

    const marketAnalysis = new MarketAnalysisService();

    // Filter to bots with 0 entries
    const zeroBots = bots.filter(bot => bot.currentEntryCount === 0 && bot.trendAlignmentEnabled);

    console.log(`Found ${zeroBots.length} bots with 0 entries and trend alignment enabled:\n`);

    for (const bot of zeroBots) {
      const analysis = await marketAnalysis.analyzeTrend(bot.symbol);
      const shouldEnter = analysis.recommendation === 'bullish';

      console.log(`${bot.symbol}:`);
      console.log(`  Tech: ${analysis.techScore.toFixed(0)}, Trend: ${analysis.trendScore.toFixed(0)}`);
      console.log(`  Recommendation: ${analysis.recommendation}`);
      console.log(`  Should Enter: ${shouldEnter ? '✅ YES' : '❌ NO'}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

findReadyBot().then(() => {
  process.exit(0);
});
