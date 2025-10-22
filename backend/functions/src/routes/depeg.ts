/**
 * Depeg Arbitrage Strategy API Routes
 */

import { Router } from 'express';
import { Firestore } from 'firebase-admin/firestore';
import { DepegMonitorService } from '../services/depegMonitorService.js';
import { KrakenService } from '../services/krakenService.js';

export function createDepegRouter(db: Firestore): Router {
  const router = Router();
  const depegService = new DepegMonitorService(db);

  /**
   * GET /depeg/prices
   * Get current stablecoin prices
   */
  router.get('/prices', async (req, res) => {
    try {
      const userId = req.user!.userId;

      // Get user's enabled pairs from config
      const config = await depegService.getConfig(userId);
      const enabledPairs = config?.enabledPairs;

      const prices = await depegService.getStablecoinPrices(enabledPairs);

      res.json({
        success: true,
        prices,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Depeg API] Error fetching prices:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /depeg/opportunities
   * Get detected arbitrage opportunities
   */
  router.get('/opportunities', async (req, res) => {
    try {
      const userId = req.user!.userId;

      // Get user configuration
      const config = await depegService.getConfig(userId);

      // Get current prices
      const prices = await depegService.getStablecoinPrices(config.enabledPairs);

      // Detect opportunities
      const opportunities = await depegService.detectOpportunities(prices, config);

      res.json({
        success: true,
        opportunities,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Depeg API] Error detecting opportunities:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /depeg/execute
   * Execute a depeg arbitrage trade
   */
  router.post('/execute', async (req, res) => {
    try {
      const userId = req.user!.userId;

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
        });
      }

      // Get opportunity details from request body
      const { pair, entryPrice, targetPrice, type } = req.body;

      if (!pair || !entryPrice || !targetPrice || !type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: pair, entryPrice, targetPrice, type',
        });
      }

      // Get user configuration
      const config = await depegService.getConfig(userId);

      // Create opportunity object
      const depegPercentage = ((entryPrice - 1.0) / 1.0) * 100;
      const estimatedProfitPercent = type === 'buy'
        ? ((targetPrice - entryPrice) / entryPrice) * 100 - (config.feeTierPercent * 2)
        : ((entryPrice - targetPrice) / targetPrice) * 100 - (config.feeTierPercent * 2);

      const opportunity = {
        id: `opp_${Date.now()}`,
        pair,
        type: type as 'buy' | 'sell',
        entryPrice,
        targetPrice,
        depegPercentage,
        estimatedProfit: (entryPrice * 0.01) * estimatedProfitPercent, // Dollar amount estimate
        estimatedProfitPercent,
        riskLevel: Math.abs(depegPercentage) > 2 ? 'high' : Math.abs(depegPercentage) > 1 ? 'medium' : 'low' as 'low' | 'medium' | 'high',
        confidence: Math.abs(depegPercentage) > 0.5 ? 0.8 : 0.6,
        detectedAt: new Date().toISOString(),
        status: 'pending' as const,
      };

      // Execute the trade
      const position = await depegService.executeTrade(
        userId,
        opportunity,
        config,
        apiKey,
        apiSecret
      );

      res.json({
        success: true,
        position,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error executing trade:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /depeg/positions
   * Get all open positions for the user
   */
  router.get('/positions', async (req, res) => {
    try {
      const userId = req.user!.userId;

      // Get Kraken credentials for price updates
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      // Update positions with current prices if credentials provided
      if (apiKey && apiSecret) {
        await depegService.updatePositions(userId);
      }

      const positions = await depegService.getOpenPositions(userId);

      res.json({
        success: true,
        positions,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error fetching positions:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /depeg/close/:positionId
   * Close an open position
   */
  router.post('/close/:positionId', async (req, res) => {
    try {
      const userId = req.user!.userId;
      const positionId = req.params.positionId;

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
        });
      }

      // Close the position
      const closedPosition = await depegService.closePosition(
        positionId,
        userId,
        apiKey,
        apiSecret
      );

      res.json({
        success: true,
        position: closedPosition,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error closing position:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /depeg/history
   * Get trade history for the user
   */
  router.get('/history', async (req, res) => {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 50;

      const history = await depegService.getTradeHistory(userId, limit);

      res.json({
        success: true,
        history,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error fetching history:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /depeg/config
   * Get user's depeg strategy configuration
   */
  router.get('/config', async (req, res) => {
    try {
      const userId = req.user!.userId;

      const config = await depegService.getConfig(userId);

      res.json({
        success: true,
        config,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error fetching config:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PUT /depeg/config
   * Update user's depeg strategy configuration
   */
  router.put('/config', async (req, res) => {
    try {
      const userId = req.user!.userId;

      // Extract allowed configuration fields
      const configUpdate: any = {};
      const allowedFields = [
        'enabled',
        'autoExecute',
        'minDepegThreshold',
        'maxDepegThreshold',
        'maxAllocationPercent',
        'maxPositionSize',
        'minProfitTarget',
        'stopLossPercent',
        'slippageTolerance',
        'feeTierPercent',
        'enabledPairs',
        'riskLevel',
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          configUpdate[field] = req.body[field];
        }
      });

      // Update configuration
      await depegService.updateConfig(userId, configUpdate);

      // Get updated config
      const config = await depegService.getConfig(userId);

      res.json({
        success: true,
        config,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error updating config:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /depeg/monitor
   * Manually trigger monitoring and auto-execution (if enabled)
   */
  router.post('/monitor', async (req, res) => {
    try {
      const userId = req.user!.userId;

      // Get Kraken credentials from headers
      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      if (!apiKey || !apiSecret) {
        return res.status(401).json({
          success: false,
          error: 'Kraken API credentials required',
        });
      }

      // Get user configuration
      const config = await depegService.getConfig(userId);

      if (!config.enabled) {
        return res.json({
          success: true,
          message: 'Monitoring is disabled',
          executed: 0,
        });
      }

      // Get current prices
      const prices = await depegService.getStablecoinPrices(config.enabledPairs);

      // Detect opportunities
      const opportunities = await depegService.detectOpportunities(prices, config);

      // If auto-execute is enabled, execute the best opportunity
      let executed = 0;
      const results = [];

      if (config.autoExecute && opportunities.length > 0) {
        // Sort by estimated profit and execute the best one
        const sortedOpps = opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);

        // Execute top opportunity
        try {
          const position = await depegService.executeTrade(
            userId,
            sortedOpps[0],
            config,
            apiKey,
            apiSecret
          );
          executed++;
          results.push({
            pair: sortedOpps[0].pair,
            type: sortedOpps[0].type,
            price: sortedOpps[0].entryPrice,
            success: true,
            positionId: position.id,
          });
        } catch (error: any) {
          results.push({
            pair: sortedOpps[0].pair,
            type: sortedOpps[0].type,
            price: sortedOpps[0].entryPrice,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        opportunitiesDetected: opportunities.length,
        executed,
        results,
        prices,
        opportunities,
      });
    } catch (error: any) {
      console.error('[Depeg API] Error in monitor:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
