/**
 * Check if Kraken API keys are stored in Firestore
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../../serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkApiKeys() {
  console.log('[Check] Checking for Kraken API keys in Firestore...\n');

  try {
    // Check apiKeys collection
    const apiKeysSnapshot = await db.collection('apiKeys').get();

    console.log(`[Check] Found ${apiKeysSnapshot.size} total API key documents\n`);

    if (apiKeysSnapshot.empty) {
      console.log('❌ NO API KEYS FOUND IN FIRESTORE!');
      console.log('\nThis is why orders are not being executed.');
      console.log('The order queue needs API keys stored in Firestore to execute trades.');
      console.log('\nTo fix this, you need to add your Kraken API keys to the Settings page.');
      return;
    }

    // Show each API key
    apiKeysSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Document ID: ${doc.id}`);
      console.log(`  Name: ${data.name || 'N/A'}`);
      console.log(`  User ID: ${data.userId || 'N/A'}`);
      console.log(`  Active: ${data.isActive !== undefined ? data.isActive : 'N/A'}`);
      console.log(`  Encrypted: ${data.encrypted !== undefined ? data.encrypted : 'N/A'}`);
      console.log(`  API Key exists: ${!!data.apiKey}`);
      console.log(`  API Secret exists: ${!!data.apiSecret}`);
      console.log('');
    });

  } catch (error) {
    console.error('[Check] Error:', error.message);
  }
}

checkApiKeys();
