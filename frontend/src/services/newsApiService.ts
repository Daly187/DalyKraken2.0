/**
 * News API Service
 * Handles all news-related API calls
 */

import { apiService } from './apiService';
import type { DailyNewsData, MarketOverview, FearGreedData, TopMover } from '../types/news';

class NewsApiService {
  /**
   * Get latest news (today or most recent)
   */
  async getLatestNews(): Promise<DailyNewsData | null> {
    try {
      const response = await apiService.get<{ success: boolean; data: DailyNewsData | null }>('/news/latest');
      return response.data || null;
    } catch (error) {
      console.error('[NewsAPI] Error fetching latest news:', error);
      throw error;
    }
  }

  /**
   * Get news for a specific date
   */
  async getNewsForDate(date: string): Promise<DailyNewsData> {
    try {
      const response = await apiService.get<{ success: boolean; data: DailyNewsData }>(`/news/daily/${date}`);
      return response.data;
    } catch (error) {
      console.error('[NewsAPI] Error fetching news for date:', error);
      throw error;
    }
  }

  /**
   * Get available dates with news
   */
  async getAvailableDates(limit: number = 30): Promise<string[]> {
    try {
      const response = await apiService.get<{ success: boolean; dates: string[] }>(`/news/dates?limit=${limit}`);
      return response.dates || [];
    } catch (error) {
      console.error('[NewsAPI] Error fetching available dates:', error);
      throw error;
    }
  }

  /**
   * Get live market overview
   */
  async getMarketOverview(): Promise<MarketOverview> {
    try {
      const response = await apiService.get<{ success: boolean; data: MarketOverview }>('/news/market');
      return response.data;
    } catch (error) {
      console.error('[NewsAPI] Error fetching market overview:', error);
      throw error;
    }
  }

  /**
   * Get Fear & Greed index
   */
  async getFearGreedIndex(): Promise<FearGreedData> {
    try {
      const response = await apiService.get<{ success: boolean; data: FearGreedData }>('/news/fear-greed');
      return response.data;
    } catch (error) {
      console.error('[NewsAPI] Error fetching Fear & Greed:', error);
      throw error;
    }
  }

  /**
   * Get top gainers and losers
   */
  async getTopMovers(limit: number = 5): Promise<{ gainers: TopMover[]; losers: TopMover[] }> {
    try {
      const response = await apiService.get<{ success: boolean; data: { gainers: TopMover[]; losers: TopMover[] } }>(`/news/top-movers?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[NewsAPI] Error fetching top movers:', error);
      throw error;
    }
  }

  /**
   * Manually trigger news refresh
   */
  async refreshNews(): Promise<DailyNewsData> {
    try {
      const response = await apiService.post<{ success: boolean; data: DailyNewsData }>('/news/refresh');
      return response.data;
    } catch (error) {
      console.error('[NewsAPI] Error refreshing news:', error);
      throw error;
    }
  }
}

export const newsApiService = new NewsApiService();
export default newsApiService;
