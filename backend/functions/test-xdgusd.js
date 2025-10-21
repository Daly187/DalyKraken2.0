const mapping = {
  'DOGEUSD': 'DOGE/USD',
  'XXDGZUSD': 'DOGE/USD',
  'XDGUSD': 'DOGE/USD',
};

function normalizePair(krakenPair) {
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

console.log('Testing XDGUSD:');
console.log(`XDGUSD → ${normalizePair('XDGUSD')}`);
console.log(normalizePair('XDGUSD') === 'DOGE/USD' ? '✓ CORRECT - XDGUSD now maps to DOGE/USD' : '✗ WRONG');
