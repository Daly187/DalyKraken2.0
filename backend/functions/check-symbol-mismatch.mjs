/**
 * Check symbol naming mismatches between Kraken pairs and bot symbols
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import KrakenClient from 'kraken-api';
import crypto from 'crypto';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

function decryptKey(encrypted) {
  try {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);

    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(encryptionKey),
      iv
    );

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return encrypted;
  }
}

async function checkSymbolMismatch() {
  console.log('=== Checking Symbol Mismatches ===\n');

  try {
    // Get all active bots
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('status', '==', 'active')
      .get();

    console.log('Active Bot Symbols in Database:');
    const botSymbols = [];
    botsSnapshot.forEach(doc => {
      const bot = doc.data();
      botSymbols.push(bot.symbol);
      console.log(`  - ${bot.symbol} (Bot ID: ${doc.id})`);
    });

    // Get user's API keys
    const userId = 'SpuaL2eGO3Nkh0kk2wkl';
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
      console.error('\nNo API keys found');
      return;
    }

    const activeKey = userData.krakenKeys.find(k => k.isActive);
    if (!activeKey) {
      console.error('\nNo active API key found');
      return;
    }

    const apiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
    const apiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

    // Fetch recent trades from Kraken
    console.log('\n\nFetching recent trades from Kraken...\n');
    const krakenClient = new KrakenClient(apiKey, apiSecret);

    const startTime = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Last 24 hours
    const result = await krakenClient.api('TradesHistory', { start: startTime });

    const trades = result.result?.trades || {};
    const uniquePairs = new Set();

    console.log('Kraken Trade Pairs (last 24 hours):');
    for (const [txid, trade] of Object.entries(trades)) {
      if (trade.type === 'buy') {
        uniquePairs.add(trade.pair);
      }
    }

    const pairArray = Array.from(uniquePairs).sort();
    pairArray.forEach(pair => {
      console.log(`  - ${pair}`);
    });

    // Show current mapping
    console.log('\n\nCurrent Symbol Mapping in tradesSyncService.ts:');
    console.log('  XATOMZUSD → ATOM/USD');
    console.log('  ATOMUSD → ATOM/USD');
    console.log('  XXDGZUSD → DOGE/USD');
    console.log('  DOGEUSD → DOGE/USD');
    console.log('  etc...');

    // Check for mismatches
    console.log('\n\n=== MISMATCHES FOUND ===\n');

    let foundMismatches = false;
    for (const krakenPair of pairArray) {
      // Try to find a matching bot symbol
      const matched = botSymbols.some(botSymbol => {
        // Remove slashes and compare
        const normalized = botSymbol.replace('/', '');
        return krakenPair.includes(normalized.substring(0, 3)) ||
               krakenPair.includes(normalized.substring(normalized.length - 3));
      });

      if (!matched) {
        console.log(`❌ Kraken pair "${krakenPair}" has NO matching bot`);
        foundMismatches = true;
      } else {
        // Find which bot it might match
        for (const botSymbol of botSymbols) {
          const base = botSymbol.split('/')[0];
          if (krakenPair.includes(base) || krakenPair.includes('X' + base + 'Z') ||
              krakenPair.includes(base.substring(0, 3))) {
            console.log(`✓ Kraken "${krakenPair}" → Bot "${botSymbol}"`);
            break;
          }
        }
      }
    }

    if (!foundMismatches) {
      console.log('All Kraken pairs have matching bots!');
    }

    // Generate recommended mapping
    console.log('\n\n=== RECOMMENDED MAPPING ===\n');
    console.log('Add these to normalizePair() function:\n');

    for (const krakenPair of pairArray) {
      // Try to extract base currency
      let base = krakenPair.replace('ZUSD', '').replace('USD', '').replace('X', '').replace('Z', '');

      // Find matching bot
      const matchingBot = botSymbols.find(s => s.startsWith(base) || s.includes(base));

      if (matchingBot) {
        console.log(`  '${krakenPair}': '${matchingBot}',`);
      } else {
        console.log(`  '${krakenPair}': '${base}/USD',  // ⚠️ No bot found - create bot first`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Run the check
checkSymbolMismatch()
  .then(() => {
    console.log('\n\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
