/**
 * Polymarket Auto-Betting Routes
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db.js';
import { PolymarketService } from '../services/polymarketService.js';

export function createPolymarketRouter(): Router {
  const router = Router();

  /**
   * Helper to get Polymarket service with credentials from request
   * Now supports both L2 auth (API key/secret) and L1 auth (private key for signing)
   */
  const getPolymarketService = (req: Request): PolymarketService => {
    const apiKey = req.headers['x-polymarket-api-key'] as string;
    const apiSecret = req.headers['x-polymarket-api-secret'] as string;
    const passphrase = req.headers['x-polymarket-passphrase'] as string;
    const address = req.headers['x-polymarket-address'] as string;
    const privateKey = req.headers['x-polymarket-private-key'] as string;
    const funderAddress = req.headers['x-polymarket-funder-address'] as string;

    // Signature type: 0 = EOA (standard wallet), 1 = POLY_PROXY (Magic Link), 2 = GNOSIS_SAFE
    const signatureTypeStr = req.headers['x-polymarket-signature-type'] as string;
    const signatureType = signatureTypeStr ? parseInt(signatureTypeStr) : 0;

    return new PolymarketService(
      apiKey,
      apiSecret,
      passphrase,
      address,
      privateKey,
      funderAddress,
      signatureType
    );
  };

  /**
   * Helper to get user ID from request
   */
  const getUserId = (req: Request): string => {
    return (req as any).user?.uid || 'default';
  };

  // ============================================
  // MARKET DATA ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/markets
   * Get available markets with optional filters
   */
  router.get('/markets', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);
      const { active, closed, limit, category } = req.query;

      let markets = await polyService.getMarkets({
        active: active === 'true',
        closed: closed === 'true',
        limit: limit ? parseInt(limit as string) : 100,
      });

      // Filter by category if provided
      if (category) {
        markets = markets.filter(m => m.category === category);
      }

      res.json({
        success: true,
        data: markets,
        count: markets.length,
      });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching markets:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /polymarket/markets/:id
   * Get a specific market
   */
  router.get('/markets/:id', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);
      const market = await polyService.getMarket(req.params.id);

      res.json({ success: true, data: market });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching market:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // CONFIG ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/config
   * Get user's betting configuration
   */
  router.get('/config', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const configRef = db.collection('polymarketConfigs').doc(userId);
      const doc = await configRef.get();

      if (!doc.exists) {
        // Return default config - permissive defaults to show all available markets
        const defaultConfig = {
          enabled: false,
          scanIntervalMinutes: 60,
          timeframeHours: 0, // 0 = no time filter, show all active markets
          minProbability: 0.01, // Very low threshold to include most markets
          maxProbability: 0.99,
          contrarianMode: false,
          contrarianThreshold: 0.95,
          marketScopeLimit: 500, // Increased from 100
          minVolume: 0, // No volume filter by default
          minLiquidity: 0, // No liquidity filter by default
          categories: [],
          betSizeMode: 'fixed',
          fixedBetAmount: 10,
          percentageBetAmount: 2,
          maxBetPercent: 25,
          maxDailyBets: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        res.json({ success: true, config: defaultConfig });
      } else {
        res.json({ success: true, config: doc.data() });
      }
    } catch (error: any) {
      console.error('[Polymarket] Error fetching config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /polymarket/config
   * Update user's betting configuration
   */
  router.put('/config', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const configRef = db.collection('polymarketConfigs').doc(userId);

      const updates = {
        ...req.body,
        userId,
        updatedAt: new Date().toISOString(),
      };

      // Ensure createdAt is set on first save
      const doc = await configRef.get();
      if (!doc.exists) {
        updates.createdAt = new Date().toISOString();
      }

      await configRef.set(updates, { merge: true });

      res.json({ success: true, config: updates });
    } catch (error: any) {
      console.error('[Polymarket] Error updating config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // POSITION & BALANCE ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/balance
   * Get user's Polymarket balance
   */
  router.get('/balance', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);
      const balance = await polyService.getBalance();

      res.json({ success: true, balance });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching balance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /polymarket/portfolio
   * Get comprehensive portfolio summary including positions value, P/L, deposits, withdrawals
   */
  router.get('/portfolio', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);
      const portfolio = await polyService.getPortfolioSummary();

      res.json({
        success: true,
        portfolio,
      });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching portfolio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /polymarket/positions
   * Get user's open positions
   * Maps Data API response to frontend-expected format
   */
  router.get('/positions', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);
      const rawPositions = await polyService.getPositions();

      // Map Data API fields to frontend expected format
      // Data API returns: proxyWallet, conditionId, outcomeIndex, title, slug, icon,
      // endDate, curPrice, avgPrice, initialValue, currentValue, cashPnl, percentPnl, size, outcome
      const positions = rawPositions.map((pos: any) => ({
        id: pos.conditionId || pos.asset?.condition_id || Math.random().toString(36).substr(2, 9),
        marketId: pos.conditionId || pos.asset?.condition_id || '',
        marketQuestion: pos.title || pos.question || 'Unknown Market',
        outcomeId: pos.tokenId || pos.asset?.token_id || '',
        outcomeName: pos.outcome || 'Unknown',
        side: (pos.outcome || '').toLowerCase() === 'yes' || (pos.outcome || '').toLowerCase() === 'no'
          ? (pos.outcome || '').toLowerCase()
          : 'yes',
        shares: parseFloat(pos.size || '0'),
        avgPrice: parseFloat(pos.avgPrice || pos.avg_price || '0'),
        currentPrice: parseFloat(pos.curPrice || pos.current_price || '0'),
        cost: parseFloat(pos.initialValue || '0'),
        currentValue: parseFloat(pos.currentValue || '0'),
        unrealizedPnL: parseFloat(pos.cashPnl || pos.pnl || '0'),
        unrealizedPnLPercent: parseFloat(pos.percentPnl || '0') / 100, // Convert from percentage to decimal
        endDate: pos.endDate || pos.end_date_iso || new Date().toISOString(),
        status: 'open',
      }));

      console.log(`[Polymarket] Mapped ${positions.length} positions`);

      res.json({
        success: true,
        positions,
        count: positions.length,
      });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching positions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // BETTING ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/bets
   * Get user's bet history from Firestore
   */
  router.get('/bets', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const limitNum = parseInt(req.query.limit as string) || 50;
      const polyService = getPolymarketService(req);

      // Try with orderBy first, fall back to simple query if index doesn't exist
      let bets: any[] = [];
      try {
        const betsRef = db.collection('polymarketBets')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(limitNum);

        const snapshot = await betsRef.get();
        bets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (indexError: any) {
        // Index might not exist yet, try simple query
        console.log('[Polymarket] Index not ready, using simple query for bets');
        const betsRef = db.collection('polymarketBets')
          .where('userId', '==', userId)
          .limit(limitNum);

        const snapshot = await betsRef.get();
        bets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side
        bets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      // Fetch external trade history directly from Polymarket API (covers bets made outside this app)
      // Uses the /activity endpoint which includes market info
      let externalBets: any[] = [];
      try {
        const activities = await polyService.getTradeHistory(limitNum);
        console.log(`[Polymarket] Got ${activities.length} activities from Polymarket`);

        externalBets = activities.map((activity: any) => {
          // Activity endpoint returns: title, slug, conditionId, outcomeIndex, outcome,
          // side (buy/sell), size, price, usdcSize, timestamp, transactionHash, etc.
          const outcomeName = activity.outcome || activity.title || 'Unknown';
          const normalizedOutcome = String(outcomeName).toLowerCase();
          const side = normalizedOutcome.includes('no') ? 'no' : 'yes';

          // Parse timestamp - could be ISO string or unix timestamp
          let createdAt: string;
          if (activity.timestamp) {
            const ts = activity.timestamp;
            if (typeof ts === 'string' && ts.includes('T')) {
              createdAt = ts; // Already ISO string
            } else {
              const rawTimestamp = Number(ts);
              createdAt = rawTimestamp > 1e12
                ? new Date(rawTimestamp).toISOString()
                : new Date(rawTimestamp * 1000).toISOString();
            }
          } else {
            createdAt = new Date().toISOString();
          }

          const price = parseFloat(activity.price || '0');
          const shares = parseFloat(activity.size || '0');
          // usdcSize is the total amount spent/received
          const amount = parseFloat(activity.usdcSize || '0') || (price * shares);

          return {
            id: `activity_${activity.transactionHash || activity.id || Math.random().toString(36).substr(2, 9)}`,
            marketId: activity.conditionId || 'unknown',
            marketQuestion: activity.title || 'Unknown Market',
            outcomeId: activity.assetId || activity.tokenId || 'unknown',
            outcomeName,
            side,
            shares,
            amount,
            price,
            orderId: activity.transactionHash || activity.id,
            status: 'filled',
            strategy: 'external',
            createdAt,
            externalTradeId: activity.transactionHash || activity.id,
            tradeType: activity.side || 'buy', // 'buy' or 'sell'
          };
        });

        console.log(`[Polymarket] Mapped ${externalBets.length} external bets`);
        if (externalBets.length > 0) {
          console.log('[Polymarket] Sample mapped bet:', JSON.stringify(externalBets[0], null, 2));
        }
      } catch (externalErr: any) {
        console.log('[Polymarket] Could not fetch external trade history:', externalErr.message);
      }

      // Also fetch positions to include as "bets" with P/L data
      // This allows the Wins/Losses filters to work
      let positionBets: any[] = [];
      try {
        const positions = await polyService.getPositions();
        positionBets = positions.map((pos: any) => {
          const profit = parseFloat(pos.cashPnl || '0');
          const profitPercent = parseFloat(pos.percentPnl || '0') / 100; // Convert from percentage
          const isWin = profit > 0;
          const isLoss = profit < 0;

          return {
            id: `position_${pos.conditionId || pos.tokenId || Math.random().toString(36).substr(2, 9)}`,
            marketId: pos.conditionId || 'unknown',
            marketQuestion: pos.title || 'Open Position',
            outcomeId: pos.tokenId || 'unknown',
            outcomeName: pos.outcome || 'Unknown',
            side: (pos.outcome || '').toLowerCase().includes('no') ? 'no' : 'yes',
            shares: parseFloat(pos.size || '0'),
            amount: parseFloat(pos.initialValue || '0'),
            price: parseFloat(pos.avgPrice || '0'),
            currentPrice: parseFloat(pos.curPrice || '0'),
            orderId: `pos_${pos.conditionId}`,
            status: isWin || isLoss ? 'resolved' : 'pending', // Mark as resolved if has P/L
            strategy: 'position',
            createdAt: pos.timestamp || new Date().toISOString(),
            profit: profit,
            profitPercent: profitPercent,
            currentValue: parseFloat(pos.currentValue || '0'),
            endDate: pos.endDate,
            isPosition: true, // Flag to identify position entries
          };
        });
        console.log(`[Polymarket] Added ${positionBets.length} positions as bets with P/L data`);
      } catch (posErr: any) {
        console.log('[Polymarket] Could not fetch positions for bets:', posErr.message);
      }

      // De-duplicate any external trades already stored as internal bets
      const existingOrderIds = new Set(
        bets.map((b: any) => b.orderId).filter((id: string) => !!id)
      );

      // Merge all sources: Firestore bets, external activities, positions
      // Positions go first (they have the most complete P/L data)
      const mergedBets = [
        ...positionBets,
        ...bets,
        ...externalBets.filter((b: any) => !existingOrderIds.has(b.orderId)),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        success: true,
        bets: mergedBets,
        count: mergedBets.length,
      });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching bets:', error);
      // Return empty array instead of error for better UX
      res.json({ success: true, bets: [], count: 0 });
    }
  });

  /**
   * POST /polymarket/bets
   * Place a bet manually using EIP-712 signed orders
   */
  router.post('/bets', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const polyService = getPolymarketService(req);
      const { marketId, tokenId, side, amount, limitPrice, question, outcome, negRisk } = req.body;

      console.log('[Polymarket] Placing bet - full body:', JSON.stringify(req.body, null, 2));
      console.log('[Polymarket] Placing bet:', { marketId, tokenId, side, amount, limitPrice, question, outcome, negRisk });

      if (!side || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: side, amount',
        });
      }

      // Determine the token ID to use - prefer explicit tokenId, fall back to outcomeId
      const tradeTokenId = tokenId || req.body.outcomeId;
      console.log('[Polymarket] Trade token ID:', tradeTokenId);

      if (!tradeTokenId) {
        return res.status(400).json({
          success: false,
          error: 'Missing token ID for trading. Please run a new scan to get updated market data.',
        });
      }

      // Check if private key is provided for signed orders
      const hasPrivateKey = req.headers['x-polymarket-private-key'];
      console.log('[Polymarket] Has private key for signing:', !!hasPrivateKey);

      // Try to get market info for recording (but don't fail if it errors)
      let marketQuestion = question || 'Unknown market';
      try {
        if (marketId) {
          const market = await polyService.getMarket(marketId);
          if (market?.question) {
            marketQuestion = market.question;
          }
        }
      } catch (marketError: any) {
        console.log('[Polymarket] Could not fetch market details:', marketError.message);
        // Continue with bet placement - we have the essential info
      }

      // Calculate the price for the order
      // If no limit price provided, use a high price for market-like execution (0.99 = near-market buy)
      const orderPrice = limitPrice ? parseFloat(limitPrice) : 0.99;

      // Calculate number of shares: amount / price
      // e.g., $10 at price 0.85 = 10 / 0.85 = 11.76 shares
      const shares = parseFloat(amount) / orderPrice;

      console.log('[Polymarket] Order calculation:', {
        amount: parseFloat(amount),
        price: orderPrice,
        shares: shares.toFixed(4),
        useSignedOrder: !!hasPrivateKey,
      });

      let order;
      try {
        if (hasPrivateKey) {
          // Use EIP-712 signed order (proper authentication)
          console.log('[Polymarket] Using signed order with EIP-712...');
          order = await polyService.placeSignedOrder({
            tokenId: tradeTokenId,
            side: 'BUY', // Always BUY the outcome token
            size: shares,
            price: orderPrice,
            orderType: limitPrice ? 'GTC' : 'FOK', // GTC for limit, FOK for market-like
            negRisk: negRisk || false,
          });
        } else {
          // Fall back to simple order (may fail with 403 if CLOB requires signed orders)
          console.log('[Polymarket] Falling back to simple order (no private key)...');
          if (limitPrice) {
            order = await polyService.placeLimitOrder({
              tokenId: tradeTokenId,
              side: 'BUY',
              amount: parseFloat(amount),
              price: parseFloat(limitPrice),
            });
          } else {
            order = await polyService.placeMarketOrder({
              tokenId: tradeTokenId,
              side: 'BUY',
              amount: parseFloat(amount),
            });
          }
        }
      } catch (orderError: any) {
        console.error('[Polymarket] Order placement failed:', orderError);
        const errorMessage = orderError.response?.data?.message || orderError.message;

        // Check if this is an auth error that could be solved with a private key
        if (!hasPrivateKey && (errorMessage.includes('403') || errorMessage.includes('auth') || errorMessage.includes('signature'))) {
          return res.status(400).json({
            success: false,
            error: 'Order requires wallet authentication. Please add your wallet private key in Settings to enable order signing.',
          });
        }

        return res.status(400).json({
          success: false,
          error: `Order failed: ${errorMessage}`,
        });
      }

      // Record bet in Firestore
      const betRecord = {
        userId,
        marketId: marketId || 'unknown',
        marketQuestion,
        outcomeId: tradeTokenId,
        outcomeName: outcome || side,
        side: side.toLowerCase(),
        shares: shares,
        amount: parseFloat(amount),
        price: orderPrice,
        orderId: order?.id || 'pending',
        status: 'pending',
        strategy: 'manual',
        signedOrder: !!hasPrivateKey,
        createdAt: new Date().toISOString(),
      };

      const betRef = await db.collection('polymarketBets').add(betRecord);

      res.json({
        success: true,
        bet: { id: betRef.id, ...betRecord },
        order,
      });
    } catch (error: any) {
      console.error('[Polymarket] Error placing bet:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // STATS ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/stats
   * Get user's performance statistics
   * Combines Firestore bets + positions data for comprehensive stats
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const polyService = getPolymarketService(req);

      // Get Firestore bets
      let firestoreBets: any[] = [];
      try {
        const betsRef = db.collection('polymarketBets')
          .where('userId', '==', userId);
        const snapshot = await betsRef.get();
        firestoreBets = snapshot.docs.map(doc => doc.data());
      } catch (err: any) {
        console.log('[Polymarket] Could not fetch Firestore bets:', err.message);
      }

      // Get positions for calculating unrealized stats
      let positions: any[] = [];
      try {
        positions = await polyService.getPositions();
      } catch (err: any) {
        console.log('[Polymarket] Could not fetch positions for stats:', err.message);
      }

      // Get activity history for comprehensive trade counting
      let activities: any[] = [];
      try {
        activities = await polyService.getTradeHistory(200);
      } catch (err: any) {
        console.log('[Polymarket] Could not fetch activity for stats:', err.message);
      }

      // Calculate stats from positions (open/unrealized)
      const positionsCount = positions.length;
      const positionsValue = positions.reduce((sum: number, p: any) => sum + parseFloat(p.currentValue || '0'), 0);
      const positionsCost = positions.reduce((sum: number, p: any) => sum + parseFloat(p.initialValue || '0'), 0);
      const unrealizedPnL = positions.reduce((sum: number, p: any) => sum + parseFloat(p.cashPnl || '0'), 0);

      // Calculate stats from activities (total trades)
      const totalActivities = activities.length;

      // Categorize activities by type
      // Activity types: 'buy' = bought position, 'sell' = sold position
      // Also look for type field which might indicate redemption/payout
      const buyActivities = activities.filter((a: any) =>
        a.side === 'buy' || a.type === 'buy' || (!a.side && !a.type)
      );
      const sellActivities = activities.filter((a: any) =>
        a.side === 'sell' || a.type === 'sell'
      );
      // Redemptions are when markets resolve and you get paid out
      const redemptionActivities = activities.filter((a: any) =>
        a.type === 'redeem' || a.type === 'redemption' || a.type === 'payout'
      );

      console.log(`[Polymarket] Activity breakdown: ${buyActivities.length} buys, ${sellActivities.length} sells, ${redemptionActivities.length} redemptions`);

      // Calculate invested from activities (sum of buy amounts)
      const investedFromActivities = buyActivities.reduce((sum: number, a: any) => {
        return sum + parseFloat(a.usdcSize || '0');
      }, 0);

      // Calculate returned from sell activities
      const returnedFromSells = sellActivities.reduce((sum: number, a: any) => {
        return sum + parseFloat(a.usdcSize || '0');
      }, 0);

      // Calculate realized P/L from closed positions (sells + redemptions - associated buys)
      // For now, estimate realized P/L as: sells + redemptions - (total buys - current positions cost)
      const totalRedemptions = redemptionActivities.reduce((sum: number, a: any) => {
        return sum + parseFloat(a.usdcSize || a.payout || '0');
      }, 0);

      // Realized P/L = money received from sells/redemptions - money spent on those closed positions
      // Estimate: if we have X in open positions and spent Y total, then Y-X was spent on closed positions
      // And we got Z back from sells/redemptions, so realized P/L = Z - (Y - X) = Z - Y + X
      const realizedPnL = (returnedFromSells + totalRedemptions) - (investedFromActivities - positionsCost);
      console.log(`[Polymarket] Realized P/L calculation: sells(${returnedFromSells}) + redemptions(${totalRedemptions}) - (invested(${investedFromActivities}) - openCost(${positionsCost})) = ${realizedPnL}`);

      // For wins/losses, we look at positions with positive/negative P/L
      const winningPositions = positions.filter((p: any) => parseFloat(p.cashPnl || '0') > 0);
      const losingPositions = positions.filter((p: any) => parseFloat(p.cashPnl || '0') < 0);

      // Combine Firestore resolved bets
      const resolvedBets = firestoreBets.filter(b => b.status === 'resolved');
      const firestoreWins = resolvedBets.filter(b => b.profit && b.profit > 0).length;
      const firestoreLosses = resolvedBets.filter(b => b.profit && b.profit < 0).length;
      const firestoreProfit = resolvedBets.reduce((sum, b) => sum + (b.profit || 0), 0);

      // Total calculations
      const totalBets = totalActivities || firestoreBets.length || positionsCount;
      const wins = winningPositions.length + firestoreWins;
      const losses = losingPositions.length + firestoreLosses;
      const pending = positionsCount;

      // Total invested = from activities + from Firestore (avoid double counting)
      const totalInvested = investedFromActivities || positionsCost || firestoreBets.reduce((sum, b) => sum + (b.amount || 0), 0);

      // Total profit = unrealized from positions + realized from sells + Firestore
      const totalProfit = unrealizedPnL + firestoreProfit;

      // Best/worst from positions
      const bestFromPositions = Math.max(0, ...positions.map((p: any) => parseFloat(p.cashPnl || '0')));
      const worstFromPositions = Math.min(0, ...positions.map((p: any) => parseFloat(p.cashPnl || '0')));
      const bestFromFirestore = Math.max(0, ...resolvedBets.map(b => b.profit || 0));
      const worstFromFirestore = Math.min(0, ...resolvedBets.map(b => b.profit || 0));

      // Calculate average win/loss from positions
      const winningPnLs = positions
        .map((p: any) => parseFloat(p.cashPnl || '0'))
        .filter(pnl => pnl > 0);
      const losingPnLs = positions
        .map((p: any) => parseFloat(p.cashPnl || '0'))
        .filter(pnl => pnl < 0);

      const avgWin = winningPnLs.length > 0
        ? winningPnLs.reduce((a, b) => a + b, 0) / winningPnLs.length
        : 0;
      const avgLoss = losingPnLs.length > 0
        ? losingPnLs.reduce((a, b) => a + b, 0) / losingPnLs.length
        : 0;

      // Calculate average win/loss percentages from positions
      const winningPercents = positions
        .filter((p: any) => parseFloat(p.cashPnl || '0') > 0)
        .map((p: any) => parseFloat(p.percentPnl || '0'));
      const losingPercents = positions
        .filter((p: any) => parseFloat(p.cashPnl || '0') < 0)
        .map((p: any) => parseFloat(p.percentPnl || '0'));

      const avgWinPercent = winningPercents.length > 0
        ? winningPercents.reduce((a, b) => a + b, 0) / winningPercents.length
        : 0;
      const avgLossPercent = losingPercents.length > 0
        ? losingPercents.reduce((a, b) => a + b, 0) / losingPercents.length
        : 0;

      // Calculate invested properly from positions (cost basis)
      const actualInvested = positionsCost > 0 ? positionsCost : totalInvested;

      // Calculate average bet size from positions (more accurate)
      const avgBetFromPositions = positionsCount > 0
        ? positionsCost / positionsCount
        : (totalBets > 0 ? actualInvested / totalBets : 0);

      // All-time P/L = unrealized from open positions + realized from closed positions + Firestore
      // Unrealized = current value - cost of open positions
      // Realized = calculated from activity (sells + redemptions vs buys for closed positions)
      const allTimePnL = unrealizedPnL + realizedPnL + firestoreProfit;
      console.log(`[Polymarket] All-time P/L: unrealized(${unrealizedPnL}) + realized(${realizedPnL}) + firestore(${firestoreProfit}) = ${allTimePnL}`);

      // Calculate monthly P/L from activities
      const monthlyPnL: Record<string, { pnl: number; invested: number }> = {};
      const currentYear = new Date().getFullYear();

      // Group activities by month and calculate P/L
      activities.forEach((a: any) => {
        if (!a.timestamp) return;

        const date = new Date(a.timestamp);
        if (date.getFullYear() !== currentYear) return;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyPnL[monthKey]) {
          monthlyPnL[monthKey] = { pnl: 0, invested: 0 };
        }

        const amount = parseFloat(a.usdcSize || '0');
        const side = a.side || a.type || '';

        if (side === 'buy') {
          monthlyPnL[monthKey].invested += amount;
        } else if (side === 'sell' || side === 'redeem' || side === 'redemption') {
          // Estimate P/L: for sells, we need to compare to original buy price
          // For redemptions, the full amount is profit if we won
          monthlyPnL[monthKey].pnl += amount;
        }
      });

      // Add unrealized P/L to current month
      const currentMonthKey = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyPnL[currentMonthKey]) {
        monthlyPnL[currentMonthKey] = { pnl: 0, invested: 0 };
      }
      monthlyPnL[currentMonthKey].pnl += unrealizedPnL;

      console.log('[Polymarket] Monthly P/L:', monthlyPnL);

      const stats = {
        totalBets,
        wins,
        losses,
        pending,
        winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
        totalInvested: actualInvested,
        totalReturned: actualInvested + allTimePnL,
        totalProfit: allTimePnL,
        roi: actualInvested > 0 ? allTimePnL / actualInvested : 0,
        avgBetSize: avgBetFromPositions,
        bestBet: Math.max(bestFromPositions, bestFromFirestore),
        worstBet: Math.min(worstFromPositions, worstFromFirestore),
        currentExposure: positionsValue,
        // Additional stats
        openPositions: positionsCount,
        unrealizedPnL,
        realizedPnL, // Realized P/L from closed positions
        positionsValue,
        positionsCost, // Cost basis for positions
        // Average win/loss stats
        avgWin,
        avgWinPercent,
        avgLoss,
        avgLossPercent,
        // All-time stats
        allTimePnL,
        // Monthly breakdown
        monthlyPnL,
      };

      console.log('[Polymarket] Stats calculated:', stats);
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // EXECUTION ENDPOINTS
  // ============================================

  /**
   * GET /polymarket/executions
   * Get recent execution logs
   */
  router.get('/executions', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const limitNum = parseInt(req.query.limit as string) || 20;

      // Try with orderBy first, fall back to simple query if index doesn't exist
      let executions: any[] = [];
      try {
        const execRef = db.collection('polymarketExecutions')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(limitNum);

        const snapshot = await execRef.get();
        executions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (indexError: any) {
        // Index might not exist yet, try simple query
        console.log('[Polymarket] Index not ready, using simple query for executions');
        const execRef = db.collection('polymarketExecutions')
          .where('userId', '==', userId)
          .limit(limitNum);

        const snapshot = await execRef.get();
        executions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side
        executions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      res.json({
        success: true,
        executions,
        count: executions.length,
      });
    } catch (error: any) {
      console.error('[Polymarket] Error fetching executions:', error);
      // Return empty array instead of error for better UX
      res.json({ success: true, executions: [], count: 0 });
    }
  });

  /**
   * POST /polymarket/trigger
   * Manually trigger a market scan
   */
  router.post('/trigger', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const polyService = getPolymarketService(req);

      // Get user's config or use defaults
      const configRef = db.collection('polymarketConfigs').doc(userId);
      const configDoc = await configRef.get();

      // Use saved config or defaults - permissive defaults to show all available markets
      const defaultConfig = {
        timeframeHours: 0, // 0 = no time filter, show all active markets
        marketScopeLimit: 500, // Increased limit
        minProbability: 0.01, // Very low to include most markets
        maxProbability: 0.99,
        minVolume: 0, // No volume filter by default
        minLiquidity: 0, // No liquidity filter by default
        closeDate: null,
        maxOpportunities: 100, // Return up to 100 opportunities
      };

      const config = configDoc.exists ? { ...defaultConfig, ...configDoc.data() } : defaultConfig;

      console.log(`[Polymarket] Scan config for user ${userId}:`, {
        timeframeHours: config.timeframeHours,
        timeframeDays: Math.round((config.timeframeHours || 168) / 24),
        marketScopeLimit: config.marketScopeLimit,
        minProbability: config.minProbability,
        maxProbability: config.maxProbability,
        minVolume: config.minVolume,
        minLiquidity: config.minLiquidity,
        closeDate: config.closeDate,
        configExists: configDoc.exists,
      });

      console.log(`[Polymarket] Using timeframe: ${config.timeframeHours}h (${Math.round((config.timeframeHours || 168) / 24)} days)`);

      // Get markets closing soon
      const markets = await polyService.getMarketsClosingSoon(
        config.timeframeHours || 24,
        config.marketScopeLimit || 100
      );

      // Filter by volume and liquidity thresholds first
      const minVolume = config.minVolume || 0;
      const minLiquidity = config.minLiquidity || 0;
      const volumeFilteredMarkets = markets.filter(market => {
        const volume = parseFloat(market.volume || '0');
        const liquidity = parseFloat(market.liquidity || '0');
        return volume >= minVolume && liquidity >= minLiquidity;
      });

      // Filter by probability threshold and build opportunity objects
      const minProb = config.minProbability || 0.70;
      const maxProb = config.maxProbability || 0.98;

      console.log(`[Polymarket] Filtering by probability: ${minProb * 100}% - ${maxProb * 100}%`);

      const opportunities = volumeFilteredMarkets
        .map(market => {
          // Parse outcomePrices - API returns it as JSON string or array
          let prices: number[] = [];
          const rawPrices = (market as any).outcomePrices || market.outcome_prices;
          if (typeof rawPrices === 'string') {
            try {
              prices = JSON.parse(rawPrices).map((p: string) => parseFloat(p));
            } catch { prices = []; }
          } else if (Array.isArray(rawPrices)) {
            prices = rawPrices.map(p => parseFloat(p));
          }

          // Parse outcomes - API returns it as JSON string or array
          let outcomes: string[] = [];
          const rawOutcomes = market.outcomes;
          if (typeof rawOutcomes === 'string') {
            try {
              outcomes = JSON.parse(rawOutcomes);
            } catch { outcomes = []; }
          } else if (Array.isArray(rawOutcomes)) {
            outcomes = rawOutcomes;
          }

          // Find the outcome that matches our probability criteria
          let matchingIdx = -1;
          let matchingPrice = 0;

          for (let i = 0; i < prices.length; i++) {
            if (prices[i] >= minProb && prices[i] <= maxProb) {
              matchingIdx = i;
              matchingPrice = prices[i];
              break;
            }
          }

          if (matchingIdx === -1) return null;

          // Calculate hours to close - API uses endDateIso or endDate
          const endDateStr = (market as any).endDateIso || (market as any).endDate || market.end_date_iso;
          const endDate = endDateStr ? new Date(endDateStr) : null;
          const hoursToClose = endDate
            ? Math.max(0, (endDate.getTime() - Date.now()) / (1000 * 60 * 60))
            : 999;

          // Extract token IDs for trading - check multiple field names
          let tokenIds: string[] = [];
          const rawTokens = (market as any).clobTokenIds || (market as any).tokens;
          console.log(`[Polymarket] Market ${market.question?.substring(0, 50)}: rawTokens type=${typeof rawTokens}, value=${JSON.stringify(rawTokens)?.substring(0, 100)}`);

          if (typeof rawTokens === 'string') {
            try {
              tokenIds = JSON.parse(rawTokens);
              console.log(`[Polymarket] Parsed tokenIds from string: ${tokenIds.length} tokens`);
            } catch (e) {
              console.log(`[Polymarket] Failed to parse tokenIds: ${e}`);
              tokenIds = [];
            }
          } else if (Array.isArray(rawTokens)) {
            // Could be array of strings or array of objects with token_id
            tokenIds = rawTokens.map(t => typeof t === 'string' ? t : (t.token_id || t.tokenId || ''));
            console.log(`[Polymarket] Got tokenIds from array: ${tokenIds.length} tokens`);
          }

          // Get the token ID for the matching outcome
          const tokenId = tokenIds[matchingIdx] || '';
          console.log(`[Polymarket] Selected tokenId for outcome ${matchingIdx}: ${tokenId?.substring(0, 30)}...`);

          return {
            id: market.id || (market as any).conditionId || market.condition_id,
            conditionId: (market as any).conditionId || market.condition_id,
            tokenId: tokenId, // Token ID for trading
            question: market.question,
            outcome: outcomes[matchingIdx] || (matchingIdx === 0 ? 'Yes' : 'No'),
            outcomeIndex: matchingIdx,
            probability: matchingPrice,
            volume: parseFloat(market.volume || '0'),
            hoursToClose: Math.round(hoursToClose * 10) / 10,
            endDate: endDateStr,
            category: market.category,
            slug: market.slug,
          };
        })
        .filter(opp => opp !== null)
        .sort((a, b) => (b?.probability || 0) - (a?.probability || 0));

      // Record execution
      const execution = {
        userId,
        action: 'scan',
        marketsScanned: markets.length,
        marketsAfterVolumeFilter: volumeFilteredMarkets.length,
        minVolumeUsed: minVolume,
        minLiquidityUsed: minLiquidity,
        opportunitiesFound: opportunities.length,
        betsPlaced: 0, // Manual scan doesn't auto-place bets
        timestamp: new Date().toISOString(),
        filtersUsed: {
          timeframeHours: config.timeframeHours,
          minProbability: minProb,
          maxProbability: maxProb,
          minVolume: minVolume,
          minLiquidity: minLiquidity,
          marketScopeLimit: config.marketScopeLimit,
          closeDate: config.closeDate || null,
        },
      };

      await db.collection('polymarketExecutions').add(execution);

      // Determine how many opportunities to return (default 100, configurable)
      const maxOpportunities = config.maxOpportunities || 100;

      res.json({
        success: true,
        result: {
          marketsScanned: markets.length,
          marketsAfterVolumeFilter: volumeFilteredMarkets.length,
          opportunitiesFound: opportunities.length,
          opportunities: opportunities.slice(0, maxOpportunities), // Return more opportunities
          filtersUsed: {
            timeframeHours: config.timeframeHours,
            minProbability: minProb,
            maxProbability: maxProb,
            minVolume: minVolume,
            minLiquidity: minLiquidity,
            marketScopeLimit: config.marketScopeLimit,
            closeDate: config.closeDate || null,
            maxOpportunities: maxOpportunities,
          },
        },
      });
    } catch (error: any) {
      console.error('[Polymarket] Error triggering scan:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================
  // CREDENTIAL ENDPOINTS
  // ============================================

  /**
   * POST /polymarket/credentials
   * Save Polymarket API credentials
   */
  router.post('/credentials', async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { apiKey, apiSecret, passphrase, address } = req.body;

      if (!apiKey || !apiSecret || !passphrase) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: apiKey, apiSecret, passphrase',
        });
      }

      // Store credentials (in production, these should be encrypted)
      await db.collection('polymarketCredentials').doc(userId).set({
        apiKey,
        apiSecret,
        passphrase,
        address: address || '',
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true, message: 'Credentials saved successfully' });
    } catch (error: any) {
      console.error('[Polymarket] Error saving credentials:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /polymarket/test-connection
   * Test Polymarket API connection
   */
  router.post('/test-connection', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);
      const result = await polyService.testConnection();

      res.json(result);
    } catch (error: any) {
      console.error('[Polymarket] Error testing connection:', error);
      res.status(500).json({
        success: false,
        message: `Connection test failed: ${error.message}`,
      });
    }
  });

  /**
   * GET /polymarket/debug-addresses
   * Debug endpoint to show which addresses are configured and find positions
   */
  router.get('/debug-addresses', async (req: Request, res: Response) => {
    try {
      const address = req.headers['x-polymarket-address'] as string;
      const funderAddress = req.headers['x-polymarket-funder-address'] as string;

      const results: any = {
        configuredAddresses: {
          walletAddress: address || 'not set',
          funderAddress: funderAddress || 'not set',
        },
        addressesChecked: [],
        positionsFound: {},
        rawApiResponses: [],
      };

      // Check each address - funder first, then wallet
      const addressesToCheck = [funderAddress, address].filter(Boolean);

      for (const addr of addressesToCheck) {
        const addrLower = addr.toLowerCase();
        try {
          console.log(`[Debug] Fetching positions for: ${addrLower}`);
          const response = await axios.get('https://data-api.polymarket.com/positions', {
            params: { user: addrLower, limit: 500 },
            timeout: 15000,
          });
          const positions = response.data || [];
          console.log(`[Debug] Got ${positions.length} positions for ${addrLower}`);

          results.addressesChecked.push({
            address: addrLower,
            positionsCount: positions.length,
            positions: positions.slice(0, 10).map((p: any) => ({
              title: p.title || p.question,
              outcome: p.outcome,
              size: p.size,
              currentValue: p.currentValue,
            })),
          });
          results.positionsFound[addrLower] = positions.length;

          // Store raw response for debugging
          if (positions.length > 0) {
            results.rawApiResponses.push({
              address: addrLower,
              sampleRaw: positions[0],
            });
          }
        } catch (err: any) {
          results.addressesChecked.push({
            address: addrLower,
            error: err.response?.data || err.message,
          });
        }
      }

      // Also check what the positions endpoint returns through our service
      try {
        const polyService = getPolymarketService(req);
        const servicePositions = await polyService.getPositions();
        results.servicePositionsCount = servicePositions.length;
        results.servicePositionsSample = servicePositions.slice(0, 3).map((p: any) => ({
          title: p.title,
          size: p.size,
          _sourceAddress: p._sourceAddress,
        }));
      } catch (err: any) {
        results.serviceError = err.message;
      }

      res.json({ success: true, debug: results });
    } catch (error: any) {
      console.error('[Polymarket] Debug error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /polymarket/derive-api-key
   * Derive API credentials from wallet private key
   * This uses L1 (wallet signature) to create L2 (API key/secret/passphrase) credentials
   */
  router.post('/derive-api-key', async (req: Request, res: Response) => {
    try {
      const polyService = getPolymarketService(req);

      console.log('[Polymarket] Deriving API credentials from wallet...');

      const credentials = await polyService.createOrDeriveApiCredentials();

      res.json({
        success: true,
        credentials: {
          apiKey: credentials.apiKey,
          apiSecret: credentials.secret,
          passphrase: credentials.passphrase,
        },
        message: 'API credentials derived successfully. Save these in your Settings.',
      });
    } catch (error: any) {
      console.error('[Polymarket] Error deriving API credentials:', error);
      res.status(500).json({
        success: false,
        error: `Failed to derive API credentials: ${error.message}`,
      });
    }
  });

  /**
   * POST /polymarket/analyze
   * AI analysis of betting opportunities
   * Analyzes markets and provides recommendations with reasoning
   */
  router.post('/analyze', async (req: Request, res: Response) => {
    try {
      const { opportunities } = req.body;

      if (!opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No opportunities provided for analysis',
        });
      }

      // Analyze each opportunity using rule-based logic
      // (In production, this could call an AI API like Claude/GPT)
      const analyzedOpportunities = opportunities.map((opp: any) => {
        const analysis = analyzeOpportunity(opp);
        return {
          ...opp,
          aiAnalysis: analysis,
        };
      });

      // Sort by AI score to find best picks
      const sortedByScore = [...analyzedOpportunities].sort(
        (a, b) => b.aiAnalysis.score - a.aiAnalysis.score
      );

      // Mark top picks (top 3 by score)
      sortedByScore.forEach((opp, idx) => {
        opp.aiAnalysis.isBestPick = idx < 3;
        opp.aiAnalysis.rank = idx + 1;
      });

      res.json({
        success: true,
        opportunities: analyzedOpportunities,
        bestPicks: sortedByScore.slice(0, 3).map(o => o.id),
      });
    } catch (error: any) {
      console.error('[Polymarket] Error analyzing opportunities:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

/**
 * Analyze a single betting opportunity
 * Returns a score (0-100), recommendation, and reasoning
 */
function analyzeOpportunity(opp: {
  id: string;
  question: string;
  outcome: string;
  probability: number;
  volume: number;
  hoursToClose: number;
  category?: string;
}): {
  score: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  reasoning: string;
  factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
} {
  let score = 50; // Start neutral
  const factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[] = [];

  // Factor 1: Probability sweet spot (80-92% is ideal for high-confidence bets)
  const prob = opp.probability;
  if (prob >= 0.85 && prob <= 0.92) {
    score += 20;
    factors.push({
      name: 'Probability',
      impact: 'positive',
      detail: `${(prob * 100).toFixed(0)}% is in the sweet spot - high confidence without being priced in`,
    });
  } else if (prob >= 0.80 && prob < 0.85) {
    score += 10;
    factors.push({
      name: 'Probability',
      impact: 'positive',
      detail: `${(prob * 100).toFixed(0)}% offers good value with reasonable confidence`,
    });
  } else if (prob > 0.92 && prob <= 0.95) {
    score += 5;
    factors.push({
      name: 'Probability',
      impact: 'neutral',
      detail: `${(prob * 100).toFixed(0)}% is very high - less upside but safer`,
    });
  } else if (prob > 0.95) {
    score -= 10;
    factors.push({
      name: 'Probability',
      impact: 'negative',
      detail: `${(prob * 100).toFixed(0)}% is extremely high - minimal profit potential`,
    });
  } else {
    score -= 5;
    factors.push({
      name: 'Probability',
      impact: 'neutral',
      detail: `${(prob * 100).toFixed(0)}% has more uncertainty`,
    });
  }

  // Factor 2: Volume (higher volume = more liquidity and market confidence)
  if (opp.volume >= 500000) {
    score += 15;
    factors.push({
      name: 'Volume',
      impact: 'positive',
      detail: `$${(opp.volume / 1000).toFixed(0)}K volume indicates strong market interest and reliable pricing`,
    });
  } else if (opp.volume >= 100000) {
    score += 10;
    factors.push({
      name: 'Volume',
      impact: 'positive',
      detail: `$${(opp.volume / 1000).toFixed(0)}K volume shows good liquidity`,
    });
  } else if (opp.volume >= 50000) {
    score += 5;
    factors.push({
      name: 'Volume',
      impact: 'neutral',
      detail: `$${(opp.volume / 1000).toFixed(0)}K volume is moderate`,
    });
  } else {
    score -= 10;
    factors.push({
      name: 'Volume',
      impact: 'negative',
      detail: `$${(opp.volume / 1000).toFixed(0)}K volume is low - prices may be less reliable`,
    });
  }

  // Factor 3: Time to close (sweet spot is 3-14 days)
  const daysToClose = opp.hoursToClose / 24;
  if (daysToClose >= 3 && daysToClose <= 14) {
    score += 10;
    factors.push({
      name: 'Timing',
      impact: 'positive',
      detail: `${daysToClose.toFixed(0)} days to resolution - good balance of certainty and value`,
    });
  } else if (daysToClose < 3 && daysToClose >= 1) {
    score += 5;
    factors.push({
      name: 'Timing',
      impact: 'neutral',
      detail: `${daysToClose.toFixed(1)} days to resolution - quick turnaround`,
    });
  } else if (daysToClose < 1) {
    score -= 5;
    factors.push({
      name: 'Timing',
      impact: 'negative',
      detail: `Less than a day to resolution - high time pressure`,
    });
  } else {
    factors.push({
      name: 'Timing',
      impact: 'neutral',
      detail: `${daysToClose.toFixed(0)} days to resolution`,
    });
  }

  // Factor 4: Expected value calculation
  const potentialReturn = 1 / prob;
  const expectedValue = (prob * potentialReturn) - 1; // Should be ~0 for fair odds
  const impliedEdge = (potentialReturn - 1) * 100; // Profit % if win

  if (impliedEdge >= 15 && impliedEdge <= 30) {
    score += 10;
    factors.push({
      name: 'Value',
      impact: 'positive',
      detail: `${impliedEdge.toFixed(0)}% potential profit offers good risk/reward`,
    });
  } else if (impliedEdge > 30) {
    score += 5;
    factors.push({
      name: 'Value',
      impact: 'neutral',
      detail: `${impliedEdge.toFixed(0)}% potential profit but higher risk`,
    });
  } else {
    factors.push({
      name: 'Value',
      impact: 'neutral',
      detail: `${impliedEdge.toFixed(0)}% potential profit`,
    });
  }

  // Factor 5: Category bonus (sports tend to be more predictable)
  if (opp.category) {
    const cat = opp.category.toLowerCase();
    if (cat.includes('sports') || cat.includes('nfl') || cat.includes('nba')) {
      score += 5;
      factors.push({
        name: 'Category',
        impact: 'positive',
        detail: 'Sports markets often have more predictable outcomes',
      });
    } else if (cat.includes('politics') || cat.includes('election')) {
      factors.push({
        name: 'Category',
        impact: 'neutral',
        detail: 'Political markets can be volatile',
      });
    }
  }

  // Determine recommendation based on score
  let recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  if (score >= 75) {
    recommendation = 'strong_buy';
  } else if (score >= 60) {
    recommendation = 'buy';
  } else if (score >= 45) {
    recommendation = 'hold';
  } else {
    recommendation = 'avoid';
  }

  // Generate reasoning summary
  const positiveFactors = factors.filter(f => f.impact === 'positive');
  const negativeFactors = factors.filter(f => f.impact === 'negative');

  let reasoning = '';
  if (recommendation === 'strong_buy') {
    reasoning = `Strong opportunity with ${positiveFactors.length} favorable factors. `;
  } else if (recommendation === 'buy') {
    reasoning = `Good opportunity. `;
  } else if (recommendation === 'hold') {
    reasoning = `Mixed signals. `;
  } else {
    reasoning = `Several concerns. `;
  }

  if (positiveFactors.length > 0) {
    reasoning += `Strengths: ${positiveFactors.map(f => f.name.toLowerCase()).join(', ')}. `;
  }
  if (negativeFactors.length > 0) {
    reasoning += `Watch: ${negativeFactors.map(f => f.name.toLowerCase()).join(', ')}.`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    recommendation,
    reasoning: reasoning.trim(),
    factors,
  };
}
