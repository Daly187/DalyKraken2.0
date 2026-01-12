/**
 * DalyKraken 2.0 - Backend Types
 */

export interface TradeCycle {
  cycleId: string;
  cycleNumber: number;
  cycleStartTime: string;
  cycleEndTime: string;
  entryCount: number;
  totalInvested: number;
  totalVolume: number;
  averageEntryPrice: number;
  exitPrice: number;
  exitTime: string;
  profit: number;
  profitPercent: number;
}

export interface DCABotConfig {
  id: string;
  userId: string;
  symbol: string;
  initialOrderAmount: number;
  tradeMultiplier: number;
  reEntryCount: number;
  stepPercent: number;
  stepMultiplier: number;
  tpTarget: number;
  exitPercentage: number; // Percentage of holdings to sell on exit (e.g., 90 = sell 90%, keep 10%)
  supportResistanceEnabled: boolean;
  reEntryDelay: number;
  trendAlignmentEnabled: boolean;
  status: 'active' | 'paused' | 'completed' | 'stopped' | 'exiting' | 'exit_pending' | 'exit_failed';
  createdAt: string;
  updatedAt: string;
  // Cycle tracking fields
  cycleId?: string;
  cycleStartTime?: string;
  cycleNumber?: number;
  previousCycles?: TradeCycle[];
  // Exit failure tracking
  exitFailureReason?: string;
  exitFailureTime?: string;
  exitAttempts?: number;
  lastExitAttempt?: string;
  // Price caching for UI display (updated during bot processing)
  lastKnownPrice?: number;
  priceLastUpdated?: string;
  // Market trend field - calculated from Crypto Trends page data
  market_trend?: 'bullish' | 'bearish' | 'neutral';
  market_trend_updated?: string; // ISO timestamp of last update
}

export interface LiveDCABot extends DCABotConfig {
  currentEntryCount: number;
  averagePurchasePrice: number;
  totalInvested: number;
  totalQuantity: number; // Total crypto holdings across all filled entries
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  lastEntryTime: string | null;
  nextEntryPrice: number | null;
  currentTpPrice: number | null;
  entries: DCABotEntry[];
  techScore: number;
  trendScore: number;
  recommendation?: 'bullish' | 'bearish' | 'neutral';
  support: number | null;
  resistance: number | null;
  currentSupport?: number;
  currentResistance?: number;
  nextSupport?: number;
}

export interface DCABotEntry {
  id: string;
  botId: string;
  entryNumber: number;
  orderAmount: number;
  price: number;
  quantity: number;
  timestamp: string;
  orderId?: string;
  status: 'pending' | 'filled' | 'failed';
  txid?: string;
  // Cycle tracking fields
  cycleId?: string;
  cycleNumber?: number;
  source?: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface TrendAnalysis {
  symbol: string;
  techScore: number;
  trendScore: number;
  support: number | null;
  resistance: number | null;
  recommendation: 'bullish' | 'bearish' | 'neutral';
  timestamp: string;
}

export interface KrakenCredentials {
  userId: string;
  apiKey: string;
  apiSecret: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface BotExecutionLog {
  id: string;
  botId: string;
  action: 'entry' | 'exit' | 'partial_exit';
  symbol: string;
  price: number;
  quantity: number;
  amount: number;
  entryNumber?: number;
  reason: string;
  techScore: number;
  trendScore: number;
  timestamp: string;
  success: boolean;
  error?: string;
  orderId?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}
