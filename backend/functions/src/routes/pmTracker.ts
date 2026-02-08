/**
 * Polymarket Wallet Tracker Routes
 *
 * Endpoints for:
 * - Leaderboard: top wallets with stats
 * - Wallet details: positions and trades
 * - User tracking: track/untrack wallets, portfolio view
 */

import { Router, Request, Response } from 'express';
import { Firestore } from 'firebase-admin/firestore';
import { PmWalletTrackerService } from '../services/pmWalletTrackerService.js';

export function createPmTrackerRouter(db: Firestore): Router {
  const router = Router();
  const trackerService = new PmWalletTrackerService(db);

  /**
   * Helper to get user ID from authenticated request
   */
  const getUserId = (req: Request): string => {
    return (req as any).user?.uid || (req as any).user?.userId || 'default';
  };

  // ============================================
  // LEADERBOARD ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/tracker/top-wallets
   * Get cached leaderboard of top wallets
   */
  router.get('/top-wallets', async (req: Request, res: Response) => {
    try {
      const {
        sortBy = 'pnl7d',
        limit = '50',
        offset = '0',
      } = req.query;

      const wallets = await trackerService.getTopWallets({
        sortBy: sortBy as any,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      // Get last sync time
      const cacheDoc = await db.collection('pm_wallets_top').limit(1).get();
      const lastSyncedAt = cacheDoc.empty
        ? null
        : cacheDoc.docs[0].data()?.syncedAt?.toDate();

      res.json({
        success: true,
        wallets,
        total: wallets.length,
        lastSyncedAt: lastSyncedAt?.toISOString() || null,
      });
    } catch (error: any) {
      console.error('[PmTracker] Error fetching top wallets:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /polymarket/tracker/sync/top-wallets
   * Manually trigger leaderboard sync (admin/scheduled use)
   */
  router.post('/sync/top-wallets', async (req: Request, res: Response) => {
    try {
      console.log('[PmTracker] Manual top wallets sync triggered');
      const result = await trackerService.syncTopWallets();

      res.json({
        success: result.success,
        walletsUpdated: result.walletsUpdated,
        syncedAt: result.syncedAt.toISOString(),
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('[PmTracker] Error syncing top wallets:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // WALLET DETAILS ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/tracker/wallet/:address
   * Get wallet details including positions and recent trades
   */
  router.get('/wallet/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const {
        includePositions = 'true',
        includeTrades = 'true',
        tradeLimit = '20',
      } = req.query;

      if (!address) {
        return res.status(400).json({ success: false, error: 'Address is required' });
      }

      const details = await trackerService.getWalletDetails(address);

      // Filter based on query params
      const response: any = {
        success: true,
        wallet: {
          address: details.address,
          stats: details.stats,
        },
      };

      if (includePositions === 'true') {
        response.wallet.positions = details.positions;
      }

      if (includeTrades === 'true') {
        response.wallet.recentTrades = details.recentTrades.slice(0, parseInt(tradeLimit as string));
      }

      res.json(response);
    } catch (error: any) {
      console.error('[PmTracker] Error fetching wallet details:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /polymarket/tracker/sync/wallet/:address
   * Sync latest data for a specific wallet
   */
  router.post('/sync/wallet/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      if (!address) {
        return res.status(400).json({ success: false, error: 'Address is required' });
      }

      console.log(`[PmTracker] Syncing wallet ${address}`);

      const stats = await trackerService.calculateWalletStats(address);

      res.json({
        success: true,
        wallet: {
          address: address.toLowerCase(),
          stats,
        },
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[PmTracker] Error syncing wallet:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // USER TRACKING ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/tracker/portfolio
   * Get user's tracked wallets portfolio
   */
  router.get('/portfolio', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const portfolio = await trackerService.getTrackedPortfolio(userId);

      res.json({
        success: true,
        portfolio,
      });
    } catch (error: any) {
      console.error('[PmTracker] Error fetching portfolio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /polymarket/tracker/track
   * Track a wallet
   */
  router.post('/track', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { walletAddress, allocationUsd, nickname } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ success: false, error: 'walletAddress is required' });
      }

      if (typeof allocationUsd !== 'number' || allocationUsd < 0) {
        return res.status(400).json({ success: false, error: 'allocationUsd must be a positive number' });
      }

      // Validate allocation cap (e.g., max $1M per wallet)
      const MAX_ALLOCATION = 1000000;
      if (allocationUsd > MAX_ALLOCATION) {
        return res.status(400).json({
          success: false,
          error: `allocationUsd cannot exceed $${MAX_ALLOCATION.toLocaleString()}`,
        });
      }

      console.log(`[PmTracker] User ${userId} tracking wallet ${walletAddress} with $${allocationUsd}`);

      const trackedWallet = await trackerService.trackWallet(
        userId,
        walletAddress,
        allocationUsd,
        nickname
      );

      res.json({
        success: true,
        trackedWallet,
      });
    } catch (error: any) {
      console.error('[PmTracker] Error tracking wallet:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /polymarket/tracker/track/:address
   * Update tracking allocation or nickname
   */
  router.put('/track/:address', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { address } = req.params;
      const { allocationUsd, nickname } = req.body;

      if (!address) {
        return res.status(400).json({ success: false, error: 'Address is required' });
      }

      const updates: { allocationUsd?: number; nickname?: string } = {};

      if (allocationUsd !== undefined) {
        if (typeof allocationUsd !== 'number' || allocationUsd < 0) {
          return res.status(400).json({ success: false, error: 'allocationUsd must be a positive number' });
        }
        updates.allocationUsd = allocationUsd;
      }

      if (nickname !== undefined) {
        updates.nickname = nickname;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No updates provided' });
      }

      console.log(`[PmTracker] User ${userId} updating tracking for ${address}:`, updates);

      await trackerService.updateTracking(userId, address, updates);

      res.json({
        success: true,
        message: 'Tracking updated successfully',
      });
    } catch (error: any) {
      console.error('[PmTracker] Error updating tracking:', error);
      if (error.message === 'Wallet not tracked') {
        return res.status(404).json({ success: false, error: 'Wallet is not being tracked' });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /polymarket/tracker/track/:address
   * Untrack a wallet
   */
  router.delete('/track/:address', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { address } = req.params;

      if (!address) {
        return res.status(400).json({ success: false, error: 'Address is required' });
      }

      console.log(`[PmTracker] User ${userId} untracking wallet ${address}`);

      await trackerService.untrackWallet(userId, address);

      res.json({
        success: true,
        message: 'Wallet untracked successfully',
      });
    } catch (error: any) {
      console.error('[PmTracker] Error untracking wallet:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /polymarket/tracker/sync/portfolio
   * Manually sync user's tracked wallets
   */
  router.post('/sync/portfolio', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      console.log(`[PmTracker] Syncing portfolio for user ${userId}`);

      const result = await trackerService.syncTrackedWalletsForUser(userId);

      res.json({
        success: result.success,
        walletsUpdated: result.walletsUpdated,
        syncedAt: result.syncedAt.toISOString(),
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('[PmTracker] Error syncing portfolio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
