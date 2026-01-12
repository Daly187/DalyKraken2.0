import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testRawBalance() {
  try {
    console.log('Fetching Kraken API credentials...\n');

    // Get user document to retrieve Kraken API credentials
    const usersSnapshot = await db.collection('users').limit(1).get();

    if (usersSnapshot.empty) {
      console.log('No users found');
      process.exit(1);
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.krakenApiKey || !userData.krakenApiSecret) {
      console.log('No Kraken API credentials found');
      process.exit(1);
    }

    console.log('Calling Kraken Balance API directly...\n');

    // Import Kraken client directly
    const KrakenClient = (await import('kraken-api')).default;
    const client = new KrakenClient(
      userData.krakenApiKey,
      userData.krakenApiSecret
    );

    // Call the raw API
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
        console.log(`${key}: ${value}`);
      }
    }

    console.log('\n=== USD-RELATED KEYS ===');
    const usdKeys = allKeys.filter(k =>
      k.includes('USD') ||
      k.includes('DAI') ||
      k === 'ZUSD' ||
      k === 'USD'
    );
    console.log('Found USD-related keys:', usdKeys.join(', '));
    for (const key of usdKeys) {
      console.log(`  ${key}: ${balances[key]}`);
    }

    console.log('\n=== LOOKING FOR $253.57 ===');
    for (const [key, value] of Object.entries(balances)) {
      const bal = parseFloat(value);
      if (bal > 250 && bal < 260) {
        console.log(`🎯 FOUND IT! ${key}: ${value}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testRawBalance();
