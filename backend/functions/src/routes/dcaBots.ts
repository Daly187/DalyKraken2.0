/**
 * DCA Bots API Routes
 */

import { Router } from 'express';
import { Firestore } from 'firebase-admin/firestore';
import { DCABotConfig } from '../types';
import { DCABotService } from '../services/dcaBotService';

export function createDCABotsRouter(db: Firestore): Router {
  const router = Router();
  const dcaBotService = new DCABotService(db);

  /**
   * GET /dca-bots
   * Get all DCA bots for a user
   */
  router.get('/', async (req, res) => {
    try {
      // In production, get userId from authenticated user
      // For now, use a default userId or from query params
      const userId = req.query.userId as string || 'default-user';

      const snapshot = await db
        .collection('dcaBots')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const bots = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const botId = doc.id;
          return await dcaBotService.getBotById(botId);
        })
      );

      res.json({
        success: true,
        bots: bots.filter((bot) => bot !== null),
      });
    } catch (error: any) {
      console.error('[DCABots API] Error fetching bots:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /dca-bots/:id
   * Get a single DCA bot by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      const botId = req.params.id;
      const bot = await dcaBotService.getBotById(botId);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      res.json({
        success: true,
        bot,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error fetching bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /dca-bots
   * Create a new DCA bot
   */
  router.post('/', async (req, res) => {
    try {
      const userId = req.body.userId || 'default-user';

      const botData: Omit<DCABotConfig, 'id'> = {
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

      // Create bot in Firestore
      const docRef = await db.collection('dcaBots').add(botData);

      // Get the created bot with live data
      const bot = await dcaBotService.getBotById(docRef.id);

      res.status(201).json({
        success: true,
        bot,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error creating bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PUT /dca-bots/:id
   * Update a DCA bot
   */
  router.put('/:id', async (req, res) => {
    try {
      const botId = req.params.id;

      // Get existing bot
      const botDoc = await db.collection('dcaBots').doc(botId).get();

      if (!botDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Prepare update data (only allow certain fields to be updated)
      const updateData: Partial<DCABotConfig> = {
        updatedAt: new Date().toISOString(),
      };

      // Allow updating these fields
      const allowedFields = [
        'stepPercent',
        'stepMultiplier',
        'tpTarget',
        'supportResistanceEnabled',
        'reEntryDelay',
        'trendAlignmentEnabled',
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          (updateData as any)[field] = req.body[field];
        }
      });

      // Update bot
      await db.collection('dcaBots').doc(botId).update(updateData);

      // Get updated bot
      const bot = await dcaBotService.getBotById(botId);

      res.json({
        success: true,
        bot,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error updating bot:', error);
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
      const botId = req.params.id;

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

      // Delete bot
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

      res.json({
        success: true,
        message: 'Bot deleted successfully',
      });
    } catch (error: any) {
      console.error('[DCABots API] Error deleting bot:', error);
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
      const botId = req.params.id;

      await db.collection('dcaBots').doc(botId).update({
        status: 'paused',
        updatedAt: new Date().toISOString(),
      });

      const bot = await dcaBotService.getBotById(botId);

      res.json({
        success: true,
        bot,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error pausing bot:', error);
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
      const botId = req.params.id;

      await db.collection('dcaBots').doc(botId).update({
        status: 'active',
        updatedAt: new Date().toISOString(),
      });

      const bot = await dcaBotService.getBotById(botId);

      res.json({
        success: true,
        bot,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error resuming bot:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /dca-bots/:id/executions
   * Get execution history for a bot
   */
  router.get('/:id/executions', async (req, res) => {
    try {
      const botId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 50;

      const executions = await dcaBotService.getBotExecutions(botId, limit);

      res.json({
        success: true,
        executions,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error fetching executions:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
