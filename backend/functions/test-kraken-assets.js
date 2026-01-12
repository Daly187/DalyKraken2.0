import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testKrakenAssets() {
  try {
    console.log('Fetching Kraken API credentials...\n');

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

    console.log('Fetching balance from Kraken...\n');

    const { default: KrakenService } = await import('./lib/services/krakenService.js');

    const krakenService = new KrakenService(
      userData.krakenApiKey,
      userData.krakenApiSecret
    );

    const balances = await krakenService.getBalance();

    console.log('=== LOOKING FOR INJ, DASH, and ICP ===\n');

    // Search for INJ-related keys
    const injKeys = Object.keys(balances).filter(key =>
      key.toUpperCase().includes('INJ')
    );

    if (injKeys.length > 0) {
      console.log('INJ-related balance keys found:');
      injKeys.forEach(key => {
        console.log(`  ${key}: ${balances[key]}`);
      });
    } else {
      console.log('No INJ-related balance keys found');
    }

    console.log('');

    // Search for DASH-related keys
    const dashKeys = Object.keys(balances).filter(key =>
      key.toUpperCase().includes('DASH')
    );

    if (dashKeys.length > 0) {
      console.log('DASH-related balance keys found:');
      dashKeys.forEach(key => {
        console.log(`  ${key}: ${balances[key]}`);
      });
    } else {
      console.log('No DASH-related balance keys found');
    }

    console.log('');

    // Search for ICP-related keys
    const icpKeys = Object.keys(balances).filter(key =>
      key.toUpperCase().includes('ICP')
    );

    if (icpKeys.length > 0) {
      console.log('ICP-related balance keys found:');
      icpKeys.forEach(key => {
        console.log(`  ${key}: ${balances[key]}`);
      });
    } else {
      console.log('No ICP-related balance keys found');
    }

    console.log('\n=== ALL BALANCE KEYS (for reference) ===');
    console.log(Object.keys(balances).sort().join(', '));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testKrakenAssets();
