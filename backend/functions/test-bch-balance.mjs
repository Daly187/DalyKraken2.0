import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { KrakenService } from './lib/services/krakenService.js';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function testBCHBalance() {
  // Get Kraken API keys
  const userKeysSnapshot = await db.collection('userKeys')
    .where('userId', '==', 'SpuaL2eGO3Nkh0kk2wkl')
    .get();

  if (userKeysSnapshot.empty) {
    console.log('No API keys found');
    process.exit(1);
  }

  const keys = userKeysSnapshot.docs[0].data();
  const krakenService = new KrakenService(keys.krakenApiKey, keys.krakenApiSecret);

  console.log('=== TESTING BCH BALANCE ===\n');

  // Get all balances
  const balances = await krakenService.getBalance();
  console.log('All balances from Kraken:');
  console.log(JSON.stringify(balances, null, 2));

  console.log('\n=== BCH-RELATED ASSETS ===');
  Object.keys(balances).forEach(key => {
    if (key.includes('BCH') || key.includes('BTC') && key !== 'XXBT') {
      console.log(`${key}: ${balances[key]}`);
    }
  });

  // Get BCH pair info
  console.log('\n=== BCH/USD PAIR INFO ===');
  const pairInfo = await krakenService.getAssetPairs('BCH/USD');
  console.log(JSON.stringify(pairInfo, null, 2));

  process.exit(0);
}

testBCHBalance().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
