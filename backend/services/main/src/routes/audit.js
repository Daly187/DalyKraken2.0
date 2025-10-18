import { logger } from '../utils/logger.js';
import { krakenService } from '../services/krakenService.js';
import { dcaService } from '../services/dcaService.js';

/**
 * Setup audit and transaction history routes
 * @param {express.Router} router - Express router instance
 */
export function setupAuditRoutes(router) {
  /**
   * GET /api/audit/transactions
   * Get transaction history with filtering and pagination
   */
  router.get('/transactions', async (req, res) => {
    try {
      const {
        type,
        asset,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query;

      logger.info('Fetching transaction history', { type, asset, limit, offset });

      const transactions = await krakenService.getTransactionHistory({
        type,
        asset,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        data: transactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: transactions.length === parseInt(limit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching transaction history:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/audit/trades
   * Get trade history with filtering
   */
  router.get('/trades', async (req, res) => {
    try {
      const {
        pair,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query;

      logger.info('Fetching trade history', { pair, limit, offset });

      const result = await krakenService.getTradeHistory({
        pair,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Kraken returns { trades: {...}, count: N }
      const trades = result?.trades || result || {};
      const tradeCount = result?.count || Object.keys(trades).length;

      res.json({
        success: true,
        data: trades,
        count: tradeCount,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: tradeCount === parseInt(limit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching trade history:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/audit/orders
   * Get order history (open and closed)
   */
  router.get('/orders', async (req, res) => {
    try {
      const { status = 'all', limit = 50 } = req.query;
      logger.info('Fetching order history', { status, limit });

      const orders = await krakenService.getOrderHistory({
        status,
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        data: orders,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching order history:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/audit/summary
   * Get comprehensive audit summary with statistics
   */
  router.get('/summary', async (req, res) => {
    try {
      const { period = '30d' } = req.query;
      logger.info('Fetching audit summary', { period });

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const [tradesResult, transactions] = await Promise.all([
        krakenService.getTradeHistory({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000,
        }),
        krakenService.getTransactionHistory({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000,
        }),
      ]);

      // Extract trades from Kraken response format
      const tradesData = tradesResult?.trades || tradesResult || {};
      const tradesArray = Object.values(tradesData);

      // Calculate summary statistics
      const summary = {
        period,
        totalTrades: tradesArray.length,
        totalVolume: tradesArray.reduce((sum, trade) => sum + (parseFloat(trade.vol) || 0), 0),
        totalFees: tradesArray.reduce((sum, trade) => sum + (parseFloat(trade.fee) || 0), 0),
        buyTrades: tradesArray.filter(t => t.type === 'buy').length,
        sellTrades: tradesArray.filter(t => t.type === 'sell').length,
        totalTransactions: Array.isArray(transactions) ? transactions.length : 0,
        deposits: Array.isArray(transactions) ? transactions.filter(t => t.type === 'deposit').length : 0,
        withdrawals: Array.isArray(transactions) ? transactions.filter(t => t.type === 'withdrawal').length : 0,
        avgTradeSize: tradesArray.length > 0
          ? tradesArray.reduce((sum, trade) => sum + (parseFloat(trade.vol) || 0), 0) / tradesArray.length
          : 0,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching audit summary:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/audit/sync
   * Manually trigger sync of transaction data
   */
  router.post('/sync', async (req, res) => {
    try {
      logger.info('Triggering manual transaction sync');
      const result = await krakenService.syncTransactionData();

      res.json({
        success: true,
        data: result,
        message: 'Transaction data sync completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error syncing transaction data:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/audit/export
   * Export transaction data in various formats
   */
  router.get('/export', async (req, res) => {
    try {
      const { format = 'json', startDate, endDate, type } = req.query;
      logger.info('Exporting transaction data', { format, type });

      const transactions = await krakenService.getTransactionHistory({
        type,
        startDate,
        endDate,
        limit: 10000, // Get all for export
      });

      if (format === 'csv') {
        // Convert to CSV
        const csv = convertToCSV(transactions);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions-${Date.now()}.csv`);
        res.send(csv);
      } else {
        // Return as JSON
        res.json({
          success: true,
          data: transactions,
          count: transactions.length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error exporting transaction data:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/audit/dca-deployments
   * Get audit trail of DCA strategy deployments and executions
   */
  router.get('/dca-deployments', async (req, res) => {
    try {
      const { strategyId, limit = 100 } = req.query;
      logger.info('Fetching DCA deployment audit trail', { strategyId, limit });

      const deployments = await dcaService.getDeploymentAudit({
        strategyId,
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        data: deployments,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching DCA deployment audit:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/audit/transaction/:txId
   * Get detailed information about a specific transaction
   */
  router.get('/transaction/:txId', async (req, res) => {
    try {
      const { txId } = req.params;
      logger.info(`Fetching transaction details: ${txId}`);

      const transaction = await krakenService.getTransactionDetails(txId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching transaction ${req.params.txId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Audit routes initialized');
}

/**
 * Helper function to convert transactions to CSV format
 */
function convertToCSV(transactions) {
  if (!transactions || transactions.length === 0) {
    return '';
  }

  const headers = Object.keys(transactions[0]).join(',');
  const rows = transactions.map(tx =>
    Object.values(tx).map(val =>
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',')
  );

  return [headers, ...rows].join('\n');
}
