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
