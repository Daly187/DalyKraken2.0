import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Kraken API helper
async function krakenRequest(endpoint, params = {}, apiKey, apiSecret) {
  const nonce = Date.now() * 1000;
  params.nonce = nonce;

  const postData = new URLSearchParams(params).toString();
  const sha256 = crypto.createHash('sha256').update(nonce + postData).digest();
  const hmac = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'));
  const signature = hmac.update(endpoint).update(sha256).digest('base64');

  const response = await fetch(`https://api.kraken.com${endpoint}`, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postData,
  });

  return response.json();
}

async function checkDogeBalance() {
  console.log('=== CHECKING ACTUAL KRAKEN BALANCE FOR DOGE ===\n');

  // Get user credentials
  const userDoc = await db.collection('users').limit(1).get();
  const user = userDoc.docs[0].data();

  const krakenKeys = user.krakenKeys || {};
  const apiKey = krakenKeys.apiKey;
  const apiSecret = krakenKeys.apiSecret;

  if (!apiKey || !apiSecret) {
    console.log('No Kraken credentials found');
    console.log('krakenKeys:', krakenKeys);
    process.exit(1);
  }

  // Get balance
  const result = await krakenRequest('/0/private/Balance', {}, apiKey, apiSecret);

  if (result.error && result.error.length > 0) {
    console.log('Kraken Error:', result.error);
    process.exit(1);
  }

  console.log('All Kraken Balances:');
  const balances = result.result;
  Object.keys(balances).forEach(key => {
    const val = parseFloat(balances[key]);
    if (val > 0) {
      console.log(`  ${key}: ${val}`);
    }
  });

  // Check DOGE specifically
  console.log('\n=== DOGE BALANCE CHECK ===');
  const possibleDogeKeys = ['DOGE', 'XXDG', 'XDG', 'DOGE.F', 'DOGE.S', 'XXDOGE'];

  possibleDogeKeys.forEach(key => {
    const val = balances[key];
    console.log(`  ${key}: ${val || 'NOT FOUND'}`);
  });

  // What the dcaBotService looks for
  console.log('\n=== HOW dcaBotService LOOKS UP DOGE ===');
  const symbol = 'DOGE/USD';
  const baseAsset = symbol.split('/')[0]; // "DOGE"

  // From krakenService.ts extractKrakenAsset
  const krakenAssetMap = {
    'BTC': 'XBT',
    'DOGE': 'XDG',
  };
  const mappedAsset = krakenAssetMap[baseAsset] || baseAsset;

  const possibleKeys = [
    mappedAsset,           // "XDG"
    baseAsset,             // "DOGE"
    `X${baseAsset}`,       // "XDOGE"
    `XX${baseAsset}`,      // "XXDOGE"
    `${baseAsset}.F`,      // "DOGE.F"
    `${mappedAsset}.F`,    // "XDG.F"
    `${baseAsset}.S`,      // "DOGE.S"
    `${mappedAsset}.S`,    // "XDG.S"
  ];

  console.log('Keys being checked:', possibleKeys);

  let foundBalance = 0;
  let foundKey = '';
  for (const key of possibleKeys) {
    if (balances[key]) {
      const balance = parseFloat(balances[key]);
      if (balance > 0) {
        foundBalance = balance;
        foundKey = key;
        break;
      }
    }
  }

  console.log(`\nResult: ${foundKey ? `Found ${foundBalance} at key "${foundKey}"` : 'NO BALANCE FOUND'}`);

  // Check if XXDG is the actual key
  console.log('\n=== CHECKING XXDG SPECIFICALLY ===');
  console.log('XXDG value:', balances['XXDG']);

  process.exit(0);
}

checkDogeBalance().catch(e => { console.error(e); process.exit(1); });
