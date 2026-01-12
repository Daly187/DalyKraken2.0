import { useEffect, useState } from 'react';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Activity,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  DollarSign,
  Percent,
  Zap,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { newsApiService } from '@/services/newsApiService';
import DateNavigator from '@/components/news/DateNavigator';
import FearGreedGauge from '@/components/news/FearGreedGauge';
import type { DailyNewsData, NewsArticle, TopMover, MarketOverview } from '@/types/news';

// Category badge styles
const getCategoryStyle = (category: NewsArticle['category']) => {
  const styles: Record<string, string> = {
    breaking: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    analysis: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    regulation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    defi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    nft: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
    general: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  };
  return styles[category] || styles.general;
};

// Format large numbers
const formatNumber = (num: number, decimals = 2) => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(decimals)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
  return `$${num.toLocaleString()}`;
};

// Format time ago
const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function News() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [newsData, setNewsData] = useState<DailyNewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section collapse states
  const [sectionsExpanded, setSectionsExpanded] = useState({
    summary: true,
    market: true,
    news: false,
    whale: false,
    airdrops: false,
  });

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Load available dates on mount
  useEffect(() => {
    loadAvailableDates();
  }, []);

  // Load news data when date changes
  useEffect(() => {
    loadNewsData(selectedDate);
  }, [selectedDate]);

  const loadAvailableDates = async () => {
    try {
      const dates = await newsApiService.getAvailableDates(30);
      setAvailableDates(dates);
    } catch (err) {
      console.error('Failed to load available dates:', err);
    }
  };

  const loadNewsData = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await newsApiService.getNewsForDate(date);
      setNewsData(data);
    } catch (err: any) {
      // If no data for this date, try to get latest
      if (err?.response?.status === 404) {
        try {
          const latestData = await newsApiService.getLatestNews();
          if (latestData) {
            setNewsData(latestData);
            setSelectedDate(latestData.date);
          } else {
            setError('No news data available yet. Click Refresh to fetch the latest news.');
          }
        } catch {
          setError('No news data available yet. Click Refresh to fetch the latest news.');
        }
      } else {
        setError('Failed to load news data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await newsApiService.refreshNews();
      await loadNewsData(selectedDate);
      await loadAvailableDates();
    } catch (err: any) {
      setError('Failed to refresh news: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Section header component
  const SectionHeader = ({
    title,
    icon: Icon,
    expanded,
    onToggle,
    badge,
  }: {
    title: string;
    icon: any;
    expanded: boolean;
    onToggle: () => void;
    badge?: string | number;
  }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
          <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
        <span className="text-lg font-semibold text-slate-900 dark:text-white">{title}</span>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
            {badge}
          </span>
        )}
      </div>
      {expanded ? (
        <ChevronUp className="h-5 w-5 text-slate-400" />
      ) : (
        <ChevronDown className="h-5 w-5 text-slate-400" />
      )}
    </button>
  );

  // Top Mover Card
  const TopMoverCard = ({ mover, isGainer }: { mover: TopMover; isGainer: boolean }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      {mover.image && (
        <img src={mover.image} alt={mover.symbol} className="w-8 h-8 rounded-full" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 dark:text-white text-sm">{mover.symbol}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{mover.name}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          ${mover.price < 1 ? mover.price.toFixed(4) : mover.price.toFixed(2)}
        </div>
        <div className={`text-xs font-medium ${isGainer ? 'text-green-500' : 'text-red-500'}`}>
          {isGainer ? '+' : ''}{mover.changePercent24h.toFixed(1)}%
        </div>
      </div>
    </div>
  );

  // News Article Card
  const ArticleCard = ({ article }: { article: NewsArticle }) => (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <img
            src={article.sourceIcon}
            alt={article.source}
            className="w-6 h-6 rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/24?text=📰';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {article.title}
            </h4>
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
            {article.description}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">{article.source}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{formatTimeAgo(article.publishedAt)}</span>
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded capitalize ${getCategoryStyle(article.category)}`}>
              {article.category}
            </span>
          </div>
        </div>
      </div>
    </a>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
            <Newspaper className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              News & Updates
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Daily crypto news, market data, and AI-powered summaries
            </p>
          </div>
        </div>

        <DateNavigator
          selectedDate={selectedDate}
          availableDates={availableDates}
          onDateChange={setSelectedDate}
          onRefresh={handleRefresh}
          loading={loading}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-amber-700 dark:text-amber-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !newsData && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary Section */}
      {newsData?.aiSummary && (
        <div className="bg-gradient-to-br from-primary-500/10 via-purple-500/10 to-pink-500/10 dark:from-primary-900/30 dark:via-purple-900/30 dark:to-pink-900/30 rounded-xl border border-primary-200/50 dark:border-primary-800/50 overflow-hidden">
          <button
            onClick={() => toggleSection('summary')}
            className="w-full p-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <Sparkles className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  AI Daily Summary
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Powered by {newsData.aiSummary.model}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                newsData.aiSummary.sentiment === 'bullish'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : newsData.aiSummary.sentiment === 'bearish'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {newsData.aiSummary.sentiment.charAt(0).toUpperCase() + newsData.aiSummary.sentiment.slice(1)}
              </span>
              {sectionsExpanded.summary ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </button>

          {sectionsExpanded.summary && (
            <div className="px-6 pb-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {newsData.aiSummary.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {newsData.aiSummary.summary}
              </p>
              {newsData.aiSummary.bulletPoints.length > 0 && (
                <ul className="space-y-2">
                  {newsData.aiSummary.bulletPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary-500 mt-1">•</span>
                      <span className="text-slate-600 dark:text-slate-300">{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Generated: {new Date(newsData.aiSummary.generatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Market Overview Section */}
      {newsData?.marketOverview && (
        <div>
          <SectionHeader
            title="Market Overview"
            icon={BarChart3}
            expanded={sectionsExpanded.market}
            onToggle={() => toggleSection('market')}
          />

          {sectionsExpanded.market && (
            <div className="mt-4 space-y-4">
              {/* Fear & Greed + Key Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Fear & Greed Gauge */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center">
                  <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Fear & Greed Index</h4>
                  <FearGreedGauge
                    value={newsData.marketOverview.fearGreedIndex}
                    label={newsData.marketOverview.fearGreedLabel}
                    size="md"
                  />
                </div>

                {/* Key Metrics */}
                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Market Cap</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {formatNumber(newsData.marketOverview.totalMarketCap)}
                    </div>
                    <div className={`text-sm ${newsData.marketOverview.marketCapChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {newsData.marketOverview.marketCapChange24h >= 0 ? '+' : ''}{newsData.marketOverview.marketCapChange24h.toFixed(2)}%
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">24h Volume</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {formatNumber(newsData.marketOverview.totalVolume24h)}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">BTC Dominance</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {newsData.marketOverview.btcDominance.toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Updated</span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatTimeAgo(newsData.marketOverview.timestamp)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Gainers & Losers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Gainers */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <h4 className="font-semibold text-slate-900 dark:text-white">Top Gainers</h4>
                  </div>
                  <div className="space-y-2">
                    {newsData.marketOverview.topGainers.slice(0, 5).map((mover) => (
                      <TopMoverCard key={mover.symbol} mover={mover} isGainer={true} />
                    ))}
                  </div>
                </div>

                {/* Top Losers */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <h4 className="font-semibold text-slate-900 dark:text-white">Top Losers</h4>
                  </div>
                  <div className="space-y-2">
                    {newsData.marketOverview.topLosers.slice(0, 5).map((mover) => (
                      <TopMoverCard key={mover.symbol} mover={mover} isGainer={false} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Breaking News Section */}
      {newsData?.articles && newsData.articles.length > 0 && (
        <div>
          <SectionHeader
            title="Breaking News"
            icon={Zap}
            expanded={sectionsExpanded.news}
            onToggle={() => toggleSection('news')}
            badge={newsData.articles.length}
          />

          {sectionsExpanded.news && (
            <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
                {newsData.articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Data State */}
      {!loading && !newsData && !error && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Newspaper className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No News Available
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Click the Refresh button to fetch the latest crypto news and market data.
          </p>
        </div>
      )}
    </div>
  );
}
