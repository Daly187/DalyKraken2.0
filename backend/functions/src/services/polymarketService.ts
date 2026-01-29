/**
 * Polymarket API Integration Service
 *
 * Integrates with Polymarket's APIs:
 * - Gamma API: Market data and discovery
 * - CLOB API: Order book and trading
 * - Data API: User positions and history
 *
 * Authentication:
 * - L1: Wallet-based EIP-712 signing for creating API credentials
 * - L2: HMAC-SHA256 with API credentials for general requests
 * - Orders: EIP-712 typed data signatures using wallet private key
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';

// Polymarket API endpoints
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const CLOB_API_URL = 'https://clob.polymarket.com';
const DATA_API_URL = 'https://data-api.polymarket.com';

// Polymarket Contract Addresses (Polygon Mainnet)
const CHAIN_ID = 137;
const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE_ADDRESS = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// EIP-712 Domain for Polymarket CTF Exchange Orders
const ORDER_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: CTF_EXCHANGE_ADDRESS,
};

// EIP-712 Domain for CLOB Authentication
const CLOB_AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: CHAIN_ID,
};

// EIP-712 Types for Order Signing
const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

// EIP-712 Types for CLOB Auth
const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
};

// Signature types
enum SignatureType {
  EOA = 0,      // Standard wallet (MetaMask, etc)
  POLY_PROXY = 1,  // Polymarket proxy (Magic Link/Google)
  GNOSIS_SAFE = 2, // Multisig wallet
}

// Order sides
enum OrderSide {
  BUY = 0,
  SELL = 1,
}

// Operator address (Polymarket's exchange operator)
const OPERATOR_ADDRESS = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

// Types
export interface PolymarketMarket {
  id: string;
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  outcomes: string[];
  outcome_prices: string[];
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
  end_date_iso: string;
  volume: string;
  liquidity: string;
  category: string;
  active: boolean;
  closed: boolean;
  slug: string;
}

export interface PolymarketOrder {
  id: string;
  market: string;
  asset_id: string;
  side: 'BUY' | 'SELL';
  original_size: string;
  size_matched: string;
  price: string;
  status: string;
  created_at: number;
}

export interface PolymarketPosition {
  asset: {
    condition_id: string;
    token_id: string;
  };
  size: string;
  avg_price: string;
  outcome: string;
}

export interface PolymarketTrade {
  id: string;
  market: string;
  asset_id: string;
  side: string;
  price: string;
  size: string;
  fee: string;
  timestamp: number;
}

export class PolymarketService {
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private address: string;
  private privateKey: string;
  private wallet: ethers.Wallet | null;
  private funderAddress: string; // Proxy wallet address displayed on Polymarket.com
  private signatureType: SignatureType;
  private gammaApi: AxiosInstance;
  private clobApi: AxiosInstance;
  private dataApi: AxiosInstance;

  constructor(
    apiKey?: string,
    apiSecret?: string,
    passphrase?: string,
    address?: string,
    privateKey?: string,
    funderAddress?: string,
    signatureType: SignatureType = SignatureType.EOA
  ) {
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
    this.passphrase = passphrase || '';
    this.address = address || '';
    this.privateKey = privateKey || '';
    this.funderAddress = funderAddress || address || '';
    this.signatureType = signatureType;

    // Initialize wallet from private key if provided
    if (this.privateKey) {
      try {
        this.wallet = new ethers.Wallet(this.privateKey);
        // Override address with wallet's address
        this.address = this.wallet.address;
        console.log('[PolymarketService] Wallet initialized:', {
          signerAddress: this.address,
          funderAddress: this.funderAddress,
          signatureType: this.signatureType,
          signatureTypeName: this.signatureType === 0 ? 'EOA' : this.signatureType === 1 ? 'POLY_PROXY' : 'GNOSIS_SAFE',
          isProxyWallet: this.funderAddress && this.funderAddress !== this.address,
        });
      } catch (error: any) {
        console.error('[PolymarketService] Failed to initialize wallet:', error.message);
        this.wallet = null;
      }
    } else {
      this.wallet = null;
    }

    // Initialize API clients
    this.gammaApi = axios.create({
      baseURL: GAMMA_API_URL,
      timeout: 30000,
    });

    this.clobApi = axios.create({
      baseURL: CLOB_API_URL,
      timeout: 30000,
    });

    this.dataApi = axios.create({
      baseURL: DATA_API_URL,
      timeout: 30000,
    });

    // Add auth headers to CLOB and Data APIs
    if (this.apiKey) {
      const authInterceptor = (config: any) => {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = config.method?.toUpperCase() || 'GET';
        const path = config.url || '';
        const body = config.data ? JSON.stringify(config.data) : '';
        const signature = this.generateSignature(timestamp, method, path, body);

        config.headers = {
          ...config.headers,
          'POLY_ADDRESS': this.address,
          'POLY_API_KEY': this.apiKey,
          'POLY_SIGNATURE': signature,
          'POLY_TIMESTAMP': timestamp,
          'POLY_PASSPHRASE': this.passphrase,
        };
        return config;
      };

      this.clobApi.interceptors.request.use(authInterceptor);
      this.dataApi.interceptors.request.use(authInterceptor);
    }
  }

  /**
   * Generate HMAC signature for authenticated requests (L2 Auth)
   */
  private generateSignature(timestamp: string, method: string, path: string, body?: string): string {
    const message = timestamp + method + path + (body || '');
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('base64');
  }

  // ============================================
  // EIP-712 SIGNING METHODS
  // ============================================

  /**
   * Sign EIP-712 typed data for CLOB authentication (L1 Auth)
   * Used to create or derive API credentials
   */
  async signClobAuthMessage(timestamp: string, nonce: number = 0): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Private key required for signing.');
    }

    const message = {
      address: this.wallet.address,
      timestamp: timestamp,
      nonce: nonce,
      message: 'This message attests that I control the given wallet',
    };

    const signature = await this.wallet._signTypedData(
      CLOB_AUTH_DOMAIN,
      CLOB_AUTH_TYPES,
      message
    );

    return signature;
  }

  /**
   * Create or derive API credentials from wallet signature
   * This exchanges L1 auth (wallet signature) for L2 auth (API key/secret/passphrase)
   */
  async createOrDeriveApiCredentials(): Promise<{ apiKey: string; secret: string; passphrase: string }> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Private key required.');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 0;
    const signature = await this.signClobAuthMessage(timestamp, nonce);

    console.log('[PolymarketService] Creating/deriving API credentials...');

    try {
      // Try to derive existing credentials first
      const deriveResponse = await axios.get(`${CLOB_API_URL}/auth/derive-api-key`, {
        headers: {
          'POLY_ADDRESS': this.wallet.address,
          'POLY_SIGNATURE': signature,
          'POLY_TIMESTAMP': timestamp,
          'POLY_NONCE': nonce.toString(),
        },
      });

      if (deriveResponse.data?.apiKey) {
        console.log('[PolymarketService] Derived existing API credentials');
        return {
          apiKey: deriveResponse.data.apiKey,
          secret: deriveResponse.data.secret,
          passphrase: deriveResponse.data.passphrase,
        };
      }
    } catch (err: any) {
      console.log('[PolymarketService] No existing credentials, creating new ones...');
    }

    // Create new credentials
    const createResponse = await axios.post(`${CLOB_API_URL}/auth/api-key`, {}, {
      headers: {
        'POLY_ADDRESS': this.wallet.address,
        'POLY_SIGNATURE': signature,
        'POLY_TIMESTAMP': timestamp,
        'POLY_NONCE': nonce.toString(),
      },
    });

    console.log('[PolymarketService] Created new API credentials');
    return {
      apiKey: createResponse.data.apiKey,
      secret: createResponse.data.secret,
      passphrase: createResponse.data.passphrase,
    };
  }

  /**
   * Build and sign an order using EIP-712
   */
  async buildSignedOrder(params: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    size: number;       // Number of shares
    price: number;      // Price per share (0-1)
    expiration?: number; // Unix timestamp, default 30 days
    negRisk?: boolean;  // Whether this is a neg risk market
  }): Promise<{
    order: any;
    signature: string;
  }> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Private key required for order signing.');
    }

    const makerAddress = this.funderAddress || this.wallet.address;
    const signerAddress = this.wallet.address;

    // Generate unique salt
    const salt = ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString();

    // Calculate amounts (USDC has 6 decimals)
    // For a BUY: makerAmount = price * size (USDC spent), takerAmount = size (shares received)
    // For a SELL: makerAmount = size (shares spent), takerAmount = price * size (USDC received)
    const sideEnum = params.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL;

    // Price is in 0-1 range, convert to proper decimals
    // Size is number of shares (1 share = $1 if probability is 100%)
    const priceInMicroUsdc = Math.round(params.price * 1e6);
    const sizeInShares = Math.round(params.size * 1e6); // 6 decimals for shares too

    let makerAmount: string;
    let takerAmount: string;

    if (sideEnum === OrderSide.BUY) {
      // Buying shares: spend USDC, receive shares
      makerAmount = (priceInMicroUsdc * params.size).toFixed(0);
      takerAmount = sizeInShares.toString();
    } else {
      // Selling shares: spend shares, receive USDC
      makerAmount = sizeInShares.toString();
      takerAmount = (priceInMicroUsdc * params.size).toFixed(0);
    }

    // Default expiration: 30 days from now
    const expiration = params.expiration || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    // Get current nonce (usually 0 unless we're trying to cancel)
    const nonce = 0;

    // Fee rate in basis points (Polymarket default is 0)
    const feeRateBps = 0;

    // Build the order struct
    const order = {
      salt: salt,
      maker: makerAddress,
      signer: signerAddress,
      taker: OPERATOR_ADDRESS,
      tokenId: params.tokenId,
      makerAmount: makerAmount,
      takerAmount: takerAmount,
      expiration: expiration.toString(),
      nonce: nonce.toString(),
      feeRateBps: feeRateBps.toString(),
      side: sideEnum,
      signatureType: this.signatureType,
    };

    // Select the appropriate domain based on neg risk
    const domain = params.negRisk
      ? { ...ORDER_DOMAIN, verifyingContract: NEG_RISK_CTF_EXCHANGE_ADDRESS }
      : ORDER_DOMAIN;

    // Sign the order using EIP-712
    const signature = await this.wallet._signTypedData(
      domain,
      ORDER_TYPES,
      order
    );

    console.log('[PolymarketService] Order signed:', {
      tokenId: params.tokenId,
      side: params.side,
      size: params.size,
      price: params.price,
      makerAddress,
      signerAddress,
      signatureType: this.signatureType,
      signatureTypeName: this.signatureType === 0 ? 'EOA' : this.signatureType === 1 ? 'POLY_PROXY' : 'GNOSIS_SAFE',
    });

    return { order, signature };
  }

  /**
   * Place a signed order on the CLOB
   */
  async placeSignedOrder(params: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    orderType?: 'GTC' | 'GTD' | 'FOK' | 'FAK';
    negRisk?: boolean;
  }): Promise<PolymarketOrder> {
    // Build and sign the order
    const { order, signature } = await this.buildSignedOrder({
      tokenId: params.tokenId,
      side: params.side,
      size: params.size,
      price: params.price,
      negRisk: params.negRisk,
    });

    const orderType = params.orderType || 'GTC';

    // Prepare the request payload
    const payload = {
      order: {
        ...order,
        signature: signature,
      },
      owner: order.maker,
      orderType: orderType,
    };

    console.log('[PolymarketService] Posting signed order to CLOB:', JSON.stringify(payload, null, 2));

    try {
      const response = await this.clobApi.post('/order', payload);
      console.log('[PolymarketService] Order response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error posting signed order:', error.response?.data || error.message);
      throw error;
    }
  }

  // ============================================
  // MARKET DATA METHODS (Gamma API)
  // ============================================

  /**
   * Get all active markets with pagination support
   */
  async getMarkets(options?: {
    active?: boolean;
    closed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PolymarketMarket[]> {
    try {
      const params = new URLSearchParams();
      if (options?.active !== undefined) params.append('active', String(options.active));
      if (options?.closed !== undefined) params.append('closed', String(options.closed));
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));

      const response = await this.gammaApi.get(`/markets?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching markets:', error.message);
      throw error;
    }
  }

  /**
   * Get all active markets using pagination to fetch more than API limit
   * Fetches multiple pages in parallel for speed
   */
  async getAllActiveMarkets(maxMarkets: number = 2000): Promise<PolymarketMarket[]> {
    try {
      const pageSize = 500; // Gamma API max per request
      const pagesToFetch = Math.ceil(maxMarkets / pageSize);

      console.log(`[PolymarketService] Fetching up to ${maxMarkets} markets across ${pagesToFetch} pages`);

      // Fetch first page to get initial count
      const firstPage = await this.getMarkets({
        active: true,
        closed: false,
        limit: pageSize,
        offset: 0
      });

      if (firstPage.length < pageSize) {
        // All markets fit in first page
        console.log(`[PolymarketService] Got ${firstPage.length} markets (single page)`);
        return firstPage;
      }

      // Fetch remaining pages in parallel
      const remainingPages = [];
      for (let i = 1; i < pagesToFetch; i++) {
        remainingPages.push(
          this.getMarkets({
            active: true,
            closed: false,
            limit: pageSize,
            offset: i * pageSize
          }).catch(err => {
            console.log(`[PolymarketService] Page ${i} fetch failed:`, err.message);
            return [];
          })
        );
      }

      const additionalPages = await Promise.all(remainingPages);
      const allMarkets = [firstPage, ...additionalPages].flat();

      console.log(`[PolymarketService] Fetched ${allMarkets.length} total markets across ${pagesToFetch} pages`);
      return allMarkets.slice(0, maxMarkets);
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching all markets:', error.message);
      // Fall back to single page
      return this.getMarkets({ active: true, closed: false, limit: 500 });
    }
  }

  /**
   * Get active events with their markets
   * Events contain multiple related markets (e.g., "Will BTC hit $X" with multiple price levels)
   */
  async getActiveEvents(limit: number = 100): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.append('active', 'true');
      params.append('closed', 'false');
      params.append('limit', String(limit));

      const response = await this.gammaApi.get(`/events?${params.toString()}`);
      return response.data || [];
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching events:', error.message);
      return [];
    }
  }

  /**
   * Get a specific market by ID
   */
  async getMarket(marketId: string): Promise<PolymarketMarket> {
    try {
      const response = await this.gammaApi.get(`/markets/${marketId}`);
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching market:', error.message);
      throw error;
    }
  }

  /**
   * Get markets from popular crypto price series (daily/weekly recurring markets)
   * These are the "Bitcoin above __ on January 9?" style markets
   */
  async getCryptoSeriesMarkets(): Promise<PolymarketMarket[]> {
    // Comprehensive list of crypto price series IDs from Polymarket
    // Including daily, 4H, weekly, and monthly timeframes
    const cryptoSeriesIds = [
      // Bitcoin series
      '10151', // Bitcoin Hit Price Weekly
      '10103', // Bitcoin Neg Risk 4H
      '10229', // Bitcoin Multi Strikes 4H
      '10246', // Bitcoin Neg Risk Weekly
      '10253', // Bitcoin Daily Price

      // Ethereum series
      '10152', // Ethereum Hit Price Weekly
      '10017', // Ethereum Hit Price Monthly
      '10231', // Ethereum Multi Strikes 4H
      '42',    // Ethereum Multi Strikes Weekly
      '10254', // Ethereum Daily Price

      // Solana series
      '10032', // Solana Hit Price Monthly
      '10233', // Solana Multi Strikes 4H
      '10248', // Solana Neg Risk 4H
      '10255', // Solana Daily Price

      // XRP series
      '10232', // XRP Multi Strikes 4H
      '10247', // XRP Neg Risk Weekly
      '10250', // XRP Neg Risk 4H

      // Other popular crypto series
      '10234', // DOGE Multi Strikes
      '10235', // AVAX Multi Strikes
      '10236', // LINK Multi Strikes
      '10237', // MATIC Multi Strikes
    ];

    const allMarkets: PolymarketMarket[] = [];

    try {
      // Fetch series in parallel for speed (batch of 5 at a time)
      const batchSize = 5;
      for (let i = 0; i < cryptoSeriesIds.length; i += batchSize) {
        const batch = cryptoSeriesIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (seriesId) => {
            try {
              const response = await this.gammaApi.get(`/series/${seriesId}`);
              const series = response.data;
              const markets: PolymarketMarket[] = [];

              if (series?.events) {
                // Find active (not closed) events and their markets
                for (const event of series.events) {
                  if (!event.closed && event.markets) {
                    for (const market of event.markets) {
                      if (market.active && !market.closed) {
                        // Add series context to market
                        markets.push({
                          ...market,
                          category: 'Crypto',
                          seriesTitle: series.title,
                        });
                      }
                    }
                  }
                }
              }
              return markets;
            } catch (err: any) {
              // Skip failed series silently
              return [];
            }
          })
        );
        allMarkets.push(...batchResults.flat());
      }

      console.log(`[PolymarketService] Found ${allMarkets.length} active crypto series markets`);
      return allMarkets;
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching crypto series:', error.message);
      return [];
    }
  }

  /**
   * Fetch all active series from Polymarket to discover new recurring markets
   */
  async getActiveSeries(): Promise<any[]> {
    try {
      const response = await this.gammaApi.get('/series?active=true&limit=100');
      return response.data || [];
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching series:', error.message);
      return [];
    }
  }

  /**
   * Get market prices (current odds)
   */
  async getMarketPrices(tokenIds: string[]): Promise<Record<string, number>> {
    try {
      const response = await this.clobApi.get('/prices', {
        params: { token_ids: tokenIds.join(',') }
      });
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching prices:', error.message);
      throw error;
    }
  }

  /**
   * Get order book for a token
   */
  async getOrderBook(tokenId: string): Promise<any> {
    try {
      const response = await this.clobApi.get(`/book?token_id=${tokenId}`);
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching order book:', error.message);
      throw error;
    }
  }

  // ============================================
  // TRADING METHODS (CLOB API)
  // ============================================

  /**
   * Place a market order
   */
  async placeMarketOrder(params: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    amount: number;
  }): Promise<PolymarketOrder> {
    try {
      const response = await this.clobApi.post('/order', {
        token_id: params.tokenId,
        side: params.side,
        size: params.amount.toString(),
        type: 'MARKET',
      });
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error placing market order:', error.message);
      throw error;
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(params: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    amount: number;
    price: number;
  }): Promise<PolymarketOrder> {
    try {
      const response = await this.clobApi.post('/order', {
        token_id: params.tokenId,
        side: params.side,
        size: params.amount.toString(),
        price: params.price.toString(),
        type: 'LIMIT',
      });
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error placing limit order:', error.message);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.clobApi.delete(`/order/${orderId}`);
    } catch (error: any) {
      console.error('[PolymarketService] Error cancelling order:', error.message);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<PolymarketOrder[]> {
    try {
      const response = await this.clobApi.get('/orders?status=OPEN');
      return response.data;
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching open orders:', error.message);
      throw error;
    }
  }

  // ============================================
  // ACCOUNT METHODS (CLOB API)
  // ============================================

  /**
   * Get account balance (USDC collateral)
   * Tries multiple methods:
   * 1. CLOB API balance-allowance endpoint
   * 2. Direct blockchain query for USDC.e balance
   */
  async getBalance(): Promise<number> {
    // Method 1: Try CLOB API balance-allowance endpoint
    try {
      const signatureTypes = [1, 0, 2];

      for (const sigType of signatureTypes) {
        try {
          const response = await this.clobApi.get('/balance-allowance', {
            params: {
              asset_type: 'COLLATERAL',
              signature_type: sigType,
            }
          });

          console.log(`[PolymarketService] balance-allowance response (sig=${sigType}):`, JSON.stringify(response.data));
          const balance = parseFloat(response.data?.balance || '0');
          if (balance > 0) {
            console.log(`[PolymarketService] Balance found with signature_type=${sigType}: $${balance}`);
            return balance;
          }
        } catch (err: any) {
          console.log(`[PolymarketService] balance-allowance failed (sig=${sigType}):`, err.message);
        }
      }
    } catch (error: any) {
      console.error('[PolymarketService] CLOB balance fetch failed:', error.message);
    }

    // Method 2: Query stablecoin balances directly from Polygon via public RPC
    // Try funder address first (proxy wallet where funds typically are), then wallet address
    const addressesToCheck = [];
    if (this.funderAddress) addressesToCheck.push(this.funderAddress);
    if (this.address && this.address !== this.funderAddress) addressesToCheck.push(this.address);

    if (addressesToCheck.length > 0) {
      // Token contracts on Polygon
      const TOKENS = [
        { name: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
        { name: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
        { name: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      ];

      for (const checkAddress of addressesToCheck) {
        for (const token of TOKENS) {
          try {
            console.log(`[PolymarketService] Checking ${token.name} balance for address: ${checkAddress}`);

            // ERC20 balanceOf function signature
            const balanceOfSelector = '0x70a08231';
            const paddedAddress = checkAddress.toLowerCase().replace('0x', '').padStart(64, '0');
            const data = balanceOfSelector + paddedAddress;

            // Use public Polygon RPC
            const rpcResponse = await axios.post('https://polygon-rpc.com', {
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [{
                to: token.address,
                data: data,
              }, 'latest'],
              id: 1,
            }, { timeout: 10000 });

            if (rpcResponse.data?.result && rpcResponse.data.result !== '0x') {
              const balanceWei = BigInt(rpcResponse.data.result);
              const balance = Number(balanceWei) / Math.pow(10, token.decimals);
              console.log(`[PolymarketService] ${token.name} balance for ${checkAddress}: $${balance}`);
              if (balance > 0) {
                return balance;
              }
            }
          } catch (err: any) {
            console.error(`[PolymarketService] ${token.name} balance check failed for ${checkAddress}:`, err.message);
          }
        }
      }
    }

    console.log('[PolymarketService] No balance found with any method');
    return 0;
  }

  /**
   * Get user positions
   * Uses the Data API to fetch user's open positions
   * Tries both the wallet address and funder address (proxy wallet)
   */
  async getPositions(): Promise<PolymarketPosition[]> {
    const addressesToTry: string[] = [];

    // Add funder address first (proxy wallet - where positions typically live)
    if (this.funderAddress && this.funderAddress !== this.address) {
      addressesToTry.push(this.funderAddress);
    }
    // Then try wallet address
    if (this.address) {
      addressesToTry.push(this.address);
    }

    if (addressesToTry.length === 0) {
      console.log('[PolymarketService] No address provided, cannot fetch positions');
      return [];
    }

    const allPositions: PolymarketPosition[] = [];

    for (const addr of addressesToTry) {
      try {
        // Data API positions endpoint - no auth required, just user address
        console.log(`[PolymarketService] Fetching positions for address: ${addr}`);
        const response = await axios.get('https://data-api.polymarket.com/positions', {
          params: {
            user: addr,
            sizeThreshold: 0.0001,  // Exclude closed/zero-size positions
            limit: 100,
          },
          timeout: 15000,
        });

        const positions = response.data || [];
        console.log(`[PolymarketService] Found ${positions.length} positions for ${addr}`);

        if (positions.length > 0) {
          // Add source address to each position for debugging
          positions.forEach((p: any) => p._sourceAddress = addr);
          allPositions.push(...positions);
        }
      } catch (error: any) {
        console.error(`[PolymarketService] Error fetching positions for ${addr}:`, error.message);
      }
    }

    // Deduplicate by asset.token_id if same position found under multiple addresses
    const uniquePositions = allPositions.filter((pos, index, self) =>
      index === self.findIndex(p => p.asset?.token_id === pos.asset?.token_id)
    );

    // Filter out zero-size positions that may still appear due to API lag
    const filteredPositions = uniquePositions.filter((pos: any) => {
      const size = parseFloat(pos.size || '0');
      return size > 0;
    });

    console.log(`[PolymarketService] Total unique positions found: ${uniquePositions.length}, filtered to ${filteredPositions.length} open`);
    return filteredPositions;
  }

  /**
   * Get trade history
   */
  async getTradeHistory(limit: number = 50): Promise<PolymarketTrade[]> {
    try {
      const response = await this.dataApi.get(`/trades?limit=${limit}`);
      return response.data || [];
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching trade history:', error.message);
      return [];
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      // Try to fetch balance as a connection test
      const balance = await this.getBalance();
      return {
        success: true,
        message: 'Successfully connected to Polymarket API',
        balance,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Get markets, optionally filtered by closing timeframe
   * If hoursFromNow is 0 or very large (>8760 = 1 year), returns all active markets sorted by volume
   * Otherwise strictly filters to markets closing within the timeframe
   * Also includes crypto series markets (Bitcoin/Ethereum/Solana/XRP daily/weekly prices)
   */
  async getMarketsClosingSoon(hoursFromNow: number, limit: number = 100): Promise<PolymarketMarket[]> {
    try {
      console.log(`[PolymarketService] Fetching markets (timeframe: ${hoursFromNow}h, limit: ${limit})`);

      // Fetch regular markets (paginated), crypto series markets, and events in parallel
      const [regularMarkets, cryptoSeriesMarkets, events] = await Promise.all([
        this.getAllActiveMarkets(2000), // Fetch up to 2000 markets with pagination
        this.getCryptoSeriesMarkets(),
        this.getActiveEvents(200), // Fetch active events
      ]);

      // Extract markets from events that might not be in the regular markets list
      const eventMarkets: PolymarketMarket[] = [];
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            if (market.active && !market.closed) {
              eventMarkets.push({
                ...market,
                category: event.category || market.category,
                eventTitle: event.title,
              });
            }
          }
        }
      }

      // Combine all markets and deduplicate by ID
      const marketMap = new Map<string, PolymarketMarket>();
      for (const market of [...(regularMarkets || []), ...cryptoSeriesMarkets, ...eventMarkets]) {
        const id = market.id || (market as any).conditionId || market.condition_id;
        if (id && !marketMap.has(id)) {
          marketMap.set(id, market);
        }
      }
      const allMarkets = Array.from(marketMap.values());

      console.log(`[PolymarketService] Got ${regularMarkets?.length || 0} regular + ${cryptoSeriesMarkets.length} crypto series + ${eventMarkets.length} from events = ${allMarkets.length} unique markets`);

      if (allMarkets.length === 0) {
        return [];
      }

      const now = new Date();

      // If timeframe is very large (>1 year) or 0, return all active markets sorted by volume (no time filter)
      if (hoursFromNow === 0 || hoursFromNow > 8760) {
        console.log('[PolymarketService] Large/no timeframe, returning all markets sorted by volume');
        return allMarkets
          .sort((a, b) => parseFloat(b.volume || '0') - parseFloat(a.volume || '0'))
          .slice(0, limit);
      }

      const cutoff = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);

      // Filter markets by end date - API uses endDate or endDateIso (camelCase)
      // Also include markets with no end date (perpetual/ongoing markets)
      const filteredMarkets = allMarkets.filter(market => {
        const endDateStr = (market as any).endDate || (market as any).endDateIso || market.end_date_iso;
        if (!endDateStr) {
          // Include markets without end dates - they might be daily/recurring
          return true;
        }
        const endDate = new Date(endDateStr);
        return endDate > now && endDate <= cutoff;
      });

      console.log(`[PolymarketService] ${filteredMarkets.length} markets closing within ${hoursFromNow} hours (or no end date)`);

      // Return filtered markets sorted by end date (soonest first), markets without end dates at the end
      return filteredMarkets
        .sort((a, b) => {
          const aEnd = (a as any).endDate || (a as any).endDateIso || a.end_date_iso;
          const bEnd = (b as any).endDate || (b as any).endDateIso || b.end_date_iso;
          if (!aEnd && !bEnd) return 0;
          if (!aEnd) return 1;
          if (!bEnd) return -1;
          return new Date(aEnd).getTime() - new Date(bEnd).getTime();
        })
        .slice(0, limit);
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching markets closing soon:', error.message);
      return [];
    }
  }

  /**
   * Get markets by probability threshold
   */
  async getMarketsByProbability(
    minProbability: number,
    maxProbability: number = 1,
    limit: number = 100
  ): Promise<PolymarketMarket[]> {
    try {
      const markets = await this.getMarkets({ active: true, closed: false, limit: 500 });

      return markets
        .filter(market => {
          // Check if any outcome price is within the threshold
          const prices = market.outcome_prices?.map(p => parseFloat(p)) || [];
          return prices.some(price => price >= minProbability && price <= maxProbability);
        })
        .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
        .slice(0, limit);
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching markets by probability:', error.message);
      return [];
    }
  }

  /**
   * Get top markets by volume
   */
  async getTopMarketsByVolume(limit: number = 100): Promise<PolymarketMarket[]> {
    try {
      const markets = await this.getMarkets({ active: true, closed: false, limit: 500 });

      return markets
        .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
        .slice(0, limit);
    } catch (error: any) {
      console.error('[PolymarketService] Error fetching top markets:', error.message);
      return [];
    }
  }

  /**
   * Calculate bet size based on configuration
   */
  calculateBetSize(
    balance: number,
    config: {
      betSizeMode: 'fixed' | 'percentage';
      fixedBetAmount: number;
      percentageBetAmount: number;
      maxBetPercent: number;
    }
  ): number {
    let betSize: number;

    if (config.betSizeMode === 'fixed') {
      betSize = config.fixedBetAmount;
    } else {
      betSize = balance * (config.percentageBetAmount / 100);
    }

    // Ensure bet doesn't exceed max percentage of balance
    const maxBet = balance * (config.maxBetPercent / 100);
    betSize = Math.min(betSize, maxBet);

    // Round to 2 decimal places
    return Math.round(betSize * 100) / 100;
  }
}

export const polymarketService = new PolymarketService();
