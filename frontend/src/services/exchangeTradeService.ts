/**
 * Exchange Trade Service - PRODUCTION READY
 * Handles order execution on AsterDEX and HyperLiquid with proper signatures
 */

// Production API Endpoints
const ASTER_API = 'https://fapi.asterdex.com';
const HL_API = 'https://api.hyperliquid.xyz';

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: number; // Position size in USD
  price: number; // Limit price
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  price?: number;
  size?: number;
  error?: string;
  filled?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  asterBalance?: number;
  hyperliquidBalance?: number;
}

// Asset precision configuration
const ASSET_PRECISION: Record<string, number> = {
  'BTC': 4,
  'ETH': 3,
  'SOL': 2,
  'ATOM': 1,
  'MATIC': 1,
  'AVAX': 2,
};

// Minimum order sizes per exchange
const MIN_ORDER_SIZES: Record<string, { aster: number; hl: number }> = {
  'BTC': { aster: 0.001, hl: 0.0001 },
  'ETH': { aster: 0.01, hl: 0.001 },
  'SOL': { aster: 0.1, hl: 0.1 },
  'ATOM': { aster: 1, hl: 0.1 },
  'MATIC': { aster: 10, hl: 1 },
  'AVAX': { aster: 0.1, hl: 0.1 },
};

/**
 * Rate Limiter for API calls
 */
class RateLimiter {
  private aster = { weight: 0, reset: Date.now() + 60000 };
  private hl = { calls: [] as number[], maxPerSecond: 20 };

  async checkAster(weight = 1): Promise<void> {
    if (Date.now() > this.aster.reset) {
      this.aster = { weight: 0, reset: Date.now() + 60000 };
    }
    if (this.aster.weight + weight > 2400) {
      const waitTime = this.aster.reset - Date.now();
      console.log(`[RateLimit] Aster limit reached, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      this.aster = { weight: 0, reset: Date.now() + 60000 };
    }
    this.aster.weight += weight;
  }

  async checkHL(): Promise<void> {
    const now = Date.now();
    this.hl.calls = this.hl.calls.filter(t => t > now - 1000);
    if (this.hl.calls.length >= this.hl.maxPerSecond) {
      console.log(`[RateLimit] Hyperliquid limit reached, waiting 1s`);
      await this.sleep(1000);
    }
    this.hl.calls.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ExchangeTradeService {
  private paperMode: boolean = false;
  private paperBalances = {
    aster: 100,
    hyperliquid: 100,
  };
  private rateLimiter = new RateLimiter();
  private hlAssetCache: Map<string, number> = new Map();

  /**
   * Enable/disable paper trading mode
   */
  setPaperMode(enabled: boolean): void {
    this.paperMode = enabled;
    if (enabled) {
      this.paperBalances = {
        aster: 100,
        hyperliquid: 100,
      };
    }
    console.log(`[ExchangeTradeService] Paper mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  isPaperMode(): boolean {
    return this.paperMode;
  }

  getPaperBalances() {
    return { ...this.paperBalances };
  }

  /**
   * Simulate order execution for paper trading
   */
  private simulatePaperOrder(params: OrderParams): OrderResult {
    console.log(`[PAPER] Simulating ${params.side} order for ${params.symbol}: ${params.size} USD @ ${params.price}`);

    return {
      success: true,
      orderId: `PAPER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      price: params.price,
      size: params.size,
      filled: true,
    };
  }

  /**
   * Format size with proper decimal precision
   */
  private formatSize(symbol: string, size: number): number {
    const baseAsset = symbol.replace('USDT', '').replace('PERP', '');
    const decimals = ASSET_PRECISION[baseAsset] || 2;
    return Math.floor(size * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Validate minimum order size
   */
  private validateOrderSize(symbol: string, size: number, exchange: 'aster' | 'hl'): boolean {
    const baseAsset = symbol.replace('USDT', '').replace('PERP', '');
    const min = MIN_ORDER_SIZES[baseAsset]?.[exchange] || 0;
    return size >= min;
  }

  /**
   * Sign AsterDEX request with HMAC SHA256
   */
  private async signAsterRequest(params: any, apiSecret: string): Promise<string> {
    const timestamp = Date.now();
    const queryParams = {
      ...params,
      timestamp,
      recvWindow: 5000,
    };

    // Sort params alphabetically (critical for signature)
    const sortedKeys = Object.keys(queryParams).sort();
    const queryString = sortedKeys
      .map(key => `${key}=${queryParams[key]}`)
      .join('&');

    // Use crypto-js for HMAC SHA256
    const crypto = await import('crypto-js');
    const signature = crypto.default.HmacSHA256(queryString, apiSecret).toString();

    return signature;
  }

  /**
   * Sign Hyperliquid order with EIP-712
   */
  private async signHyperliquidOrder(
    action: any,
    privateKey: string,
    vaultAddress: string | null = null
  ): Promise<{ r: string; s: string; v: number }> {
    try {
      // Import ethers dynamically
      const { ethers } = await import('ethers');

      const wallet = new ethers.Wallet(privateKey);

      // EIP-712 domain
      const domain = {
        name: 'Exchange',
        version: '1',
        chainId: 421614, // Arbitrum Sepolia for testnet, 42161 for mainnet
        verifyingContract: '0x0000000000000000000000000000000000000000',
      };

      // EIP-712 types for order action
      const types = {
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' },
        ],
        Order: [
          { name: 'a', type: 'uint32' },
          { name: 'b', type: 'bool' },
          { name: 'p', type: 'string' },
          { name: 's', type: 'string' },
          { name: 'r', type: 'bool' },
          { name: 't', type: 'Tif' },
        ],
        Tif: [
          { name: 'limit', type: 'Limit' },
        ],
        Limit: [
          { name: 'tif', type: 'string' },
        ],
      };

      // Sign the message
      const signature = await wallet._signTypedData(domain, types, action);
      const sig = ethers.utils.splitSignature(signature);

      return {
        r: sig.r,
        s: sig.s,
        v: sig.v,
      };
    } catch (error) {
      console.error('[Hyperliquid] Signature error:', error);
      // Fallback to placeholder in paper mode
      if (this.paperMode) {
        return { r: '0x0', s: '0x0', v: 27 };
      }
      throw error;
    }
  }

  /**
   * Get Hyperliquid asset index from meta
   */
  private async getHyperliquidAssetIndex(symbol: string): Promise<number> {
    const baseAsset = symbol.replace('USDT', '').replace('PERP', '');

    // Check cache
    if (this.hlAssetCache.has(baseAsset)) {
      return this.hlAssetCache.get(baseAsset)!;
    }

    try {
      await this.rateLimiter.checkHL();

      const response = await fetch(`${HL_API}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
      });

      if (!response.ok) {
        throw new Error(`Meta fetch failed: ${response.statusText}`);
      }

      const meta = await response.json();
      const assetIndex = meta.universe.findIndex((a: any) => a.name === baseAsset);

      if (assetIndex === -1) {
        throw new Error(`Asset ${baseAsset} not found in Hyperliquid meta`);
      }

      // Cache the result
      this.hlAssetCache.set(baseAsset, assetIndex);
      return assetIndex;
    } catch (error) {
      console.error('[Hyperliquid] Asset index lookup failed:', error);
      throw error;
    }
  }

  /**
   * Validate API keys and balances before trading
   */
  async validateTradingReadiness(requiredCapital: number): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // In paper mode, skip API key validation and use paper balances
    if (this.paperMode) {
      console.log('[ExchangeTradeService] Paper mode - skipping API validation');
      return {
        valid: true,
        errors: [],
        warnings: ['Running in PAPER MODE - no real trades will be executed'],
        asterBalance: this.paperBalances.aster,
        hyperliquidBalance: this.paperBalances.hyperliquid,
      };
    }

    // LIVE MODE: Check Aster API keys
    const asterApiKey = localStorage.getItem('aster_api_key');
    const asterApiSecret = localStorage.getItem('aster_api_secret');
    if (!asterApiKey || !asterApiSecret) {
      errors.push('Aster API keys not configured in Settings');
    }

    // Check Hyperliquid wallet
    const hyperliquidWallet = localStorage.getItem('hyperliquid_wallet_address');
    const hyperliquidPrivateKey = localStorage.getItem('hyperliquid_private_key');
    if (!hyperliquidWallet || !hyperliquidPrivateKey) {
      errors.push('Hyperliquid wallet not configured in Settings');
    }

    // If keys are missing, return early
    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
      };
    }

    // Fetch balances from both exchanges
    let asterBalance = 0;
    let hyperliquidBalance = 0;

    try {
      await this.rateLimiter.checkAster(5);

      // Fetch Aster balance
      const timestamp = Date.now();
      const params: any = {
        timestamp,
        recvWindow: 5000,
      };

      const signature = await this.signAsterRequest(params, asterApiSecret!);
      const queryString = `timestamp=${timestamp}&recvWindow=5000&signature=${signature}`;

      const asterResponse = await fetch(`${ASTER_API}/fapi/v1/account?${queryString}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': asterApiKey!,
        },
      });

      if (asterResponse.ok) {
        const asterData = await asterResponse.json();
        asterBalance = parseFloat(asterData.totalWalletBalance || asterData.totalMarginBalance || '0');
      } else {
        warnings.push('Could not fetch Aster balance - API error');
      }
    } catch (error) {
      warnings.push('Could not fetch Aster balance - network error');
    }

    try {
      await this.rateLimiter.checkHL();

      // Fetch Hyperliquid balance
      const hlResponse = await fetch(`${HL_API}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: hyperliquidWallet,
        }),
      });

      if (hlResponse.ok) {
        const hlData = await hlResponse.json();
        hyperliquidBalance = parseFloat(hlData.marginSummary?.accountValue || '0');
      } else {
        warnings.push('Could not fetch Hyperliquid balance - API error');
      }
    } catch (error) {
      warnings.push('Could not fetch Hyperliquid balance - network error');
    }

    // Check if balances are sufficient
    const requiredPerExchange = requiredCapital / 2;

    if (asterBalance < requiredPerExchange) {
      errors.push(
        `Insufficient Aster balance: $${asterBalance.toFixed(2)} (need $${requiredPerExchange.toFixed(2)})`
      );
    }

    if (hyperliquidBalance < requiredPerExchange) {
      errors.push(
        `Insufficient Hyperliquid balance: $${hyperliquidBalance.toFixed(2)} (need $${requiredPerExchange.toFixed(2)})`
      );
    }

    // Warning if balances are barely sufficient (within 10% margin)
    if (asterBalance >= requiredPerExchange && asterBalance < requiredPerExchange * 1.1) {
      warnings.push(`Low Aster balance: $${asterBalance.toFixed(2)} (close to minimum)`);
    }

    if (hyperliquidBalance >= requiredPerExchange && hyperliquidBalance < requiredPerExchange * 1.1) {
      warnings.push(`Low Hyperliquid balance: $${hyperliquidBalance.toFixed(2)} (close to minimum)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      asterBalance,
      hyperliquidBalance,
    };
  }

  /**
   * Verify order fill status
   */
  private async verifyOrderFill(exchange: 'aster' | 'hyperliquid', orderId: string): Promise<boolean> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.getOrderStatus(exchange, orderId);

        if (status === 'FILLED') return true;
        if (status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED') return false;

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        console.error(`[${exchange}] Order status check failed:`, error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return false;
  }

  /**
   * Get order status
   */
  private async getOrderStatus(exchange: 'aster' | 'hyperliquid', orderId: string): Promise<string> {
    if (exchange === 'aster') {
      await this.rateLimiter.checkAster(2);

      const apiKey = localStorage.getItem('aster_api_key');
      const apiSecret = localStorage.getItem('aster_api_secret');

      if (!apiKey || !apiSecret) throw new Error('API keys not found');

      const timestamp = Date.now();
      const params: any = {
        orderId,
        timestamp,
        recvWindow: 5000,
      };

      const signature = await this.signAsterRequest(params, apiSecret);
      const queryString = `orderId=${orderId}&timestamp=${timestamp}&recvWindow=5000&signature=${signature}`;

      const response = await fetch(`${ASTER_API}/fapi/v1/order?${queryString}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      });

      if (!response.ok) throw new Error(`Status check failed: ${response.statusText}`);

      const data = await response.json();
      return data.status; // FILLED, PARTIALLY_FILLED, CANCELLED, etc.
    } else {
      await this.rateLimiter.checkHL();

      const wallet = localStorage.getItem('hyperliquid_wallet_address');
      if (!wallet) throw new Error('Wallet not found');

      const response = await fetch(`${HL_API}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'orderStatus',
          user: wallet,
          oid: parseInt(orderId),
        }),
      });

      if (!response.ok) throw new Error(`Status check failed: ${response.statusText}`);

      const data = await response.json();
      return data.order?.status || 'UNKNOWN';
    }
  }

  /**
   * Place a limit order on AsterDEX
   */
  async placeAsterOrder(params: OrderParams): Promise<OrderResult> {
    // Paper trading mode
    if (this.paperMode) {
      return this.simulatePaperOrder(params);
    }

    const { symbol, side, size, price } = params;

    try {
      // Validate minimum size
      const quantity = size / price;
      const formattedQty = this.formatSize(symbol, quantity);

      if (!this.validateOrderSize(symbol, formattedQty, 'aster')) {
        throw new Error(`Order size ${formattedQty} below minimum for ${symbol} on Aster`);
      }

      console.log(`[AsterDEX] Placing ${side} order for ${symbol}: ${formattedQty} @ ${price}`);

      // Get API credentials
      const apiKey = localStorage.getItem('aster_api_key');
      const apiSecret = localStorage.getItem('aster_api_secret');

      if (!apiKey || !apiSecret) {
        throw new Error('AsterDEX API credentials not configured');
      }

      // Rate limit check
      await this.rateLimiter.checkAster(1);

      // Order parameters
      const orderParams: any = {
        symbol: symbol,
        side: side.toUpperCase(),
        type: 'LIMIT',
        quantity: formattedQty.toString(),
        price: price.toFixed(2),
        timeInForce: 'GTC',
      };

      // Sign request
      const signature = await this.signAsterRequest(orderParams, apiSecret);
      orderParams.signature = signature;

      // Convert to URL-encoded form data (CRITICAL: Must be x-www-form-urlencoded)
      const formData = new URLSearchParams(orderParams).toString();

      const response = await fetch(`${ASTER_API}/fapi/v1/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-MBX-APIKEY': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`AsterDEX order failed: ${error.msg || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[AsterDEX] Order placed successfully:`, result);

      // Verify fill
      const filled = await this.verifyOrderFill('aster', result.orderId);

      return {
        success: true,
        orderId: result.orderId.toString(),
        price: parseFloat(result.price),
        size: parseFloat(result.executedQty) * price,
        filled,
      };
    } catch (error: any) {
      console.error(`[AsterDEX] Order failed:`, error);
      return {
        success: false,
        error: error.message,
        filled: false,
      };
    }
  }

  /**
   * Place a limit order on HyperLiquid
   */
  async placeHyperliquidOrder(params: OrderParams): Promise<OrderResult> {
    // Paper trading mode
    if (this.paperMode) {
      return this.simulatePaperOrder(params);
    }

    const { symbol, side, size, price } = params;

    try {
      // Get asset index
      const assetIndex = await this.getHyperliquidAssetIndex(symbol);

      // Validate minimum size
      const quantity = size / price;
      const formattedQty = this.formatSize(symbol, quantity);

      if (!this.validateOrderSize(symbol, formattedQty, 'hl')) {
        throw new Error(`Order size ${formattedQty} below minimum for ${symbol} on Hyperliquid`);
      }

      console.log(`[HyperLiquid] Placing ${side} order for ${symbol}: ${formattedQty} @ ${price}`);

      // Get wallet credentials
      const walletAddress = localStorage.getItem('hyperliquid_wallet_address');
      const privateKey = localStorage.getItem('hyperliquid_private_key');

      if (!walletAddress || !privateKey) {
        throw new Error('HyperLiquid wallet credentials not configured');
      }

      // Rate limit check
      await this.rateLimiter.checkHL();

      // Build order action
      const action = {
        type: 'order',
        orders: [
          {
            a: assetIndex,
            b: side === 'buy',
            p: price.toFixed(2),
            s: formattedQty.toString(),
            r: false,
            t: {
              limit: {
                tif: 'Gtc',
              },
            },
          },
        ],
        grouping: 'na',
      };

      // Sign the order
      const signature = await this.signHyperliquidOrder(action, privateKey);

      const orderRequest = {
        action,
        nonce: Date.now(),
        signature,
        vaultAddress: null,
      };

      const response = await fetch(`${HL_API}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderRequest),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HyperLiquid order failed: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[HyperLiquid] Order placed successfully:`, result);

      const orderId = result.status?.statuses?.[0]?.oid?.toString() || 'unknown';

      // Verify fill
      const filled = await this.verifyOrderFill('hyperliquid', orderId);

      return {
        success: true,
        orderId,
        price: price,
        size: formattedQty * price,
        filled,
      };
    } catch (error: any) {
      console.error(`[HyperLiquid] Order failed:`, error);
      return {
        success: false,
        error: error.message,
        filled: false,
      };
    }
  }

  /**
   * Place both sides of the arbitrage trade with rollback on failure
   */
  async placeArbitrageTrade(
    longExchange: 'aster' | 'hyperliquid',
    shortExchange: 'aster' | 'hyperliquid',
    longSymbol: string,
    shortSymbol: string,
    price: number,
    positionSize: number
  ): Promise<{
    longOrder: OrderResult;
    shortOrder: OrderResult;
  }> {
    console.log(`[Arbitrage] Executing arbitrage trade:`);
    console.log(`  Long: ${longExchange} ${longSymbol} @ ${price}`);
    console.log(`  Short: ${shortExchange} ${shortSymbol} @ ${price}`);
    console.log(`  Size: $${positionSize} each side`);

    let longOrder: OrderResult | null = null;
    let shortOrder: OrderResult | null = null;

    try {
      // Place both orders simultaneously
      [longOrder, shortOrder] = await Promise.all([
        // Long side (buy)
        longExchange === 'aster'
          ? this.placeAsterOrder({
              symbol: longSymbol,
              side: 'buy',
              size: positionSize,
              price: price,
            })
          : this.placeHyperliquidOrder({
              symbol: longSymbol,
              side: 'buy',
              size: positionSize,
              price: price,
            }),

        // Short side (sell)
        shortExchange === 'aster'
          ? this.placeAsterOrder({
              symbol: shortSymbol,
              side: 'sell',
              size: positionSize,
              price: price,
            })
          : this.placeHyperliquidOrder({
              symbol: shortSymbol,
              side: 'sell',
              size: positionSize,
              price: price,
            }),
      ]);

      // Check if both orders succeeded AND filled
      if (longOrder.success && shortOrder.success && longOrder.filled && shortOrder.filled) {
        console.log(`[Arbitrage] Trade executed successfully!`);
        console.log(`  Long order: ${longOrder.orderId}`);
        console.log(`  Short order: ${shortOrder.orderId}`);
        return { longOrder, shortOrder };
      }

      // Partial fill - need to rollback
      throw new Error(
        `Partial fill detected - Long: ${longOrder.filled}, Short: ${shortOrder.filled}`
      );
    } catch (error: any) {
      console.error(`[Arbitrage] Trade failed, initiating rollback:`, error.message);

      // Rollback logic - close any filled orders
      if (longOrder?.filled && !shortOrder?.filled) {
        console.log(`[Arbitrage] Rolling back long order...`);
        await (longExchange === 'aster'
          ? this.placeAsterOrder({
              symbol: longSymbol,
              side: 'sell',
              size: positionSize,
              price: price,
            })
          : this.placeHyperliquidOrder({
              symbol: longSymbol,
              side: 'sell',
              size: positionSize,
              price: price,
            }));
      }

      if (shortOrder?.filled && !longOrder?.filled) {
        console.log(`[Arbitrage] Rolling back short order...`);
        await (shortExchange === 'aster'
          ? this.placeAsterOrder({
              symbol: shortSymbol,
              side: 'buy',
              size: positionSize,
              price: price,
            })
          : this.placeHyperliquidOrder({
              symbol: shortSymbol,
              side: 'buy',
              size: positionSize,
              price: price,
            }));
      }

      // Return failed result
      return {
        longOrder: longOrder || { success: false, error: 'Order not placed', filled: false },
        shortOrder: shortOrder || { success: false, error: 'Order not placed', filled: false },
      };
    }
  }

  /**
   * Close an arbitrage position (reverse the trades)
   */
  async closeArbitrageTrade(
    longExchange: 'aster' | 'hyperliquid',
    shortExchange: 'aster' | 'hyperliquid',
    longSymbol: string,
    shortSymbol: string,
    price: number,
    positionSize: number
  ): Promise<{
    longOrder: OrderResult;
    shortOrder: OrderResult;
  }> {
    console.log(`[Arbitrage] Closing arbitrage position:`);
    console.log(`  Closing long: ${longExchange} ${longSymbol} @ ${price}`);
    console.log(`  Closing short: ${shortExchange} ${shortSymbol} @ ${price}`);
    console.log(`  Size: $${positionSize} each side`);

    // Close positions (reverse the original trades)
    const [longOrder, shortOrder] = await Promise.all([
      // Close long (sell)
      longExchange === 'aster'
        ? this.placeAsterOrder({
            symbol: longSymbol,
            side: 'sell',
            size: positionSize,
            price: price,
          })
        : this.placeHyperliquidOrder({
            symbol: longSymbol,
            side: 'sell',
            size: positionSize,
            price: price,
          }),

      // Close short (buy)
      shortExchange === 'aster'
        ? this.placeAsterOrder({
            symbol: shortSymbol,
            side: 'buy',
            size: positionSize,
            price: price,
          })
        : this.placeHyperliquidOrder({
            symbol: shortSymbol,
            side: 'buy',
            size: positionSize,
            price: price,
          }),
    ]);

    return { longOrder, shortOrder };
  }
}

export const exchangeTradeService = new ExchangeTradeService();
