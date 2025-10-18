import express from 'express';
import { logger } from '../utils/logger.js';
import { setupAccountRoutes } from './account.js';
import { setupPortfolioRoutes } from './portfolio.js';
import { setupMarketRoutes } from './market.js';
import { setupDCARoutes } from './dcaRoutes.js';
import { setupAuditRoutes } from './audit.js';
import { setupSettingsRoutes } from './settings.js';
import { setupTelegramRoutes } from './telegram.js';
import { quantifyCryptoService } from '../services/quantifyCryptoService.js';

/**
 * Setup all API routes under /api prefix
 * @param {express.Application} app - Express application instance
 */
export function setupRoutes(app) {
  const apiRouter = express.Router();

  // Route logging middleware
  apiRouter.use((req, res, next) => {
    logger.debug(`API Request: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Initialize all route modules
  const accountRouter = express.Router();
  setupAccountRoutes(accountRouter);
  apiRouter.use('/account', accountRouter);

  const portfolioRouter = express.Router();
  setupPortfolioRoutes(portfolioRouter);
  apiRouter.use('/portfolio', portfolioRouter);

  const marketRouter = express.Router();
  setupMarketRoutes(marketRouter);
  apiRouter.use('/market', marketRouter);

  const dcaRouter = express.Router();
  setupDCARoutes(dcaRouter);
  apiRouter.use('/dca', dcaRouter);

  const auditRouter = express.Router();
  setupAuditRoutes(auditRouter);
  apiRouter.use('/audit', auditRouter);

  const settingsRouter = express.Router();
  setupSettingsRoutes(settingsRouter);
  apiRouter.use('/settings', settingsRouter);

  const telegramRouter = express.Router();
  setupTelegramRoutes(telegramRouter);
  apiRouter.use('/telegram', telegramRouter);

  // Quantify Crypto test endpoint
  const quantifyCryptoRouter = express.Router();
  quantifyCryptoRouter.get('/test', async (req, res) => {
    try {
      logger.info('Testing Quantify Crypto API connection');
      const result = await quantifyCryptoService.testConnection();
      res.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error testing Quantify Crypto connection:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
  apiRouter.use('/quantify-crypto', quantifyCryptoRouter);

  // Mount API router under /api prefix
  app.use('/api', apiRouter);

  logger.info('All API routes initialized under /api prefix');

  // Log all registered routes
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = handler.route.path;
          const method = Object.keys(handler.route.methods)[0].toUpperCase();
          routes.push(`${method} /api${path}`);
        }
      });
    }
  });

  logger.debug(`Registered routes:\n${routes.join('\n')}`);
}
