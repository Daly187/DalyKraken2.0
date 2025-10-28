import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import KrakenClient from 'kraken-api';

const serviceAccount = JSON.parse(
  readFileSync('/Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function checkKrakenBalance() {
  const userId = 'SpuaL2eGO3Nkh0kk2wkl';
  
  const userDoc = await db.collection('users').doc(userId).get();
  const krakenKey = userDoc.data().krakenApiKey;
  const krakenSecret = userDoc.data().krakenApiSecret;
  
  const client = new KrakenClient(krakenKey, krakenSecret);
  
  const response = await client.api('Balance');
  
  console.log('Kraken balances for user:\n');
  
  const assets = ['ADA', 'XADA', 'BCH', 'XBCH', 'AVAX', 'XXBT', 'BTC'];
  
  for (const asset of assets) {
    if (response.result[asset]) {
      console.log(asset + ':', response.result[asset]);
    }
  }

  process.exit(0);
}

checkKrakenBalance();
