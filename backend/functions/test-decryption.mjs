import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import KrakenClient from 'kraken-api';
import crypto from 'crypto';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Decrypt function (same logic as in settingsStore.ts)
function decryptKey(encrypted) {
  try {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32)),
      iv
    );

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error decrypting key:', error.message);
    return encrypted; // Return as-is if decryption fails
  }
}

async function testDecryption() {
  console.log('Testing key decryption and Kraken API...\n');

  // Get user's API keys
  const usersSnapshot = await db.collection('users').limit(1).get();
  const userData = usersSnapshot.docs[0].data();

  if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
    console.log('❌ No Kraken keys found');
    process.exit(1);
  }

  const activeKey = userData.krakenKeys.find(k => k.isActive);
  if (!activeKey) {
    console.log('❌ No active Kraken key');
    process.exit(1);
  }

  console.log('Key Info:');
  console.log(`  Encrypted: ${activeKey.encrypted}`);
  console.log(`  Raw API Key (first 20): ${activeKey.apiKey.substring(0, 20)}...`);
  console.log(`  Raw API Secret (first 20): ${activeKey.apiSecret.substring(0, 20)}...`);
  console.log('');

  // Decrypt the keys
  const decryptedApiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
  const decryptedApiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

  console.log('After Decryption:');
  console.log(`  Decrypted API Key (first 20): ${decryptedApiKey.substring(0, 20)}...`);
  console.log(`  Decrypted API Secret (first 20): ${decryptedApiSecret.substring(0, 20)}...`);
  console.log('');

  // Test with Kraken
  console.log('Testing with Kraken API...');
  const kraken = new KrakenClient(decryptedApiKey, decryptedApiSecret);

  try {
    const response = await kraken.api('Balance');
    console.log('✅ API call SUCCESSFUL!\n');
    console.log('Balance assets with holdings:');
    Object.entries(response.result).forEach(([key, value]) => {
      if (parseFloat(value) > 0) {
        console.log(`  ${key}: ${value}`);
      }
    });
  } catch (error) {
    console.log('❌ API call FAILED:', error.message);
    console.log('\nDecryption might have failed or keys are invalid');
  }

  process.exit(0);
}

testDecryption().catch(console.error);
