import { db } from '../db.js';
import axios from 'axios';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Blockchain Monitor Service
 *
 * Fetches real transaction data from tracked wallets using:
 * - Helius API for Solana wallets
 * - Etherscan API for Ethereum wallets (when key is provided)
 *
 * Detects trading signals (BUY/SELL) and calculates wallet performance
 */

interface WalletTransaction {
  signature: string;
  timestamp: number;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  tokenSymbol: string;
  tokenAddress: string;
  amount: number;
  amountUSD: number;
  price?: number;
  source: string; // DEX name (Jupiter, Uniswap, etc.)
}

interface WalletSignal {
  walletAddress: string;
  blockchain: string;
  signalType: 'ENTRY' | 'EXIT';
  token: string;
  tokenAddress: string;
  direction: 'BUY' | 'SELL';
  amountUSD: number;
  price: number;
  confidence: number; // 0-100
  timestamp: Timestamp;
  source: string;
  processed: boolean;
}

export class BlockchainMonitorService {
  private heliusApiKey: string;
  private etherscanApiKey?: string;

  constructor() {
    // Get API keys from environment variables
    this.heliusApiKey = process.env.HELIUS_API_KEY || '9361f429-22ad-43fa-8da3-d85f330ebc5d';
    this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '1MFXPR5C3JMA6AUW4G7NIRH4IPBJHD537M';
  }

  /**
   * Monitor all tracked wallets for a user
   */
  async monitorUserWallets(userId: string): Promise<void> {
    console.log(`[BlockchainMonitor] Monitoring wallets for user: ${userId}`);

    // Get all tracked wallets for this user
    const walletsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .where('isActive', '==', true)
      .get();

    if (walletsSnapshot.empty) {
      console.log(`[BlockchainMonitor] No active wallets to monitor for user: ${userId}`);
      return;
    }

    // Monitor each wallet
    for (const walletDoc of walletsSnapshot.docs) {
      const wallet = walletDoc.data();
      try {
        await this.monitorWallet(userId, wallet.address, wallet.blockchain);
      } catch (error) {
        console.error(`[BlockchainMonitor] Error monitoring wallet ${wallet.address}:`, error);
      }
    }
  }

  /**
   * Monitor a specific wallet for new transactions
   */
  private async monitorWallet(
    userId: string,
    walletAddress: string,
    blockchain: string
  ): Promise<void> {
    console.log(`[BlockchainMonitor] Monitoring ${blockchain} wallet: ${walletAddress}`);

    let transactions: WalletTransaction[] = [];

    if (blockchain.toLowerCase() === 'solana') {
      transactions = await this.fetchSolanaTransactions(walletAddress);
    } else if (blockchain.toLowerCase() === 'ethereum') {
      transactions = await this.fetchEthereumTransactions(walletAddress);
    } else {
      console.log(`[BlockchainMonitor] Unsupported blockchain: ${blockchain}`);
      return;
    }

    console.log(`[BlockchainMonitor] Found ${transactions.length} transactions for ${walletAddress}`);

    // Process transactions and generate signals
    for (const tx of transactions) {
      await this.processTransaction(userId, walletAddress, blockchain, tx);
    }

    // Update wallet metrics
    await this.updateWalletMetrics(userId, walletAddress, transactions);
  }

  /**
   * Fetch Solana transactions using Helius API
   */
  private async fetchSolanaTransactions(walletAddress: string): Promise<WalletTransaction[]> {
    try {
      const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions`;

      const response = await axios.get(url, {
        params: {
          'api-key': this.heliusApiKey,
          limit: 10, // Last 10 transactions
          type: 'SWAP', // Only swap transactions
        },
      });

      if (!response.data || response.data.length === 0) {
        return [];
      }

      // Parse Helius enhanced transactions
      const transactions: WalletTransaction[] = [];

      for (const tx of response.data) {
        // Helius provides enhanced transaction data with token swaps parsed
        if (tx.type === 'SWAP' && tx.tokenTransfers && tx.tokenTransfers.length >= 2) {
          const inToken = tx.tokenTransfers.find((t: any) => t.toUserAccount === walletAddress);
          const outToken = tx.tokenTransfers.find((t: any) => t.fromUserAccount === walletAddress);

          if (inToken && outToken) {
            // This is a token swap
            const isBuy = inToken.tokenAmount > 0;

            transactions.push({
              signature: tx.signature,
              timestamp: tx.timestamp,
              type: isBuy ? 'BUY' : 'SELL',
              tokenSymbol: inToken.mint || 'UNKNOWN',
              tokenAddress: inToken.mint,
              amount: Math.abs(inToken.tokenAmount),
              amountUSD: tx.nativeTransfers?.[0]?.amount || 0,
              price: inToken.tokenAmount > 0 ? (tx.nativeTransfers?.[0]?.amount / inToken.tokenAmount) : 0,
              source: tx.source || 'Unknown DEX',
            });
          }
        }
      }

      return transactions;
    } catch (error: any) {
      console.error('[BlockchainMonitor] Error fetching Solana transactions:', error.message);
      return [];
    }
  }

  /**
   * Fetch Ethereum transactions using Etherscan API
   */
  private async fetchEthereumTransactions(walletAddress: string): Promise<WalletTransaction[]> {
    if (!this.etherscanApiKey) {
      console.log('[BlockchainMonitor] Etherscan API key not configured, skipping Ethereum wallet');
      return [];
    }

    try {
      // Get ERC-20 token transfers
      const url = 'https://api.etherscan.io/api';

      const response = await axios.get(url, {
        params: {
          module: 'account',
          action: 'tokentx',
          address: walletAddress,
          page: 1,
          offset: 10,
          sort: 'desc',
          apikey: this.etherscanApiKey,
        },
      });

      if (response.data.status !== '1' || !response.data.result) {
        return [];
      }

      const transactions: WalletTransaction[] = [];

      for (const tx of response.data.result) {
        const isBuy = tx.to.toLowerCase() === walletAddress.toLowerCase();
        const amount = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));

        transactions.push({
          signature: tx.hash,
          timestamp: parseInt(tx.timeStamp),
          type: isBuy ? 'BUY' : 'SELL',
          tokenSymbol: tx.tokenSymbol,
          tokenAddress: tx.contractAddress,
          amount,
          amountUSD: 0, // Would need additional price API
          price: 0,
          source: 'Ethereum',
        });
      }

      return transactions;
    } catch (error: any) {
      console.error('[BlockchainMonitor] Error fetching Ethereum transactions:', error.message);
      return [];
    }
  }

  /**
   * Process a transaction and generate trading signal if applicable
   */
  private async processTransaction(
    userId: string,
    walletAddress: string,
    blockchain: string,
    tx: WalletTransaction
  ): Promise<void> {
    // Check if we've already processed this transaction
    const existingSignal = await db
      .collection('users')
      .doc(userId)
      .collection('walletSignals')
      .where('walletAddress', '==', walletAddress)
      .where('signature', '==', tx.signature)
      .limit(1)
      .get();

    if (!existingSignal.empty) {
      // Already processed
      return;
    }

    // Only generate signals for BUY/SELL transactions
    if (tx.type !== 'BUY' && tx.type !== 'SELL') {
      return;
    }

    // Calculate confidence score based on transaction size and other factors
    const confidence = this.calculateSignalConfidence(tx);

    // Create trading signal
    const signal: WalletSignal = {
      walletAddress,
      blockchain,
      signalType: tx.type === 'BUY' ? 'ENTRY' : 'EXIT',
      token: tx.tokenSymbol,
      tokenAddress: tx.tokenAddress,
      direction: tx.type,
      amountUSD: tx.amountUSD,
      price: tx.price || 0,
      confidence,
      timestamp: Timestamp.fromMillis(tx.timestamp * 1000),
      source: tx.source,
      processed: false,
    };

    // Store signal in Firestore
    await db
      .collection('users')
      .doc(userId)
      .collection('walletSignals')
      .add({
        ...signal,
        signature: tx.signature,
        createdAt: Timestamp.now(),
      });

    console.log(`[BlockchainMonitor] Generated ${signal.signalType} signal for ${signal.token} from ${walletAddress}`);
  }

  /**
   * Calculate signal confidence based on transaction characteristics
   */
  private calculateSignalConfidence(tx: WalletTransaction): number {
    let confidence = 50; // Base confidence

    // Increase confidence for larger transactions
    if (tx.amountUSD > 10000) confidence += 20;
    else if (tx.amountUSD > 5000) confidence += 10;
    else if (tx.amountUSD > 1000) confidence += 5;

    // Increase confidence for known DEXs
    const trustedSources = ['Jupiter', 'Raydium', 'Uniswap', 'SushiSwap', 'PancakeSwap'];
    if (trustedSources.some(source => tx.source.includes(source))) {
      confidence += 10;
    }

    // Cap at 100
    return Math.min(confidence, 100);
  }

  /**
   * Update wallet performance metrics based on transaction history
   */
  private async updateWalletMetrics(
    userId: string,
    walletAddress: string,
    transactions: WalletTransaction[]
  ): Promise<void> {
    if (transactions.length === 0) {
      return;
    }

    // Calculate metrics
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
    const buyCount = transactions.filter(tx => tx.type === 'BUY').length;
    const sellCount = transactions.filter(tx => tx.type === 'SELL').length;
    const totalTrades = buyCount + sellCount;

    // Calculate trade frequency (trades per week)
    const oldestTx = transactions[transactions.length - 1];
    const newestTx = transactions[0];
    const timeRangeWeeks = (newestTx.timestamp - oldestTx.timestamp) / (7 * 24 * 60 * 60);
    const tradesPerWeek = timeRangeWeeks > 0 ? totalTrades / timeRangeWeeks : 0;

    // Update wallet document
    const walletRef = db
      .collection('users')
      .doc(userId)
      .collection('trackedWallets')
      .where('address', '==', walletAddress)
      .limit(1);

    const snapshot = await walletRef.get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        totalVolume,
        totalTrades,
        tradesPerWeek: Math.round(tradesPerWeek * 10) / 10,
        lastMonitoredAt: Timestamp.now(),
      });

      console.log(`[BlockchainMonitor] Updated metrics for ${walletAddress}: ${totalTrades} trades, $${totalVolume.toFixed(2)} volume`);
    }
  }

  /**
   * Monitor all active wallets across all users (called by scheduled function)
   */
  async monitorAllWallets(): Promise<void> {
    console.log('[BlockchainMonitor] Starting scheduled wallet monitoring...');

    try {
      // Get all users with active wallets
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          await this.monitorUserWallets(userDoc.id);
        } catch (error) {
          console.error(`[BlockchainMonitor] Error monitoring wallets for user ${userDoc.id}:`, error);
        }
      }

      console.log('[BlockchainMonitor] Scheduled wallet monitoring completed');
    } catch (error) {
      console.error('[BlockchainMonitor] Error in scheduled monitoring:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const blockchainMonitorService = new BlockchainMonitorService();
