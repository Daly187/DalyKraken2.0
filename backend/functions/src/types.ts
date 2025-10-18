/**
 * DalyKraken 2.0 - Backend Types
 */

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
  supportResistanceEnabled: boolean;
  reEntryDelay: number;
  trendAlignmentEnabled: boolean;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  createdAt: string;
  updatedAt: string;
}

export interface LiveDCABot extends DCABotConfig {
  currentEntryCount: number;
  averagePurchasePrice: number;
  totalInvested: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  lastEntryTime: string | null;
  nextEntryPrice: number | null;
  currentTpPrice: number | null;
  entries: DCABotEntry[];
  techScore: number;
  trendScore: number;
  support: number | null;
  resistance: number | null;
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
