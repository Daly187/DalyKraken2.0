import { logger } from '../utils/logger.js';
import { dcaService } from '../services/dcaService.js';
import { scannerService } from '../services/scannerService.js';

/**
 * Setup DCA (Dollar Cost Averaging) routes
 * @param {express.Router} router - Express router instance
 */
export function setupDCARoutes(router) {
  /**
   * GET /api/dca/status
   * Get current DCA service status and active strategies
   */
  router.get('/status', async (req, res) => {
    try {
      logger.info('Fetching DCA status');
      const status = await dcaService.getStatus();

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching DCA status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/dca/start
   * Start or create a new DCA strategy
   */
  router.post('/start', async (req, res) => {
    try {
      const { pair, amount, interval, conditions } = req.body;

      if (!pair || !amount || !interval) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pair, amount, interval',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Starting DCA strategy for ${pair}`);
      const strategy = await dcaService.startStrategy({
        pair,
        amount: parseFloat(amount),
        interval,
        conditions: conditions || {},
      });

      res.json({
        success: true,
        data: strategy,
        message: `DCA strategy started for ${pair}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error starting DCA strategy:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/dca/stop/:strategyId
   * Stop a running DCA strategy
   */
  router.post('/stop/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      logger.info(`Stopping DCA strategy: ${strategyId}`);

      const result = await dcaService.stopStrategy(strategyId);

      res.json({
        success: true,
        data: result,
        message: `DCA strategy ${strategyId} stopped`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error stopping DCA strategy ${req.params.strategyId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/dca/strategies
   * Get all DCA strategies (active and inactive)
   */
  router.get('/strategies', async (req, res) => {
    try {
      logger.info('Fetching all DCA strategies');
      const strategies = await dcaService.getAllStrategies();

      res.json({
        success: true,
        data: strategies,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching DCA strategies:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/dca/strategy/:strategyId
   * Get details for a specific strategy
   */
  router.get('/strategy/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      logger.info(`Fetching DCA strategy: ${strategyId}`);

      const strategy = await dcaService.getStrategy(strategyId);

      if (!strategy) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found',
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: strategy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching DCA strategy ${req.params.strategyId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/dca/execute/:strategyId
   * Manually execute a DCA strategy buy
   */
  router.post('/execute/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      logger.info(`Manually executing DCA strategy: ${strategyId}`);

      const execution = await dcaService.executeStrategy(strategyId);

      res.json({
        success: true,
        data: execution,
        message: `DCA strategy ${strategyId} executed`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error executing DCA strategy ${req.params.strategyId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/dca/history/:strategyId
   * Get execution history for a strategy
   */
  router.get('/history/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      const { limit = 50 } = req.query;
      logger.info(`Fetching history for DCA strategy: ${strategyId}`);

      const history = await dcaService.getStrategyHistory(strategyId, parseInt(limit));

      res.json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching history for DCA strategy ${req.params.strategyId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/dca/scan
   * Scan market for DCA opportunities
   */
  router.post('/scan', async (req, res) => {
    try {
      const { criteria } = req.body;
      logger.info('Scanning market for DCA opportunities');

      const opportunities = await scannerService.scanForDCAOpportunities(criteria);

      res.json({
        success: true,
        data: opportunities,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error scanning for DCA opportunities:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/dca/bot-scores
   * Get bot scoring for potential DCA candidates
   */
  router.get('/bot-scores', async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      logger.info('Fetching bot scores for DCA candidates');

      const scores = await scannerService.getBotScores(parseInt(limit));

      res.json({
        success: true,
        data: scores,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching bot scores:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/dca/strategy/:strategyId
   * Update DCA strategy settings
   */
  router.put('/strategy/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      const updates = req.body;
      logger.info(`Updating DCA strategy: ${strategyId}`);

      const updatedStrategy = await dcaService.updateStrategy(strategyId, updates);

      res.json({
        success: true,
        data: updatedStrategy,
        message: `DCA strategy ${strategyId} updated`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error updating DCA strategy ${req.params.strategyId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /api/dca/strategy/:strategyId
   * Delete a DCA strategy
   */
  router.delete('/strategy/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      logger.info(`Deleting DCA strategy: ${strategyId}`);

      await dcaService.deleteStrategy(strategyId);

      res.json({
        success: true,
        message: `DCA strategy ${strategyId} deleted`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error deleting DCA strategy ${req.params.strategyId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('DCA routes initialized');
}
