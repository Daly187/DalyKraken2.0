import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import KrakenClient from 'kraken-api';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function testActualBalanceKeys() {
  console.log('Testing ACTUAL Kraken balance API response...\n');

  // Get user's API keys
  const usersSnapshot = await db.collection('users').limit(1).get();
  const userData = usersSnapshot.docs[0].data();

  if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
    console.log('No Kraken keys found');
    process.exit(1);
  }

  const activeKey = userData.krakenKeys.find(k => k.isActive);
  if (!activeKey) {
    console.log('No active Kraken key');
    process.exit(1);
  }

  console.log('Found active Kraken keys ✅\n');

  // Create Kraken client
  const kraken = new KrakenClient(activeKey.apiKey, activeKey.apiSecret);

  try {
    // Get balance
    const response = await kraken.api('Balance');
    const balances = response.result;

    console.log('RAW Balance Response Keys:');
    console.log('='.repeat(50));
    Object.entries(balances).forEach(([key, value]) => {
      if (parseFloat(value) > 0) {
        console.log(`  ${key}: ${value}`);
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('\nNow checking what bots need:');
    console.log('='.repeat(50));

    // Check what the completed bots are looking for
    const botsSnapshot = await db.collection('dcaBots')
      .where('status', '==', 'completed')
      .get();

    for (const doc of botsSnapshot.docs) {
      const bot = { id: doc.id, ...doc.data() };
      if (bot.currentEntryCount > 0) {
        const baseAsset = bot.symbol.split('/')[0];

        console.log(`\nBot: ${bot.symbol}`);
        console.log(`  Looking for asset: ${baseAsset}`);
        console.log(`  Keys to try: ${baseAsset}, X${baseAsset}, Z${baseAsset}`);

        let found = false;
        [baseAsset, `X${baseAsset}`, `Z${baseAsset}`, baseAsset.replace(/^X/, ''), baseAsset.replace(/^Z/, '')].forEach(code => {
          if (balances[code] && parseFloat(balances[code]) > 0) {
            console.log(`  ✅ FOUND: ${code} = ${balances[code]}`);
            found = true;
          }
        });

        if (!found) {
          console.log(`  ❌ NOT FOUND in balance keys`);
        }
      }
    }

  } catch (error) {
    console.error('Error fetching balance:', error);
  }

  process.exit(0);
}

testActualBalanceKeys().catch(console.error);
