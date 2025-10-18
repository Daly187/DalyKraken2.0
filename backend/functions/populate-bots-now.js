#!/usr/bin/env node

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('========================================');
console.log('🤖 DCA Bot Population');
console.log('========================================\n');

// File paths
const serviceAccountPath = resolve(__dirname, 'serviceAccountKey.json');
const botsDataPath = resolve(__dirname, 'historical-bots.json');

// Check files
if (!existsSync(serviceAccountPath)) {
  console.error('❌ Service account key not found');
  process.exit(1);
}

if (!existsSync(botsDataPath)) {
  console.error('❌ historical-bots.json not found');
  process.exit(1);
}

console.log('✅ Files found\n');

// Initialize Firebase
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase initialized\n');
} catch (error) {
  console.error('❌ Firebase init failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function populateBots() {
  try {
    const data = JSON.parse(readFileSync(botsDataPath, 'utf-8'));
    const bots = data.bots || [];

    console.log(`Creating ${bots.length} bot(s)...\n`);

    let successCount = 0;
    const created = [];

    for (const botData of bots) {
      try {
        console.log(`📝 ${botData.symbol}...`);

        const botRef = db.collection('dcaBots').doc();
        const botId = botRef.id;

        const { entries, comment, ...botConfig } = botData;

        await botRef.set({
          ...botConfig,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.log(`  ✅ Bot created: ${botId}`);

        // Create entries
        if (entries?.length > 0) {
          const batch = db.batch();

          for (const entry of entries) {
            const entryRef = botRef.collection('entries').doc();
            batch.set(entryRef, {
              ...entry,
              botId,
              id: entryRef.id,
              timestamp: entry.timestamp,
            });
          }

          await batch.commit();
          console.log(`  ✅ ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} created`);
        }

        created.push(botData.symbol);
        successCount++;
        console.log('');
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}\n`);
      }
    }

    console.log('========================================');
    console.log(`✅ Created ${successCount} bot(s)`);
    console.log('========================================\n');

    if (created.length > 0) {
      console.log('Bots created:');
      created.forEach(s => console.log(`  - ${s}`));
      console.log('');
    }

    console.log('🎉 Done! Check your DalyDCA page!\n');

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

populateBots();
