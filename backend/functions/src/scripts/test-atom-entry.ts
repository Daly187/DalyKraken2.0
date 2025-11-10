/**
 * Test ATOM bot entry logic to see why it's not entering
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DCABotService } from '../services/dcaBotService.js';
import { KrakenService } from '../services/krakenService.js';
import { decryptKey } from '../services/settingsStore.js';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function testAtomEntry() {
  try {
    console.log('='.repeat(80));
    console.log('TESTING ATOM/USD BOT ENTRY LOGIC');
    console.log('='.repeat(80));

    // Get ATOM bot
    const snapshot = await db.collection('dcaBots').where('symbol', '==', 'ATOM/USD').get();
    if (snapshot.empty) {
      console.log('No ATOM/USD bot found');
      return;
    }

    const botDoc = snapshot.docs[0];
    const botData = botDoc.data();
    const botId = botDoc.id;

    console.log('\nBot ID:', botId);
    console.log('Symbol:', botData.symbol);
    console.log('Current Entry Count:', botData.currentEntryCount);
    console.log('S/R Enabled:', botData.supportResistanceEnabled);
    console.log('Trend Enabled:', botData.trendAlignmentEnabled);

    // Get user settings
    const userDoc = await db.collection('users').doc(botData.userId).get();
    const userData = userDoc.data();
    const apiKey = decryptKey(userData.apiKey);
    const apiSecret = decryptKey(userData.apiSecret);

    console.log('\nInitializing services...');
    const krakenService = new KrakenService(apiKey, apiSecret);
    const dcaBotService = new DCABotService(db);

    // Get bot with live data
    console.log('\nFetching live bot data...');
    const liveBot = await dcaBotService.getBotById(botId, krakenService);

    if (!liveBot) {
      console.log('Could not fetch live bot data');
      return;
    }

    console.log('\nLive Bot Data:');
    console.log('  Current Price:', liveBot.currentPrice);
    console.log('  Current Entry Count:', liveBot.currentEntryCount);
    console.log('  Tech Score:', liveBot.techScore?.toFixed(0));
    console.log('  Trend Score:', liveBot.trendScore?.toFixed(0));
    console.log('  Recommendation:', liveBot.recommendation);
    console.log('  Support:', liveBot.support?.toFixed(4));
    console.log('  Resistance:', liveBot.resistance?.toFixed(4));

    // Check if should enter
    console.log('\n' + '='.repeat(80));
    console.log('CALLING shouldEnterPosition() WITH BACKEND LOGIC...');
    console.log('='.repeat(80));

    const entryCheck = await dcaBotService.shouldEnterPosition(liveBot, liveBot.currentPrice);

    console.log('\nResult from backend:');
    console.log('  Should Enter:', entryCheck.shouldEnter ? '✅ YES' : '❌ NO');
    console.log('  Reason:', entryCheck.reason);

    if (entryCheck.shouldEnter) {
      console.log('\n🚀 Bot SHOULD be entering!');
      console.log('   This means the backend logic is correct and will enter on next scheduler run.');
    } else {
      console.log('\n⚠️  Bot is being blocked by:', entryCheck.reason);
      console.log('   Need to investigate why the backend is blocking this.');
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('Error testing ATOM entry:', error);
  }
}

testAtomEntry().then(() => {
  console.log('\nTest complete. Exiting...');
  process.exit(0);
});
