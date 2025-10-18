import express from 'express';
import admin from 'firebase-admin';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialization of Firebase Admin and Firestore
let db = null;

function getDb() {
  if (db) return db;

  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    try {
      // Look for service account key in multiple locations
      const possiblePaths = [
        path.join(__dirname, '../../../functions/serviceAccountKey.json'),
        path.join(process.cwd(), 'serviceAccountKey.json'),
        path.join(process.cwd(), 'backend/functions/serviceAccountKey.json'),
      ];

      let serviceAccountPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          serviceAccountPath = p;
          break;
        }
      }

      if (serviceAccountPath) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        logger.info('✅ Firebase Admin initialized for DCA Bots');
      } else {
        logger.warn('⚠️  Service account key not found, Firebase operations may fail');
      }
    } catch (error) {
      logger.error('Error initializing Firebase Admin:', error);
    }
  }

  db = admin.firestore();
  return db;
}

/**
 * Setup DCA Bots routes
 */
export function setupDCABotsRoutes(router) {
  /**
   * GET /dca-bots
   * Get all DCA bots for a user
   */
  router.get('/', async (req, res) => {
    try {
      const db = getDb();
      const userId = req.query.userId || 'default-user';
      logger.info(`Fetching DCA bots for user: ${userId}`);

      const snapshot = await db
        .collection('dcaBots')
        .where('userId', '==', userId)
        .get();

      logger.info(`Found ${snapshot.docs.length} DCA bots`);

      // Get detailed info for each bot including entries and live data
      const bots = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const botData = { id: doc.id, ...doc.data() };

          // Get entries for this bot
          const entriesSnapshot = await db
            .collection('dcaBots')
            .doc(doc.id)
            .collection('entries')
            .get();

          const entries = entriesSnapshot.docs.map((entryDoc) => ({
            id: entryDoc.id,
            ...entryDoc.data(),
          }));

          // Calculate metrics
          const filledEntries = entries.filter((e) => e.status === 'filled');
          const totalInvested = filledEntries.reduce((sum, e) => sum + (e.orderAmount || 0), 0);
          const totalQuantity = filledEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
          const averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;

          // Mock current price (in a real scenario, fetch from market API)
          const currentPrice = botData.currentPrice || 0;
          const currentValue = totalQuantity * currentPrice;
          const unrealizedPnL = currentValue - totalInvested;
          const unrealizedPnLPercent = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

          // Calculate next entry price
          const lastEntry = filledEntries[0];
          let nextEntryPrice = null;
          if (lastEntry) {
            const nextStepPercent = botData.stepPercent || 1;
            nextEntryPrice = lastEntry.price * (1 - nextStepPercent / 100);
          }

          // Calculate current TP price
          const currentTpPrice = averagePurchasePrice * (1 + (botData.tpTarget || 3) / 100);

          return {
            ...botData,
            currentEntryCount: filledEntries.length,
            averagePurchasePrice,
            totalInvested,
            currentPrice,
            unrealizedPnL,
            unrealizedPnLPercent,
            lastEntryTime: lastEntry?.timestamp || null,
            nextEntryPrice,
            currentTpPrice,
            entries,
            techScore: 50, // Mock score
            trendScore: 50, // Mock score
          };
        })
      );

      res.json({
        success: true,
        bots,
      });
    } catch (error) {
      logger.error('[DCABots API] Error fetching bots:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        bots: [],
      });
    }
  });

  /**
   * POST /dca-bots
   * Create a new DCA bot
   */
  router.post('/', async (req, res) => {
    try {
      const db = getDb();
      const userId = req.body.userId || 'default-user';

      const botData = {
        userId,
        symbol: req.body.symbol,
        initialOrderAmount: req.body.initialOrderAmount,
        tradeMultiplier: req.body.tradeMultiplier || 2,
        reEntryCount: req.body.reEntryCount || 8,
        stepPercent: req.body.stepPercent || 1,
        stepMultiplier: req.body.stepMultiplier || 2,
        tpTarget: req.body.tpTarget || 3,
        supportResistanceEnabled: req.body.supportResistanceEnabled ?? false,
        reEntryDelay: req.body.reEntryDelay || 888,
        trendAlignmentEnabled: req.body.trendAlignmentEnabled ?? true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Validate required fields
      if (!botData.symbol || !botData.initialOrderAmount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, initialOrderAmount',
        });
      }

      logger.info(`Creating DCA bot for ${botData.symbol}`);

      // Create bot in Firestore
      const docRef = await db.collection('dcaBots').add(botData);

      logger.info(`Created DCA bot with ID: ${docRef.id}`);

      res.status(201).json({
        success: true,
        bot: { id: docRef.id, ...botData },
      });
    } catch (error) {
      logger.error('[DCABots API] Error creating bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /dca-bots/:id
   * Delete a DCA bot
   */
  router.delete('/:id', async (req, res) => {
    try {
      const db = getDb();
      const botId = req.params.id;
      logger.info(`Deleting DCA bot: ${botId}`);

      // Check if bot exists
      const botDoc = await db.collection('dcaBots').doc(botId).get();

      if (!botDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Delete bot and all its entries
      const batch = db.batch();
      batch.delete(db.collection('dcaBots').doc(botId));

      // Delete all entries
      const entriesSnapshot = await db
        .collection('dcaBots')
        .doc(botId)
        .collection('entries')
        .get();

      entriesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info(`Deleted DCA bot: ${botId}`);

      res.json({
        success: true,
        message: 'Bot deleted successfully',
      });
    } catch (error) {
      logger.error('[DCABots API] Error deleting bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /dca-bots/:id/pause
   * Pause a DCA bot
   */
  router.post('/:id/pause', async (req, res) => {
    try {
      const db = getDb();
      const botId = req.params.id;
      logger.info(`Pausing DCA bot: ${botId}`);

      await db.collection('dcaBots').doc(botId).update({
        status: 'paused',
        updatedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Bot paused successfully',
      });
    } catch (error) {
      logger.error('[DCABots API] Error pausing bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /dca-bots/:id/resume
   * Resume a DCA bot
   */
  router.post('/:id/resume', async (req, res) => {
    try {
      const db = getDb();
      const botId = req.params.id;
      logger.info(`Resuming DCA bot: ${botId}`);

      await db.collection('dcaBots').doc(botId).update({
        status: 'active',
        updatedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Bot resumed successfully',
      });
    } catch (error) {
      logger.error('[DCABots API] Error resuming bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  logger.info('DCA Bots routes initialized');
}
