/**
 * DalyKraken 2.0 - Firebase Functions
 * Main entry point for all Firebase Functions
 */

import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { createDCABotsRouter } from './routes/dcaBots.js';
import { DCABotService } from './services/dcaBotService.js';
import { KrakenService } from './services/krakenService.js';
import { MarketAnalysisService } from './services/marketAnalysisService.js';
import { quantifyCryptoService } from './services/quantifyCryptoService.js';
import { settingsStore, encryptKey, maskApiKey } from './services/settingsStore.js';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Strip /api prefix when requests come from Firebase Hosting rewrites
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    req.url = req.url.replace('/api', '');
  }
  next();
});

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCache(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Initialize Kraken service and Market Analysis service
const krakenService = new KrakenService();
const marketAnalysisService = new MarketAnalysisService();

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

// ============================================
// ACCOUNT ROUTES
// ============================================

app.get('/account/balance', async (req, res) => {
  try {
    console.log('[API] Fetching account balance');

    const apiKey = req.headers['x-kraken-api-key'] as string;
    const apiSecret = req.headers['x-kraken-api-secret'] as string;

    const balance = await krakenService.getBalance(apiKey, apiSecret);

    res.json({
      success: true,
      data: balance || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching balance:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/account/info', async (req, res) => {
  try {
    console.log('[API] Fetching account info');
    const accountInfo = await krakenService.getAccountInfo();

    res.json({
      success: true,
      data: accountInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching account info:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// MARKET ROUTES
// ============================================

app.get('/market/overview', async (req, res) => {
  try {
    console.log('[API] Fetching market overview');

    const cached = getCache('market_overview');
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    const overview = await krakenService.getMarketOverview();
    setCache('market_overview', overview);

    res.json({
      success: true,
      data: overview,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching market overview:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/market/prices', async (req, res) => {
  try {
    const pairs = req.query.pairs as string | undefined;
    console.log('[API] Fetching prices', pairs ? `for: ${pairs}` : 'for all pairs');

    const pairArray = pairs ? pairs.split(',').map(p => p.trim()) : undefined;
    const prices = await krakenService.getCurrentPrices(pairArray);

    res.json({
      success: true,
      data: prices,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching prices:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/market/ticker/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    console.log('[API] Fetching ticker for', pair);

    const ticker = await krakenService.getTicker(pair);

    res.json({
      success: true,
      data: ticker,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching ticker:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Enhanced trends endpoint using Kraken data
app.get('/market/quantify-crypto/enhanced-trends', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    console.log('[API] Fetching enhanced trends from Kraken (limit:', limit, ')');

    // Check cache first (60 second TTL for trends)
    const cacheKey = `enhanced_trends_kraken_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('[API] Returning cached enhanced trends');
      return res.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Use Kraken-based market analysis instead of Quantify Crypto
    const result = await marketAnalysisService.getEnhancedTrendsFromKraken(limit);
    setCache(cacheKey, result);

    console.log(`[API] Successfully generated ${result.data.trends.length} enhanced trends from Kraken`);
    res.json({
      ...result,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching enhanced trends:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// PORTFOLIO ROUTES
// ============================================

app.get('/portfolio/overview', async (req, res) => {
  try {
    console.log('[API] Fetching portfolio overview');

    const cached = getCache('portfolio_overview');
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    const balance = await krakenService.getBalance();
    const prices = await krakenService.getCurrentPrices();

    let totalValue = 0;
    const holdings: any[] = [];

    for (const [asset, amount] of Object.entries(balance)) {
      const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
      if (amountNum > 0) {
        const price = prices[asset] || 0;
        const value = amountNum * price;
        totalValue += value;

        holdings.push({
          asset,
          amount: amountNum,
          price,
          value,
          percentage: 0,
        });
      }
    }

    holdings.forEach(holding => {
      holding.percentage = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
    });

    holdings.sort((a, b) => b.value - a.value);

    const portfolioData = {
      totalValue,
      holdings,
      assetCount: holdings.length,
      lastUpdated: new Date().toISOString(),
    };

    setCache('portfolio_overview', portfolioData);

    res.json({
      success: true,
      data: portfolioData,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching portfolio overview:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// SETTINGS ROUTES
// ============================================

// Get Quantify Crypto keys
app.get('/settings/quantify-crypto-keys', async (req, res) => {
  try {
    console.log('[API] Fetching Quantify Crypto keys');

    const keys = settingsStore.getQuantifyCryptoKeys();

    // Mask the keys for security
    const maskedKeys = keys.map(key => ({
      ...key,
      apiKey: key.apiKey ? maskApiKey(key.apiKey) : null,
    }));

    res.json({
      success: true,
      data: maskedKeys,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching Quantify Crypto keys:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Save Quantify Crypto keys
app.post('/settings/quantify-crypto-keys', async (req, res) => {
  try {
    const { keys } = req.body;

    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid keys format. Expected array of key objects.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[API] Saving ${keys.length} Quantify Crypto key(s)`);

    // Encrypt API keys before storing
    const encryptedKeys = keys.map(key => ({
      ...key,
      apiKey: key.apiKey ? encryptKey(key.apiKey) : null,
      encrypted: true,
      updatedAt: new Date().toISOString(),
    }));

    settingsStore.setQuantifyCryptoKeys(encryptedKeys);

    res.json({
      success: true,
      message: `${keys.length} Quantify Crypto key(s) saved successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error saving Quantify Crypto keys:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get Kraken keys
app.get('/settings/kraken-keys', async (req, res) => {
  try {
    console.log('[API] Fetching Kraken keys');

    const keys = settingsStore.getKrakenKeys();

    // Mask the keys for security
    const maskedKeys = keys.map(key => ({
      ...key,
      apiKey: key.apiKey ? maskApiKey(key.apiKey) : null,
      apiSecret: key.apiSecret ? maskApiKey(key.apiSecret) : null,
    }));

    res.json({
      success: true,
      data: maskedKeys,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching Kraken keys:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Save Kraken keys
app.post('/settings/kraken-keys', async (req, res) => {
  try {
    const { keys } = req.body;

    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid keys format. Expected array of key objects.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[API] Saving ${keys.length} Kraken key(s)`);

    // Encrypt API keys before storing
    const encryptedKeys = keys.map(key => ({
      ...key,
      apiKey: key.apiKey ? encryptKey(key.apiKey) : key.apiKey,
      apiSecret: key.apiSecret ? encryptKey(key.apiSecret) : key.apiSecret,
      encrypted: true,
      updatedAt: new Date().toISOString(),
    }));

    settingsStore.setKrakenKeys(encryptedKeys);

    res.json({
      success: true,
      message: `${keys.length} Kraken key(s) saved successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error saving Kraken keys:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get CoinMarketCap key
app.get('/settings/coinmarketcap-key', async (req, res) => {
  try {
    console.log('[API] Fetching CoinMarketCap key');

    const key = settingsStore.getCoinMarketCapKey();

    res.json({
      success: true,
      data: key ? { apiKey: maskApiKey(key), hasKey: true } : { hasKey: false },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching CoinMarketCap key:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Save CoinMarketCap key
app.post('/settings/coinmarketcap-key', async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[API] Saving CoinMarketCap key');

    // Encrypt key before storing
    const encryptedKey = encryptKey(key);
    settingsStore.setCoinMarketCapKey(encryptedKey);

    res.json({
      success: true,
      message: 'CoinMarketCap key saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error saving CoinMarketCap key:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test Quantify Crypto connection
app.get('/quantify-crypto/test', async (req, res) => {
  try {
    console.log('[API] Testing Quantify Crypto API connection');

    const result = await quantifyCryptoService.testConnection();

    res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error testing Quantify Crypto connection:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// AUDIT ROUTES
// ============================================

app.get('/audit/trades', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    console.log(`[API] Fetching trade history (limit: ${limit}, offset: ${offset})`);

    const apiKey = req.headers['x-kraken-api-key'] as string;
    const apiSecret = req.headers['x-kraken-api-secret'] as string;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({
        success: false,
        error: 'API keys required for trade history',
        timestamp: new Date().toISOString(),
      });
    }

    const krakenClient = new KrakenService(apiKey, apiSecret);
    const result = await krakenClient.getTradeHistory();

    // Kraken returns { trades: {...}, count: N }
    const trades = result?.trades || result || {};
    const tradeCount = result?.count || Object.keys(trades).length;

    res.json({
      success: true,
      data: trades,
      count: tradeCount,
      pagination: {
        limit,
        offset,
        hasMore: tradeCount === limit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching trade history:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/audit/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    console.log(`[API] Fetching transaction history (limit: ${limit})`);

    const apiKey = req.headers['x-kraken-api-key'] as string;
    const apiSecret = req.headers['x-kraken-api-secret'] as string;

    if (!apiKey || !apiSecret) {
      return res.status(401).json({
        success: false,
        error: 'API keys required for transaction history',
        timestamp: new Date().toISOString(),
      });
    }

    // For now, return empty transactions as we're focusing on trades
    res.json({
      success: true,
      data: [],
      pagination: {
        limit,
        offset: 0,
        hasMore: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching transaction history:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// DCA ROUTES
// ============================================

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
      const entries = results.filter((r: any) => r.action === 'entry').length;
      const exits = results.filter((r: any) => r.action === 'exit').length;

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
