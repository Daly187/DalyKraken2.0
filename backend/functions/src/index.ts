/**
 * DalyKraken 2.0 - Firebase Functions
 * Main entry point for all Firebase Functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { createDCABotsRouter } from './routes/dcaBots';
import { DCABotService } from './services/dcaBotService';
import { KrakenService } from './services/krakenService';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'dalykraken-api',
    version: '2.0.0',
  });
});

// Mount DCA Bots routes
app.use('/dca-bots', createDCABotsRouter(db));

// Basic endpoints for backward compatibility
app.get('/account/info', async (req, res) => {
  // TODO: Implement with real Kraken data
  res.json({
    message: 'Account info endpoint - implement with Kraken API',
  });
});

app.get('/portfolio/overview', async (req, res) => {
  // TODO: Implement with real Kraken data
  res.json({
    message: 'Portfolio endpoint - implement with Kraken API',
  });
});

app.get('/market/overview', async (req, res) => {
  // TODO: Implement with real Kraken data
  res.json({
    message: 'Market overview endpoint - implement with Kraken API',
  });
});

app.get('/dca/status', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default-user';

    // Get all active bots for user
    const snapshot = await db
      .collection('dcaBots')
      .where('userId', '==', userId)
      .get();

    const totalBots = snapshot.size;
    const activeBots = snapshot.docs.filter(
      (doc) => doc.data().status === 'active'
    ).length;

    res.json({
      isRunning: activeBots > 0,
      isPaused: false,
      totalBots,
      activeBots,
      lastExecution: null,
      nextExecution: null,
      totalDeployed: 0,
      totalOrders: 0,
      successRate: 0,
      recoveryMode: false,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export the Express app as a Firebase Function
export const api = functions.https.onRequest(app);

/**
 * Scheduled function to process all active DCA bots
 * Runs every 5 minutes
 */
export const processDCABots = functions.pubsub
  .schedule('*/5 * * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('[Scheduled] Processing DCA bots...');

    try {
      const dcaBotService = new DCABotService(db);

      // Get all active bots
      const activeBots = await dcaBotService.getActiveBots();

      console.log(`[Scheduled] Found ${activeBots.length} active bots`);

      // Get Kraken credentials from Firebase Config
      // In production, you'd store encrypted credentials per user in Firestore
      const config = functions.config();
      const krakenApiKey = config.kraken?.api_key || '';
      const krakenApiSecret = config.kraken?.api_secret || '';

      if (!krakenApiKey || !krakenApiSecret) {
        console.warn('[Scheduled] No Kraken credentials configured');
        return null;
      }

      // Process each bot
      const results = await Promise.all(
        activeBots.map(async (bot) => {
          try {
            const result = await dcaBotService.processBot(
              bot.id,
              krakenApiKey,
              krakenApiSecret
            );

            console.log(`[Scheduled] Bot ${bot.id} (${bot.symbol}):`, result);

            return {
              botId: bot.id,
              symbol: bot.symbol,
              ...result,
            };
          } catch (error: any) {
            console.error(`[Scheduled] Error processing bot ${bot.id}:`, error);
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
      const entries = results.filter((r) => r.action === 'entry').length;
      const exits = results.filter((r) => r.action === 'exit').length;

      console.log(`[Scheduled] Summary: ${processed}/${activeBots.length} processed, ${entries} entries, ${exits} exits`);

      // Store execution summary in Firestore
      await db.collection('systemLogs').add({
        type: 'dca_bot_processing',
        timestamp: new Date().toISOString(),
        summary: {
          totalBots: activeBots.length,
          processed,
          entries,
          exits,
        },
        details: results,
      });

      return null;
    } catch (error: any) {
      console.error('[Scheduled] Error in processDCABots:', error);
      return null;
    }
  });

/**
 * Scheduled function to update market data cache
 * Runs every 1 minute
 */
export const updateMarketData = functions.pubsub
  .schedule('*/1 * * * *')
  .onRun(async (context) => {
    console.log('[Scheduled] Updating market data...');

    try {
      const dcaBotService = new DCABotService(db);
      const krakenService = new KrakenService();

      // Get all unique symbols from active bots
      const activeBots = await dcaBotService.getActiveBots();
      const symbols = [...new Set(activeBots.map((bot) => bot.symbol))];

      console.log(`[Scheduled] Updating market data for ${symbols.length} symbols`);

      // Update market data for each symbol
      const batch = db.batch();

      for (const symbol of symbols) {
        try {
          const ticker = await krakenService.getTicker(symbol);

          const docRef = db.collection('marketData').doc(symbol);
          batch.set(docRef, {
            ...ticker,
            lastUpdate: new Date().toISOString(),
          }, { merge: true });
        } catch (error) {
          console.error(`[Scheduled] Error updating ${symbol}:`, error);
        }
      }

      await batch.commit();

      console.log('[Scheduled] Market data updated successfully');

      return null;
    } catch (error: any) {
      console.error('[Scheduled] Error in updateMarketData:', error);
      return null;
    }
  });

/**
 * Firestore trigger - when a bot is created, log it
 */
export const onBotCreated = functions.firestore
  .document('dcaBots/{botId}')
  .onCreate(async (snap, context) => {
    const botId = context.params.botId;
    const botData = snap.data();

    console.log(`[Trigger] New bot created: ${botId} (${botData.symbol})`);

    // Log to audit log
    await db.collection('auditLog').add({
      userId: botData.userId,
      action: 'bot_created',
      details: {
        botId,
        symbol: botData.symbol,
        initialOrderAmount: botData.initialOrderAmount,
      },
      timestamp: new Date().toISOString(),
    });

    return null;
  });

/**
 * Firestore trigger - when a bot is deleted, clean up
 */
export const onBotDeleted = functions.firestore
  .document('dcaBots/{botId}')
  .onDelete(async (snap, context) => {
    const botId = context.params.botId;
    const botData = snap.data();

    console.log(`[Trigger] Bot deleted: ${botId} (${botData.symbol})`);

    // Log to audit log
    await db.collection('auditLog').add({
      userId: botData.userId,
      action: 'bot_deleted',
      details: {
        botId,
        symbol: botData.symbol,
      },
      timestamp: new Date().toISOString(),
    });

    return null;
  });

/**
 * HTTP function to manually trigger bot processing
 * Useful for testing
 */
export const triggerBotProcessing = functions.https.onRequest(async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check for authorization (in production, use proper auth)
  const authToken = req.headers.authorization;
  if (!authToken || authToken !== 'Bearer test-token') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const dcaBotService = new DCABotService(db);
    const activeBots = await dcaBotService.getActiveBots();

    const config = functions.config();
    const krakenApiKey = config.kraken?.api_key || '';
    const krakenApiSecret = config.kraken?.api_secret || '';

    if (!krakenApiKey || !krakenApiSecret) {
      res.status(500).json({ error: 'Kraken credentials not configured' });
      return;
    }

    const results = await Promise.all(
      activeBots.map(async (bot) => {
        return await dcaBotService.processBot(bot.id, krakenApiKey, krakenApiSecret);
      })
    );

    res.json({
      success: true,
      totalBots: activeBots.length,
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
