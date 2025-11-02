/**
 * DCA Bots API Routes
 */

import { Router } from 'express';
import { Firestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import { DCABotConfig } from '../types.js';
import { DCABotService } from '../services/dcaBotService.js';
import { KrakenService } from '../services/krakenService.js';

export function createDCABotsRouter(db: Firestore): Router {
  const router = Router();
  const dcaBotService = new DCABotService(db);

  /**
   * GET /dca-bots
   * Get all DCA bots for authenticated user
   */
  router.get('/', async (req, res) => {
    try {
      // Get userId from authenticated user
      const userId = req.user!.userId;

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      // Create KrakenService if credentials are provided
      const krakenService = (apiKey && apiSecret) ? new KrakenService(apiKey, apiSecret) : undefined;

      const snapshot = await db
        .collection('dcaBots')
        .where('userId', '==', userId)
        .get();

      const bots = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const botId = doc.id;
          return await dcaBotService.getBotById(botId, krakenService);
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
   * Get a single DCA bot by ID (with ownership verification)
   */
  router.get('/:id', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      // Create KrakenService if credentials are provided
      const krakenService = (apiKey && apiSecret) ? new KrakenService(apiKey, apiSecret) : undefined;

      const bot = await dcaBotService.getBotById(botId, krakenService);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Verify ownership
      if (bot.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
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
   * Create a new DCA bot for authenticated user
   */
  router.post('/', async (req, res) => {
    try {
      const userId = req.user!.userId;

      const now = new Date().toISOString();
      const cycleId = `cycle_${Date.now()}`;

      const botData: Omit<DCABotConfig, 'id'> = {
        userId,
        symbol: req.body.symbol,
        initialOrderAmount: req.body.initialOrderAmount,
        tradeMultiplier: req.body.tradeMultiplier || 2,
        reEntryCount: req.body.reEntryCount || 8,
        stepPercent: req.body.stepPercent || 1,
        stepMultiplier: req.body.stepMultiplier || 2,
        tpTarget: req.body.tpTarget || 3,
        exitPercentage: req.body.exitPercentage || 90, // Default to selling 90%, keeping 10%
        supportResistanceEnabled: req.body.supportResistanceEnabled ?? false,
        reEntryDelay: req.body.reEntryDelay || 888,
        trendAlignmentEnabled: req.body.trendAlignmentEnabled ?? true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        // Initialize first cycle
        cycleId,
        cycleStartTime: now,
        cycleNumber: 1,
        previousCycles: [],
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

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;
      const krakenService = (apiKey && apiSecret) ? new KrakenService(apiKey, apiSecret) : undefined;

      // Get the created bot with live data
      const bot = await dcaBotService.getBotById(docRef.id, krakenService);

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
   * Update a DCA bot (with ownership verification)
   */
  router.put('/:id', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      // Get existing bot
      const botDoc = await db.collection('dcaBots').doc(botId).get();

      if (!botDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Verify ownership
      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Prepare update data (only allow certain fields to be updated)
      const updateData: Partial<DCABotConfig> = {
        updatedAt: new Date().toISOString(),
      };

      // Allow updating these fields
      const allowedFields = [
        'initialOrderAmount',
        'tradeMultiplier',
        'reEntryCount',
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

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;
      const krakenService = (apiKey && apiSecret) ? new KrakenService(apiKey, apiSecret) : undefined;

      // Get updated bot
      const bot = await dcaBotService.getBotById(botId, krakenService);

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
   * Delete a DCA bot (with ownership verification)
   */
  router.delete('/:id', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      // Check if bot exists
      const botDoc = await db.collection('dcaBots').doc(botId).get();

      if (!botDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Verify ownership
      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
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
   * Pause a DCA bot (with ownership verification)
   */
  router.post('/:id/pause', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      // Verify ownership
      const botDoc = await db.collection('dcaBots').doc(botId).get();
      if (!botDoc.exists) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }

      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      await db.collection('dcaBots').doc(botId).update({
        status: 'paused',
        updatedAt: new Date().toISOString(),
      });

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;
      const krakenService = (apiKey && apiSecret) ? new KrakenService(apiKey, apiSecret) : undefined;

      const bot = await dcaBotService.getBotById(botId, krakenService);

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
   * Resume a DCA bot (with ownership verification)
   */
  router.post('/:id/resume', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      // Verify ownership
      const botDoc = await db.collection('dcaBots').doc(botId).get();
      if (!botDoc.exists) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }

      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      await db.collection('dcaBots').doc(botId).update({
        status: 'active',
        updatedAt: new Date().toISOString(),
      });

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;
      const krakenService = (apiKey && apiSecret) ? new KrakenService(apiKey, apiSecret) : undefined;

      const bot = await dcaBotService.getBotById(botId, krakenService);

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
   * Get execution history for a bot (with ownership verification)
   */
  router.get('/:id/executions', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      // Verify ownership
      const botDoc = await db.collection('dcaBots').doc(botId).get();
      if (!botDoc.exists) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }

      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
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

  /**
   * POST /dca-bots/:id/exit
   * Manually exit a DCA bot position (sell all holdings back to USD)
   */
  router.post('/:id/exit', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      console.log(`[DCABots API] Manual exit requested for bot ${botId} by user ${userId}`);

      // Get bot and verify ownership
      const botDoc = await db.collection('dcaBots').doc(botId).get();

      if (!botDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Get Kraken credentials from headers
      const krakenApiKey = req.headers['x-kraken-api-key'] as string;
      const krakenApiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!krakenApiKey || !krakenApiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required in headers',
        });
      }

      // Create KrakenService
      const krakenService = new KrakenService(krakenApiKey, krakenApiSecret);

      // Get bot with live data
      const bot = await dcaBotService.getBotById(botId, krakenService);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Check if bot has positions to exit
      if (bot.currentEntryCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Bot has no open positions to exit',
        });
      }

      // Check if bot is already exiting AND has a pending sell order
      if (bot.status === 'exiting') {
        // Check if there's already a pending sell order
        const pendingSellOrders = await db
          .collection('pendingOrders')
          .where('botId', '==', botId)
          .where('side', '==', 'sell')
          .where('status', 'in', ['pending', 'processing', 'retry'])
          .get();

        if (!pendingSellOrders.empty) {
          return res.status(400).json({
            success: false,
            error: 'Bot already has a pending exit order',
          });
        }

        // If bot is in "exiting" status but has no pending sell orders, it's stuck
        // Allow the manual exit to proceed to fix the stuck state
        console.log(`[DCABots API] Bot ${botId} is stuck in 'exiting' status with no pending sell orders. Allowing manual exit to fix.`);
      }

      console.log(`[DCABots API] Executing manual exit for bot ${botId} (${bot.symbol})`);
      console.log(`[DCABots API] Current positions: ${bot.currentEntryCount} entries, Total invested: $${bot.totalInvested}, Unrealized P&L: ${bot.unrealizedPnLPercent.toFixed(2)}%`);

      // Execute exit
      const result = await dcaBotService.executeExit(bot, krakenService);

      if (result.success) {
        console.log(`[DCABots API] Manual exit successful for bot ${botId}`);

        // Get updated bot data
        const updatedBot = await dcaBotService.getBotById(botId, krakenService);

        res.json({
          success: true,
          message: 'Exit order created successfully',
          bot: updatedBot,
          exitDetails: {
            entriesExited: bot.currentEntryCount,
            totalInvested: bot.totalInvested,
            unrealizedPnL: bot.unrealizedPnL,
            unrealizedPnLPercent: bot.unrealizedPnLPercent,
          },
        });
      } else {
        console.error(`[DCABots API] Manual exit failed for bot ${botId}:`, result.error);

        res.status(500).json({
          success: false,
          error: result.error || 'Failed to create exit order',
        });
      }
    } catch (error: any) {
      console.error('[DCABots API] Error executing manual exit:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /dca-bots/:id/retry-exit
   * Retry a failed exit attempt - clears failure state and attempts exit again
   */
  router.post('/:id/retry-exit', async (req, res) => {
    try {
      const botId = req.params.id;
      const userId = req.user!.userId;

      console.log(`[DCABots API] Exit retry requested for bot ${botId} by user ${userId}`);

      // Get bot and verify ownership
      const botDoc = await db.collection('dcaBots').doc(botId).get();

      if (!botDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      const botData = botDoc.data() as DCABotConfig;
      if (botData.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Check if bot is in exit_failed state
      if (botData.status !== 'exit_failed') {
        return res.status(400).json({
          success: false,
          error: `Bot is not in failed state. Current status: ${botData.status}`,
        });
      }

      // Get Kraken credentials from headers
      const krakenApiKey = req.headers['x-kraken-api-key'] as string;
      const krakenApiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!krakenApiKey || !krakenApiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required in headers',
        });
      }

      console.log(`[DCABots API] Clearing failure state and retrying exit for bot ${botId}`);
      console.log(`[DCABots API] Previous failure: ${botData.exitFailureReason}`);
      console.log(`[DCABots API] Exit attempts: ${botData.exitAttempts || 0}`);

      // Create KrakenService
      const krakenService = new KrakenService(krakenApiKey, krakenApiSecret);

      // Get bot with live data
      const bot = await dcaBotService.getBotById(botId, krakenService);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: 'Bot not found',
        });
      }

      // Check if bot still has positions
      if (bot.currentEntryCount === 0) {
        // No positions - mark as completed and clear failure state
        await db.collection('dcaBots').doc(botId).update({
          status: 'completed',
          exitFailureReason: null,
          exitFailureTime: null,
          updatedAt: new Date().toISOString(),
        });

        return res.json({
          success: true,
          message: 'Bot has no positions - marked as completed',
          bot: await dcaBotService.getBotById(botId, krakenService),
        });
      }

      // Clear failure state and set to active before retry
      await db.collection('dcaBots').doc(botId).update({
        status: 'active',
        exitFailureReason: null,
        exitFailureTime: null,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[DCABots API] Failure state cleared, attempting exit retry...`);

      // Execute exit
      const result = await dcaBotService.executeExit(bot, krakenService);

      if (result.success) {
        console.log(`[DCABots API] Exit retry successful for bot ${botId}`);

        // Get updated bot data
        const updatedBot = await dcaBotService.getBotById(botId, krakenService);

        res.json({
          success: true,
          message: 'Exit retry successful - order queued for execution',
          bot: updatedBot,
          exitDetails: {
            entriesExited: bot.currentEntryCount,
            totalInvested: bot.totalInvested,
            unrealizedPnL: bot.unrealizedPnL,
            unrealizedPnLPercent: bot.unrealizedPnLPercent,
          },
        });
      } else {
        console.error(`[DCABots API] Exit retry failed for bot ${botId}:`, result.error);

        // Set back to exit_failed with new error
        await db.collection('dcaBots').doc(botId).update({
          status: 'exit_failed',
          exitFailureReason: result.error,
          exitFailureTime: new Date().toISOString(),
          lastExitAttempt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        res.status(500).json({
          success: false,
          error: result.error || 'Failed to retry exit',
        });
      }
    } catch (error: any) {
      console.error('[DCABots API] Error retrying exit:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /dca-bots/trigger
   * Manually trigger bot processing for all user's active bots
   */
  router.post('/trigger', async (req, res) => {
    console.log('[DCABots API] ===== TRIGGER ENDPOINT CALLED =====');
    console.log('[DCABots API] Request headers:', req.headers);
    console.log('[DCABots API] Request user:', req.user);

    try {
      // Check if user is authenticated
      if (!req.user || !req.user.userId) {
        console.error('[DCABots API] Trigger attempted without authentication');
        console.error('[DCABots API] req.user:', req.user);
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const userId = req.user.userId;

      console.log('[DCABots API] Manual trigger requested by user:', userId);

      // Get user's active bots
      const snapshot = await db
        .collection('dcaBots')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();

      if (snapshot.empty) {
        return res.json({
          success: true,
          message: 'No active bots to process',
          totalBots: 0,
          results: [],
        });
      }

      const activeBots = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DCABotConfig[];

      console.log(`[DCABots API] Processing ${activeBots.length} active bots`);

      // Get Kraken credentials from headers (same as all other endpoints)
      const krakenApiKey = req.headers['x-kraken-api-key'] as string;
      const krakenApiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!krakenApiKey || !krakenApiSecret) {
        console.error('[DCABots API] No Kraken API keys provided in headers');
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
        });
      }

      console.log('[DCABots API] Using Kraken credentials from request headers');


      // Process each bot
      const results = await Promise.all(
        activeBots.map(async (bot) => {
          try {
            const result = await dcaBotService.processBot(
              bot.id,
              krakenApiKey,
              krakenApiSecret
            );

            console.log(`[DCABots API] Bot ${bot.id} (${bot.symbol}):`, result);

            return {
              botId: bot.id,
              symbol: bot.symbol,
              ...result,
            };
          } catch (error: any) {
            console.error(`[DCABots API] Error processing bot ${bot.id}:`, error);
            return {
              botId: bot.id,
              symbol: bot.symbol,
              processed: false,
              reason: error.message,
            };
          }
        })
      );

      // Log summary
      const processed = results.filter((r) => r.processed).length;
      const entries = results.filter((r: any) => r.action === 'entry').length;
      const exits = results.filter((r: any) => r.action === 'exit').length;

      console.log(`[DCABots API] Manual trigger summary: ${processed}/${activeBots.length} processed, ${entries} entries, ${exits} exits`);

      res.json({
        success: true,
        message: 'Bot processing triggered successfully',
        totalBots: activeBots.length,
        summary: {
          processed,
          entries,
          exits,
        },
        results,
      });
    } catch (error: any) {
      console.error('[DCABots API] Error triggering bot processing:', error);
      console.error('[DCABots API] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error occurred',
        details: error.stack,
      });
    }
  });

  return router;
}
