/**
 * News Routes
 * API endpoints for crypto news aggregation and daily summaries
 */

import { Router } from 'express';
import { Firestore } from 'firebase-admin/firestore';
import { NewsAggregatorService } from '../services/newsAggregatorService.js';
import { NewsMarketDataService } from '../services/newsMarketDataService.js';
import { AISummaryService } from '../services/aiSummaryService.js';

export function createNewsRouter(db: Firestore): Router {
  const router = Router();

  const newsAggregator = new NewsAggregatorService(db);
  const marketDataService = new NewsMarketDataService(db);
  const aiSummaryService = new AISummaryService(db);

  /**
   * GET /news/latest
   * Get today's news data (or most recent available)
   */
  router.get('/latest', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`[News API] Fetching latest news for ${today}`);

      // Try to get today's data first
      let newsDoc = await db.collection('dailyNews').doc(today).get();

      // If no data for today, get the most recent
      if (!newsDoc.exists) {
        const recentSnapshot = await db.collection('dailyNews')
          .orderBy('date', 'desc')
          .limit(1)
          .get();

        if (recentSnapshot.empty) {
          return res.json({
            success: true,
            data: null,
            message: 'No news data available yet',
            timestamp: new Date().toISOString(),
          });
        }

        newsDoc = recentSnapshot.docs[0];
      }

      const data = newsDoc.data();
      const date = newsDoc.id;

      // Get articles from subcollection
      const articles = await newsAggregator.getArticles(date, 30);

      res.json({
        success: true,
        data: {
          date,
          aiSummary: data?.aiSummary || null,
          marketOverview: data?.marketOverview || null,
          articles,
          whaleAlerts: [], // TODO: Implement whale alerts
          airdrops: [], // TODO: Implement airdrops
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching latest news:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /news/daily/:date
   * Get news data for a specific date
   */
  router.get('/daily/:date', async (req, res) => {
    try {
      const { date } = req.params;

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`[News API] Fetching news for ${date}`);

      const newsDoc = await db.collection('dailyNews').doc(date).get();

      if (!newsDoc.exists) {
        return res.status(404).json({
          success: false,
          error: `No news data available for ${date}`,
          timestamp: new Date().toISOString(),
        });
      }

      const data = newsDoc.data();
      const articles = await newsAggregator.getArticles(date, 50);

      res.json({
        success: true,
        data: {
          date,
          aiSummary: data?.aiSummary || null,
          marketOverview: data?.marketOverview || null,
          articles,
          whaleAlerts: [], // TODO: Implement
          airdrops: [], // TODO: Implement
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching news for date:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /news/dates
   * Get list of available dates with news
   */
  router.get('/dates', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;

      console.log(`[News API] Fetching available dates (limit: ${limit})`);

      const dates = await newsAggregator.getAvailableDates(limit);

      res.json({
        success: true,
        dates,
        count: dates.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching dates:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /news/summary/:date
   * Get just the AI summary for a date
   */
  router.get('/summary/:date', async (req, res) => {
    try {
      const { date } = req.params;

      console.log(`[News API] Fetching summary for ${date}`);

      const summary = await aiSummaryService.getStoredSummary(date);

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: `No summary available for ${date}`,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching summary:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /news/market
   * Get current market overview (live data)
   */
  router.get('/market', async (req, res) => {
    try {
      console.log('[News API] Fetching live market overview');

      const marketData = await marketDataService.getMarketOverview();

      res.json({
        success: true,
        data: marketData,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching market data:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /news/refresh
   * Manually trigger news aggregation for today
   */
  router.post('/refresh', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`[News API] Manual refresh triggered for ${today}`);

      // Fetch all data
      const [articles, marketData] = await Promise.all([
        newsAggregator.fetchAllFeeds(),
        marketDataService.getMarketOverview(),
      ]);

      // Generate AI summary
      const aiSummary = await aiSummaryService.generateDailySummary(articles, marketData);

      // Store everything
      await Promise.all([
        newsAggregator.storeArticles(today, articles),
        marketDataService.storeMarketData(today, marketData),
        aiSummaryService.storeSummary(today, aiSummary),
      ]);

      // Update the main document
      await db.collection('dailyNews').doc(today).set({
        date: today,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      res.json({
        success: true,
        message: 'News refreshed successfully',
        data: {
          date: today,
          articlesCount: articles.length,
          aiSummary,
          marketOverview: marketData,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error refreshing news:', error.message);
      console.error('[News API] Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error occurred',
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /news/fear-greed
   * Get current Fear & Greed index
   */
  router.get('/fear-greed', async (req, res) => {
    try {
      console.log('[News API] Fetching Fear & Greed index');

      const fearGreed = await marketDataService.getFearGreedIndex();

      res.json({
        success: true,
        data: fearGreed,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching Fear & Greed:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /news/top-movers
   * Get current top gainers and losers
   */
  router.get('/top-movers', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      console.log(`[News API] Fetching top movers (limit: ${limit})`);

      const movers = await marketDataService.getTopMovers(limit);

      res.json({
        success: true,
        data: movers,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[News API] Error fetching top movers:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
