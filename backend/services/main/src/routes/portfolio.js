import { logger } from '../utils/logger.js';
import { krakenService } from '../services/krakenService.js';
import { dataStore } from '../services/dataStore.js';

/**
 * Setup portfolio-related routes
 * @param {express.Router} router - Express router instance
 */
export function setupPortfolioRoutes(router) {
  /**
   * GET /api/portfolio/overview
   * Get complete portfolio overview with holdings and performance
   */
  router.get('/overview', async (req, res) => {
    try {
      logger.info('Fetching portfolio overview');

      // Try to get cached data first
      const cached = dataStore.get('portfolio_overview');
      if (cached && Date.now() - cached.timestamp < 30000) {
        logger.debug('Returning cached portfolio overview');
        return res.json({
          success: true,
          data: cached.data,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }

      const balance = await krakenService.getBalance();
      const prices = await krakenService.getCurrentPrices();

      // Calculate portfolio metrics
      let totalValue = 0;
      const holdings = [];

      for (const [asset, amount] of Object.entries(balance)) {
        if (parseFloat(amount) > 0) {
          const price = prices[asset] || 0;
          const value = parseFloat(amount) * price;
          totalValue += value;

          holdings.push({
            asset,
            amount: parseFloat(amount),
            price,
            value,
            percentage: 0, // Will calculate after total
          });
        }
      }

      // Calculate percentages
      holdings.forEach(holding => {
        holding.percentage = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
      });

      // Sort by value
      holdings.sort((a, b) => b.value - a.value);

      const portfolioData = {
        totalValue,
        holdings,
        assetCount: holdings.length,
        lastUpdated: new Date().toISOString(),
      };

      // Cache the result
      dataStore.set('portfolio_overview', portfolioData);

      res.json({
        success: true,
        data: portfolioData,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching portfolio overview:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/portfolio/holdings
   * Get current holdings with current prices
   */
  router.get('/holdings', async (req, res) => {
    try {
      logger.info('Fetching portfolio holdings');
      const balance = await krakenService.getBalance();
      const prices = await krakenService.getCurrentPrices();

      const holdings = Object.entries(balance)
        .filter(([asset, amount]) => parseFloat(amount) > 0)
        .map(([asset, amount]) => ({
          asset,
          amount: parseFloat(amount),
          price: prices[asset] || 0,
          value: parseFloat(amount) * (prices[asset] || 0),
        }))
        .sort((a, b) => b.value - a.value);

      res.json({
        success: true,
        data: holdings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching portfolio holdings:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/portfolio/performance
   * Get portfolio performance metrics
   */
  router.get('/performance', async (req, res) => {
    try {
      logger.info('Fetching portfolio performance');
      const { period = '24h' } = req.query;

      // This would typically fetch historical data
      // For now, return mock data
      const performance = {
        period,
        change: 2.45,
        changePercent: 3.2,
        high: 78500.50,
        low: 75200.30,
        volume: 125000,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: performance,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching portfolio performance:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/portfolio/allocation
   * Get asset allocation breakdown
   */
  router.get('/allocation', async (req, res) => {
    try {
      logger.info('Fetching portfolio allocation');
      const balance = await krakenService.getBalance();
      const prices = await krakenService.getCurrentPrices();

      let totalValue = 0;
      const allocations = [];

      for (const [asset, amount] of Object.entries(balance)) {
        if (parseFloat(amount) > 0) {
          const value = parseFloat(amount) * (prices[asset] || 0);
          totalValue += value;
          allocations.push({ asset, value });
        }
      }

      const allocation = allocations.map(item => ({
        asset: item.asset,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
        value: item.value,
      })).sort((a, b) => b.percentage - a.percentage);

      res.json({
        success: true,
        data: {
          allocation,
          totalValue,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching portfolio allocation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Portfolio routes initialized');
}
