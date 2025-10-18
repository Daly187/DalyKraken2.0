// Core types for DalyKraken 2.0

export interface User {
  id: string;
  username: string;
  email?: string;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  marginLevel: number;
  openOrdersCount: number;
  lastUpdate: string;
}

export interface Holding {
  symbol: string;
  asset: string;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  profitLoss: number;
  profitLossPercent: number;
  allocation: number;
}

export interface Portfolio {
  totalValue: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  holdings: Holding[];
  lastUpdate: string;
}

export interface LivePrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface OHLCData {
  symbol: string;
  interval: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  pair: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  spread: number;
  ohlc?: OHLCData[];
  lastUpdate: number;
}

export interface TrendData {
  symbol: string;
  trendScore: number;
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  support: number;
  resistance: number;
  volatility: number;
  momentum: number;
}

export interface EnhancedTrend extends TrendData {
  rsi: number;
  macd: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface DCAStatus {
  isRunning: boolean;
  isPaused: boolean;
  lastExecution: string | null;
  nextExecution: string | null;
  totalDeployed: number;
  totalOrders: number;
  successRate: number;
  recoveryMode: boolean;
}

export interface DCAConfig {
  enabled: boolean;
  interval: string;
  amount: number;
  maxOrders: number;
  minScore: number;
  timeGraph: string;
}

export interface ScanResult {
  symbol: string;
  score: number;
  signals: {
    trend: number;
    momentum: number;
    volume: number;
    volatility: number;
  };
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
}

export interface BotScore {
  symbol: string;
  score: number;
  rank: number;
  lastUpdate: string;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
  symbol: string;
  amount: number;
  price: number;
  fee: number;
  total: number;
  timestamp: string;
  orderId?: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface AuditSummary {
  totalTransactions: number;
  totalBuys: number;
  totalSells: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalFees: number;
  netProfitLoss: number;
}

export interface DCADeployment {
  id: string;
  symbol: string;
  amount: number;
  price: number;
  score: number;
  timestamp: string;
  status: 'pending' | 'executed' | 'failed';
  orderId?: string;
}

// DCA Bot Configuration
export interface DCABotConfig {
  id: string;
  symbol: string;
  initialOrderAmount: number;
  tradeMultiplier: number; // Default 2x
  reEntryCount: number; // Default 8
  stepPercent: number; // Default 1%
  stepMultiplier: number; // Default 2x
  tpTarget: number; // Default 3% (minimum TP based on average purchase price)
  supportResistanceEnabled: boolean; // Default false
  reEntryDelay: number; // Default 888 minutes
  trendAlignmentEnabled: boolean; // Default true
  status: 'active' | 'paused' | 'completed' | 'stopped';
  createdAt: string;
  updatedAt: string;
}

// Live DCA Bot (active bot with execution data)
export interface LiveDCABot extends DCABotConfig {
  currentEntryCount: number; // How many entries have been made
  averagePurchasePrice: number; // Average price of all entries
  totalInvested: number; // Total amount invested so far
  currentPrice: number; // Current market price
  unrealizedPnL: number; // Unrealized profit/loss
  unrealizedPnLPercent: number; // Unrealized profit/loss percentage
  lastEntryTime: string | null; // When the last entry was made
  nextEntryPrice: number | null; // Price level for next entry
  currentTpPrice: number | null; // Current take profit price
  entries: DCABotEntry[]; // All entries made by this bot
  techScore: number; // Technical score (bullish/bearish)
  trendScore: number; // Trend score (bullish/bearish)
  support: number | null; // Support level (legacy)
  resistance: number | null; // Resistance level (legacy)
  currentSupport?: number; // Current support level
  currentResistance?: number; // Current resistance level
  nextSupport?: number; // Next support level below current
}

// Individual entry made by a DCA bot
export interface DCABotEntry {
  id: string;
  botId: string;
  entryNumber: number; // 1st, 2nd, 3rd entry, etc.
  orderAmount: number; // Amount of this specific order
  price: number; // Price at which this entry was made
  quantity: number; // Quantity purchased
  timestamp: string;
  orderId?: string; // Kraken order ID
  status: 'pending' | 'filled' | 'failed';
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  secret: string;
  isActive: boolean;
  isPrimary: boolean;
  lastUsed: string | null;
}

export interface SystemStatus {
  wsConnected: boolean;
  apiAvailable: boolean;
  cacheAvailable: boolean;
  snapshotAvailable: boolean;
  krakenConnected: boolean;
  lastHealthCheck: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface RiskStatus {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  exposurePercent: number;
  concentrationRisk: number;
  liquidityRisk: number;
  warnings: string[];
  lastUpdate: string;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface WSRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
}

export interface WSResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}
