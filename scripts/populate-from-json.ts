/**
 * Populate DCA Bots from JSON File
 *
 * This script reads historical-bots.json and creates the bots in Firestore.
 *
 * Usage:
 * 1. Copy historical-bots-template.json to historical-bots.json
 * 2. Edit historical-bots.json with your actual data
 * 3. Run: npx ts-node scripts/populate-from-json.ts
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, '../backend/functions/serviceAccountKey.json');
const botsDataPath = resolve(__dirname, 'historical-bots.json');

if (!existsSync(serviceAccountPath)) {
  console.error('ERROR: Service account key not found!');
  console.log('\nTo fix this:');
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('2. Click "Generate New Private Key"');
  console.log('3. Save it as backend/functions/serviceAccountKey.json');
  process.exit(1);
}

if (!existsSync(botsDataPath)) {
  console.error('ERROR: historical-bots.json not found!');
  console.log('\nTo fix this:');
  console.log('1. Copy historical-bots-template.json to historical-bots.json');
  console.log('2. Edit historical-bots.json with your actual bot data');
  console.log('3. Run this script again');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error: any) {
  console.error('ERROR: Failed to initialize Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function populateBots() {
  console.log('========================================');
  console.log('DCA Bot Population from JSON');
  console.log('========================================\n');

  // Read bots data
  const data = JSON.parse(readFileSync(botsDataPath, 'utf-8'));
  const bots = data.bots || [];

  if (!Array.isArray(bots) || bots.length === 0) {
    console.error('ERROR: No bots found in historical-bots.json');
    console.log('Make sure the file has a "bots" array with at least one bot.');
    process.exit(1);
  }

  console.log(`Found ${bots.length} bot(s) to create\n`);

  let successCount = 0;
  let errorCount = 0;
  const createdBots: string[] = [];

  for (const botData of bots) {
    try {
      // Validate required fields
      if (!botData.symbol) {
        throw new Error('Missing required field: symbol');
      }
      if (botData.initialOrderAmount === undefined) {
        throw new Error('Missing required field: initialOrderAmount');
      }

      console.log(`Creating bot for ${botData.symbol}...`);

      // Create bot document
      const botRef = db.collection('dcaBots').doc();
      const botId = botRef.id;

      const { entries, comment, ...botConfig } = botData;

      const bot = {
        ...botConfig,
        createdAt: admin.firestore.Timestamp.now().toDate().toISOString(),
        updatedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
      };

      await botRef.set(bot);
      console.log(`  ✓ Created bot: ${botId}`);

      // Create entries if any
      if (entries && Array.isArray(entries) && entries.length > 0) {
        const batch = db.batch();

        for (const entry of entries) {
          const entryRef = botRef.collection('entries').doc();
          const entryData = {
            ...entry,
            botId,
            id: entryRef.id,
            timestamp:
              typeof entry.timestamp === 'string'
                ? entry.timestamp
                : admin.firestore.Timestamp.fromDate(new Date(entry.timestamp)).toDate().toISOString(),
          };
          batch.set(entryRef, entryData);
        }

        await batch.commit();
        console.log(`  ✓ Created ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
      } else {
        console.log(`  ℹ No entries to create`);
      }

      createdBots.push(`${botData.symbol} (${botId})`);
      successCount++;
      console.log('');
    } catch (error: any) {
      console.error(`  ✗ Error: ${error.message}\n`);
      errorCount++;
    }
  }

  // Summary
  console.log('========================================');
  console.log('Summary:');
  console.log('========================================');
  console.log(`✓ Successfully created: ${successCount} bot(s)`);
  console.log(`✗ Failed: ${errorCount} bot(s)`);

  if (createdBots.length > 0) {
    console.log('\nCreated bots:');
    createdBots.forEach((bot) => console.log(`  - ${bot}`));
  }

  console.log('\n========================================');
  console.log('Next Steps:');
  console.log('========================================');
  console.log('1. Open your DalyDCA page in the app');
  console.log('2. The bots should appear in the bots table');
  console.log('3. You can manage them (pause, resume, delete) as needed');
  console.log('========================================\n');
}

// Run the script
populateBots()
  .then(() => {
    console.log('Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
