#!/usr/bin/env node
/**
 * Migration script to add exitPercentage=90 to all existing DCA bots
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'dalydough' });
const db = getFirestore();

async function migrateExitPercentage() {
  try {
    console.log('Starting migration: Adding exitPercentage to all DCA bots...\n');

    const botsSnapshot = await db.collection('dcaBots').get();

    if (botsSnapshot.empty) {
      console.log('No bots found to migrate.');
      return;
    }

    console.log(`Found ${botsSnapshot.size} bots to migrate.\n`);

    const batch = db.batch();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of botsSnapshot.docs) {
      const bot = doc.data();

      // Skip if already has exitPercentage
      if (bot.exitPercentage !== undefined) {
        console.log(`✓ Bot ${doc.id} (${bot.symbol}) - Already has exitPercentage: ${bot.exitPercentage}%`);
        skippedCount++;
        continue;
      }

      // Add exitPercentage = 90 (default)
      batch.update(doc.ref, {
        exitPercentage: 90,
        updatedAt: new Date().toISOString(),
      });

      console.log(`→ Bot ${doc.id} (${bot.symbol}) - Adding exitPercentage: 90%`);
      updatedCount++;
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\n✅ Migration complete! Updated ${updatedCount} bots, skipped ${skippedCount} bots.`);
    } else {
      console.log(`\n✅ No updates needed. All ${skippedCount} bots already have exitPercentage.`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateExitPercentage();
