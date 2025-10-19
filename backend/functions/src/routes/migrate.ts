/**
 * Migration Routes
 * Handles data migration from default-user to specific users
 */

import { Router, Request, Response } from 'express';
import { Firestore } from 'firebase-admin/firestore';

export function createMigrateRouter(db: Firestore): Router {
  const router = Router();

  /**
   * POST /migrate/default-user-to/:userId
   * Migrate all data from 'default-user' to a specific userId
   */
  router.post('/default-user-to/:userId', async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      const sourceUserId = 'default-user';

      console.log(`Starting migration from ${sourceUserId} to ${targetUserId}`);

      const results = {
        dcaBots: 0,
        tradeHistory: 0,
        costBasis: 0,
        errors: [] as string[],
      };

      // 1. Migrate DCA Bots
      try {
        const dcaBotsSnapshot = await db
          .collection('dca_bots')
          .where('userId', '==', sourceUserId)
          .get();

        console.log(`Found ${dcaBotsSnapshot.size} DCA bots to migrate`);

        for (const doc of dcaBotsSnapshot.docs) {
          const botData = doc.data();
          await db.collection('dca_bots').doc(doc.id).update({
            userId: targetUserId,
          });
          results.dcaBots++;
        }
      } catch (error) {
        const errorMsg = `DCA Bots migration error: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }

      // 2. Migrate Trade History
      try {
        const tradeHistorySnapshot = await db
          .collection('trade_history')
          .where('userId', '==', sourceUserId)
          .get();

        console.log(`Found ${tradeHistorySnapshot.size} trade history records to migrate`);

        for (const doc of tradeHistorySnapshot.docs) {
          await db.collection('trade_history').doc(doc.id).update({
            userId: targetUserId,
          });
          results.tradeHistory++;
        }
      } catch (error) {
        const errorMsg = `Trade History migration error: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }

      // 3. Migrate Cost Basis
      try {
        const costBasisSnapshot = await db
          .collection('cost_basis')
          .where('userId', '==', sourceUserId)
          .get();

        console.log(`Found ${costBasisSnapshot.size} cost basis records to migrate`);

        for (const doc of costBasisSnapshot.docs) {
          await db.collection('cost_basis').doc(doc.id).update({
            userId: targetUserId,
          });
          results.costBasis++;
        }
      } catch (error) {
        const errorMsg = `Cost Basis migration error: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }

      console.log('Migration completed:', results);

      res.json({
        success: true,
        message: `Successfully migrated data from ${sourceUserId} to ${targetUserId}`,
        results,
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /migrate/check-default-user
   * Check what data exists for default-user
   */
  router.get('/check-default-user', async (req: Request, res: Response) => {
    try {
      const sourceUserId = 'default-user';

      const [dcaBotsSnapshot, tradeHistorySnapshot, costBasisSnapshot] = await Promise.all([
        db.collection('dca_bots').where('userId', '==', sourceUserId).get(),
        db.collection('trade_history').where('userId', '==', sourceUserId).get(),
        db.collection('cost_basis').where('userId', '==', sourceUserId).get(),
      ]);

      const results = {
        dcaBots: dcaBotsSnapshot.size,
        tradeHistory: tradeHistorySnapshot.size,
        costBasis: costBasisSnapshot.size,
        total: dcaBotsSnapshot.size + tradeHistorySnapshot.size + costBasisSnapshot.size,
      };

      res.json({
        success: true,
        userId: sourceUserId,
        results,
      });
    } catch (error) {
      console.error('Check error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /migrate/assign-bots-to/:userId
   * Assign specific bot IDs to a userId
   */
  router.post('/assign-bots-to/:userId', async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      const botIds: string[] = req.body.botIds || [];

      if (botIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No botIds provided. Send an array of bot IDs in the request body.',
        });
      }

      console.log(`Assigning ${botIds.length} bots to ${targetUserId}`);

      const results = {
        updated: 0,
        notFound: [] as string[],
        errors: [] as string[],
      };

      for (const botId of botIds) {
        try {
          const botRef = db.collection('dca_bots').doc(botId);
          const botDoc = await botRef.get();

          if (!botDoc.exists) {
            results.notFound.push(botId);
            continue;
          }

          await botRef.update({
            userId: targetUserId,
          });
          results.updated++;
          console.log(`Updated bot ${botId} to userId ${targetUserId}`);
        } catch (error) {
          const errorMsg = `Error updating bot ${botId}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      console.log('Bot assignment completed:', results);

      res.json({
        success: true,
        message: `Assigned ${results.updated} bots to ${targetUserId}`,
        results,
      });
    } catch (error) {
      console.error('Assignment error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /migrate/assign-all-bots-to/:userId
   * Assign ALL bots in the database to a specific userId
   * Checks both dca_bots and dcaBots collections
   */
  router.post('/assign-all-bots-to/:userId', async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId;

      console.log(`Assigning ALL bots to ${targetUserId}`);

      const results = {
        updated: 0,
        collections: {} as Record<string, number>,
        errors: [] as string[],
      };

      // Check both possible collection names
      const collections = ['dca_bots', 'dcaBots'];

      for (const collectionName of collections) {
        try {
          const allBotsSnapshot = await db.collection(collectionName).get();
          console.log(`Found ${allBotsSnapshot.size} bots in ${collectionName} collection`);

          let collectionUpdates = 0;
          for (const doc of allBotsSnapshot.docs) {
            try {
              await db.collection(collectionName).doc(doc.id).update({
                userId: targetUserId,
              });
              collectionUpdates++;
              results.updated++;
              console.log(`Updated bot ${doc.id} in ${collectionName} to userId ${targetUserId}`);
            } catch (error) {
              const errorMsg = `Error updating bot ${doc.id} in ${collectionName}: ${error instanceof Error ? error.message : String(error)}`;
              console.error(errorMsg);
              results.errors.push(errorMsg);
            }
          }
          results.collections[collectionName] = collectionUpdates;
        } catch (error) {
          console.log(`Collection ${collectionName} not found or error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log('All bots assignment completed:', results);

      res.json({
        success: true,
        message: `Assigned ${results.updated} bots to ${targetUserId}`,
        results,
      });
    } catch (error) {
      console.error('Assignment error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
