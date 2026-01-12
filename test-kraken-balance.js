// Quick test to see what Kraken actually returns for balance
// Run with: KRAKEN_API_KEY=your_key KRAKEN_API_SECRET=your_secret node test-kraken-balance.js

import KrakenClient from 'kraken-api';

const apiKey = process.env.KRAKEN_API_KEY;
const apiSecret = process.env.KRAKEN_API_SECRET;

if (!apiKey || !apiSecret) {
  console.log('Please set KRAKEN_API_KEY and KRAKEN_API_SECRET environment variables');
  console.log('Example: KRAKEN_API_KEY=xxx KRAKEN_API_SECRET=yyy node test-kraken-balance.js');
  process.exit(1);
}

console.log('Testing Kraken API...\n');
console.log('API Key:', apiKey.substring(0, 10) + '...');

const client = new KrakenClient(apiKey, apiSecret);

try {
  const response = await client.api('Balance');
  const balances = response.result;

  console.log('\n=== RAW KRAKEN RESPONSE ===');
  console.log(JSON.stringify(balances, null, 2));

  console.log('\n=== ALL BALANCE KEYS ===');
  console.log(Object.keys(balances).join(', '));

  console.log('\n=== USD-RELATED BALANCES ===');
  for (const [key, value] of Object.entries(balances)) {
    if (key.includes('USD') || key.includes('USDT') || key.includes('USDC')) {
      const bal = parseFloat(value);
      if (bal > 0) {
        console.log(`${key}: ${value}`);
      }
    }
  }

  console.log('\n=== ALL NON-ZERO BALANCES ===');
  for (const [key, value] of Object.entries(balances)) {
    const bal = parseFloat(value);
    if (bal > 0.00000001) {
      console.log(`${key}: ${value}`);
    }
  }

} catch (error) {
  console.error('Error:', error);
}
