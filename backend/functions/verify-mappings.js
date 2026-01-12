import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Updated asset mappings (matching assetNames.ts)
const CURRENT_MAPPINGS = [
  'BTC', 'ETH', 'XRP', 'LTC', 'XLM', 'DOGE', 'ETC', 'XMR', 'ZEC', 'MLN', 'REP',
  'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'BCH', 'AAVE',
  'COMP', 'MKR', 'SNX', 'CRV', 'SUSHI', 'YFI', 'ALGO', 'XTZ', 'MANA', 'SAND',
  'GRT', 'FIL', 'NEAR', 'OP', 'ARB', 'LDO', 'APE', 'IMX', 'BLUR', 'AXS', 'ENJ',
  'GALA', 'BAND', 'FTM', 'MINA', 'FLOW', 'EOS', 'TRX', '1INCH', 'BAL',
  'INJ', 'DASH', 'ICP',
  'AIR', 'AKT', 'ANT', 'API3', 'APT', 'BADGER', 'BAT', 'BNB', 'BNT', 'CFG',
  'ETH2', 'EWT', 'FET', 'GHST', 'GLM', 'ICX', 'KAVA', 'KEEP', 'KILT', 'KINT',
  'KNC', 'KSM', 'LPT', 'LSK', 'MNGO', 'MOVR', 'OCEAN', 'OMG', 'ORCA', 'OXT',
  'PAXG', 'PERP', 'PHA', 'QTUM', 'RARI', 'RAY', 'REN', 'RPL', 'RUNE', 'SC',
  'SDN', 'SPELL', 'SRM', 'STORJ', 'T', 'TBTC', 'WAVES', 'XRT', 'ZRX',
  'USDT', 'USDC', 'DAI', 'BUSD',
  'USD', 'EUR', 'GBP', 'CAD', 'JPY'
];

async function verifyMappings() {
  try {
    console.log('Verifying all DCA bot asset mappings...\n');

    const dcaBotsSnapshot = await db.collection('dcaBots').get();
    const allAssets = new Set();

    dcaBotsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.symbol) {
        const baseAsset = data.symbol.split('/')[0];
        allAssets.add(baseAsset);
      }
    });

    const sortedAssets = Array.from(allAssets).sort();
    const missingAssets = sortedAssets.filter(asset => !CURRENT_MAPPINGS.includes(asset));

    console.log(`Total unique assets in DCA bots: ${sortedAssets.length}`);
    console.log(`Assets in mapping: ${CURRENT_MAPPINGS.length}`);
    console.log(`Missing from mapping: ${missingAssets.length}\n`);

    if (missingAssets.length === 0) {
      console.log('✅ SUCCESS! All assets are now properly mapped!');
      console.log('\nAll DCA bot balances should now display correctly in the UI.');
    } else {
      console.log('❌ STILL MISSING:');
      missingAssets.forEach(asset => {
        console.log(`  - ${asset}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyMappings();
