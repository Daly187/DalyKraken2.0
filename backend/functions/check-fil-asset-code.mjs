import KrakenClient from 'kraken-api';
import { readFileSync } from 'fs';

// Load credentials from your service account
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

// You'll need to get Kraken API keys - let me check what endpoint to use
const kraken = new KrakenClient();

async function checkFILAssetCode() {
  try {
    console.log('\n=== Checking FIL Asset Code on Kraken ===\n');

    // Get AssetPairs info for FIL/USD
    const pairInfo = await kraken.api('AssetPairs', { pair: 'FILUSD' });

    if (pairInfo.error && pairInfo.error.length > 0) {
      console.error('Error:', pairInfo.error);
      process.exit(1);
    }

    console.log('FIL/USD Pair Information:');
    console.log(JSON.stringify(pairInfo.result, null, 2));

    // The result will show you:
    // - wsname: The WebSocket name
    // - altname: Alternative name
    // - base: The base asset code that Kraken uses
    // - quote: The quote asset code

    const pairData = Object.values(pairInfo.result)[0];
    console.log('\n=== Key Information ===');
    console.log(`Base Asset Code: ${pairData.base}`);
    console.log(`Quote Asset Code: ${pairData.quote}`);
    console.log(`WebSocket Name: ${pairData.wsname}`);
    console.log(`Alt Name: ${pairData.altname}`);
    console.log(`Order Min: ${pairData.ordermin}`);
    console.log(`Lot Decimals: ${pairData.lot_decimals}`);
    console.log(`Pair Decimals: ${pairData.pair_decimals}`);

    console.log('\n=== What This Means ===');
    console.log(`When checking balance, look for asset code: "${pairData.base}"`);
    console.log(`When placing orders, use pair: "FILUSD" (no slash)`);

  } catch (error) {
    console.error('Error checking FIL asset code:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkFILAssetCode();
