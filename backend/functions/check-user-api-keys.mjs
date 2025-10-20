/**
 * Check if user has Kraken API keys
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkUserApiKeys() {
  const userId = 'SpuaL2eGO3Nkh0kk2wkl';

  console.log(`[Check] Checking API keys for user: ${userId}\n`);

  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    console.log('[Check] ❌ User document does not exist!');
    return;
  }

  const userData = userDoc.data();
  console.log('[Check] ✅ User document exists');

  if (!userData.krakenKeys) {
    console.log('[Check] ❌ No krakenKeys field found in user document');
    console.log('[Check] Available fields:', Object.keys(userData).join(', '));
    return;
  }

  console.log('[Check] ✅ krakenKeys field exists');
  console.log(`[Check] Number of keys: ${userData.krakenKeys.length}\n`);

  userData.krakenKeys.forEach((key, index) => {
    console.log(`Key #${index + 1}:`);
    console.log(`  ID: ${key.id || 'N/A'}`);
    console.log(`  Name: ${key.name || 'N/A'}`);
    console.log(`  API Key: ${key.apiKey ? key.apiKey.substring(0, 10) + '...' : 'N/A'}`);
    console.log(`  Is Active: ${key.isActive}`);
    console.log(`  Encrypted: ${key.encrypted}`);
    console.log('');
  });
}

// Run the script
checkUserApiKeys()
  .then(() => {
    console.log('\n[Check] Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Check] Error:', error);
    process.exit(1);
  });
