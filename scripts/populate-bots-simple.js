#!/usr/bin/env node

/**
 * Simple bot populator - Works from root directory
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, '../backend/functions/serviceAccountKey.json');
const botsDataPath = path.resolve(__dirname, 'historical-bots.json');

console.log('========================================');
console.log('DCA Bot Population Script');
console.log('========================================\n');

// Check files exist
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account key not found at:', serviceAccountPath);
  console.log('\nPlease download it from Firebase Console and save as:');
  console.log('backend/functions/serviceAccountKey.json\n');
  process.exit(1);
}

if (!fs.existsSync(botsDataPath)) {
  console.error('❌ historical-bots.json not found at:', botsDataPath);
  process.exit(1);
}

console.log('✅ Service account key found');
console.log('✅ Bot data file found\n');

// Initialize Firebase
try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase initialized\n');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function populateBots() {
  try {
    // Read bots data
    const data = JSON.parse(fs.readFileSync(botsDataPath, 'utf-8'));
    const bots = data.bots || [];

    if (!Array.isArray(bots) || bots.length === 0) {
      console.error('❌ No bots found in historical-bots.json');
      process.exit(1);
    }

    console.log(`Found ${bots.length} bot(s) to create\n`);

    let successCount = 0;
    let errorCount = 0;
    const createdBots = [];

    for (const botData of bots) {
      try {
        console.log(`Creating bot for ${botData.symbol}...`);

        // Create bot document
        const botRef = db.collection('dcaBots').doc();
        const botId = botRef.id;

        const { entries, comment, ...botConfig } = botData;

        const bot = {
          ...botConfig,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
              timestamp: typeof entry.timestamp === 'string'
                ? entry.timestamp
                : new Date(entry.timestamp).toISOString(),
            };
            batch.set(entryRef, entryData);
          }

          await batch.commit();
          console.log(`  ✓ Created ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
        }

        createdBots.push(`${botData.symbol} (${botId})`);
        successCount++;
        console.log('');
      } catch (error) {
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
    console.log('✅ Population Complete!');
    console.log('========================================');
    console.log('\nNext Steps:');
    console.log('1. Open your DalyDCA page in the app');
    console.log('2. The bots should appear in the "Live Bots" table');
    console.log('3. You can manage them (pause, resume, delete) as needed');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run
populateBots();
