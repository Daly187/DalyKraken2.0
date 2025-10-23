/**
 * Tracker API Routes
 * RESTful endpoints for wallet tracking and copy trading
 */

import express, { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { walletTrackerService, WalletSignal } from '../services/walletTrackerService.js';
import { copyTradingService } from '../services/copyTradingService.js';
import { walletDiscoveryService } from '../services/walletDiscoveryService.js';

export function createTrackerRouter() {
  const router = express.Router();

  /**
   * GET /tracker/discover/search
   * Search for top wallets with filters
   */
  router.get('/discover/search', async (req: Request, res: Response) => {
    try {
      const { chain, minPnL, minWinRate, minTrades, minActiveForDays, labels } = req.query;

      const filters: any = {};

      if (chain) {
        filters.chain = Array.isArray(chain) ? chain : [chain];
      }

      if (minPnL) filters.minPnL = parseFloat(minPnL as string);
      if (minWinRate) filters.minWinRate = parseFloat(minWinRate as string);
      if (minTrades) filters.minTrades = parseInt(minTrades as string);
      if (minActiveForDays) filters.minActiveForDays = parseInt(minActiveForDays as string);

      if (labels) {
        filters.labels = Array.isArray(labels) ? labels : [labels];
      }

      const wallets = await walletDiscoveryService.searchWallets(filters);

      res.json({
        success: true,
        wallets,
        count: wallets.length
      });
    } catch (error: any) {
      console.error('[Tracker API] Error searching wallets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/discover/recommended
   * Get top recommended wallets
   */
  router.get('/discover/recommended', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const wallets = await walletDiscoveryService.getRecommendedWallets(limit);

      res.json({
        success: true,
        wallets,
        count: wallets.length
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching recommended wallets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/discover/preview/:address
   * Get wallet preview before tracking
   */
  router.get('/discover/preview/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      const wallet = await walletDiscoveryService.getWalletPreview(address);

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      res.json({
        success: true,
        wallet
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching wallet preview:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/discover/filters
   * Get available filter options
   */
  router.get('/discover/filters', async (req: Request, res: Response) => {
    try {
      const options = walletDiscoveryService.getFilterOptions();

      res.json({
        success: true,
        options
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching filter options:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/wallets
   * Get all tracked wallets with scores
   */
  router.get('/wallets', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const wallets = await walletTrackerService.getTrackedWallets(userId);

      res.json({
        success: true,
        wallets,
        count: wallets.length
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching wallets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/wallets/:address
   * Get detailed info for a specific wallet
   */
  router.get('/wallets/:walletId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const { walletId } = req.params;

      const wallet = await walletTrackerService.getWalletDetails(userId, walletId);

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      res.json({
        success: true,
        wallet
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching wallet details:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tracker/wallets
   * Add a new wallet to track
   */
  router.post('/wallets', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const { address, chain, nickname } = req.body;

      if (!address || !chain) {
        return res.status(400).json({
          success: false,
          error: 'Address and chain are required'
        });
      }

      const walletId = await walletTrackerService.addWallet(
        userId,
        address,
        chain,
        nickname
      );

      res.json({
        success: true,
        walletId,
        message: 'Wallet added successfully'
      });
    } catch (error: any) {
      console.error('[Tracker API] Error adding wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /tracker/wallets/:walletId
   * Remove (deactivate) a tracked wallet
   */
  router.delete('/wallets/:walletId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const { walletId } = req.params;

      await walletTrackerService.removeWallet(userId, walletId);

      res.json({
        success: true,
        message: 'Wallet removed successfully'
      });
    } catch (error: any) {
      console.error('[Tracker API] Error removing wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/signals
   * Get recent signals from tracked wallets
   */
  router.get('/signals', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 50;

      const signals = await walletTrackerService.getRecentSignals(userId, limit);

      res.json({
        success: true,
        signals,
        count: signals.length
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching signals:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tracker/signals
   * Manually record a signal (for testing or webhook)
   */
  router.post('/signals', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const {
        walletId,
        walletAddress,
        chain,
        type,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        price,
        txHash,
        protocol
      } = req.body;

      if (!walletId || !walletAddress || !type || !tokenIn || !tokenOut) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const signal: Omit<WalletSignal, 'id'> = {
        walletId,
        walletAddress,
        chain: chain || 'ethereum',
        timestamp: Timestamp.now(),
        type,
        tokenIn,
        tokenOut,
        amountIn: amountIn || 0,
        amountOut: amountOut || 0,
        price: price || 0,
        txHash: txHash || '',
        protocol: protocol || 'unknown',
        copyable: false,
        status: 'pending'
      };

      const signalId = await walletTrackerService.recordSignal(userId, signal);

      // Optionally auto-process the signal
      if (req.body.autoProcess) {
        const apiKey = req.headers['x-kraken-api-key'] as string;
        const apiSecret = req.headers['x-kraken-api-secret'] as string;

        const result = await copyTradingService.processSignal(
          userId,
          { ...signal, id: signalId },
          apiKey,
          apiSecret
        );

        return res.json({
          success: true,
          signalId,
          processed: true,
          result
        });
      }

      res.json({
        success: true,
        signalId,
        message: 'Signal recorded successfully'
      });
    } catch (error: any) {
      console.error('[Tracker API] Error recording signal:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tracker/signals/:signalId/process
   * Process a signal and potentially copy the trade
   */
  router.post('/signals/:signalId/process', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const { signalId } = req.params;

      // Fetch the signal
      const signals = await walletTrackerService.getRecentSignals(userId, 100);
      const signal = signals.find(s => s.id === signalId);

      if (!signal) {
        return res.status(404).json({
          success: false,
          error: 'Signal not found'
        });
      }

      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      const result = await copyTradingService.processSignal(
        userId,
        signal,
        apiKey,
        apiSecret
      );

      res.json({
        success: true,
        result
      });
    } catch (error: any) {
      console.error('[Tracker API] Error processing signal:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/positions
   * Get all open copy trade positions
   */
  router.get('/positions', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }

      const positions = await copyTradingService.getOpenPositions(userId);

      // Calculate total stats
      const totalInvested = positions.reduce((sum, p) => sum + p.investedAmount, 0);
      const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

      res.json({
        success: true,
        positions,
        stats: {
          count: positions.length,
          totalInvested,
          totalValue,
          totalPnL,
          totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
        }
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching positions:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tracker/positions/:positionId/close
   * Close a copy trade position
   */
  router.post('/positions/:positionId/close', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const { positionId } = req.params;

      const apiKey = req.headers['x-kraken-api-key'] as string;
      const apiSecret = req.headers['x-kraken-api-secret'] as string;

      const result = await copyTradingService.closePosition(
        userId,
        positionId,
        apiKey,
        apiSecret
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        result
      });
    } catch (error: any) {
      console.error('[Tracker API] Error closing position:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/history
   * Get trade history
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 50;

      const history = await copyTradingService.getTradeHistory(userId, limit);

      // Calculate stats
      const totalTrades = history.length;
      const winningTrades = history.filter(t => t.unrealizedPnL > 0).length;
      const totalPnL = history.reduce((sum, t) => sum + t.unrealizedPnL, 0);

      res.json({
        success: true,
        history,
        stats: {
          totalTrades,
          winningTrades,
          losingTrades: totalTrades - winningTrades,
          winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
          totalPnL
        }
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /tracker/config
   * Get tracker configuration
   */
  router.get('/config', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }

      const config = await walletTrackerService.getConfig(userId);

      res.json({
        success: true,
        config
      });
    } catch (error: any) {
      console.error('[Tracker API] Error fetching config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tracker/config
   * Update tracker configuration
   */
  router.post('/config', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }
      const config = req.body;

      await walletTrackerService.updateConfig(userId, config);

      res.json({
        success: true,
        message: 'Configuration updated successfully'
      });
    } catch (error: any) {
      console.error('[Tracker API] Error updating config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /tracker/monitor
   * Manually trigger monitoring (for testing)
   */
  router.post('/monitor', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID not found in request. Please log in again.'
        });
        return;
      }

      // This would typically be called by a scheduled function
      // For now, just return success
      res.json({
        success: true,
        message: 'Monitoring triggered (placeholder)'
      });
    } catch (error: any) {
      console.error('[Tracker API] Error triggering monitor:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
