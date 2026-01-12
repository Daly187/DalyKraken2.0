/**
 * Trading routes for Firebase Functions
 */

import { Router } from 'express';
import { KrakenService } from '../services/krakenService.js';
import { TelegramService } from '../services/telegramService.js';

export function createTradingRouter(): Router {
  const router = Router();
  const telegramService = new TelegramService();

  /**
   * POST /trading/addorder
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

      console.log(`[Trading] Placing ${type} ${ordertype} order: ${volume} ${pair}`);

      // Get API keys from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
          timestamp: new Date().toISOString(),
        });
      }

      const krakenService = new KrakenService(apiKey, apiSecret);

      let orderResult;

      // Validate order type
      if (ordertype !== 'market' && ordertype !== 'limit') {
        return res.status(400).json({
          success: false,
          error: 'Invalid order type. Must be "market" or "limit"',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate price for limit orders
      if (ordertype === 'limit' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for limit orders',
          timestamp: new Date().toISOString(),
        });
      }

      // Place order based on trade direction
      if (type === 'buy') {
        orderResult = await krakenService.placeBuyOrder(
          pair,
          parseFloat(volume),
          ordertype as 'market' | 'limit',
          price ? parseFloat(price) : undefined
        );
      } else if (type === 'sell') {
        orderResult = await krakenService.placeSellOrder(
          pair,
          parseFloat(volume),
          ordertype as 'market' | 'limit',
          price ? parseFloat(price) : undefined
        );
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid trade type. Must be "buy" or "sell"',
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
          console.warn('[Trading] Failed to fetch current price for notification:', error);
          currentPrice = 0;
        }
      }

      // Calculate amount
      const amount = parseFloat(volume) * parseFloat(String(currentPrice));

      // Build top holdings for notification
      const topHoldings: Array<{ asset: string; value: number }> = [];
      try {
        const accountBalance = await krakenService.getBalance(apiKey, apiSecret);
        if (accountBalance) {
          const stablecoins = ['ZUSD', 'USD', 'USDT', 'USDC', 'DAI', 'BUSD'];

          // Get prices for non-stablecoin assets
          const assetPairs: string[] = [];
          const assetToPairMapping: Record<string, string> = {};

          for (const asset of Object.keys(accountBalance)) {
            const amountNum = parseFloat(String(accountBalance[asset]));
            if (amountNum > 0 && !stablecoins.includes(asset)) {
              const baseAsset = asset.replace(/\.F$/, '');
              const assetPair = baseAsset.startsWith('X') || baseAsset.startsWith('Z')
                ? `${baseAsset}ZUSD` : `${baseAsset}USD`;
              assetPairs.push(assetPair);
              assetToPairMapping[asset] = assetPair;
            }
          }

          let prices: Record<string, number> = {};
          if (assetPairs.length > 0) {
            try {
              const rawPrices = await krakenService.getCurrentPrices(assetPairs);
              for (const [asset] of Object.entries(assetToPairMapping)) {
                const baseAsset = asset.replace(/\.F$/, '');
                if (rawPrices[baseAsset] !== undefined) {
                  prices[asset] = rawPrices[baseAsset];
                }
              }
            } catch (e) { /* ignore price fetch errors */ }
          }

          // Build holdings array
          for (const [asset, assetAmount] of Object.entries(accountBalance)) {
            const amountNum = parseFloat(String(assetAmount));
            if (amountNum <= 0) continue;
            const isStable = stablecoins.includes(asset);
            const assetPrice = isStable ? 1 : (prices[asset] || 0);
            const assetValue = amountNum * assetPrice;
            if (assetValue > 0.01) {
              let displayName = asset.replace(/\.F$/, '');
              if (displayName.startsWith('X') || displayName.startsWith('Z')) {
                displayName = displayName.substring(1);
              }
              topHoldings.push({ asset: displayName, value: assetValue });
            }
          }
          topHoldings.sort((a, b) => b.value - a.value);
        }
      } catch (error) {
        console.warn('[Trading] Failed to fetch balance for Telegram notification:', error);
      }

      // Send Telegram notification for trade entry (manual trade - no bot context)
      try {
        await telegramService.sendTradeEntry({
          pair,
          price: parseFloat(String(currentPrice)),
          totalPurchased: amount, // For manual trades, just show the current order amount
          remainingValue: amount,
          topHoldings,
        });
      } catch (error) {
        console.warn('[Trading] Failed to send Telegram notification:', error);
        // Don't fail the order if notification fails
      }

      res.json({
        success: true,
        data: orderResult,
        message: 'Order placed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Trading] Error placing order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /trading/openorders
   * Get open orders
   */
  router.post('/openorders', async (req, res) => {
    try {
      console.log('[Trading] Fetching open orders');

      // Get API keys from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
          timestamp: new Date().toISOString(),
        });
      }

      const krakenService = new KrakenService(apiKey, apiSecret);
      const openOrders = await krakenService.getOpenOrders();

      res.json({
        success: true,
        data: openOrders,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Trading] Error fetching open orders:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /trading/cancelorder
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

      console.log(`[Trading] Cancelling order: ${txid}`);

      // Get API keys from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
          timestamp: new Date().toISOString(),
        });
      }

      const krakenService = new KrakenService(apiKey, apiSecret);
      const result = await krakenService.cancelOrder(txid);

      res.json({
        success: true,
        data: result,
        message: 'Order cancelled successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Trading] Error cancelling order:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /trading/closeposition
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

      console.log(`[Trading] Closing position: ${volume} ${pair}`);

      // Get API keys from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
          timestamp: new Date().toISOString(),
        });
      }

      const krakenService = new KrakenService(apiKey, apiSecret);

      // Place market sell order to close position
      const orderResult = await krakenService.placeSellOrder(
        pair,
        parseFloat(volume),
        'market'
      );

      // Get current price
      let currentPrice;
      try {
        const prices = await krakenService.getCurrentPrices([pair]);
        currentPrice = prices[pair] || prices[Object.keys(prices)[0]];
      } catch (error) {
        console.warn('[Trading] Failed to fetch current price:', error);
        currentPrice = 0;
      }

      // Calculate profit/loss if entry price provided
      const amount = parseFloat(volume) * parseFloat(String(currentPrice));
      let profit = 0;
      let profitPercent = 0;

      if (entryPrice) {
        const entryAmount = parseFloat(volume) * parseFloat(entryPrice);
        profit = amount - entryAmount;
        profitPercent = (profit / entryAmount) * 100;
      }

      // Build top holdings for notification
      const topHoldings: Array<{ asset: string; value: number }> = [];
      let accountBalanceData: Record<string, any> = {};
      try {
        const accountBalance = await krakenService.getBalance(apiKey, apiSecret);
        accountBalanceData = accountBalance || {};
        if (accountBalance) {
          const stablecoins = ['ZUSD', 'USD', 'USDT', 'USDC', 'DAI', 'BUSD'];

          // Get prices for non-stablecoin assets
          const assetPairs: string[] = [];
          const assetToPairMapping: Record<string, string> = {};

          for (const asset of Object.keys(accountBalance)) {
            const amountNum = parseFloat(String(accountBalance[asset]));
            if (amountNum > 0 && !stablecoins.includes(asset)) {
              const baseAsset = asset.replace(/\.F$/, '');
              const assetPair = baseAsset.startsWith('X') || baseAsset.startsWith('Z')
                ? `${baseAsset}ZUSD` : `${baseAsset}USD`;
              assetPairs.push(assetPair);
              assetToPairMapping[asset] = assetPair;
            }
          }

          let prices: Record<string, number> = {};
          if (assetPairs.length > 0) {
            try {
              const rawPrices = await krakenService.getCurrentPrices(assetPairs);
              for (const [asset] of Object.entries(assetToPairMapping)) {
                const baseAsset = asset.replace(/\.F$/, '');
                if (rawPrices[baseAsset] !== undefined) {
                  prices[asset] = rawPrices[baseAsset];
                }
              }
            } catch (e) { /* ignore price fetch errors */ }
          }

          // Build holdings array
          for (const [asset, assetAmount] of Object.entries(accountBalance)) {
            const amountNum = parseFloat(String(assetAmount));
            if (amountNum <= 0) continue;
            const isStable = stablecoins.includes(asset);
            const assetPrice = isStable ? 1 : (prices[asset] || 0);
            const assetValue = amountNum * assetPrice;
            if (assetValue > 0.01) {
              let displayName = asset.replace(/\.F$/, '');
              if (displayName.startsWith('X') || displayName.startsWith('Z')) {
                displayName = displayName.substring(1);
              }
              topHoldings.push({ asset: displayName, value: assetValue });
            }
          }
          topHoldings.sort((a, b) => b.value - a.value);
        }
      } catch (error) {
        console.warn('[Trading] Failed to fetch balance for Telegram notification:', error);
      }

      // Extract symbol and find remaining balance
      let symbol = pair.replace(/USD$|ZUSD$/, '');
      if (symbol.startsWith('X') || symbol.startsWith('Z')) {
        symbol = symbol.substring(1);
      }
      let remainingBalance: number | undefined;
      for (const [asset, assetAmount] of Object.entries(accountBalanceData)) {
        let assetSymbol = asset.replace(/\.F$/, '');
        if (assetSymbol.startsWith('X') || assetSymbol.startsWith('Z')) {
          assetSymbol = assetSymbol.substring(1);
        }
        if (assetSymbol === symbol) {
          remainingBalance = parseFloat(String(assetAmount));
          break;
        }
      }

      // Send Telegram notification for trade closure (manual trade)
      const totalPurchased = entryPrice ? parseFloat(volume) * parseFloat(entryPrice) : amount;
      try {
        await telegramService.sendTradeClosure({
          pair,
          price: parseFloat(String(currentPrice)),
          totalPurchased,
          totalSold: amount,
          profit,
          profitPercent,
          symbol,
          remainingBalance,
          topHoldings,
        });
      } catch (error) {
        console.warn('[Trading] Failed to send Telegram notification:', error);
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
    } catch (error: any) {
      console.error('[Trading] Error closing position:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /trading/test-telegram
   * Send a test Telegram message
   */
  router.post('/test-telegram', async (req, res) => {
    try {
      console.log('[Trading] Sending test Telegram message');

      const result = await telegramService.sendTestMessage();

      if (result.sent) {
        res.json({
          success: true,
          message: 'Test message sent successfully',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.json({
          success: false,
          message: 'Telegram notifications are disabled or not configured',
          reason: result.reason,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('[Trading] Error sending test Telegram message:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  console.log('[Trading] Trading routes initialized');
  return router;
}
