import { logger } from '../utils/logger.js';
import { krakenService } from '../services/krakenService.js';
import { dataStore } from '../services/dataStore.js';
import { quantifyCryptoService } from '../services/quantifyCryptoService.js';

/**
 * Setup market data routes
 * @param {express.Router} router - Express router instance
 */
export function setupMarketRoutes(router) {
  /**
   * GET /api/market/overview
   * Get market overview with key statistics
   */
  router.get('/overview', async (req, res) => {
    try {
      logger.info('Fetching market overview');

      // Check cache first (30 second TTL)
      const cached = dataStore.get('market_overview');
      if (cached && Date.now() - cached.timestamp < 30000) {
        logger.debug('Returning cached market overview');
        return res.json({
          success: true,
          data: cached.data,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }

      const overview = await krakenService.getMarketOverview();

      // Cache the result
      dataStore.set('market_overview', overview);

      res.json({
        success: true,
        data: overview,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching market overview:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/top20
   * Get top 20 cryptocurrencies by market cap/volume
   */
  router.get('/top20', async (req, res) => {
    try {
      logger.info('Fetching top 20 assets');

      // Check cache first (60 second TTL)
      const cached = dataStore.get('market_top20');
      if (cached && Date.now() - cached.timestamp < 60000) {
        logger.debug('Returning cached top 20');
        return res.json({
          success: true,
          data: cached.data,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }

      const top20 = await krakenService.getTop20Assets();

      // Cache the result
      dataStore.set('market_top20', top20);

      res.json({
        success: true,
        data: top20,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching top 20 assets:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/prices
   * Get live prices for specified pairs or all pairs
   */
  router.get('/prices', async (req, res) => {
    try {
      const { pairs } = req.query;
      logger.info(`Fetching prices${pairs ? ` for: ${pairs}` : ' for all pairs'}`);

      const pairArray = pairs ? pairs.split(',').map(p => p.trim()) : null;
      const prices = await krakenService.getCurrentPrices(pairArray);

      res.json({
        success: true,
        data: prices,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching prices:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/ticker/:pair
   * Get detailed ticker information for a specific pair
   */
  router.get('/ticker/:pair', async (req, res) => {
    try {
      const { pair } = req.params;
      logger.info(`Fetching ticker for ${pair}`);

      const ticker = await krakenService.getTicker(pair);

      res.json({
        success: true,
        data: ticker,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching ticker for ${req.params.pair}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/ohlc/:pair
   * Get OHLC (candlestick) data for a pair
   */
  router.get('/ohlc/:pair', async (req, res) => {
    try {
      const { pair } = req.params;
      const { interval = 60 } = req.query; // Default 1 hour
      logger.info(`Fetching OHLC for ${pair} with interval ${interval}`);

      const ohlc = await krakenService.getOHLC(pair, parseInt(interval));

      res.json({
        success: true,
        data: ohlc,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching OHLC for ${req.params.pair}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/orderbook/:pair
   * Get order book data for a pair
   */
  router.get('/orderbook/:pair', async (req, res) => {
    try {
      const { pair } = req.params;
      const { count = 10 } = req.query;
      logger.info(`Fetching order book for ${pair}`);

      const orderBook = await krakenService.getOrderBook(pair, parseInt(count));

      res.json({
        success: true,
        data: orderBook,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching order book for ${req.params.pair}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/trades/:pair
   * Get recent trades for a pair
   */
  router.get('/trades/:pair', async (req, res) => {
    try {
      const { pair } = req.params;
      const { since } = req.query;
      logger.info(`Fetching recent trades for ${pair}`);

      const trades = await krakenService.getRecentTrades(pair, since);

      res.json({
        success: true,
        data: trades,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching trades for ${req.params.pair}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/spread/:pair
   * Get bid/ask spread for a pair
   */
  router.get('/spread/:pair', async (req, res) => {
    try {
      const { pair } = req.params;
      logger.info(`Fetching spread for ${pair}`);

      const spread = await krakenService.getSpread(pair);

      res.json({
        success: true,
        data: spread,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching spread for ${req.params.pair}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/market/quantify-crypto/enhanced-trends
   * Get enhanced trend data with technical analysis from Quantify Crypto
   */
  router.get('/quantify-crypto/enhanced-trends', async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      logger.info(`Fetching enhanced trends (limit: ${limit})`);

      // Check cache first (60 second TTL for trends)
      const cacheKey = `enhanced_trends_${limit}`;
      const cached = dataStore.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        logger.debug('Returning cached enhanced trends');
        return res.json({
          ...cached.data,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await quantifyCryptoService.getEnhancedTrends(parseInt(limit));

      // Cache the result
      dataStore.set(cacheKey, result);

      res.json({
        ...result,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching enhanced trends:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Market routes initialized');
}
