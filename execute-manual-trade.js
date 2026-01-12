#!/usr/bin/env node

/**
 * Manual Trade Execution Script
 * Execute manual trades on Kraken
 *
 * Usage: node execute-manual-trade.js <symbol> <side> <amount>
 * Example: node execute-manual-trade.js AVNT short 5
 */

import https from 'https';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        env[key.trim()] = value.trim();
      }
    }
    return env;
  } catch (error) {
    return {};
  }
}

const env = loadEnv();
const KRAKEN_API_KEY = env.KRAKEN_API_KEY || process.env.KRAKEN_API_KEY;
const KRAKEN_API_SECRET = env.KRAKEN_API_SECRET || process.env.KRAKEN_API_SECRET;

// Parse command line arguments
const [,, symbol, side, amount] = process.argv;

if (!symbol || !side || !amount) {
  console.error('❌ Usage: node execute-manual-trade.js <symbol> <side> <amount>');
  console.error('   Example: node execute-manual-trade.js AVNT short 5');
  process.exit(1);
}

if (!KRAKEN_API_KEY || !KRAKEN_API_SECRET) {
  console.error('❌ Missing Kraken API credentials');
  console.error('   Set KRAKEN_API_KEY and KRAKEN_API_SECRET in .env file');
  process.exit(1);
}

// Helper to make HTTPS requests
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Sign Kraken request
function getMessageSignature(path, request, secret) {
  const message = request.nonce + new URLSearchParams(request).toString();
  const secret_buffer = Buffer.from(secret, 'base64');
  const hash = crypto.createHash('sha256');
  const hmac = crypto.createHmac('sha512', secret_buffer);
  const hash_digest = hash.update(message).digest();
  const hmac_digest = hmac.update(path + hash_digest).digest('base64');
  return hmac_digest;
}

// Make Kraken API request
async function krakenRequest(endpoint, params = {}) {
  const path = `/0/private/${endpoint}`;
  const nonce = Date.now() * 1000;
  const request = { nonce, ...params };

  const signature = getMessageSignature(path, request, KRAKEN_API_SECRET);
  const body = new URLSearchParams(request).toString();

  const options = {
    method: 'POST',
    headers: {
      'API-Key': KRAKEN_API_KEY,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  };

  const data = await httpsRequest(`https://api.kraken.com${path}`, options);

  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }

  return data.result;
}

// Execute the trade
async function executeTrade() {
  console.log('\n🚀 DalyDough Manual Trade Execution');
  console.log('=====================================');
  console.log(`Symbol: ${symbol}`);
  console.log(`Side: ${side}`);
  console.log(`Amount: $${amount}`);
  console.log('=====================================\n');

  try {
    // Step 1: Get ticker price
    console.log('📊 Fetching current price...');
    const tickerData = await httpsRequest(`https://api.kraken.com/0/public/Ticker?pair=${symbol}USD`);

    if (tickerData.error && tickerData.error.length > 0) {
      throw new Error(`Ticker error: ${tickerData.error.join(', ')}`);
    }

    // Find the pair in the response (Kraken returns with different formatting)
    const pairKey = Object.keys(tickerData.result)[0];
    if (!pairKey) {
      throw new Error(`Could not find ticker data for ${symbol}USD`);
    }

    const ticker = tickerData.result[pairKey];
    const currentPrice = parseFloat(ticker.c[0]); // Last trade price

    console.log(`✅ Current ${symbol} price: $${currentPrice.toFixed(6)}`);

    // Step 2: Calculate quantity
    const quantity = parseFloat(amount) / currentPrice;
    console.log(`📏 Calculated quantity: ${quantity.toFixed(8)} ${symbol}`);

    // Step 3: Determine order type
    const orderType = side.toLowerCase() === 'short' ? 'sell' : 'buy';

    // Step 4: Place order
    console.log(`\n📝 Placing ${orderType.toUpperCase()} order...`);

    const orderParams = {
      pair: `${symbol}USD`,
      type: orderType,
      ordertype: 'market',
      volume: quantity.toFixed(8),
      validate: false, // Set to true for dry run
    };

    console.log('Order parameters:', JSON.stringify(orderParams, null, 2));

    const result = await krakenRequest('AddOrder', orderParams);

    console.log('\n✅ ORDER PLACED SUCCESSFULLY!');
    console.log('=====================================');
    console.log('Transaction IDs:', result.txid);
    console.log('Description:', result.descr);
    console.log('=====================================\n');

    // Step 5: Verify order
    if (result.txid && result.txid.length > 0) {
      console.log('📋 Order Details:');
      console.log(`   Pair: ${symbol}USD`);
      console.log(`   Type: ${orderType.toUpperCase()}`);
      console.log(`   Volume: ${quantity.toFixed(8)} ${symbol}`);
      console.log(`   Approx Value: $${amount}`);
      console.log(`   Price: ~$${currentPrice.toFixed(6)}`);
      console.log(`   Order ID: ${result.txid[0]}\n`);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the script
executeTrade().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
