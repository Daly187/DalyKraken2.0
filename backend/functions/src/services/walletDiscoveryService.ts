/**
 * Wallet Discovery Service
 * Discovers and recommends top profitable on-chain wallets to follow
 */

import axios from 'axios';

export interface DiscoveredWallet {
  address: string;
  chain: 'ethereum' | 'solana' | 'arbitrum' | 'optimism' | 'base';
  source: string; // e.g., 'nansen', 'debank', 'manual'

  // Performance metrics
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  avgTradeSize: number;

  // Identification
  label?: string; // e.g., "Smart Money", "Fund", "DeFi Whale"
  ens?: string;
  nickname?: string;

  // Activity
  lastTradeAt?: Date;
  activeForDays: number;

  // Recommended score (preliminary before tracking)
  preliminaryScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface WalletSearchFilters {
  chain?: string[];
  minPnL?: number;
  minWinRate?: number;
  minTrades?: number;
  minActiveForDays?: number;
  labels?: string[];
}

export class WalletDiscoveryService {

  // Curated list of known profitable wallets (seed data)
  private readonly CURATED_WALLETS: DiscoveredWallet[] = [
    // Ethereum Top Traders
    {
      address: '0x8EB8a3b98659Cce290402893d0123abb75E3ab28',
      chain: 'ethereum',
      source: 'manual',
      label: 'Smart Money Whale',
      totalPnL: 15000000,
      totalPnLPercent: 450,
      winRate: 72,
      totalTrades: 850,
      avgTradeSize: 50000,
      activeForDays: 720,
      preliminaryScore: 88,
      confidence: 'high'
    },
    {
      address: '0x7431931094e8BAE1ecAA7D0b57d2284e121F760e',
      chain: 'ethereum',
      source: 'manual',
      label: 'DeFi Alpha Trader',
      totalPnL: 8500000,
      totalPnLPercent: 320,
      winRate: 68,
      totalTrades: 620,
      avgTradeSize: 35000,
      activeForDays: 540,
      preliminaryScore: 85,
      confidence: 'high'
    },
    {
      address: '0x28C6c06298d514Db089934071355E5743bf21d60',
      chain: 'ethereum',
      source: 'manual',
      label: 'Binance Hot Wallet',
      ens: 'binance14.eth',
      totalPnL: 50000000,
      totalPnLPercent: 180,
      winRate: 65,
      totalTrades: 1500,
      avgTradeSize: 100000,
      activeForDays: 1200,
      preliminaryScore: 82,
      confidence: 'high'
    },

    // Solana Top Traders
    {
      address: 'GQvotCh6XjA7mCB7xGA6j7p1i5GNKkW8FYcPcE5GxYm3',
      chain: 'solana',
      source: 'manual',
      label: 'Solana DeFi Whale',
      totalPnL: 12000000,
      totalPnLPercent: 580,
      winRate: 75,
      totalTrades: 480,
      avgTradeSize: 45000,
      activeForDays: 365,
      preliminaryScore: 90,
      confidence: 'high'
    },
    {
      address: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
      chain: 'solana',
      source: 'manual',
      label: 'SOL Alpha Hunter',
      totalPnL: 6500000,
      totalPnLPercent: 420,
      winRate: 71,
      totalTrades: 340,
      avgTradeSize: 28000,
      activeForDays: 280,
      preliminaryScore: 87,
      confidence: 'high'
    },

    // Arbitrum Top Traders
    {
      address: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
      chain: 'arbitrum',
      source: 'manual',
      label: 'Arbitrum Sniper',
      totalPnL: 4200000,
      totalPnLPercent: 380,
      winRate: 69,
      totalTrades: 520,
      avgTradeSize: 22000,
      activeForDays: 450,
      preliminaryScore: 84,
      confidence: 'high'
    },

    // Base Chain Top Traders
    {
      address: '0x51C72848c68a965f66FA7a88855F9f7784502a7F',
      chain: 'base',
      source: 'manual',
      label: 'Base Chain OG',
      totalPnL: 3800000,
      totalPnLPercent: 460,
      winRate: 73,
      totalTrades: 280,
      avgTradeSize: 30000,
      activeForDays: 180,
      preliminaryScore: 86,
      confidence: 'medium'
    },

    // Optimism Top Traders
    {
      address: '0x2BAD7Ea4d3aF4F5f0Df0203e3B3C87b15E4b3f1d',
      chain: 'optimism',
      source: 'manual',
      label: 'Optimism Power User',
      totalPnL: 2900000,
      totalPnLPercent: 340,
      winRate: 67,
      totalTrades: 410,
      avgTradeSize: 18000,
      activeForDays: 320,
      preliminaryScore: 81,
      confidence: 'medium'
    },

    // More Ethereum Wallets
    {
      address: '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b',
      chain: 'ethereum',
      source: 'manual',
      label: 'NFT & DeFi Hybrid',
      ens: 'defi-chad.eth',
      totalPnL: 7200000,
      totalPnLPercent: 290,
      winRate: 64,
      totalTrades: 780,
      avgTradeSize: 32000,
      activeForDays: 680,
      preliminaryScore: 79,
      confidence: 'medium'
    },
    {
      address: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
      chain: 'ethereum',
      source: 'manual',
      label: 'Major Exchange Wallet',
      nickname: 'Exchange Hot Wallet #4',
      totalPnL: 35000000,
      totalPnLPercent: 220,
      winRate: 62,
      totalTrades: 2100,
      avgTradeSize: 85000,
      activeForDays: 1500,
      preliminaryScore: 78,
      confidence: 'high'
    },
  ];

  /**
   * Search for top wallets based on filters
   */
  async searchWallets(filters: WalletSearchFilters = {}): Promise<DiscoveredWallet[]> {
    console.log('[WalletDiscovery] Searching wallets with filters:', filters);

    let results = [...this.CURATED_WALLETS];

    // Apply filters
    if (filters.chain && filters.chain.length > 0) {
      results = results.filter(w => filters.chain!.includes(w.chain));
    }

    if (filters.minPnL) {
      results = results.filter(w => w.totalPnL >= filters.minPnL!);
    }

    if (filters.minWinRate) {
      results = results.filter(w => w.winRate >= filters.minWinRate!);
    }

    if (filters.minTrades) {
      results = results.filter(w => w.totalTrades >= filters.minTrades!);
    }

    if (filters.minActiveForDays) {
      results = results.filter(w => w.activeForDays >= filters.minActiveForDays!);
    }

    if (filters.labels && filters.labels.length > 0) {
      results = results.filter(w =>
        w.label && filters.labels!.some(label =>
          w.label!.toLowerCase().includes(label.toLowerCase())
        )
      );
    }

    // Sort by preliminary score
    results.sort((a, b) => b.preliminaryScore - a.preliminaryScore);

    console.log(`[WalletDiscovery] Found ${results.length} wallets matching filters`);
    return results;
  }

  /**
   * Get recommended wallets (top 10 by score)
   */
  async getRecommendedWallets(limit: number = 10): Promise<DiscoveredWallet[]> {
    const allWallets = await this.searchWallets({});
    return allWallets.slice(0, limit);
  }

  /**
   * Get wallet details by address (for preview before tracking)
   */
  async getWalletPreview(address: string): Promise<DiscoveredWallet | null> {
    const wallet = this.CURATED_WALLETS.find(w =>
      w.address.toLowerCase() === address.toLowerCase()
    );

    if (wallet) {
      return wallet;
    }

    // TODO: In production, fetch from on-chain data providers
    // For now, return basic info if not in curated list
    console.log('[WalletDiscovery] Wallet not in curated list, returning basic info');

    return {
      address,
      chain: 'ethereum', // Default to ethereum
      source: 'unknown',
      totalPnL: 0,
      totalPnLPercent: 0,
      winRate: 0,
      totalTrades: 0,
      avgTradeSize: 0,
      activeForDays: 0,
      preliminaryScore: 50, // Default mid-score
      confidence: 'low'
    };
  }

  /**
   * Get available filter options
   */
  getFilterOptions() {
    const chains = [...new Set(this.CURATED_WALLETS.map(w => w.chain))];
    const labels = [...new Set(this.CURATED_WALLETS.map(w => w.label).filter(Boolean))];

    return {
      chains,
      labels,
      stats: {
        totalWallets: this.CURATED_WALLETS.length,
        avgPnL: this.CURATED_WALLETS.reduce((sum, w) => sum + w.totalPnL, 0) / this.CURATED_WALLETS.length,
        avgWinRate: this.CURATED_WALLETS.reduce((sum, w) => sum + w.winRate, 0) / this.CURATED_WALLETS.length,
        avgScore: this.CURATED_WALLETS.reduce((sum, w) => sum + w.preliminaryScore, 0) / this.CURATED_WALLETS.length,
      }
    };
  }

  /**
   * Fetch trending wallets from DeBankAPI (example integration)
   * NOTE: This requires API keys and is currently a placeholder
   */
  private async fetchFromDeBank(chain: string): Promise<DiscoveredWallet[]> {
    // TODO: Implement DeBankAPI integration
    // Example endpoint: https://api.debank.com/user/addr?id=0x...
    console.log('[WalletDiscovery] DeBankAPI integration not yet implemented');
    return [];
  }

  /**
   * Fetch from Nansen API (example integration)
   * NOTE: This requires API keys and is currently a placeholder
   */
  private async fetchFromNansen(): Promise<DiscoveredWallet[]> {
    // TODO: Implement Nansen API integration
    // Nansen Smart Money labels, wallet tracking, etc.
    console.log('[WalletDiscovery] Nansen API integration not yet implemented');
    return [];
  }

  /**
   * Calculate a preliminary score for a discovered wallet
   * Similar to the full scoring but based on limited data
   */
  private calculatePreliminaryScore(wallet: Partial<DiscoveredWallet>): number {
    let score = 50; // baseline

    // Performance component (40%)
    if (wallet.totalPnLPercent) {
      score += Math.min(20, wallet.totalPnLPercent / 10); // Up to +20 for high returns
    }

    if (wallet.winRate) {
      score += (wallet.winRate - 50) * 0.2; // +/-10 based on win rate
    }

    // Activity component (30%)
    if (wallet.totalTrades) {
      score += Math.min(15, wallet.totalTrades / 50); // Up to +15 for many trades
    }

    if (wallet.activeForDays) {
      score += Math.min(15, wallet.activeForDays / 30); // Up to +15 for long history
    }

    // Confidence boost (30%)
    if (wallet.label) {
      score += 10; // Labeled wallets are more trustworthy
    }

    if (wallet.ens) {
      score += 5; // ENS names add credibility
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Import a batch of wallet addresses to check
   */
  async importAndAnalyzeWallets(addresses: string[]): Promise<DiscoveredWallet[]> {
    console.log(`[WalletDiscovery] Analyzing ${addresses.length} wallet addresses`);

    const results: DiscoveredWallet[] = [];

    for (const address of addresses) {
      const preview = await this.getWalletPreview(address);
      if (preview) {
        results.push(preview);
      }
    }

    return results;
  }
}

export const walletDiscoveryService = new WalletDiscoveryService();
