import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// From globalPriceManager.ts GLOBAL_CRYPTO_PAIRS
const GLOBAL_PRICE_LIST = [
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD',
  'ADA/USD', 'AVAX/USD', 'DOT/USD', 'MATIC/USD', 'LINK/USD',
  'ATOM/USD', 'UNI/USD', 'LTC/USD', 'BCH/USD', 'NEAR/USD',
  'APT/USD', 'ARB/USD', 'OP/USD', 'IMX/USD', 'ALGO/USD',
  'AAVE/USD', 'GRT/USD', 'FIL/USD', 'LDO/USD', 'MKR/USD',
  'SNX/USD', 'SAND/USD', 'MANA/USD', 'AXS/USD', 'FLOW/USD',
  'XTZ/USD', 'EOS/USD', 'DOGE/USD', 'TRX/USD', 'ETC/USD',
  'XLM/USD', 'FTM/USD', 'MINA/USD', 'APE/USD', 'ENJ/USD',
  'CRV/USD', 'SUSHI/USD', 'YFI/USD', 'COMP/USD', 'BAL/USD',
  '1INCH/USD', 'GALA/USD', 'BLUR/USD', 'ANKR/USD', 'BAT/USD',
  'BAND/USD', 'AUDIO/USD', 'API3/USD', 'INJ/USD', 'RUNE/USD',
  'GLMR/USD', 'KSM/USD', 'KAVA/USD', 'CHZ/USD', 'ROSE/USD',
  'BONK/USD', 'PEPE/USD', 'WIF/USD', 'FLOKI/USD', 'JASMY/USD',
  'ZIL/USD', 'WAVES/USD', 'DASH/USD', 'ZEC/USD', 'IOTX/USD',
  'HBAR/USD', 'VET/USD', 'ONE/USD', 'CELO/USD', 'QTUM/USD',
  'ZRX/USD', 'BNT/USD', 'OMG/USD', 'SUI/USD', 'SEI/USD',
  'TIA/USD', 'PYTH/USD', 'JUP/USD', 'BERA/USD', 'BEAM/USD',
  'AR/USD', 'STORJ/USD', 'RENDER/USD', 'FET/USD', 'AGIX/USD',
  'RLC/USD', 'NMR/USD', 'CTSI/USD', 'AMP/USD', 'REQ/USD',
  'PHA/USD', 'ASTR/USD', 'ALICE/USD', 'ALCX/USD', 'PAXG/USD',
];

async function checkMissingPrices() {
  try {
    console.log('Checking which DCA bot assets are missing from global price list...\n');

    const dcaBotsSnapshot = await db.collection('dcaBots').get();
    const uniqueSymbols = new Set();

    dcaBotsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.symbol) {
        uniqueSymbols.add(data.symbol);
      }
    });

    const sortedSymbols = Array.from(uniqueSymbols).sort();
    const missingFromPriceList = sortedSymbols.filter(symbol => !GLOBAL_PRICE_LIST.includes(symbol));

    console.log(`Total unique bot symbols: ${sortedSymbols.length}`);
    console.log(`Symbols in global price list: ${GLOBAL_PRICE_LIST.length}`);
    console.log(`Missing from price list: ${missingFromPriceList.length}\n`);

    if (missingFromPriceList.length === 0) {
      console.log('✅ All DCA bot symbols are in the global price list!');
    } else {
      console.log('⚠️  The following symbols are MISSING from GLOBAL_CRYPTO_PAIRS:');
      console.log('   (These will be dynamically added by Portfolio page, but should be added to improve performance)\n');

      missingFromPriceList.forEach(symbol => {
        console.log(`  '${symbol}',`);
      });

      console.log('\n=== RECOMMENDED ACTION ===');
      console.log('Add these symbols to GLOBAL_CRYPTO_PAIRS in globalPriceManager.ts');
      console.log('for better performance and immediate price availability.\n');
    }

    // Also check which ones ARE in the list
    const inPriceList = sortedSymbols.filter(symbol => GLOBAL_PRICE_LIST.includes(symbol));
    console.log(`\n✓ ${inPriceList.length} symbols already in global price list`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMissingPrices();
