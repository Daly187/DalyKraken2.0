import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Updated GLOBAL_CRYPTO_PAIRS list (matching the new globalPriceManager.ts)
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
  // New additions
  'ICP/USD', 'ICX/USD', 'REP/USD', 'MLN/USD', 'USDT/USD', 'USDC/USD', 'DAI/USD',
  'RAY/USD', 'ORCA/USD', 'MNGO/USD', 'SRM/USD',
  'MOVR/USD', 'SDN/USD', 'CFG/USD', 'KILT/USD', 'KINT/USD',
  'KNC/USD', 'RPL/USD', 'PERP/USD', 'RARI/USD', 'LPT/USD',
  'BADGER/USD', 'KEEP/USD', 'REN/USD', 'SPELL/USD', 'OXT/USD',
  'EWT/USD', 'OCEAN/USD', 'GHST/USD', 'GLM/USD', 'SC/USD',
  'AKT/USD', 'ANT/USD', 'AIR/USD', 'T/USD', 'TBTC/USD',
  'ETH2/USD', 'XRT/USD', 'LSK/USD',
];

async function verifyPrices() {
  try {
    console.log('Verifying all DCA bot symbols have price coverage...\n');

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
    console.log(`Symbols in updated price list: ${GLOBAL_PRICE_LIST.length}`);
    console.log(`Missing from price list: ${missingFromPriceList.length}\n`);

    if (missingFromPriceList.length === 0) {
      console.log('✅ SUCCESS! All DCA bot symbols are now in the global price list!');
      console.log('   All portfolio assets will show correct prices immediately.');
    } else {
      console.log('❌ STILL MISSING:');
      missingFromPriceList.forEach(symbol => {
        console.log(`  - ${symbol}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPrices();
