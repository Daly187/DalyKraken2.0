// Polymarket Auto-Betting Types

export interface PolymarketMarket {
  id: string;
  conditionId: string;
  questionId: string;
  question: string;
  description: string;
  outcomes: PolymarketOutcome[];
  endDate: string;
  volume: number;
  liquidity: number;
  category: string;
  status: 'active' | 'resolved' | 'cancelled';
  resolutionSource?: string;
  slug: string;
}

export interface PolymarketOutcome {
  id: string;
  name: string;
  price: number; // 0-1 probability
  tokenId: string;
}

export interface PolymarketConfig {
  id?: string;
  userId: string;
  enabled: boolean;
  scanIntervalMinutes: number; // 15, 30, 60

  // Strategy Settings
  timeframeHours: number; // Markets closing within X hours
  minProbability: number; // Default 0.80
  maxProbability: number; // Default 0.95
  contrarianMode: boolean; // Bet against heavy favorites
  contrarianThreshold: number; // Default 0.95
  closeDate?: string; // Optional target close date (YYYY-MM-DD)

  // Market Scope
  marketScopeLimit: number; // Top N markets by volume
  minVolume: number; // Minimum volume in USD
  minLiquidity?: number; // Minimum liquidity in USD
  categories: string[]; // Filter by categories (empty = all)

  // Exit Strategy
  takeProfitPercent?: number; // Auto-close when PnL reaches this %
  stopLossPercent?: number; // Auto-close when PnL drops below this %

  // Bet Sizing
  betSizeMode: 'fixed' | 'percentage';
  fixedBetAmount: number; // $ per bet
  percentageBetAmount: number; // % of bankroll per bet
  maxBetPercent: number; // Max % of bankroll at risk
  maxDailyBets: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface PolymarketPosition {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcomeId: string;
  outcomeName: string;
  side: 'yes' | 'no';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  cost: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  endDate: string;
  status: 'open' | 'resolved';
}

export interface PolymarketBet {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcomeId: string;
  outcomeName: string;
  side: 'yes' | 'no';
  shares: number;
  price: number;
  amount: number; // USDC spent
  orderId?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'resolved';
  strategy: 'probability' | 'contrarian' | 'manual' | 'external';
  profit?: number;
  profitPercent?: number;
  createdAt: string;
  filledAt?: string;
  resolvedAt?: string;
}

export interface PolymarketStats {
  totalBets: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  totalInvested: number;
  totalReturned: number;
  totalProfit: number;
  roi: number;
  avgBetSize: number;
  bestBet: number;
  worstBet: number;
  currentExposure: number;
}

export interface PolymarketExecution {
  id: string;
  userId: string;
  action: 'scan' | 'bet' | 'resolution' | 'error';
  marketId?: string;
  betId?: string;
  marketsScanned?: number;
  opportunitiesFound?: number;
  betsPlaced?: number;
  result?: any;
  error?: string;
  timestamp: string;
}

export interface PolymarketOpportunity {
  market: PolymarketMarket;
  recommendedSide: 'yes' | 'no';
  probability: number;
  strategy: 'probability' | 'contrarian';
  hoursToClose: number;
  suggestedAmount: number;
}

export interface PolymarketScanResult {
  timestamp: string;
  marketsScanned: number;
  opportunities: PolymarketOpportunity[];
  betsPlaced: PolymarketBet[];
  errors: string[];
}

// Default configuration
export const DEFAULT_POLYMARKET_CONFIG: Omit<PolymarketConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  enabled: false,
  scanIntervalMinutes: 60,
  timeframeHours: 24,
  minProbability: 0.75,
  maxProbability: 0.95,
  contrarianMode: false,
  contrarianThreshold: 0.95,
  closeDate: undefined,
  marketScopeLimit: 100,
  minVolume: 10000,
  minLiquidity: 5000,
  categories: [],
  takeProfitPercent: 5,
  stopLossPercent: 10,
  betSizeMode: 'fixed',
  fixedBetAmount: 10,
  percentageBetAmount: 2,
  maxBetPercent: 25,
  maxDailyBets: 10,
};
