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

// Decrypt function
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
    return encrypted;
  }
}

async function populateBalanceCache() {
  console.log('Fetching Kraken balances and populating cache...\n');

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

  const krakenApiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
  const krakenApiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

  console.log('✅ API keys loaded');

  // Fetch balances from Kraken
  const kraken = new KrakenClient(krakenApiKey, krakenApiSecret);

  try {
    const response = await kraken.api('Balance');
    const balances = response.result;

    console.log(`✅ Fetched ${Object.keys(balances).length} balance entries from Kraken`);

    // Convert string balances to numbers
    const balanceCache = {};
    Object.entries(balances).forEach(([asset, balance]) => {
      const numBalance = parseFloat(balance);
      if (numBalance > 0) {
        balanceCache[asset] = numBalance;
        console.log(`  ${asset}: ${numBalance}`);
      }
    });

    // Store in Firestore
    await db.collection('krakenBalanceCache').doc('latest').set({
      balances: balanceCache,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'rest_api_manual',
    });

    console.log(`\n✅ Balance cache updated successfully with ${Object.keys(balanceCache).length} assets`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fetching balances:', error.message);

    if (error.message.includes('Temporary lockout')) {
      console.log('\n⚠️  Kraken API rate limit. Please wait 15-60 minutes and try again.');
    }

    process.exit(1);
  }
}

populateBalanceCache().catch(console.error);
