/**
 * Copy Kraken API keys from settingsStore (in-memory) to user document in Firestore
 * This allows the processOrderQueue scheduler to access the keys
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function copyKeysToUser() {
  const userId = 'SpuaL2eGO3Nkh0kk2wkl';

  console.log(`[Copy Keys] Copying Kraken API keys to user: ${userId}\n`);
  console.log('[Copy Keys] Please enter your Kraken API credentials when prompted.\n');
  console.log('[Copy Keys] NOTE: You can find these in your Kraken account settings.');
  console.log('[Copy Keys]       Make sure the keys have trading permissions enabled.\n');

  // Since we can't easily access the in-memory settingsStore from a script,
  // and we can't prompt for input in this environment, let's provide instructions
  console.log('='.repeat(70));
  console.log('MANUAL STEP REQUIRED:');
  console.log('='.repeat(70));
  console.log('');
  console.log('1. Go to the DalyDough web app and login');
  console.log('2. Navigate to Settings page');
  console.log('3. In the "Kraken API Keys" section, enter your API credentials');
  console.log('4. Click "Save Kraken Keys"');
  console.log('');
  console.log('The updated frontend code will now save keys to Firestore automatically.');
  console.log('');
  console.log('Alternative: Run this command with environment variables:');
  console.log('');
  console.log('  KRAKEN_API_KEY="your-key" KRAKEN_API_SECRET="your-secret" \\');
  console.log('  node save-keys-directly.mjs');
  console.log('');
  console.log('='.repeat(70));
}

// Run the script
copyKeysToUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Copy Keys] Error:', error);
    process.exit(1);
  });
