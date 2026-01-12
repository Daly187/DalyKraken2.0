/**
 * News Aggregator Service
 * Fetches and aggregates crypto news from multiple RSS feeds
 */

import RssParser from 'rss-parser';
import { Firestore } from 'firebase-admin/firestore';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceIcon: string;
  publishedAt: string;
  category: 'breaking' | 'analysis' | 'regulation' | 'defi' | 'nft' | 'general';
  imageUrl?: string;
  author?: string;
  fetchedAt: string;
}

interface RSSFeedConfig {
  name: string;
  url: string;
  icon: string;
}

const RSS_FEEDS: RSSFeedConfig[] = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    icon: 'https://www.coindesk.com/favicon.ico',
  },
  {
    name: 'Cointelegraph',
    url: 'https://cointelegraph.com/rss',
    icon: 'https://cointelegraph.com/favicon.ico',
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    icon: 'https://decrypt.co/favicon.ico',
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    icon: 'https://www.theblock.co/favicon.ico',
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/feed',
    icon: 'https://bitcoinmagazine.com/favicon.ico',
  },
];

// Keywords for categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  regulation: ['sec', 'regulation', 'regulatory', 'law', 'legal', 'court', 'lawsuit', 'ban', 'government', 'congress', 'senate', 'policy'],
  defi: ['defi', 'decentralized finance', 'lending', 'borrowing', 'liquidity', 'yield', 'staking', 'amm', 'dex', 'swap'],
  nft: ['nft', 'non-fungible', 'opensea', 'collectible', 'digital art', 'metaverse'],
  breaking: ['breaking', 'urgent', 'just in', 'alert', 'crash', 'surge', 'plunge', 'hack', 'exploit'],
  analysis: ['analysis', 'outlook', 'forecast', 'prediction', 'opinion', 'review', 'deep dive'],
};

export class NewsAggregatorService {
  private parser: RssParser;
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
    this.parser = new RssParser({
      timeout: 10000,
      headers: {
        'User-Agent': 'DalyKraken/2.0 News Aggregator',
      },
    });
  }

  /**
   * Fetch articles from all RSS feeds
   */
  async fetchAllFeeds(): Promise<NewsArticle[]> {
    console.log('[NewsAggregator] Fetching from all RSS feeds...');

    const allArticles: NewsArticle[] = [];
    const fetchPromises = RSS_FEEDS.map(feed => this.fetchFeed(feed));

    const results = await Promise.allSettled(fetchPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
        console.log(`[NewsAggregator] ✅ ${RSS_FEEDS[index].name}: ${result.value.length} articles`);
      } else {
        console.error(`[NewsAggregator] ❌ ${RSS_FEEDS[index].name}: ${result.reason}`);
      }
    });

    // Deduplicate and sort by date
    const deduplicated = this.deduplicateArticles(allArticles);
    deduplicated.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    console.log(`[NewsAggregator] Total: ${deduplicated.length} unique articles`);
    return deduplicated;
  }

  /**
   * Fetch articles from a single RSS feed
   */
  private async fetchFeed(feedConfig: RSSFeedConfig): Promise<NewsArticle[]> {
    try {
      const feed = await this.parser.parseURL(feedConfig.url);
      const now = new Date().toISOString();

      return (feed.items || []).slice(0, 20).map((item, index) => ({
        id: this.generateArticleId(feedConfig.name, item.link || '', index),
        title: item.title || 'Untitled',
        description: this.cleanDescription(item.contentSnippet || item.content || item.description || ''),
        url: item.link || '',
        source: feedConfig.name,
        sourceIcon: feedConfig.icon,
        publishedAt: item.pubDate || item.isoDate || now,
        category: this.categorizeArticle(item.title || '', item.contentSnippet || ''),
        imageUrl: this.extractImageUrl(item),
        author: item.creator || item.author,
        fetchedAt: now,
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch ${feedConfig.name}: ${error.message}`);
    }
  }

  /**
   * Generate a unique article ID
   */
  private generateArticleId(source: string, url: string, index: number): string {
    const hash = Buffer.from(url || `${source}-${index}`).toString('base64').slice(0, 12);
    return `${source.toLowerCase().replace(/\s+/g, '-')}-${hash}`;
  }

  /**
   * Clean HTML and truncate description
   */
  private cleanDescription(text: string): string {
    // Remove HTML tags
    let clean = text.replace(/<[^>]*>/g, '');
    // Decode HTML entities
    clean = clean.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    // Trim and truncate
    clean = clean.trim();
    if (clean.length > 300) {
      clean = clean.substring(0, 297) + '...';
    }
    return clean;
  }

  /**
   * Categorize article based on content
   */
  private categorizeArticle(title: string, content: string): NewsArticle['category'] {
    const text = `${title} ${content}`.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category as NewsArticle['category'];
      }
    }

    return 'general';
  }

  /**
   * Extract image URL from RSS item
   */
  private extractImageUrl(item: any): string | undefined {
    // Check common image fields
    if (item.enclosure?.url) return item.enclosure.url;
    if (item['media:content']?.$.url) return item['media:content'].$.url;
    if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;

    // Try to extract from content
    const imgMatch = (item.content || '').match(/<img[^>]+src="([^"]+)"/);
    if (imgMatch) return imgMatch[1];

    return undefined;
  }

  /**
   * Remove duplicate articles based on URL similarity
   */
  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Map<string, NewsArticle>();

    for (const article of articles) {
      // Normalize URL for comparison
      const normalizedUrl = article.url.toLowerCase()
        .replace(/\/$/, '')
        .replace(/\?.*$/, '');

      // Also check title similarity
      const normalizedTitle = article.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `${normalizedUrl}-${normalizedTitle.slice(0, 50)}`;

      if (!seen.has(key)) {
        seen.set(key, article);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Store articles for a specific date
   */
  async storeArticles(date: string, articles: NewsArticle[]): Promise<void> {
    console.log(`[NewsAggregator] Storing ${articles.length} articles for ${date}`);

    const batch = this.db.batch();
    const articlesRef = this.db.collection('dailyNews').doc(date).collection('articles');

    // Delete existing articles first
    const existing = await articlesRef.get();
    existing.docs.forEach(doc => batch.delete(doc.ref));

    // Add new articles
    for (const article of articles) {
      const docRef = articlesRef.doc(article.id);
      batch.set(docRef, article);
    }

    await batch.commit();
    console.log(`[NewsAggregator] Stored ${articles.length} articles for ${date}`);
  }

  /**
   * Get articles for a specific date
   */
  async getArticles(date: string, limit: number = 50): Promise<NewsArticle[]> {
    const snapshot = await this.db
      .collection('dailyNews')
      .doc(date)
      .collection('articles')
      .orderBy('publishedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as NewsArticle);
  }

  /**
   * Get available dates with news
   */
  async getAvailableDates(limit: number = 30): Promise<string[]> {
    const snapshot = await this.db
      .collection('dailyNews')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.id);
  }
}
