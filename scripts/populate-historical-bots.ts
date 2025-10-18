/**
 * Script to Populate Historical DCA Bots
 *
 * This script creates DCA bots in Firestore based on historical trading data
 * from the audit log. These bots were created before the app but should follow
 * the same logic as the current DCA bots.
 *
 * Usage:
 * 1. Update the HISTORICAL_BOTS array below with your historical bot data
 * 2. Run: npx ts-node scripts/populate-historical-bots.ts
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Initialize Firebase Admin
// Make sure you have the service account key in the correct location
try {
  const serviceAccount = JSON.parse(
    readFileSync(resolve(__dirname, '../backend/functions/serviceAccountKey.json'), 'utf-8')
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.log('Note: If you get an error about serviceAccountKey.json, you need to:');
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('2. Click "Generate New Private Key"');
  console.log('3. Save it as backend/functions/serviceAccountKey.json');
  throw error;
}

const db = admin.firestore();

/**
 * Define your historical bots here based on your audit log data
 *
 * To find your historical bot data:
 * 1. Look at your trade history in the audit log
 * 2. Identify patterns of DCA-style entries (multiple buys at different prices)
 * 3. Group them by symbol
 * 4. Fill in the configuration that matches your trading strategy
 */
const HISTORICAL_BOTS = [
  // Example bot - Replace with your actual data
  {
    symbol: 'BTC/USD',
    initialOrderAmount: 10,
    tradeMultiplier: 2,
    reEntryCount: 8,
    stepPercent: 1,
    stepMultiplier: 2,
    tpTarget: 3,
    supportResistanceEnabled: false,
    reEntryDelay: 888,
    trendAlignmentEnabled: true,
    status: 'completed' as const, // or 'active', 'paused', 'stopped'
    userId: 'default-user',
    // Entries for this bot (historical trades)
    entries: [
      {
        entryNumber: 1,
        orderAmount: 10,
        price: 45000, // Replace with actual price from audit log
        quantity: 10 / 45000,
        timestamp: new Date('2025-01-01T00:00:00Z'), // Replace with actual timestamp
        orderId: 'KRAKEN_ORDER_ID_1', // Replace with actual order ID if available
        status: 'filled' as const,
      },
      {
        entryNumber: 2,
        orderAmount: 20,
        price: 44550, // Replace with actual price
        quantity: 20 / 44550,
        timestamp: new Date('2025-01-02T00:00:00Z'),
        orderId: 'KRAKEN_ORDER_ID_2',
        status: 'filled' as const,
      },
      // Add more entries as needed
    ],
  },

  // Add more bots here
  // You can copy the structure above and modify for each symbol you traded
  {
    symbol: 'ETH/USD',
    initialOrderAmount: 10,
    tradeMultiplier: 2,
    reEntryCount: 8,
    stepPercent: 1,
    stepMultiplier: 2,
    tpTarget: 3,
    supportResistanceEnabled: false,
    reEntryDelay: 888,
    trendAlignmentEnabled: true,
    status: 'active' as const,
    userId: 'default-user',
    entries: [],
  },
];

async function populateHistoricalBots() {
  console.log('Starting historical bot population...');
  console.log(`Found ${HISTORICAL_BOTS.length} bots to create`);

  let successCount = 0;
  let errorCount = 0;

  for (const botData of HISTORICAL_BOTS) {
    try {
      console.log(`\nProcessing bot for ${botData.symbol}...`);

      // Create bot document
      const botRef = db.collection('dcaBots').doc();
      const botId = botRef.id;

      const { entries, ...botConfig } = botData;

      const bot = {
        ...botConfig,
        createdAt: admin.firestore.Timestamp.now().toDate().toISOString(),
        updatedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
      };

      await botRef.set(bot);
      console.log(`✓ Created bot ${botId} for ${botData.symbol}`);

      // Create entries if any
      if (entries && entries.length > 0) {
        const batch = db.batch();

        for (const entry of entries) {
          const entryRef = botRef.collection('entries').doc();
          const entryData = {
            ...entry,
            botId,
            id: entryRef.id,
            timestamp: admin.firestore.Timestamp.fromDate(entry.timestamp).toDate().toISOString(),
          };
          batch.set(entryRef, entryData);
        }

        await batch.commit();
        console.log(`✓ Created ${entries.length} entries for ${botData.symbol}`);
      }

      successCount++;
    } catch (error: any) {
      console.error(`✗ Error creating bot for ${botData.symbol}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('Population Summary:');
  console.log(`✓ Successfully created: ${successCount} bots`);
  console.log(`✗ Failed: ${errorCount} bots`);
  console.log('========================================\n');

  console.log('Next steps:');
  console.log('1. Open your DalyDCA page in the app');
  console.log('2. The bots should now appear in the table');
  console.log('3. You can pause, resume, or delete them as needed');
}

// Instructions for users
console.log('========================================');
console.log('DCA Bot Population Script');
console.log('========================================\n');
console.log('BEFORE RUNNING THIS SCRIPT:');
console.log('1. Review your trade history in the Audit Log page');
console.log('2. Update the HISTORICAL_BOTS array in this file with your actual data');
console.log('3. Replace the example entries with your real trade data');
console.log('4. Update timestamps, prices, and order IDs to match your audit log\n');
console.log('Press Ctrl+C to exit if you need to update the data first.\n');

// Run the script
populateHistoricalBots()
  .then(() => {
    console.log('Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
