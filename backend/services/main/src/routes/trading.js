import { logger } from '../utils/logger.js';
import { krakenService } from '../services/krakenService.js';
import { telegramService } from '../services/telegramService.js';

/**
 * Setup trading routes
 * @param {express.Router} router - Express router instance
 */
export function setupTradingRoutes(router) {
  /**
   * POST /api/trading/addorder
   * Place a new order on Kraken
   */
  router.post('/addorder', async (req, res) => {
    try {
      const { pair, type, ordertype, volume, price } = req.body;

      if (!pair || !type || !ordertype || !volume) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pair, type, ordertype, volume',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Placing ${type} ${ordertype} order: ${volume} ${pair}`);

      let orderResult;

      if (ordertype === 'market') {
        // Place market order
        orderResult = await krakenService.placeMarketOrder(pair, type, volume);
      } else if (ordertype === 'limit') {
        // Place limit order
        if (!price) {
          return res.status(400).json({
            success: false,
            error: 'Price is required for limit orders',
            timestamp: new Date().toISOString(),
          });
        }
        orderResult = await krakenService.placeLimitOrder(pair, type, volume, price);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid order type. Must be "market" or "limit"',
          timestamp: new Date().toISOString(),
        });
      }

      // Get current price for calculation
      let currentPrice = price;
      if (!currentPrice) {
        try {
          const prices = await krakenService.getCurrentPrices([pair]);
          currentPrice = prices[pair] || prices[Object.keys(prices)[0]];
        } catch (error) {
          logger.warn('Failed to fetch current price for notification:', error);
          currentPrice = 0;
        }
      }

      // Calculate amount
      const amount = parseFloat(volume) * parseFloat(currentPrice);

      // Get portfolio balance for notification
      let balance = { total: 0, stables: 0 };
      try {
        const accountBalance = await krakenService.getBalance();
        if (accountBalance) {
          // Calculate total balance in USD equivalent
          balance.total = Object.entries(accountBalance).reduce((sum, [asset, amount]) => {
            return sum + parseFloat(amount);
          }, 0);

          // Calculate stables (USD, USDT, USDC, etc.)
          balance.stables = Object.entries(accountBalance).reduce((sum, [asset, assetAmount]) => {
            if (asset.includes('USD') || asset.includes('USDT') || asset.includes('USDC')) {
              return sum + parseFloat(assetAmount);
            }
            return sum;
          }, 0);
        }
      } catch (error) {
        logger.warn('Failed to fetch balance for Telegram notification:', error);
      }

      // Send Telegram notification for trade entry
      try {
        await telegramService.sendTradeEntry(
          {
            pair,
            type,
            volume,
            price: currentPrice,
            amount,
            orderResult,
          },
          balance
        );
      } catch (error) {
        logger.warn('Failed to send Telegram notification:', error);
        // Don't fail the order if notification fails
      }

      res.json({
        success: true,
        data: orderResult,
        message: 'Order placed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error placing order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/trading/openorders
   * Get open orders
   */
  router.post('/openorders', async (req, res) => {
    try {
      logger.info('Fetching open orders');

      const openOrders = await krakenService.getOpenOrders();

      res.json({
        success: true,
        data: openOrders,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching open orders:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/trading/cancelorder
   * Cancel an open order
   */
  router.post('/cancelorder', async (req, res) => {
    try {
      const { txid } = req.body;

      if (!txid) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: txid',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Cancelling order: ${txid}`);

      const result = await krakenService.cancelOrder(txid);

      res.json({
        success: true,
        data: result,
        message: 'Order cancelled successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error cancelling order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/trading/closeposition
   * Close a position (sell order with notification)
   */
  router.post('/closeposition', async (req, res) => {
    try {
      const { pair, volume, entryPrice } = req.body;

      if (!pair || !volume) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pair, volume',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Closing position: ${volume} ${pair}`);

      // Place market sell order to close position
      const orderResult = await krakenService.placeMarketOrder(pair, 'sell', volume);

      // Get current price
      let currentPrice;
      try {
        const prices = await krakenService.getCurrentPrices([pair]);
        currentPrice = prices[pair] || prices[Object.keys(prices)[0]];
      } catch (error) {
        logger.warn('Failed to fetch current price:', error);
        currentPrice = 0;
      }

      // Calculate profit/loss if entry price provided
      const amount = parseFloat(volume) * parseFloat(currentPrice);
      let profit = 0;
      let profitPercent = 0;

      if (entryPrice) {
        const entryAmount = parseFloat(volume) * parseFloat(entryPrice);
        profit = amount - entryAmount;
        profitPercent = (profit / entryAmount) * 100;
      }

      // Get portfolio balance for notification
      let balance = { total: 0, stables: 0 };
      try {
        const accountBalance = await krakenService.getBalance();
        if (accountBalance) {
          balance.total = Object.entries(accountBalance).reduce((sum, [asset, amount]) => {
            return sum + parseFloat(amount);
          }, 0);

          balance.stables = Object.entries(accountBalance).reduce((sum, [asset, assetAmount]) => {
            if (asset.includes('USD') || asset.includes('USDT') || asset.includes('USDC')) {
              return sum + parseFloat(assetAmount);
            }
            return sum;
          }, 0);
        }
      } catch (error) {
        logger.warn('Failed to fetch balance for Telegram notification:', error);
      }

      // Send Telegram notification for trade closure
      try {
        await telegramService.sendTradeClosure(
          {
            pair,
            type: 'sell',
            volume,
            price: currentPrice,
            amount,
            profit,
            profitPercent,
            orderResult,
          },
          balance
        );
      } catch (error) {
        logger.warn('Failed to send Telegram notification:', error);
        // Don't fail the order if notification fails
      }

      res.json({
        success: true,
        data: {
          orderResult,
          profit,
          profitPercent,
          closingPrice: currentPrice,
        },
        message: 'Position closed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error closing position:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Trading routes initialized');
}
