import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import KrakenClient from 'kraken-api';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testRawBalance() {
  try {
    console.log('Fetching Kraken API credentials...\n');

    // Get user with krakenKeys
    const usersSnapshot = await db.collection('users').get();
    let userData = null;

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (data.krakenKeys && data.krakenKeys.length > 0) {
        userData = data;
        console.log('Found user with API keys:', doc.id);
        break;
      }
    }

    if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
      console.log('No Kraken API keys found');
      process.exit(1);
    }

    const { apiKey, apiSecret } = userData.krakenKeys[0];
    console.log('API Key:', apiKey.substring(0, 10) + '...');

    console.log('\nCalling Kraken Balance API directly...\n');

    const client = new KrakenClient(apiKey, apiSecret);
    const response = await client.api('Balance');
    const balances = response.result;

    console.log('=== RAW KRAKEN API RESPONSE ===\n');
    console.log(JSON.stringify(balances, null, 2));

    console.log('\n=== ALL BALANCE KEYS ===');
    const allKeys = Object.keys(balances);
    console.log(`Total keys: ${allKeys.length}`);
    console.log(allKeys.join(', '));

    console.log('\n=== ALL NON-ZERO BALANCES ===');
    for (const [key, value] of Object.entries(balances)) {
      const bal = parseFloat(value);
      if (bal > 0.00000001) {
        console.log(`  ${key}: ${value}`);
      }
    }

    console.log('\n=== USD-RELATED KEYS ===');
    const usdKeys = allKeys.filter(k =>
      k.includes('USD') ||
      k.includes('DAI') ||
      k === 'ZUSD' ||
      k === 'USD'
    );
    console.log('Found USD-related keys:', usdKeys.length ? usdKeys.join(', ') : 'NONE');
    for (const key of usdKeys) {
      console.log(`  ${key}: ${balances[key]}`);
    }

    console.log('\n=== LOOKING FOR ~$253 BALANCE ===');
    let found253 = false;
    for (const [key, value] of Object.entries(balances)) {
      const bal = parseFloat(value);
      if (bal > 250 && bal < 260) {
        console.log(`🎯 FOUND IT! ${key}: ${value}`);
        found253 = true;
      }
    }
    if (!found253) {
      console.log('  No balance in $250-260 range found');
    }

    console.log('\n=== ALL BALANCES > $1 ===');
    for (const [key, value] of Object.entries(balances)) {
      const bal = parseFloat(value);
      if (bal > 1) {
        console.log(`  ${key}: ${value}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testRawBalance();
