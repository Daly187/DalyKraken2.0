import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkBalance() {
  try {
    console.log('Fetching Kraken API credentials...\n');

    // Get user document to retrieve Kraken API credentials
    const usersSnapshot = await db.collection('users').limit(1).get();

    if (usersSnapshot.empty) {
      console.log('No users found');
      process.exit(1);
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.krakenApiKey || !userData.krakenApiSecret) {
      console.log('No Kraken API credentials found');
      process.exit(1);
    }

    console.log('Fetching balance from Kraken...\n');

    // Import KrakenService
    const { default: KrakenService } = await import('./lib/services/krakenService.js');

    const krakenService = new KrakenService(
      userData.krakenApiKey,
      userData.krakenApiSecret
    );

    const balances = await krakenService.getBalance();

    console.log('=== FULL KRAKEN BALANCE ===\n');
    console.log('All balance keys:', Object.keys(balances).join(', '));
    console.log('\n=== DETAILED BALANCES ===\n');

    // Group balances by type
    const usdBalances = {};
    const stablecoinBalances = {};
    const cryptoBalances = {};

    for (const [key, value] of Object.entries(balances)) {
      const balance = parseFloat(value);
      if (balance === 0) continue; // Skip zero balances

      if (key.includes('USD') && !key.includes('T') && !key.includes('C')) {
        usdBalances[key] = balance;
      } else if (key.includes('USDT') || key.includes('USDC') || key.includes('DAI')) {
        stablecoinBalances[key] = balance;
      } else {
        cryptoBalances[key] = balance;
      }
    }

    // Display USD balances
    console.log('💵 USD BALANCES:');
    if (Object.keys(usdBalances).length === 0) {
      console.log('  None found');
    } else {
      let totalUSD = 0;
      for (const [key, balance] of Object.entries(usdBalances)) {
        console.log(`  ${key}: $${balance.toFixed(2)}`);
        totalUSD += balance;
      }
      console.log(`  TOTAL USD: $${totalUSD.toFixed(2)}`);
    }

    console.log('\n💰 STABLECOIN BALANCES:');
    if (Object.keys(stablecoinBalances).length === 0) {
      console.log('  None found');
    } else {
      let totalStables = 0;
      for (const [key, balance] of Object.entries(stablecoinBalances)) {
        console.log(`  ${key}: $${balance.toFixed(2)}`);
        totalStables += balance;
      }
      console.log(`  TOTAL STABLECOINS: $${totalStables.toFixed(2)}`);
    }

    console.log('\n🪙 CRYPTO BALANCES:');
    if (Object.keys(cryptoBalances).length === 0) {
      console.log('  None found');
    } else {
      for (const [key, balance] of Object.entries(cryptoBalances)) {
        console.log(`  ${key}: ${balance.toFixed(8)}`);
      }
    }

    // Calculate total USD equivalent
    const totalUSD = Object.values(usdBalances).reduce((sum, bal) => sum + bal, 0);
    const totalStables = Object.values(stablecoinBalances).reduce((sum, bal) => sum + bal, 0);
    const totalUSDEquivalent = totalUSD + totalStables;

    console.log('\n=== SUMMARY ===');
    console.log(`Total USD + Stablecoins: $${totalUSDEquivalent.toFixed(2)}`);
    console.log(`  - Pure USD: $${totalUSD.toFixed(2)}`);
    console.log(`  - Stablecoins: $${totalStables.toFixed(2)}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBalance();
