import { logger } from '../utils/logger.js';
import { krakenService } from '../services/krakenService.js';

/**
 * Setup account-related routes
 * @param {express.Router} router - Express router instance
 */
export function setupAccountRoutes(router) {
  /**
   * GET /api/account/balance
   * Get account balance information
   * Accepts optional API keys via headers for frontend-provided credentials
   */
  router.get('/balance', async (req, res) => {
    try {
      logger.info('Fetching account balance');

      // Check for API keys in headers (sent from frontend)
      const apiKey = req.headers['x-kraken-api-key'];
      const apiSecret = req.headers['x-kraken-api-secret'];

      const balance = await krakenService.getBalance(apiKey, apiSecret);

      // Ensure balance is never null or undefined
      const safeBalance = balance || {};

      res.json({
        success: true,
        data: safeBalance,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching account balance:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        data: {}, // Return empty object on error
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/account/info
   * Get comprehensive account information
   */
  router.get('/info', async (req, res) => {
    try {
      logger.info('Fetching account info');
      const accountInfo = await krakenService.getAccountInfo();

      res.json({
        success: true,
        data: accountInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching account info:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/account/trade-balance
   * Get trade balance including margin and equity
   */
  router.get('/trade-balance', async (req, res) => {
    try {
      logger.info('Fetching trade balance');
      const tradeBalance = await krakenService.getTradeBalance();

      res.json({
        success: true,
        data: tradeBalance,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching trade balance:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/account/volume
   * Get account trading volume and fee tier
   */
  router.get('/volume', async (req, res) => {
    try {
      logger.info('Fetching account volume');
      const volume = await krakenService.getTradingVolume();

      res.json({
        success: true,
        data: volume,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching account volume:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Account routes initialized');
}
