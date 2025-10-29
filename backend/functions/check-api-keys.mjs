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

async function checkApiKeys() {
  console.log('Checking API keys in Firebase...\n');

  // Get user's API keys
  const usersSnapshot = await db.collection('users').limit(1).get();
  const userData = usersSnapshot.docs[0].data();
  const userId = usersSnapshot.docs[0].id;

  console.log(`User ID: ${userId}`);
  console.log(`Kraken Keys Count: ${userData.krakenKeys?.length || 0}\n`);

  if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
    console.log('❌ No Kraken keys found');
    process.exit(1);
  }

  userData.krakenKeys.forEach((key, index) => {
    console.log(`Key #${index + 1}:`);
    console.log(`  Name: ${key.name || 'N/A'}`);
    console.log(`  Active: ${key.isActive ? 'YES' : 'NO'}`);
    console.log(`  Encrypted: ${key.encrypted ? 'YES' : 'NO'}`);
    console.log(`  API Key (first 10 chars): ${key.apiKey?.substring(0, 10)}...`);
    console.log(`  API Secret (first 10 chars): ${key.apiSecret?.substring(0, 10)}...`);
    console.log('');
  });

  const activeKey = userData.krakenKeys.find(k => k.isActive);
  if (!activeKey) {
    console.log('❌ No active Kraken key');
    process.exit(1);
  }

  console.log('Testing active key with Kraken API...\n');

  // Test with the keys as-is (should work if not encrypted)
  const kraken = new KrakenClient(activeKey.apiKey, activeKey.apiSecret);

  try {
    const response = await kraken.api('Balance');
    console.log('✅ API call SUCCESSFUL!');
    console.log('Balance keys found:', Object.keys(response.result).join(', '));
  } catch (error) {
    console.log('❌ API call FAILED:', error.message);
    console.log('\nThis means either:');
    console.log('  1. The keys are encrypted and need decryption');
    console.log('  2. The keys are invalid or expired');
    console.log('  3. The keys don\'t have the required permissions');
  }

  process.exit(0);
}

checkApiKeys().catch(console.error);
