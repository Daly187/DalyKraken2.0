/**
 * Cleanup Script: Delete incomplete pending orders
 * This script removes all pending orders that have amount = 0 or undefined
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin with project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'dalydough',
  });
}

const db = admin.firestore();

async function cleanupPendingOrders() {
  console.log('[Cleanup] Starting cleanup of incomplete pending orders...');

  try {
    // Get all pending orders
    const snapshot = await db.collection('pendingOrders').get();

    console.log(`[Cleanup] Found ${snapshot.size} pending orders`);

    let deletedCount = 0;
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Delete if amount is 0, undefined, or missing
      if (!data.amount || data.amount === 0) {
        console.log(`[Cleanup] Deleting order ${doc.id} - amount: ${data.amount}, pair: ${data.pair}`);
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`[Cleanup] Successfully deleted ${deletedCount} incomplete pending orders`);
    } else {
      console.log('[Cleanup] No incomplete orders found to delete');
    }

    // Also clean up failed bot executions with amount = 0
    console.log('[Cleanup] Cleaning up failed bot executions...');
    const execSnapshot = await db.collection('botExecutions')
      .where('success', '==', false)
      .where('amount', '==', 0)
      .get();

    console.log(`[Cleanup] Found ${execSnapshot.size} failed bot executions with amount = 0`);

    let execDeletedCount = 0;
    const execBatch = db.batch();

    execSnapshot.forEach((doc) => {
      console.log(`[Cleanup] Deleting failed execution ${doc.id}`);
      execBatch.delete(doc.ref);
      execDeletedCount++;
    });

    if (execDeletedCount > 0) {
      await execBatch.commit();
      console.log(`[Cleanup] Successfully deleted ${execDeletedCount} failed bot executions`);
    } else {
      console.log('[Cleanup] No failed bot executions found to delete');
    }

    console.log('[Cleanup] Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Cleanup] Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupPendingOrders();
