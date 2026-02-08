/**
 * Polymarket Wallet Tracker Types
 */

export interface TopWallet {
  address: string;
  displayName?: string;
  pnl7d: number;
  pnl30d: number;
  roi7d: number;
  roi30d: number;
  winRate7d: number;
  winRate30d: number;
  volume7d: number;
  volume30d: number;
  openPositions: number;
  lastActiveAt: string | null;
  syncedAt: string;
  rank7d: number;
  rank30d: number;
}

export interface WalletPosition {
  marketId: string;
  conditionId: string;
  tokenId: string;
  question: string;
  outcome: string;
  side: 'YES' | 'NO';
  size: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  value: number;
}

export interface WalletTrade {
  id: string;
  timestamp: string;
  marketId: string;
  question: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  fee: number;
  realizedPnl?: number;
}

export interface WalletStats {
  pnl7d: number;
  pnl30d: number;
  roi7d: number;
  roi30d: number;
  winRate7d: number;
  winRate30d: number;
  volume7d: number;
  volume30d: number;
  tradesCount7d: number;
  tradesCount30d: number;
  openPositionsCount: number;
  totalExposure: number;
  lastActiveAt: string | null;
}

export interface WalletDetails {
  address: string;
  stats: WalletStats;
  positions: WalletPosition[];
  recentTrades: WalletTrade[];
}

export interface TrackedWallet {
  address: string;
  nickname?: string;
  allocationUsd: number;
  weight: number;
  isActive: boolean;
  trackedAt: string;
  cachedPnl7d: number;
  cachedRoi7d: number;
  cachedWinRate: number;
  cachedPositionsCount: number;
  cachedLastActiveAt: string | null;
  currentValue: number;
  pnlContribution: number;
  lastSyncedAt: string;
}

export interface TrackedPortfolio {
  totalAllocation: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  weightedWinRate: number;
  trackedWallets: TrackedWallet[];
}

export interface TopWalletsResponse {
  success: boolean;
  wallets: TopWallet[];
  total: number;
  lastSyncedAt: string | null;
}

export interface WalletDetailsResponse {
  success: boolean;
  wallet: WalletDetails;
}

export interface PortfolioResponse {
  success: boolean;
  portfolio: TrackedPortfolio;
}

export interface TrackWalletResponse {
  success: boolean;
  trackedWallet: TrackedWallet;
}

export interface SyncResponse {
  success: boolean;
  walletsUpdated: number;
  syncedAt: string;
  errors?: string[];
}

export type SortOption = 'pnl7d' | 'pnl30d' | 'roi7d' | 'roi30d' | 'volume30d' | 'winRate7d';
export type TimeframeOption = '7d' | '30d';
