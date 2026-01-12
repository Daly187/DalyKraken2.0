/**
 * News & Updates Types
 */

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

export interface TopMover {
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number;
  volume24h: number;
  image?: string;
}

export interface MarketOverview {
  fearGreedIndex: number;
  fearGreedLabel: string;
  btcDominance: number;
  totalMarketCap: number;
  totalVolume24h: number;
  marketCapChange24h: number;
  topGainers: TopMover[];
  topLosers: TopMover[];
  timestamp: string;
}

export interface AISummary {
  title: string;
  summary: string;
  bulletPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  generatedAt: string;
  model: string;
}

export interface WhaleAlert {
  id: string;
  txHash: string;
  blockchain: string;
  from: string;
  fromLabel?: string;
  to: string;
  toLabel?: string;
  amount: number;
  amountUsd: number;
  symbol: string;
  type: 'transfer' | 'exchange_deposit' | 'exchange_withdrawal' | 'unknown';
  timestamp: string;
  significance: 'high' | 'medium' | 'low';
}

export interface AirdropEvent {
  id: string;
  name: string;
  projectName: string;
  type: 'airdrop' | 'token_unlock' | 'launch' | 'fork' | 'upgrade';
  description: string;
  estimatedValue?: string;
  startDate: string;
  endDate?: string;
  requirements?: string[];
  eligibilityUrl?: string;
  projectUrl?: string;
  twitterUrl?: string;
  status: 'upcoming' | 'active' | 'ended';
  verified: boolean;
}

export interface DailyNewsData {
  date: string;
  aiSummary: AISummary | null;
  marketOverview: MarketOverview | null;
  articles: NewsArticle[];
  whaleAlerts: WhaleAlert[];
  airdrops: AirdropEvent[];
}

export interface FearGreedData {
  value: number;
  label: string;
  timestamp: string;
  previousClose?: number;
  change?: number;
}
