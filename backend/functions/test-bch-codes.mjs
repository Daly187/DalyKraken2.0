import KrakenClient from 'kraken-api';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

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
    return encrypted;
  }
}

const usersSnapshot = await db.collection('users').limit(1).get();
const userData = usersSnapshot.docs[0].data();
const activeKey = userData.krakenKeys.find(k => k.isActive);
const krakenApiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
const krakenApiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

const kraken = new KrakenClient(krakenApiKey, krakenApiSecret);

console.log('\n=== Testing BCH Asset Codes ===\n');

// Get AssetPairs info for BCH/USD
try {
  const pairResponse = await kraken.api('AssetPairs', { pair: 'BCHUSD' });
  const pairKey = Object.keys(pairResponse.result)[0];
  const pairInfo = pairResponse.result[pairKey];
  console.log('AssetPairs API says:');
  console.log(`  Pair: ${pairKey}`);
  console.log(`  Base Asset Code: ${pairInfo.base}`);
  console.log(`  Quote Asset Code: ${pairInfo.quote}`);
} catch (error) {
  console.log('AssetPairs error:', error.message);
}

// Get Balance
try {
  const balanceResponse = await kraken.api('Balance');
  console.log('\nBalance API returns these assets:');
  Object.entries(balanceResponse.result).forEach(([asset, balance]) => {
    if (parseFloat(balance) > 0) {
      console.log(`  ${asset}: ${balance}`);
    }
  });

  // Check specifically for BCH variants
  console.log('\nChecking BCH variants:');
  const variants = ['BCH', 'XBCH', 'XXBCH', 'ZBCH', 'BCHUSD'];
  variants.forEach(code => {
    const val = balanceResponse.result[code];
    console.log(`  ${code}: ${val || '(not found)'}`);
  });
} catch (error) {
  console.log('Balance error:', error.message);
}

process.exit(0);
