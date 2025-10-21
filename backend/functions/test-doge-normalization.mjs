/**
 * Test DOGE pair normalization
 */

// Test the normalizePair function with DOGE variants
function normalizePair(krakenPair) {
  const mapping = {
    'ATOMUSD': 'ATOM/USD',
    'XATOMZUSD': 'ATOM/USD',
    'DOGEUSD': 'DOGE/USD',
    'XXDGZUSD': 'DOGE/USD',
    'XDGUSD': 'DOGE/USD',
    'DOGUSD': 'DOGE/USD',
    'GRTUSD': 'GRT/USD',
    'LINKUSD': 'LINK/USD',
    'ETHUSD': 'ETH/USD',
    'XETHZUSD': 'ETH/USD',
    'BTCUSD': 'BTC/USD',
    'XXBTZUSD': 'BTC/USD',
    'XBTUSD': 'BTC/USD',
    'ALGOUSD': 'ALGO/USD',
    'MANAUSD': 'MANA/USD',
    'DOTUSD': 'DOT/USD',
    'NEARUSD': 'NEAR/USD',
    'FILUSD': 'FIL/USD',
    'BCHUSD': 'BCH/USD',
    'SANDUSD': 'SAND/USD',
    'SOLUSD': 'SOL/USD',
    'ADAUSD': 'ADA/USD',
    'UNIUSD': 'UNI/USD',
    'AVAXUSD': 'AVAX/USD',
    'XLMUSD': 'XLM/USD',
    'XRPUSD': 'XRP/USD',
    'XXRPZUSD': 'XRP/USD',
    'LTCUSD': 'LTC/USD',
    'XLTCZUSD': 'LTC/USD',
    'GALAUSD': 'GALA/USD',
  };

  if (mapping[krakenPair]) {
    return mapping[krakenPair];
  }

  let normalized = krakenPair
    .replace(/^X/, '')
    .replace(/^XX/, '')
    .replace(/ZUSD$/, '')
    .replace(/USD$/, '');

  return `${normalized}/USD`;
}

console.log('=== Testing DOGE Pair Normalization ===\n');

const dogeVariants = [
  'DOGEUSD',
  'XXDGZUSD',
  'XDGUSD',
  'DOGUSD',
  'XDG',
  'XXDG',
];

dogeVariants.forEach(variant => {
  const normalized = normalizePair(variant);
  const match = normalized === 'DOGE/USD' ? '✓' : '✗';
  console.log(`${match} "${variant}" → "${normalized}"`);
});

console.log('\n=== Testing All Your Bots ===\n');

const botSymbols = [
  'DOT/USD', 'BCH/USD', 'NEAR/USD', 'DOGE/USD', 'LTC/USD',
  'FIL/USD', 'ATOM/USD', 'GRT/USD', 'SAND/USD', 'XRP/USD',
  'MANA/USD', 'ALGO/USD', 'ADA/USD', 'UNI/USD', 'LINK/USD',
  'XLM/USD', 'SOL/USD', 'AVAX/USD'
];

// Common Kraken formats to test
const testPairs = botSymbols.map(symbol => {
  const base = symbol.split('/')[0];
  return [
    `${base}USD`,
    `X${base}ZUSD`,
    `X${base}USD`,
  ];
}).flat();

console.log('Testing common Kraken formats:\n');
testPairs.forEach(pair => {
  const normalized = normalizePair(pair);
  const match = botSymbols.includes(normalized) ? '✓' : '✗';
  console.log(`${match} "${pair}" → "${normalized}"`);
});
