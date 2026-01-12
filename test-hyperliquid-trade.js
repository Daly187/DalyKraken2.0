#!/usr/bin/env node

/**
 * HyperLiquid Manual Trade Test Script
 * Tests the fixed HyperLiquid order execution code
 *
 * IMPORTANT: Run this with credentials as arguments OR set them in .env
 *
 * Usage Option 1 (with arguments):
 *   node test-hyperliquid-trade.js <symbol> <side> <amount> <wallet> <private_key>
 *   Example: node test-hyperliquid-trade.js AVNT short 5 0x123... 0xabc...
 *
 * Usage Option 2 (with .env file):
 *   node test-hyperliquid-trade.js <symbol> <side> <amount>
 *   Example: node test-hyperliquid-trade.js AVNT short 5
 *   (Requires HYPERLIQUID_WALLET_ADDRESS and HYPERLIQUID_PRIVATE_KEY in .env)
 */

import https from 'https';
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

// Parse command line arguments
const args = process.argv.slice(2);
const symbol = args[0];
const side = args[1];
const amount = args[2];
const walletFromArgs = args[3];
const privateKeyFromArgs = args[4];

// Get credentials from args or env
const HL_WALLET_ADDRESS = walletFromArgs || env.HYPERLIQUID_WALLET_ADDRESS || process.env.HYPERLIQUID_WALLET_ADDRESS;
const HL_PRIVATE_KEY = privateKeyFromArgs || env.HYPERLIQUID_PRIVATE_KEY || process.env.HYPERLIQUID_PRIVATE_KEY;

if (!symbol || !side || !amount) {
  console.error('❌ Usage: node test-hyperliquid-trade.js <symbol> <side> <amount> [wallet] [private_key]');
  console.error('   Example: node test-hyperliquid-trade.js AVNT short 5');
  console.error('   Or with credentials: node test-hyperliquid-trade.js AVNT short 5 0x123... 0xabc...');
  process.exit(1);
}

if (!HL_WALLET_ADDRESS || !HL_PRIVATE_KEY) {
  console.error('❌ Missing HyperLiquid credentials');
  console.error('   Option 1: Set HYPERLIQUID_WALLET_ADDRESS and HYPERLIQUID_PRIVATE_KEY in .env file');
  console.error('   Option 2: Pass as command line arguments:');
  console.error('   node test-hyperliquid-trade.js AVNT short 5 <wallet_address> <private_key>');
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

// Get HyperLiquid asset index
async function getAssetIndex(symbol) {
  const baseAsset = symbol.replace('USDT', '').replace('PERP', '').replace('USD', '');

  const response = await httpsRequest('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  });

  const assetIndex = response.universe.findIndex(a => a.name === baseAsset);

  if (assetIndex === -1) {
    throw new Error(`Asset ${baseAsset} not found in HyperLiquid meta. Available: ${response.universe.map(a => a.name).slice(0, 10).join(', ')}...`);
  }

  return assetIndex;
}

// Get current market price
async function getMarketPrice(symbol) {
  const baseAsset = symbol.replace('USDT', '').replace('PERP', '').replace('USD', '');

  const response = await httpsRequest('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'allMids'
    }),
  });

  const price = parseFloat(response[baseAsset]);

  if (!price) {
    throw new Error(`Could not find price for ${baseAsset}. Available: ${Object.keys(response).slice(0, 10).join(', ')}...`);
  }

  return price;
}

// Sign HyperLiquid order with EIP-712 (FIXED VERSION - matches deployed code)
async function signOrder(orderData, privateKey) {
  // Dynamic import of ethers
  const { ethers } = await import('ethers');

  const wallet = new ethers.Wallet(privateKey);

  // EIP-712 domain for HyperLiquid
  const domain = {
    name: 'Exchange',
    version: '1',
    chainId: 1337,
    verifyingContract: '0x0000000000000000000000000000000000000000',
  };

  // Correct EIP-712 types for HyperLiquid order signing (FIXED)
  const types = {
    Order: [
      { name: 'a', type: 'uint32' },  // asset index
      { name: 'b', type: 'bool' },    // is_buy
      { name: 'p', type: 'uint64' },  // price (in 1e8 units) - FIXED from string
      { name: 's', type: 'uint64' },  // size (in 1e8 units) - FIXED from string
      { name: 'r', type: 'bool' },    // reduce_only
      { name: 't', type: 'uint8' },   // order_type (0=limit, 1=trigger, etc.) - FIXED
      { name: 'c', type: 'uint64' },  // limit_px (same as p for non-trigger orders) - ADDED
    ]
  };

  // Convert string prices/sizes to integer format for signing
  // HyperLiquid uses 1e8 for precision
  const priceInt = Math.round(parseFloat(orderData.p) * 1e8);
  const sizeInt = Math.round(parseFloat(orderData.s) * 1e8);

  // Create the order object for signing
  const orderForSigning = {
    a: orderData.a,        // asset index (already a number)
    b: orderData.b,        // is_buy (already a boolean)
    p: priceInt,           // price as integer (FIXED)
    s: sizeInt,            // size as integer (FIXED)
    r: orderData.r,        // reduce_only (already a boolean)
    t: 0,                  // 0 for limit orders, 1 for trigger orders (FIXED)
    c: priceInt,           // limit_px (same as price for limit orders) (ADDED)
  };

  console.log('📝 Order data for signing:', orderForSigning);

  // Sign the typed data (ethers v6 uses signTypedData, not _signTypedData)
  const signature = await wallet.signTypedData(domain, types, orderForSigning);
  const sig = ethers.Signature.from(signature);

  return {
    r: sig.r,
    s: sig.s,
    v: sig.v,
  };
}

// Place order on HyperLiquid
async function placeOrder(assetIndex, isBuy, price, size, orderType = 'MARKET') {
  // Format price as string with proper precision
  let orderPrice;
  if (orderType === 'MARKET') {
    // For market orders (IoC), set extreme prices to ensure fill
    orderPrice = isBuy
      ? (price * 1.05).toFixed(8)  // 5% above for buys
      : (price * 0.95).toFixed(8); // 5% below for sells
  } else {
    // For limit orders, use exact price
    orderPrice = price.toFixed(8);
  }

  // Format size as string with proper precision
  const orderSize = size.toFixed(8);

  // Create the order object that will be signed
  const orderToSign = {
    a: assetIndex,              // asset index as number
    b: isBuy,                   // boolean for is_buy
    p: orderPrice,              // price as string (will be converted in signing)
    s: orderSize,               // size as string (will be converted in signing)
    r: false,                   // reduce_only
  };

  console.log('📋 Order to sign:', orderToSign);

  // Sign the order
  const signature = await signOrder(orderToSign, HL_PRIVATE_KEY);
  console.log('🔐 Signature generated:', {
    r: signature.r.substring(0, 16) + '...',
    s: signature.s.substring(0, 16) + '...',
    v: signature.v
  });

  // Build the order type object for the API
  const orderTypeObj = orderType === 'LIMIT'
    ? { limit: { tif: 'Gtc' } }      // Good till cancelled for limit orders
    : { limit: { tif: 'Ioc' } };     // Immediate or cancel for market orders

  // Create the order object for the API (different format than signing)
  const apiOrder = {
    a: assetIndex,
    b: isBuy,
    p: orderPrice,        // Keep as string for API
    s: orderSize,         // Keep as string for API
    r: false,
    t: orderTypeObj,      // Order type object for API
  };

  // Build the complete action
  const action = {
    type: 'order',
    orders: [apiOrder],
    grouping: 'na',
  };

  console.log('📤 Action for API:', JSON.stringify(action, null, 2));

  // Create the final request
  const orderRequest = {
    action,
    nonce: Date.now(),
    signature,
    vaultAddress: null,  // null for main account
  };

  console.log('🚀 Sending order request to HyperLiquid API...\n');

  // Send the order
  const response = await httpsRequest('https://api.hyperliquid.xyz/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderRequest),
  });

  return response;
}

// Execute the trade
async function executeTrade() {
  console.log('\n🚀 HyperLiquid Manual Trade Test');
  console.log('=====================================');
  console.log(`Symbol: ${symbol}`);
  console.log(`Side: ${side}`);
  console.log(`Amount: $${amount}`);
  console.log(`Wallet: ${HL_WALLET_ADDRESS}`);
  console.log('=====================================\n');

  try {
    // Step 1: Get asset index
    console.log('📊 Step 1: Fetching asset index...');
    const assetIndex = await getAssetIndex(symbol);
    console.log(`✅ Asset index for ${symbol}: ${assetIndex}\n`);

    // Step 2: Get current price
    console.log('📊 Step 2: Fetching current price...');
    const currentPrice = await getMarketPrice(symbol);
    console.log(`✅ Current ${symbol} price: $${currentPrice.toFixed(6)}\n`);

    // Step 3: Calculate quantity
    console.log('📏 Step 3: Calculating quantity...');
    const quantity = parseFloat(amount) / currentPrice;
    console.log(`✅ Calculated quantity: ${quantity.toFixed(8)} ${symbol}\n`);

    // Step 4: Determine order side
    const isBuy = side.toLowerCase() === 'long' || side.toLowerCase() === 'buy';
    const orderSide = isBuy ? 'BUY (LONG)' : 'SELL (SHORT)';

    // Step 5: Place order (using MARKET for testing)
    console.log(`📝 Step 4: Placing MARKET ${orderSide} order...`);
    console.log('─────────────────────────────────────\n');

    const result = await placeOrder(assetIndex, isBuy, currentPrice, quantity, 'MARKET');

    console.log('\n✅ ORDER RESPONSE RECEIVED!');
    console.log('=====================================');
    console.log('Full Response:', JSON.stringify(result, null, 2));
    console.log('=====================================\n');

    // Step 6: Extract order details
    const orderId = result.response?.data?.statuses?.[0]?.oid ||
                    result.status?.statuses?.[0]?.oid ||
                    'unknown';
    const orderStatus = result.response?.data?.statuses?.[0]?.status ||
                       result.status?.statuses?.[0]?.status ||
                       'unknown';

    console.log('📋 Order Details:');
    console.log('─────────────────────────────────────');
    console.log(`   Asset: ${symbol}`);
    console.log(`   Side: ${orderSide}`);
    console.log(`   Type: MARKET (IoC)`);
    console.log(`   Quantity: ${quantity.toFixed(8)} ${symbol}`);
    console.log(`   Approx Value: $${amount}`);
    console.log(`   Price: ~$${currentPrice.toFixed(6)}`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Status: ${orderStatus}`);
    console.log('─────────────────────────────────────\n');

    if (orderStatus === 'filled' || orderStatus === 'success') {
      console.log('✅ ✅ ✅ ORDER FILLED SUCCESSFULLY! ✅ ✅ ✅\n');
      console.log('🎉 The fixed HyperLiquid execution code is working!\n');
    } else if (orderStatus === 'error' || result.status === 'err') {
      console.log('❌ ORDER FAILED');
      console.log('Error details:', result);
      console.log('\n');
    } else {
      console.log(`⚠️  Order status: ${orderStatus}`);
      console.log('Check the full response above for details.\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);

    if (error.message.includes('signature')) {
      console.error('\n💡 Signature validation failed - check private key and wallet address');
    }
    if (error.message.includes('margin')) {
      console.error('\n💡 Insufficient USDC in HyperLiquid account');
    }
    if (error.message.includes('not found')) {
      console.error('\n💡 Asset not found - check symbol spelling');
    }

    process.exit(1);
  }
}

// Run the script
executeTrade().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
