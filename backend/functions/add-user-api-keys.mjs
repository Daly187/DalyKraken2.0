/**
 * Manually add Kraken API keys to user document
 * This will allow the processOrderQueue scheduler to execute pending orders
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import crypto from 'crypto';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Encryption function (must match backend/functions/src/services/settingsStore.ts)
function encryptKey(text) {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key!!';
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function addUserApiKeys() {
  const userId = 'SpuaL2eGO3Nkh0kk2wkl';

  console.log(`[Add Keys] Adding Kraken API keys for user: ${userId}\n`);

  // Prompt for API keys
  console.log('Please enter your Kraken API credentials:');
  console.log('(These will be encrypted before storage)\n');

  // For now, we'll use environment variables or you can modify this to prompt for input
  const API_KEY = process.env.KRAKEN_API_KEY;
  const API_SECRET = process.env.KRAKEN_API_SECRET;

  if (!API_KEY || !API_SECRET) {
    console.error('[Add Keys] ❌ Error: Please set KRAKEN_API_KEY and KRAKEN_API_SECRET environment variables');
    console.error('Example: KRAKEN_API_KEY=xxx KRAKEN_API_SECRET=yyy node add-user-api-keys.mjs');
    process.exit(1);
  }

  console.log(`[Add Keys] API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`[Add Keys] API Secret: ${API_SECRET.substring(0, 10)}...\n`);

  // Encrypt the keys
  const encryptedApiKey = encryptKey(API_KEY);
  const encryptedApiSecret = encryptKey(API_SECRET);

  // Create key object
  const krakenKey = {
    id: 'primary-key',
    name: 'Primary Kraken Account',
    apiKey: encryptedApiKey,
    apiSecret: encryptedApiSecret,
    encrypted: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log('[Add Keys] Saving encrypted API keys to Firestore...');

  // Save to Firestore
  await db.collection('users').doc(userId).set(
    {
      krakenKeys: [krakenKey],
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log('[Add Keys] ✅ API keys saved successfully!\n');

  // Verify
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (userData && userData.krakenKeys && userData.krakenKeys.length > 0) {
    console.log('[Add Keys] ✅ Verification successful:');
    console.log(`[Add Keys]    - Number of keys: ${userData.krakenKeys.length}`);
    console.log(`[Add Keys]    - Key name: ${userData.krakenKeys[0].name}`);
    console.log(`[Add Keys]    - Key active: ${userData.krakenKeys[0].isActive}`);
    console.log(`[Add Keys]    - Key encrypted: ${userData.krakenKeys[0].encrypted}`);
  } else {
    console.log('[Add Keys] ❌ Verification failed - keys not found in user document');
  }
}

// Run the script
addUserApiKeys()
  .then(() => {
    console.log('\n[Add Keys] Complete! The processOrderQueue scheduler can now execute orders.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Add Keys] Error:', error);
    process.exit(1);
  });
