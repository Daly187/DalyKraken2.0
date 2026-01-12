import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Current asset mappings from assetNames.ts
const CURRENT_MAPPINGS = [
  'BTC', 'ETH', 'XRP', 'LTC', 'XLM', 'DOGE', 'ETC', 'XMR', 'ZEC', 'MLN', 'REP',
  'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'BCH', 'AAVE',
  'COMP', 'MKR', 'SNX', 'CRV', 'SUSHI', 'YFI', 'ALGO', 'XTZ', 'MANA', 'SAND',
  'GRT', 'FIL', 'NEAR', 'OP', 'ARB', 'LDO', 'APE', 'IMX', 'BLUR', 'AXS', 'ENJ',
  'GALA', 'BAND', 'FTM', 'MINA', 'FLOW', 'EOS', 'TRX', '1INCH', 'BAL',
  'INJ', 'DASH', 'ICP', // Recently added
  'USDT', 'USDC', 'DAI', 'BUSD', // Stablecoins
  'USD', 'EUR', 'GBP', 'CAD', 'JPY' // Fiat
];

async function checkAllAssets() {
  try {
    console.log('Fetching all DCA bots from Firebase...\n');

    const dcaBotsSnapshot = await db.collection('dcaBots').get();

    if (dcaBotsSnapshot.empty) {
      console.log('No DCA bots found');
      process.exit(1);
    }

    console.log(`Found ${dcaBotsSnapshot.size} DCA bots\n`);

    const allSymbols = new Set();
    const allAssets = new Set();
    const botsData = [];

    dcaBotsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.symbol) {
        allSymbols.add(data.symbol);
        // Extract base asset from symbol (e.g., "BTC" from "BTC/USD")
        const baseAsset = data.symbol.split('/')[0];
        allAssets.add(baseAsset);
        botsData.push({
          id: doc.id,
          symbol: data.symbol,
          baseAsset: baseAsset,
          totalVolume: data.totalVolume,
          totalInvested: data.totalInvested,
          status: data.status
        });
      }
    });

    console.log('=== ALL UNIQUE SYMBOLS ===');
    const sortedSymbols = Array.from(allSymbols).sort();
    sortedSymbols.forEach(symbol => {
      console.log(`  ${symbol}`);
    });

    console.log('\n=== ALL UNIQUE BASE ASSETS ===');
    const sortedAssets = Array.from(allAssets).sort();
    sortedAssets.forEach(asset => {
      console.log(`  ${asset}`);
    });

    console.log('\n=== MISSING FROM ASSET MAPPINGS ===');
    const missingAssets = sortedAssets.filter(asset => !CURRENT_MAPPINGS.includes(asset));

    if (missingAssets.length === 0) {
      console.log('  ✓ All assets are mapped!');
    } else {
      console.log('  ⚠️  The following assets are NOT in assetNames.ts:');
      missingAssets.forEach(asset => {
        const botsWithAsset = botsData.filter(b => b.baseAsset === asset);
        console.log(`    - ${asset} (${botsWithAsset.length} bots)`);
        botsWithAsset.forEach(bot => {
          console.log(`      → ${bot.symbol}: ${bot.totalVolume ? bot.totalVolume.toFixed(8) : 'N/A'} tokens, $${bot.totalInvested ? bot.totalInvested.toFixed(2) : 'N/A'} invested`);
        });
      });
    }

    console.log('\n=== ASSET MAPPING CODE TO ADD ===');
    if (missingAssets.length > 0) {
      console.log('\nAdd to KRAKEN_TO_COMMON_NAME:');
      missingAssets.forEach(asset => {
        console.log(`  '${asset}': '${asset}',`);
      });

      console.log('\nAdd to COMMON_NAME_TO_PAIR:');
      missingAssets.forEach(asset => {
        console.log(`  '${asset}': '${asset}/USD',`);
      });
    }

    console.log('\n=== BOTS BY ASSET ===');
    const assetGroups = {};
    botsData.forEach(bot => {
      if (!assetGroups[bot.baseAsset]) {
        assetGroups[bot.baseAsset] = [];
      }
      assetGroups[bot.baseAsset].push(bot);
    });

    Object.keys(assetGroups).sort().forEach(asset => {
      const bots = assetGroups[asset];
      const isMapped = CURRENT_MAPPINGS.includes(asset);
      const status = isMapped ? '✓' : '✗';
      console.log(`\n${status} ${asset} (${bots.length} bot${bots.length > 1 ? 's' : ''})`);
      bots.forEach(bot => {
        const volume = bot.totalVolume ? bot.totalVolume.toFixed(8) : 'N/A';
        const invested = bot.totalInvested ? bot.totalInvested.toFixed(2) : 'N/A';
        console.log(`    ${bot.symbol}: ${volume} tokens, $${invested} invested (${bot.status})`);
      });
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllAssets();
