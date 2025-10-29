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

async function testSellOrder() {
  const userId = 'SpuaL2eGO3Nkh0kk2wkl';
  
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  const client = new KrakenClient(userData.krakenApiKey, userData.krakenApiSecret);
  
  // Get balance first
  console.log('\n1. Getting balance...');
  const balanceResponse = await client.api('Balance');
  console.log('Balance response:', JSON.stringify(balanceResponse.result, null, 2));
  
  // Get AssetPairs info for AVAX/USD
  console.log('\n2. Getting AssetPairs info for AVAXUSD...');
  const pairResponse = await client.api('AssetPairs', { pair: 'AVAXUSD' });
  const pairInfo = Object.values(pairResponse.result)[0];
  console.log('Pair info:', JSON.stringify(pairInfo, null, 2));
  
  // Get the exact base asset code
  const baseAsset = pairInfo.base;
  console.log('\n3. Base asset code:', baseAsset);
  
  // Get balance for this asset
  const balance = parseFloat(balanceResponse.result[baseAsset] || 0);
  console.log('Balance for', baseAsset, ':', balance);
  
  // Calculate sell volume (90% of balance)
  const exitPercentage = 90;
  const volume = balance * (exitPercentage / 100);
  const volumePrecision = pairInfo.lot_decimals || 8;
  const finalVolume = parseFloat(volume.toFixed(volumePrecision));
  
  console.log('\n4. Calculated sell volume:');
  console.log('   Raw balance:', balance);
  console.log('   Exit %:', exitPercentage);
  console.log('   Volume before precision:', volume);
  console.log('   Precision (lot_decimals):', volumePrecision);
  console.log('   Final volume:', finalVolume);
  
  // Try to place the order
  console.log('\n5. Attempting to place sell order...');
  console.log('   Pair: AVAXUSD');
  console.log('   Type: sell');
  console.log('   Order type: market');
  console.log('   Volume:', finalVolume);
  
  try {
    const orderResponse = await client.api('AddOrder', {
      pair: 'AVAXUSD',
      type: 'sell',
      ordertype: 'market',
      volume: finalVolume.toString()
    });
    
    console.log('\n✅ SUCCESS!');
    console.log('Order response:', JSON.stringify(orderResponse, null, 2));
  } catch (error) {
    console.log('\n❌ FAILED!');
    console.log('Error:', error.message);
    if (error.error) {
      console.log('Kraken errors:', error.error);
    }
    console.log('Full error:', JSON.stringify(error, null, 2));
  }
  
  process.exit(0);
}

testSellOrder();
