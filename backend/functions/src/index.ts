/**
 * DalyKraken 2.0 - Firebase Functions
 * Main entry point for all Firebase Functions
 */

import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { createAuthRouter } from './routes/auth.js';
import { createDCABotsRouter } from './routes/dcaBots.js';
import { createMigrateRouter } from './routes/migrate.js';
import { createTradingRouter } from './routes/trading.js';
import { authenticateToken } from './middleware/auth.js';
import { DCABotService } from './services/dcaBotService.js';
import { KrakenService } from './services/krakenService.js';
import { MarketAnalysisService } from './services/marketAnalysisService.js';
import { CostBasisService } from './services/costBasisService.js';
import { quantifyCryptoService } from './services/quantifyCryptoService.js';
import { settingsStore, encryptKey, maskApiKey } from './services/settingsStore.js';
import { orderQueueService } from './services/orderQueueService.js';
import { orderExecutorService } from './services/orderExecutorService.js';
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

// Initialize Kraken service, Market Analysis service, and Cost Basis service
const krakenService = new KrakenService();
const marketAnalysisService = new MarketAnalysisService();
const costBasisService = new CostBasisService(db);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'dalykraken-api',
    version: '2.0.0',
  });
});

// Mount authentication routes (public)
app.use('/auth', createAuthRouter(db));

// Mount migration routes (public - for initial setup only)
app.use('/migrate', createMigrateRouter(db));

// Log all incoming requests to /dca-bots for debugging
app.use('/dca-bots', (req, res, next) => {
  console.log('[API] ===== INCOMING /dca-bots REQUEST =====');
  console.log('[API] Method:', req.method);
  console.log('[API] Path:', req.path);
  console.log('[API] Full URL:', req.url);
  console.log('[API] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[API] Body:', JSON.stringify(req.body, null, 2));
  next();
});

// Mount DCA Bots routes (protected)
app.use('/dca-bots', authenticateToken, createDCABotsRouter(db));

// Mount Trading routes (protected)
app.use('/trading', authenticateToken, createTradingRouter());

// ============================================
// ACCOUNT ROUTES (Protected)
// ============================================

app.get('/account/balance', authenticateToken, async (req, res) => {
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

app.get('/account/info', authenticateToken, async (req, res) => {
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
// MARKET ROUTES (Protected)
// ============================================

app.get('/market/overview', authenticateToken, async (req, res) => {
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

app.get('/market/prices', authenticateToken, async (req, res) => {
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

app.get('/market/ticker/:pair', authenticateToken, async (req, res) => {
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
app.get('/market/quantify-crypto/enhanced-trends', authenticateToken, async (req, res) => {
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

app.get('/portfolio/overview', authenticateToken, async (req, res) => {
  try {
    console.log('[API] Fetching portfolio overview');

    // Get userId from authenticated user
    const userId = req.user!.userId;

    const cached = getCache(`portfolio_overview_${userId}`);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Get API keys from headers for authenticated balance fetch
    const apiKey = req.headers['x-kraken-api-key'] as string;
    const apiSecret = req.headers['x-kraken-api-secret'] as string;

    // Create authenticated Kraken client
    const krakenClient = apiKey && apiSecret
      ? new KrakenService(apiKey, apiSecret)
      : krakenService; // Fallback to public API (won't have balance)

    const balance = await krakenClient.getBalance(apiKey, apiSecret);

    // Build list of trading pairs for assets we hold
    const assetPairs: string[] = [];
    for (const asset of Object.keys(balance)) {
      const amountNum = typeof balance[asset] === 'number' ? balance[asset] : parseFloat(String(balance[asset]));
      if (amountNum > 0) {
        // Skip USD and stablecoins - they don't need price lookup
        if (['ZUSD', 'USD', 'USDT', 'USDC', 'DAI', 'BUSD'].includes(asset)) {
          continue;
        }
        // Convert asset to Kraken pair format (e.g., XXBT -> XXBTZUSD, SOL -> SOLUSD)
        const pair = asset.startsWith('X') || asset.startsWith('Z')
          ? `${asset}ZUSD`
          : `${asset}USD`;
        assetPairs.push(pair);
      }
    }

    // Fetch prices for all held assets
    console.log('[API] Fetching prices for asset pairs:', assetPairs);
    const prices = await krakenService.getCurrentPrices(assetPairs);
    console.log('[API] Received prices:', JSON.stringify(prices));

    let totalValue = 0;
    let totalCostBasis = 0;
    const holdings: any[] = [];

    // Prepare holdings data for cost basis lookup
    const holdingsForCostBasis = Object.entries(balance)
      .filter(([_, amount]) => {
        const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
        return amountNum > 0;
      })
      .map(([asset, amount]) => {
        const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
        // Handle USD and stablecoins with price = 1
        let currentPrice;
        if (['ZUSD', 'USD', 'USDT', 'USDC', 'DAI', 'BUSD'].includes(asset)) {
          currentPrice = 1;
        } else {
          currentPrice = prices[asset] || 0;
        }
        return {
          asset,
          amount: amountNum,
          currentPrice,
        };
      });

    // Get real cost basis from trade history
    let costBasisMap: Map<string, any>;
    try {
      costBasisMap = await costBasisService.getCostBasisForHoldings(userId, holdingsForCostBasis);
      console.log(`[API] Retrieved cost basis for ${costBasisMap.size} assets`);
    } catch (error) {
      console.warn('[API] Failed to get cost basis, using fallback:', error);
      costBasisMap = new Map();
    }

    // Build holdings with real P&L calculations
    for (const [asset, amount] of Object.entries(balance)) {
      const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
      if (amountNum > 0) {
        // Handle USD and stablecoins with price = 1
        let price;
        if (['ZUSD', 'USD', 'USDT', 'USDC', 'DAI', 'BUSD'].includes(asset)) {
          price = 1;
        } else {
          price = prices[asset] || 0;
        }
        const value = amountNum * price;
        totalValue += value;

        let avgPrice = price;
        let costBasis = value;
        let profitLoss = 0;
        let profitLossPercent = 0;

        // Use real cost basis if available
        const costBasisData = costBasisMap.get(asset);
        if (costBasisData) {
          avgPrice = costBasisData.averageCost;
          costBasis = costBasisData.totalCostBasis;
          profitLoss = costBasisData.unrealizedPnL;
          profitLossPercent = costBasisData.unrealizedPnLPercent;
          totalCostBasis += costBasis;
        } else {
          // Fallback: assume break-even if no cost basis
          console.log(`[API] No cost basis for ${asset}, assuming break-even`);
          totalCostBasis += value;
        }

        holdings.push({
          asset,
          symbol: `${asset}/USD`,
          amount: amountNum,
          currentPrice: price,
          avgPrice,
          value,
          profitLoss,
          profitLossPercent,
          allocation: 0, // Will be calculated below
        });
      }
    }

    // Calculate allocations
    holdings.forEach(holding => {
      holding.allocation = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
    });

    holdings.sort((a, b) => b.value - a.value);

    // Calculate total P&L
    const totalProfitLoss = totalValue - totalCostBasis;
    const totalProfitLossPercent = totalCostBasis > 0
      ? (totalProfitLoss / totalCostBasis) * 100
      : 0;

    const portfolioData = {
      totalValue,
      totalCostBasis,
      totalProfitLoss,
      totalProfitLossPercent,
      holdings,
      assetCount: holdings.length,
      usingRealCostBasis: costBasisMap.size > 0,
      lastUpdate: new Date().toISOString(),
    };

    setCache(`portfolio_overview_${userId}`, portfolioData);

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
// COST BASIS / TRADE HISTORY ROUTES
// ============================================

app.post('/portfolio/sync-trades', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

    console.log('[API] Syncing trade history for user:', userId);

    // Get API keys from headers
    const apiKey = req.headers['x-kraken-api-key'] as string;
    const apiSecret = req.headers['x-kraken-api-secret'] as string;

    // Create Kraken client with user's API keys
    const krakenClient = apiKey && apiSecret
      ? new KrakenService(apiKey, apiSecret)
      : new KrakenService();

    await costBasisService.syncTradeHistory(userId, krakenClient);

    // Get count of synced trades
    const tradesSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('trades')
      .get();

    const costBasisSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('costBasis')
      .get();

    res.json({
      success: true,
      message: 'Trade history synced successfully',
      stats: {
        totalTrades: tradesSnapshot.size,
        assetsWithCostBasis: costBasisSnapshot.size,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error syncing trade history:', error.message);

    // Provide more helpful error messages
    let errorMessage = error.message;

    if (error.message?.includes('rate limit')) {
      errorMessage = 'Kraken API rate limit exceeded. Please wait a few minutes and try again.';
    } else if (error.message?.includes('Invalid key') || error.message?.includes('EAPI:Invalid key')) {
      errorMessage = 'Invalid Kraken API credentials. Please check your API keys in Settings.';
    } else if (error.message?.includes('Permission denied')) {
      errorMessage = 'API key does not have permission to access trade history. Please update your API key permissions.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/portfolio/cost-basis/:asset', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const asset = req.params.asset;

    console.log(`[API] Fetching cost basis for ${asset}`);

    const costBasisDoc = await db
      .collection('users')
      .doc(userId)
      .collection('costBasis')
      .doc(asset)
      .get();

    if (!costBasisDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Cost basis not found for this asset',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: costBasisDoc.data(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching cost basis:', error.message);
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
app.get('/settings/quantify-crypto-keys', authenticateToken, async (req, res) => {
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
app.post('/settings/quantify-crypto-keys', authenticateToken, async (req, res) => {
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
app.get('/settings/kraken-keys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    console.log(`[API] Fetching Kraken keys for user ${userId}`);

    // Try to get from Firestore first
    let keys = [];
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        keys = userData?.krakenKeys || [];
        console.log(`[API] Found ${keys.length} Kraken keys in Firestore`);
      }
    } catch (firestoreError) {
      console.warn('[API] Error reading from Firestore, falling back to in-memory store:', firestoreError);
    }

    // Fallback to in-memory store if no keys found in Firestore
    if (keys.length === 0) {
      keys = settingsStore.getKrakenKeys();
      console.log(`[API] Using ${keys.length} Kraken keys from in-memory store`);
    }

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
app.post('/settings/kraken-keys', authenticateToken, async (req, res) => {
  try {
    const { keys } = req.body;
    const userId = req.user!.userId;

    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid keys format. Expected array of key objects.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[API] Saving ${keys.length} Kraken key(s) for user ${userId}`);

    // Encrypt API keys before storing
    const encryptedKeys = keys.map(key => ({
      ...key,
      apiKey: key.apiKey ? encryptKey(key.apiKey) : key.apiKey,
      apiSecret: key.apiSecret ? encryptKey(key.apiSecret) : key.apiSecret,
      encrypted: true,
      updatedAt: new Date().toISOString(),
    }));

    // Save to in-memory store for backward compatibility
    settingsStore.setKrakenKeys(encryptedKeys);

    // Also save to Firestore for persistence
    const writeResult = await db.collection('users').doc(userId).set(
      {
        krakenKeys: encryptedKeys,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[API] Kraken keys saved to Firestore for user ${userId}`, {
      writeTime: writeResult.writeTime,
      keyCount: encryptedKeys.length,
      path: `users/${userId}`,
    });

    // Verify the write by reading back
    const verifyDoc = await db.collection('users').doc(userId).get();
    const verifyData = verifyDoc.data();
    console.log(`[API] Verified Firestore write - found ${verifyData?.krakenKeys?.length || 0} keys`);

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
app.get('/settings/coinmarketcap-key', authenticateToken, async (req, res) => {
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
app.post('/settings/coinmarketcap-key', authenticateToken, async (req, res) => {
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
app.get('/quantify-crypto/test', authenticateToken, async (req, res) => {
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
// TELEGRAM ROUTES
// ============================================

// Get Telegram config
app.get('/telegram/config', authenticateToken, async (req, res) => {
  try {
    console.log('[API] Fetching Telegram config');

    const doc = await db.collection('settings').doc('telegram').get();

    if (!doc.exists) {
      return res.json({
        success: true,
        data: null,
        timestamp: new Date().toISOString(),
      });
    }

    const data = doc.data();

    // Mask the bot token for security
    const maskedConfig = {
      ...data,
      botToken: data?.botToken ? maskApiKey(data.botToken) : null,
      chatId: data?.chatId || null,
      enabled: data?.enabled || false,
    };

    res.json({
      success: true,
      data: maskedConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error fetching Telegram config:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Save Telegram config
app.post('/telegram/config', authenticateToken, async (req, res) => {
  try {
    const { botToken, chatId, enabled } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Bot token and chat ID are required',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[API] Saving Telegram config');

    // Save to Firestore (don't encrypt - the TelegramService needs plaintext)
    await db.collection('settings').doc('telegram').set({
      botToken,
      chatId,
      enabled: enabled !== undefined ? enabled : true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({
      success: true,
      message: 'Telegram configuration saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error saving Telegram config:', error.message);
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

app.get('/audit/trades', authenticateToken, async (req, res) => {
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

app.get('/audit/transactions', authenticateToken, async (req, res) => {
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

app.get('/dca/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

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

/**
 * Order Queue Monitoring Endpoints
 */

// TEST: Create a test pending order
app.post('/order-queue/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

    console.log('[TEST] Creating test pending order for user:', userId);

    const testOrder = await orderQueueService.createOrder({
      userId,
      botId: 'test-bot-123',
      pair: 'BTC/USD',
      type: 'market' as any,
      side: 'buy',
      volume: '0.001',
    });

    console.log('[TEST] Test order created:', testOrder.id);

    res.json({
      success: true,
      message: 'Test pending order created successfully',
      order: testOrder,
    });
  } catch (error: any) {
    console.error('[TEST] Error creating test order:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Get pending orders for current user
app.get('/order-queue', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const orders = await orderQueueService.getOrdersByUser(userId);

    res.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error: any) {
    console.error('[API] Error fetching order queue:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get order queue statistics
app.get('/order-queue/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const counts = await orderQueueService.getPendingOrdersCount();
    const executorStatus = orderExecutorService.getStatus();

    res.json({
      success: true,
      stats: {
        ...counts,
        executor: executorStatus,
      },
    });
  } catch (error: any) {
    console.error('[API] Error fetching order queue stats:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get specific order details
app.get('/order-queue/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const order = await orderQueueService.getOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Verify user owns this order
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error: any) {
    console.error('[API] Error fetching order:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Scheduled function to process pending orders
 * Runs every minute
 */
export const processOrderQueue = functions.pubsub
  .schedule('* * * * *') // Every minute
  .onRun(async (context) => {
    console.log('[OrderQueue] Processing pending orders...');

    try {
      const result = await orderExecutorService.executePendingOrders();

      console.log('[OrderQueue] Processing complete:', result);

      return result;
    } catch (error: any) {
      console.error('[OrderQueue] Error processing orders:', error.message);
      return null;
    }
  });
