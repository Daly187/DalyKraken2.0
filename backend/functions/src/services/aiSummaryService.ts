/**
 * AI Summary Service
 * Generates daily crypto market summaries using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import { Firestore } from 'firebase-admin/firestore';
import { NewsArticle } from './newsAggregatorService.js';
import { MarketOverview } from './newsMarketDataService.js';

export interface AISummary {
  title: string;
  summary: string;
  bulletPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  generatedAt: string;
  model: string;
}

export class AISummaryService {
  private db: Firestore;
  private anthropic: Anthropic | null = null;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Initialize Anthropic client with API key from settings
   */
  private async getAnthropicClient(): Promise<Anthropic> {
    if (this.anthropic) {
      return this.anthropic;
    }

    // Try to get API key from Firestore settings
    const settingsDoc = await this.db.collection('settings').doc('ai').get();
    const apiKey = settingsDoc.data()?.anthropicApiKey;

    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please add it in Settings.');
    }

    this.anthropic = new Anthropic({ apiKey });
    return this.anthropic;
  }

  /**
   * Generate a daily summary from articles and market data
   */
  async generateDailySummary(
    articles: NewsArticle[],
    marketData: MarketOverview
  ): Promise<AISummary> {
    console.log('[AISummary] Generating daily summary...');

    const prompt = this.buildSummaryPrompt(articles, marketData);

    try {
      const client = await this.getAnthropicClient();

      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const parsed = this.parseAIResponse(content.text);

      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
        model: 'claude-3-haiku',
      };
    } catch (error: any) {
      console.error('[AISummary] Error generating summary:', error.message);

      // Return a fallback summary based on market data
      return this.generateFallbackSummary(articles, marketData);
    }
  }

  /**
   * Build the prompt for the AI summarization
   */
  private buildSummaryPrompt(articles: NewsArticle[], marketData: MarketOverview): string {
    // Take top 15 most recent articles
    const topArticles = articles.slice(0, 15);

    const articlesList = topArticles
      .map((a, i) => `${i + 1}. [${a.source}] ${a.title}`)
      .join('\n');

    const topGainer = marketData.topGainers[0];
    const topLoser = marketData.topLosers[0];

    return `You are a crypto market analyst providing a daily briefing for traders. Based on today's news and market data, write a concise summary.

TODAY'S TOP HEADLINES:
${articlesList}

MARKET DATA:
- Fear & Greed Index: ${marketData.fearGreedIndex} (${marketData.fearGreedLabel})
- BTC Dominance: ${marketData.btcDominance.toFixed(1)}%
- Total Market Cap: $${(marketData.totalMarketCap / 1e12).toFixed(2)}T
- 24h Volume: $${(marketData.totalVolume24h / 1e9).toFixed(1)}B
- Market Cap Change (24h): ${marketData.marketCapChange24h >= 0 ? '+' : ''}${marketData.marketCapChange24h.toFixed(2)}%
${topGainer ? `- Top Gainer: ${topGainer.symbol} (${topGainer.changePercent24h >= 0 ? '+' : ''}${topGainer.changePercent24h.toFixed(1)}%)` : ''}
${topLoser ? `- Top Loser: ${topLoser.symbol} (${topLoser.changePercent24h.toFixed(1)}%)` : ''}

Please provide your response in EXACTLY this format:

TITLE: [A compelling 5-10 word headline summarizing today's market]

SUMMARY:
[2-3 paragraphs summarizing the key developments traders need to know. Focus on actionable insights and what's driving the market today.]

BULLET_POINTS:
- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]
- [Key takeaway 4 if relevant]
- [Key takeaway 5 if relevant]

SENTIMENT: [bullish/bearish/neutral]`;
  }

  /**
   * Parse the AI response into structured data
   */
  private parseAIResponse(text: string): Omit<AISummary, 'generatedAt' | 'model'> {
    // Extract title
    const titleMatch = text.match(/TITLE:\s*(.+?)(?=\n|SUMMARY:)/is);
    const title = titleMatch ? titleMatch[1].trim() : 'Daily Crypto Market Update';

    // Extract summary
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+?)(?=BULLET_POINTS:|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : text.slice(0, 500);

    // Extract bullet points
    const bulletMatch = text.match(/BULLET_POINTS:\s*([\s\S]+?)(?=SENTIMENT:|$)/i);
    let bulletPoints: string[] = [];
    if (bulletMatch) {
      bulletPoints = bulletMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(point => point.length > 0);
    }

    // Extract sentiment
    const sentimentMatch = text.match(/SENTIMENT:\s*(bullish|bearish|neutral)/i);
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (sentimentMatch) {
      sentiment = sentimentMatch[1].toLowerCase() as 'bullish' | 'bearish' | 'neutral';
    }

    return { title, summary, bulletPoints, sentiment };
  }

  /**
   * Generate a fallback summary when AI is unavailable
   */
  private generateFallbackSummary(
    articles: NewsArticle[],
    marketData: MarketOverview
  ): AISummary {
    const fearGreedText = marketData.fearGreedIndex >= 60 ? 'showing optimism' :
      marketData.fearGreedIndex <= 40 ? 'showing caution' : 'neutral';

    const marketTrend = marketData.marketCapChange24h >= 2 ? 'rallying' :
      marketData.marketCapChange24h <= -2 ? 'declining' : 'trading sideways';

    const title = `Crypto Markets ${marketData.marketCapChange24h >= 0 ? 'Up' : 'Down'} ${Math.abs(marketData.marketCapChange24h).toFixed(1)}% - ${marketData.fearGreedLabel}`;

    const topGainer = marketData.topGainers[0];
    const topLoser = marketData.topLosers[0];

    const summary = `The cryptocurrency market is ${marketTrend} today with the total market cap ${marketData.marketCapChange24h >= 0 ? 'increasing' : 'decreasing'} by ${Math.abs(marketData.marketCapChange24h).toFixed(2)}%. The Fear & Greed Index sits at ${marketData.fearGreedIndex}, indicating the market is ${fearGreedText}.

Bitcoin dominance stands at ${marketData.btcDominance.toFixed(1)}%, with total 24-hour trading volume reaching $${(marketData.totalVolume24h / 1e9).toFixed(1)} billion across all exchanges.${topGainer ? ` Leading today's gainers is ${topGainer.symbol} with a ${topGainer.changePercent24h.toFixed(1)}% gain.` : ''}`;

    const bulletPoints = [
      `Fear & Greed Index: ${marketData.fearGreedIndex} (${marketData.fearGreedLabel})`,
      `Total market cap: $${(marketData.totalMarketCap / 1e12).toFixed(2)} trillion`,
      `BTC dominance: ${marketData.btcDominance.toFixed(1)}%`,
    ];

    if (topGainer) {
      bulletPoints.push(`Top gainer: ${topGainer.symbol} (+${topGainer.changePercent24h.toFixed(1)}%)`);
    }
    if (topLoser) {
      bulletPoints.push(`Top loser: ${topLoser.symbol} (${topLoser.changePercent24h.toFixed(1)}%)`);
    }

    const sentiment: 'bullish' | 'bearish' | 'neutral' =
      marketData.fearGreedIndex >= 55 && marketData.marketCapChange24h >= 1 ? 'bullish' :
      marketData.fearGreedIndex <= 45 && marketData.marketCapChange24h <= -1 ? 'bearish' :
      'neutral';

    return {
      title,
      summary,
      bulletPoints,
      sentiment,
      generatedAt: new Date().toISOString(),
      model: 'fallback-template',
    };
  }

  /**
   * Store AI summary for a specific date
   */
  async storeSummary(date: string, summary: AISummary): Promise<void> {
    console.log(`[AISummary] Storing summary for ${date}`);

    await this.db.collection('dailyNews').doc(date).set({
      date,
      aiSummary: summary,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  /**
   * Get stored summary for a date
   */
  async getStoredSummary(date: string): Promise<AISummary | null> {
    const doc = await this.db.collection('dailyNews').doc(date).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data()?.aiSummary || null;
  }
}
