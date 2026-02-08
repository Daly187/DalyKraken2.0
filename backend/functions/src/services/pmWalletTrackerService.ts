/**
 * Polymarket Wallet Tracker Service
 *
 * Provides functionality to:
 * - Scrape/fetch top wallet leaderboard from Polymarket
 * - Fetch wallet positions and trades for any address
 * - Calculate wallet statistics (PnL, ROI, win rate)
 * - Manage user tracked wallets and portfolio calculations
 */

import axios from 'axios';
import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

// Polymarket API endpoints
const DATA_API_URL = 'https://data-api.polymarket.com';
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

// Types
export interface TopWallet {
  address: string;
  displayName?: string;
  pnl7d: number;
  pnl30d: number;
  roi7d: number;
  roi30d: number;
  winRate7d: number;
  winRate30d: number;
  volume7d: number;
  volume30d: number;
  openPositions: number;
  lastActiveAt: Date | null;
  syncedAt: Date;
  rank7d: number;
  rank30d: number;
}

export interface WalletPosition {
  marketId: string;
  conditionId: string;
  tokenId: string;
  question: string;
  outcome: string;
  side: 'YES' | 'NO';
  size: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  value: number;
}

export interface WalletTrade {
  id: string;
  timestamp: Date;
  marketId: string;
  question: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  fee: number;
  realizedPnl?: number;
}

export interface WalletStats {
  pnl7d: number;
  pnl30d: number;
  roi7d: number;
  roi30d: number;
  winRate7d: number;
  winRate30d: number;
  volume7d: number;
  volume30d: number;
  tradesCount7d: number;
  tradesCount30d: number;
  openPositionsCount: number;
  totalExposure: number;
  lastActiveAt: Date | null;
}

export interface TrackedWallet {
  address: string;
  nickname?: string;
  allocationUsd: number;
  weight: number;
  isActive: boolean;
  trackedAt: Date;
  cachedPnl7d: number;
  cachedRoi7d: number;
  cachedWinRate: number;
  cachedPositionsCount: number;
  cachedLastActiveAt: Date | null;
  currentValue: number;
  pnlContribution: number;
  lastSyncedAt: Date;
}

export interface TrackedPortfolio {
  totalAllocation: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  weightedWinRate: number;
  trackedWallets: TrackedWallet[];
}

export interface SyncResult {
  success: boolean;
  walletsUpdated: number;
  syncedAt: Date;
  errors?: string[];
}

export class PmWalletTrackerService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Scrape the Polymarket leaderboard
   * Note: Polymarket's leaderboard is client-rendered, so we use their internal API
   */
  async scrapeLeaderboard(): Promise<TopWallet[]> {
    try {
      console.log('[PmWalletTracker] Scraping leaderboard...');

      // Try to fetch from Polymarket's leaderboard API endpoint
      // The actual endpoint needs to be discovered by inspecting network requests
      // For now, we'll try common patterns
      const endpoints = [
        'https://polymarket.com/api/leaderboard',
        'https://gamma-api.polymarket.com/leaderboard',
        'https://data-api.polymarket.com/leaderboard',
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(endpoint, {
            timeout: 15000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; DalyKraken/2.0)',
            },
          });

          if (response.data && Array.isArray(response.data)) {
            console.log(`[PmWalletTracker] Found leaderboard at ${endpoint}`);
            return this.parseLeaderboardResponse(response.data);
          }
        } catch (err: any) {
          console.log(`[PmWalletTracker] Endpoint ${endpoint} failed: ${err.message}`);
        }
      }

      // Fallback: Try to scrape from the gamma-api profiles endpoint
      // Get top traders by volume
      console.log('[PmWalletTracker] Trying gamma API profiles...');
      const profilesResponse = await axios.get(`${GAMMA_API_URL}/profiles`, {
        params: {
          limit: 100,
          order: 'volume',
        },
        timeout: 15000,
      });

      if (profilesResponse.data && Array.isArray(profilesResponse.data)) {
        return this.parseGammaProfiles(profilesResponse.data);
      }

      console.log('[PmWalletTracker] Could not find leaderboard data');
      return [];
    } catch (error: any) {
      console.error('[PmWalletTracker] Error scraping leaderboard:', error.message);
      return [];
    }
  }

  /**
   * Parse leaderboard API response
   */
  private parseLeaderboardResponse(data: any[]): TopWallet[] {
    return data.map((item, index) => ({
      address: (item.address || item.user || item.wallet || '').toLowerCase(),
      displayName: item.name || item.displayName || item.ens || null,
      pnl7d: parseFloat(item.pnl7d || item.pnl_7d || item.weeklyPnl || 0),
      pnl30d: parseFloat(item.pnl30d || item.pnl_30d || item.monthlyPnl || 0),
      roi7d: parseFloat(item.roi7d || item.roi_7d || item.weeklyRoi || 0),
      roi30d: parseFloat(item.roi30d || item.roi_30d || item.monthlyRoi || 0),
      winRate7d: parseFloat(item.winRate7d || item.win_rate_7d || item.weeklyWinRate || 0),
      winRate30d: parseFloat(item.winRate30d || item.win_rate_30d || item.monthlyWinRate || 0),
      volume7d: parseFloat(item.volume7d || item.volume_7d || item.weeklyVolume || 0),
      volume30d: parseFloat(item.volume30d || item.volume_30d || item.monthlyVolume || 0),
      openPositions: parseInt(item.openPositions || item.positions_count || 0),
      lastActiveAt: item.lastActive ? new Date(item.lastActive) : null,
      syncedAt: new Date(),
      rank7d: index + 1,
      rank30d: index + 1,
    })).filter(w => w.address);
  }

  /**
   * Parse Gamma API profiles response
   */
  private parseGammaProfiles(data: any[]): TopWallet[] {
    return data.map((item, index) => ({
      address: (item.proxyWallet || item.address || '').toLowerCase(),
      displayName: item.name || item.ens || null,
      pnl7d: parseFloat(item.pnl || 0) * 0.25, // Estimate 7d as 25% of total
      pnl30d: parseFloat(item.pnl || 0),
      roi7d: parseFloat(item.roi || 0) * 0.25,
      roi30d: parseFloat(item.roi || 0),
      winRate7d: parseFloat(item.winRate || 0.5),
      winRate30d: parseFloat(item.winRate || 0.5),
      volume7d: parseFloat(item.volume || 0) * 0.25,
      volume30d: parseFloat(item.volume || 0),
      openPositions: parseInt(item.positionsCount || 0),
      lastActiveAt: item.lastTradeTimestamp ? new Date(item.lastTradeTimestamp) : null,
      syncedAt: new Date(),
      rank7d: index + 1,
      rank30d: index + 1,
    })).filter(w => w.address);
  }

  /**
   * Sync top wallets to Firestore
   */
  async syncTopWallets(): Promise<SyncResult> {
    const errors: string[] = [];
    let walletsUpdated = 0;

    try {
      console.log('[PmWalletTracker] Starting top wallets sync...');

      // Scrape leaderboard
      const wallets = await this.scrapeLeaderboard();

      if (wallets.length === 0) {
        console.log('[PmWalletTracker] No wallets found from leaderboard, trying to enrich existing...');
        // Try to enrich existing tracked wallets with fresh stats
        const existingWallets = await this.getTopWallets({ limit: 50 });
        for (const wallet of existingWallets) {
          try {
            const stats = await this.calculateWalletStats(wallet.address);
            await this.updateWalletInCache(wallet.address, stats);
            walletsUpdated++;
          } catch (err: any) {
            errors.push(`Failed to update ${wallet.address}: ${err.message}`);
          }
        }
      } else {
        // Update cache with scraped data
        const batch = this.db.batch();
        const collectionRef = this.db.collection('pm_wallets_top');

        for (const wallet of wallets) {
          const docRef = collectionRef.doc(wallet.address.toLowerCase());
          batch.set(docRef, {
            ...wallet,
            lastActiveAt: wallet.lastActiveAt ? Timestamp.fromDate(wallet.lastActiveAt) : null,
            syncedAt: Timestamp.now(),
          }, { merge: true });
          walletsUpdated++;
        }

        await batch.commit();
        console.log(`[PmWalletTracker] Synced ${walletsUpdated} wallets to cache`);
      }

      return {
        success: true,
        walletsUpdated,
        syncedAt: new Date(),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('[PmWalletTracker] Error syncing top wallets:', error.message);
      return {
        success: false,
        walletsUpdated,
        syncedAt: new Date(),
        errors: [error.message],
      };
    }
  }

  /**
   * Update a wallet in the cache
   */
  private async updateWalletInCache(address: string, stats: WalletStats): Promise<void> {
    const docRef = this.db.collection('pm_wallets_top').doc(address.toLowerCase());
    await docRef.set({
      address: address.toLowerCase(),
      pnl7d: stats.pnl7d,
      pnl30d: stats.pnl30d,
      roi7d: stats.roi7d,
      roi30d: stats.roi30d,
      winRate7d: stats.winRate7d,
      winRate30d: stats.winRate30d,
      volume7d: stats.volume7d,
      volume30d: stats.volume30d,
      openPositions: stats.openPositionsCount,
      lastActiveAt: stats.lastActiveAt ? Timestamp.fromDate(stats.lastActiveAt) : null,
      syncedAt: Timestamp.now(),
    }, { merge: true });
  }

  /**
   * Get top wallets from cache
   */
  async getTopWallets(options: {
    sortBy?: 'pnl7d' | 'pnl30d' | 'roi7d' | 'roi30d' | 'volume30d' | 'winRate7d';
    limit?: number;
    offset?: number;
  } = {}): Promise<TopWallet[]> {
    const { sortBy = 'pnl7d', limit = 50, offset = 0 } = options;

    try {
      const collectionRef = this.db.collection('pm_wallets_top');
      let query = collectionRef.orderBy(sortBy, 'desc');

      if (offset > 0) {
        const startAfterDoc = await collectionRef
          .orderBy(sortBy, 'desc')
          .limit(offset)
          .get();

        if (!startAfterDoc.empty) {
          const lastDoc = startAfterDoc.docs[startAfterDoc.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      const snapshot = await query.limit(limit).get();

      return snapshot.docs.map((doc, index) => {
        const data = doc.data();
        return {
          address: data.address,
          displayName: data.displayName || null,
          pnl7d: data.pnl7d || 0,
          pnl30d: data.pnl30d || 0,
          roi7d: data.roi7d || 0,
          roi30d: data.roi30d || 0,
          winRate7d: data.winRate7d || 0,
          winRate30d: data.winRate30d || 0,
          volume7d: data.volume7d || 0,
          volume30d: data.volume30d || 0,
          openPositions: data.openPositions || 0,
          lastActiveAt: data.lastActiveAt?.toDate() || null,
          syncedAt: data.syncedAt?.toDate() || new Date(),
          rank7d: offset + index + 1,
          rank30d: data.rank30d || offset + index + 1,
        };
      });
    } catch (error: any) {
      console.error('[PmWalletTracker] Error fetching top wallets:', error.message);
      return [];
    }
  }

  /**
   * Get wallet positions from Polymarket Data API
   */
  async getWalletPositions(address: string): Promise<WalletPosition[]> {
    try {
      console.log(`[PmWalletTracker] Fetching positions for ${address}`);

      const response = await axios.get(`${DATA_API_URL}/positions`, {
        params: {
          user: address.toLowerCase(),
          limit: 500,
        },
        timeout: 15000,
      });

      const positions = response.data || [];

      // Enrich with market data
      const enrichedPositions: WalletPosition[] = [];

      for (const pos of positions) {
        const size = parseFloat(pos.size || '0');
        if (size <= 0) continue;

        const avgPrice = parseFloat(pos.avgPrice || pos.avg_price || '0');
        const currentPrice = parseFloat(pos.currentPrice || pos.price || avgPrice);

        enrichedPositions.push({
          marketId: pos.marketId || pos.market || pos.conditionId || '',
          conditionId: pos.conditionId || pos.condition_id || '',
          tokenId: pos.tokenId || pos.token_id || '',
          question: pos.title || pos.question || pos.marketSlug || 'Unknown Market',
          outcome: pos.outcome || (pos.outcomeIndex === 0 ? 'YES' : 'NO'),
          side: pos.outcomeIndex === 0 || pos.outcome === 'Yes' ? 'YES' : 'NO',
          size,
          avgPrice,
          currentPrice,
          unrealizedPnl: size * (currentPrice - avgPrice),
          value: size * currentPrice,
        });
      }

      return enrichedPositions;
    } catch (error: any) {
      console.error(`[PmWalletTracker] Error fetching positions for ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Get wallet trade history from Polymarket Data API
   */
  async getWalletTrades(address: string, limit: number = 50): Promise<WalletTrade[]> {
    try {
      console.log(`[PmWalletTracker] Fetching trades for ${address}`);

      const response = await axios.get(`${DATA_API_URL}/activity`, {
        params: {
          user: address.toLowerCase(),
          limit,
        },
        timeout: 15000,
      });

      const activities = response.data || [];

      return activities
        .filter((a: any) => a.type === 'TRADE' || a.action === 'BUY' || a.action === 'SELL')
        .map((trade: any) => ({
          id: trade.id || trade.transactionHash || `${trade.timestamp}-${trade.tokenId}`,
          timestamp: new Date(trade.timestamp || trade.created_at || Date.now()),
          marketId: trade.marketId || trade.conditionId || '',
          question: trade.title || trade.question || trade.marketSlug || 'Unknown Market',
          outcome: trade.outcome || '',
          side: (trade.side || trade.action || 'BUY').toUpperCase() as 'BUY' | 'SELL',
          size: parseFloat(trade.size || trade.amount || '0'),
          price: parseFloat(trade.price || '0'),
          fee: parseFloat(trade.fee || trade.feeAmount || '0'),
          realizedPnl: trade.realizedPnl ? parseFloat(trade.realizedPnl) : undefined,
        }));
    } catch (error: any) {
      console.error(`[PmWalletTracker] Error fetching trades for ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Calculate wallet statistics from positions and trades
   */
  async calculateWalletStats(address: string): Promise<WalletStats> {
    try {
      const [positions, trades] = await Promise.all([
        this.getWalletPositions(address),
        this.getWalletTrades(address, 100),
      ]);

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Filter trades by timeframe
      const trades7d = trades.filter(t => t.timestamp >= sevenDaysAgo);
      const trades30d = trades.filter(t => t.timestamp >= thirtyDaysAgo);

      // Calculate PnL from trades (realized)
      const pnl7d = trades7d.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
      const pnl30d = trades30d.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);

      // Calculate volume
      const volume7d = trades7d.reduce((sum, t) => sum + (t.size * t.price), 0);
      const volume30d = trades30d.reduce((sum, t) => sum + (t.size * t.price), 0);

      // Calculate win rate (trades with positive PnL / total trades with PnL data)
      const tradesWithPnl7d = trades7d.filter(t => t.realizedPnl !== undefined);
      const wins7d = tradesWithPnl7d.filter(t => (t.realizedPnl || 0) > 0).length;
      const winRate7d = tradesWithPnl7d.length > 0 ? wins7d / tradesWithPnl7d.length : 0.5;

      const tradesWithPnl30d = trades30d.filter(t => t.realizedPnl !== undefined);
      const wins30d = tradesWithPnl30d.filter(t => (t.realizedPnl || 0) > 0).length;
      const winRate30d = tradesWithPnl30d.length > 0 ? wins30d / tradesWithPnl30d.length : 0.5;

      // Calculate ROI (PnL / volume)
      const roi7d = volume7d > 0 ? pnl7d / volume7d : 0;
      const roi30d = volume30d > 0 ? pnl30d / volume30d : 0;

      // Position stats
      const totalExposure = positions.reduce((sum, p) => sum + p.value, 0);
      const lastActiveAt = trades.length > 0 ? trades[0].timestamp : null;

      return {
        pnl7d,
        pnl30d,
        roi7d,
        roi30d,
        winRate7d,
        winRate30d,
        volume7d,
        volume30d,
        tradesCount7d: trades7d.length,
        tradesCount30d: trades30d.length,
        openPositionsCount: positions.length,
        totalExposure,
        lastActiveAt,
      };
    } catch (error: any) {
      console.error(`[PmWalletTracker] Error calculating stats for ${address}:`, error.message);
      return {
        pnl7d: 0,
        pnl30d: 0,
        roi7d: 0,
        roi30d: 0,
        winRate7d: 0.5,
        winRate30d: 0.5,
        volume7d: 0,
        volume30d: 0,
        tradesCount7d: 0,
        tradesCount30d: 0,
        openPositionsCount: 0,
        totalExposure: 0,
        lastActiveAt: null,
      };
    }
  }

  /**
   * Get wallet details with positions and trades
   */
  async getWalletDetails(address: string): Promise<{
    address: string;
    stats: WalletStats;
    positions: WalletPosition[];
    recentTrades: WalletTrade[];
  }> {
    const [stats, positions, recentTrades] = await Promise.all([
      this.calculateWalletStats(address),
      this.getWalletPositions(address),
      this.getWalletTrades(address, 20),
    ]);

    return {
      address: address.toLowerCase(),
      stats,
      positions,
      recentTrades,
    };
  }

  /**
   * Track a wallet for a user
   */
  async trackWallet(
    userId: string,
    address: string,
    allocationUsd: number,
    nickname?: string
  ): Promise<TrackedWallet> {
    const normalizedAddress = address.toLowerCase();

    // Get wallet stats
    const stats = await this.calculateWalletStats(normalizedAddress);

    // Calculate initial values
    const currentValue = allocationUsd * (1 + stats.roi30d);
    const pnlContribution = currentValue - allocationUsd;

    const trackedWallet: any = {
      address: normalizedAddress,
      nickname: nickname || null,
      allocationUsd,
      weight: 0, // Will be recalculated
      isActive: true,
      trackedAt: Timestamp.now(),
      cachedPnl7d: stats.pnl7d,
      cachedRoi7d: stats.roi7d,
      cachedWinRate: stats.winRate7d,
      cachedPositionsCount: stats.openPositionsCount,
      cachedLastActiveAt: stats.lastActiveAt ? Timestamp.fromDate(stats.lastActiveAt) : null,
      currentValue,
      pnlContribution,
      lastSyncedAt: Timestamp.now(),
    };

    // Save to user's tracked wallets
    const docRef = this.db
      .collection('users')
      .doc(userId)
      .collection('pm_tracked_wallets')
      .doc(normalizedAddress);

    await docRef.set(trackedWallet);

    // Also add/update in global cache
    await this.updateWalletInCache(normalizedAddress, stats);

    // Recalculate weights
    await this.recalculatePortfolioWeights(userId);

    return {
      address: normalizedAddress,
      nickname: nickname || undefined,
      allocationUsd,
      weight: 0, // Will be returned by portfolio call
      isActive: true,
      trackedAt: new Date(),
      cachedPnl7d: stats.pnl7d,
      cachedRoi7d: stats.roi7d,
      cachedWinRate: stats.winRate7d,
      cachedPositionsCount: stats.openPositionsCount,
      cachedLastActiveAt: stats.lastActiveAt,
      currentValue,
      pnlContribution,
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Update tracking allocation
   */
  async updateTracking(
    userId: string,
    address: string,
    updates: { allocationUsd?: number; nickname?: string }
  ): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    const docRef = this.db
      .collection('users')
      .doc(userId)
      .collection('pm_tracked_wallets')
      .doc(normalizedAddress);

    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Wallet not tracked');
    }

    const data = doc.data()!;
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    if (updates.allocationUsd !== undefined) {
      updateData.allocationUsd = updates.allocationUsd;
      // Recalculate current value
      const roi = data.cachedRoi7d || 0;
      updateData.currentValue = updates.allocationUsd * (1 + roi);
      updateData.pnlContribution = updateData.currentValue - updates.allocationUsd;
    }

    if (updates.nickname !== undefined) {
      updateData.nickname = updates.nickname || null;
    }

    await docRef.update(updateData);

    if (updates.allocationUsd !== undefined) {
      await this.recalculatePortfolioWeights(userId);
    }
  }

  /**
   * Untrack a wallet
   */
  async untrackWallet(userId: string, address: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    const docRef = this.db
      .collection('users')
      .doc(userId)
      .collection('pm_tracked_wallets')
      .doc(normalizedAddress);

    await docRef.delete();
    await this.recalculatePortfolioWeights(userId);
  }

  /**
   * Recalculate portfolio weights for a user
   */
  private async recalculatePortfolioWeights(userId: string): Promise<void> {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('pm_tracked_wallets')
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) return;

    const totalAllocation = snapshot.docs.reduce(
      (sum, doc) => sum + (doc.data().allocationUsd || 0),
      0
    );

    const batch = this.db.batch();
    for (const doc of snapshot.docs) {
      const allocation = doc.data().allocationUsd || 0;
      const weight = totalAllocation > 0 ? allocation / totalAllocation : 0;
      batch.update(doc.ref, { weight });
    }

    await batch.commit();
  }

  /**
   * Get user's tracked portfolio
   */
  async getTrackedPortfolio(userId: string): Promise<TrackedPortfolio> {
    try {
      // Simple query without orderBy to avoid index requirements
      const snapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('pm_tracked_wallets')
        .get();

      // Filter active and sort client-side
      const trackedWallets: TrackedWallet[] = snapshot.docs
        .filter(doc => doc.data().isActive !== false)
        .map(doc => {
      const data = doc.data();
      return {
        address: data.address,
        nickname: data.nickname || undefined,
        allocationUsd: data.allocationUsd || 0,
        weight: data.weight || 0,
        isActive: data.isActive || true,
        trackedAt: data.trackedAt?.toDate() || new Date(),
        cachedPnl7d: data.cachedPnl7d || 0,
        cachedRoi7d: data.cachedRoi7d || 0,
        cachedWinRate: data.cachedWinRate || 0.5,
        cachedPositionsCount: data.cachedPositionsCount || 0,
        cachedLastActiveAt: data.cachedLastActiveAt?.toDate() || null,
        currentValue: data.currentValue || data.allocationUsd || 0,
        pnlContribution: data.pnlContribution || 0,
        lastSyncedAt: data.lastSyncedAt?.toDate() || new Date(),
      };
    });

    const totalAllocation = trackedWallets.reduce((sum, w) => sum + w.allocationUsd, 0);
    const currentValue = trackedWallets.reduce((sum, w) => sum + w.currentValue, 0);
    const totalPnl = currentValue - totalAllocation;
    const totalPnlPercent = totalAllocation > 0 ? totalPnl / totalAllocation : 0;

    // Sort by allocation descending (client-side)
    trackedWallets.sort((a, b) => b.allocationUsd - a.allocationUsd);

    // Weighted win rate
    const weightedWinRate = trackedWallets.reduce(
      (sum, w) => sum + w.cachedWinRate * w.weight,
      0
    );

    return {
      totalAllocation,
      currentValue,
      totalPnl,
      totalPnlPercent,
      weightedWinRate,
      trackedWallets,
    };
    } catch (error: any) {
      console.error(`[PmWalletTracker] Error getting portfolio for ${userId}:`, error.message);
      // Return empty portfolio on error
      return {
        totalAllocation: 0,
        currentValue: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        weightedWinRate: 0.5,
        trackedWallets: [],
      };
    }
  }

  /**
   * Sync tracked wallets for a user (refresh stats)
   */
  async syncTrackedWalletsForUser(userId: string): Promise<SyncResult> {
    const errors: string[] = [];
    let walletsUpdated = 0;

    try {
      const snapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('pm_tracked_wallets')
        .where('isActive', '==', true)
        .get();

      for (const doc of snapshot.docs) {
        const address = doc.data().address;
        try {
          const stats = await this.calculateWalletStats(address);
          const allocationUsd = doc.data().allocationUsd || 0;
          const currentValue = allocationUsd * (1 + stats.roi30d);
          const pnlContribution = currentValue - allocationUsd;

          await doc.ref.update({
            cachedPnl7d: stats.pnl7d,
            cachedRoi7d: stats.roi7d,
            cachedWinRate: stats.winRate7d,
            cachedPositionsCount: stats.openPositionsCount,
            cachedLastActiveAt: stats.lastActiveAt ? Timestamp.fromDate(stats.lastActiveAt) : null,
            currentValue,
            pnlContribution,
            lastSyncedAt: Timestamp.now(),
          });

          walletsUpdated++;
        } catch (err: any) {
          errors.push(`Failed to sync ${address}: ${err.message}`);
        }
      }

      return {
        success: true,
        walletsUpdated,
        syncedAt: new Date(),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error(`[PmWalletTracker] Error syncing tracked wallets for ${userId}:`, error.message);
      return {
        success: false,
        walletsUpdated,
        syncedAt: new Date(),
        errors: [error.message],
      };
    }
  }

  /**
   * Sync all tracked wallets across all users
   */
  async syncAllTrackedWallets(): Promise<SyncResult> {
    const errors: string[] = [];
    let walletsUpdated = 0;

    try {
      // Get all unique tracked wallet addresses
      const uniqueAddresses = new Set<string>();
      const usersSnapshot = await this.db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const trackedSnapshot = await userDoc.ref
          .collection('pm_tracked_wallets')
          .where('isActive', '==', true)
          .get();

        for (const doc of trackedSnapshot.docs) {
          uniqueAddresses.add(doc.data().address);
        }
      }

      console.log(`[PmWalletTracker] Syncing ${uniqueAddresses.size} unique tracked wallets`);

      // Sync each unique wallet once
      const statsMap = new Map<string, WalletStats>();
      for (const address of uniqueAddresses) {
        try {
          const stats = await this.calculateWalletStats(address);
          statsMap.set(address, stats);
          await this.updateWalletInCache(address, stats);
          walletsUpdated++;
        } catch (err: any) {
          errors.push(`Failed to sync ${address}: ${err.message}`);
        }
      }

      // Update all user tracking records with cached stats
      for (const userDoc of usersSnapshot.docs) {
        const trackedSnapshot = await userDoc.ref
          .collection('pm_tracked_wallets')
          .where('isActive', '==', true)
          .get();

        const batch = this.db.batch();
        for (const doc of trackedSnapshot.docs) {
          const address = doc.data().address;
          const stats = statsMap.get(address);
          if (stats) {
            const allocationUsd = doc.data().allocationUsd || 0;
            const currentValue = allocationUsd * (1 + stats.roi30d);
            const pnlContribution = currentValue - allocationUsd;

            batch.update(doc.ref, {
              cachedPnl7d: stats.pnl7d,
              cachedRoi7d: stats.roi7d,
              cachedWinRate: stats.winRate7d,
              cachedPositionsCount: stats.openPositionsCount,
              cachedLastActiveAt: stats.lastActiveAt ? Timestamp.fromDate(stats.lastActiveAt) : null,
              currentValue,
              pnlContribution,
              lastSyncedAt: Timestamp.now(),
            });
          }
        }
        await batch.commit();
      }

      return {
        success: true,
        walletsUpdated,
        syncedAt: new Date(),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('[PmWalletTracker] Error syncing all tracked wallets:', error.message);
      return {
        success: false,
        walletsUpdated,
        syncedAt: new Date(),
        errors: [error.message],
      };
    }
  }
}
