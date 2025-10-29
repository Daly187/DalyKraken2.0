import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setBalanceCache() {
  console.log('Manually setting balance cache from Portfolio data...\n');

  // Based on the Portfolio screenshots provided
  const balanceCache = {
    'ADA': 15.843876,
    'BCH': 0.041292,
    // Add other holdings as needed
  };

  console.log('Setting balances:');
  Object.entries(balanceCache).forEach(([asset, balance]) => {
    console.log(`  ${asset}: ${balance}`);
  });

  // Store in Firestore
  await db.collection('krakenBalanceCache').doc('latest').set({
    balances: balanceCache,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'manual_from_portfolio',
  });

  console.log(`\n✅ Balance cache updated successfully`);
  process.exit(0);
}

setBalanceCache().catch(console.error);
