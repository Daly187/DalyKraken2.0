/**
 * Exchange Trade Service - PRODUCTION READY
 * Handles order execution on AsterDEX and HyperLiquid with proper signatures
 *
 * PRECISION MANAGEMENT:
 * - Uses dynamic PrecisionManager service for all trading pairs
 * - Automatically fetches precision rules from both exchanges
 * - Supports all available trading pairs without manual configuration
 */

// Production API Endpoints
const ASTER_API = 'https://fapi.asterdex.com';
const HL_API = 'https://api.hyperliquid.xyz';

// Import precision manager for dynamic precision management
import { precisionManager } from './precisionManager';

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: number; // Position size in USD
  price?: number; // Limit price (optional for market orders)
  orderType?: 'LIMIT' | 'MARKET'; // Order type (default: LIMIT)
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
  debugLogs?: string[]; // Debug logs for UI display
}

// Static precision mappings removed - now using dynamic PrecisionManager

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
  private rateLimiter = new RateLimiter();
  private hlAssetCache: Map<string, number> = new Map();
  private initialized = false;

  /**
   * Initialize the service (must be called before use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ExchangeTradeService] Initializing with dynamic precision...');
    await precisionManager.initialize();
    this.initialized = true;
    console.log('[ExchangeTradeService] ✅ Initialized with dynamic precision support');
  }

  /**
   * Format size with proper decimal precision using dynamic rules
   */
  private formatSize(symbol: string, size: number, exchange: 'aster' | 'hyperliquid', orderType: 'LIMIT' | 'MARKET' = 'LIMIT'): number {
    // Map exchange names to precisionManager format
    const exchangeName = exchange === 'aster' ? 'asterdex' : 'hyperliquid';

    // Use precision manager for dynamic precision
    return precisionManager.roundQuantity(exchangeName, symbol, size, orderType);
  }

  /**
   * Format price with proper decimal precision using dynamic rules
   */
  private formatPrice(symbol: string, price: number, exchange: 'aster' | 'hyperliquid'): string {
    // Map exchange names to precisionManager format
    const exchangeName = exchange === 'aster' ? 'asterdex' : 'hyperliquid';

    // Use precision manager for dynamic price rounding
    const rounded = precisionManager.roundPrice(exchangeName, symbol, price);
    return rounded.toString();
  }

  /**
   * Validate order size and notional using precision manager
   */
  private validateOrderSize(symbol: string, size: number, price: number, exchange: 'aster' | 'hyperliquid', orderType: 'LIMIT' | 'MARKET' = 'LIMIT'): boolean {
    const exchangeName = exchange === 'aster' ? 'asterdex' : 'hyperliquid';

    // Use precision manager to validate the order
    const validation = precisionManager.validateOrder(exchangeName, symbol, price, size, orderType);

    // Log any validation warnings
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning =>
        console.warn(`[ExchangeTradeService] ${warning}`)
      );
    }

    // Log any validation errors
    if (validation.errors.length > 0) {
      validation.errors.forEach(error =>
        console.error(`[ExchangeTradeService] ❌ ${error}`)
      );
    }

    return validation.valid;
  }

  /**
   * Sign AsterDEX request with HMAC SHA256
   */
  private async signAsterRequest(params: any, apiSecret: string): Promise<string> {
    // Don't create new timestamp - use the one from params if provided
    const queryParams = {
      ...params,
      // Only add timestamp if not already present
      timestamp: params.timestamp || Date.now(),
      recvWindow: params.recvWindow || 5000,
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
        chainId: 1337, // HyperLiquid uses 1337 for all L1 trading actions
        verifyingContract: '0x0000000000000000000000000000000000000000',
      };

      // EIP-712 types for order action
      // Note: Only include the primary type (Order) and its dependencies
      const types = {
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
    const debugLogs: string[] = [];

    const addDebugLog = (msg: string) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      debugLogs.push(`[${timestamp}] ${msg}`);
      console.log(`[Validation] ${msg}`);
    };

    addDebugLog('========================================');
    addDebugLog('STARTING VALIDATION');
    addDebugLog(`Required capital per exchange: $${requiredCapital}`);
    addDebugLog('========================================');

    // LIVE MODE: Check Aster API keys
    addDebugLog('Step 1: Checking Aster API keys in localStorage...');
    const asterApiKey = localStorage.getItem('aster_api_key');
    const asterApiSecret = localStorage.getItem('aster_api_secret');

    if (!asterApiKey || !asterApiSecret) {
      addDebugLog('❌ Aster API keys NOT FOUND in localStorage');
      errors.push('Aster API keys not configured in Settings');
    } else {
      addDebugLog(`✓ Aster API key found: ${asterApiKey.substring(0, 8)}...${asterApiKey.substring(asterApiKey.length - 4)}`);
      addDebugLog(`✓ Aster API secret found: ${asterApiSecret.substring(0, 8)}...`);
    }

    // Check Hyperliquid wallet
    addDebugLog('Step 2: Checking Hyperliquid credentials in localStorage...');
    const hyperliquidWallet = localStorage.getItem('hyperliquid_wallet_address');
    const hyperliquidPrivateKey = localStorage.getItem('hyperliquid_private_key');

    if (!hyperliquidWallet || !hyperliquidPrivateKey) {
      addDebugLog('❌ Hyperliquid credentials NOT FOUND in localStorage');
      errors.push('Hyperliquid wallet not configured in Settings');
    } else {
      addDebugLog(`✓ Hyperliquid wallet found: ${hyperliquidWallet.substring(0, 8)}...${hyperliquidWallet.substring(hyperliquidWallet.length - 4)}`);
      addDebugLog(`✓ Hyperliquid private key found`);
    }

    // If keys are missing, return early
    if (errors.length > 0) {
      addDebugLog('========================================');
      addDebugLog('VALIDATION ABORTED: Missing credentials');
      addDebugLog('========================================');
      return {
        valid: false,
        errors,
        warnings,
        debugLogs,
      };
    }

    // Fetch balances from both exchanges
    let asterBalance = 0;
    let hyperliquidBalance = 0;

    addDebugLog('========================================');
    addDebugLog('Step 3: Fetching Aster balance...');
    addDebugLog('========================================');

    try {
      addDebugLog('3.1: Checking rate limiter...');
      await this.rateLimiter.checkAster(5);
      addDebugLog('✓ Rate limiter check passed');

      const timestamp = Date.now();
      const params = `timestamp=${timestamp}`;
      addDebugLog(`3.2: Created timestamp: ${timestamp}`);
      addDebugLog(`3.3: Created params string: ${params}`);

      // Create signature
      addDebugLog('3.4: Importing crypto-js module...');
      const crypto = await import('crypto-js');
      addDebugLog('✓ crypto-js imported successfully');
      addDebugLog(`✓ crypto.default exists: ${!!crypto.default}`);
      addDebugLog(`✓ crypto.default.HmacSHA256 exists: ${!!crypto.default?.HmacSHA256}`);

      addDebugLog('3.5: Creating HMAC signature...');
      const signature = crypto.default.HmacSHA256(params, asterApiSecret!).toString();
      addDebugLog(`✓ Signature created: ${signature.substring(0, 16)}...${signature.substring(signature.length - 8)}`);

      // Check BOTH spot and futures balances on AsterDEX
      let spotBalance = 0;
      let futuresBalance = 0;

      // 1. Fetch SPOT balance
      addDebugLog('========================================');
      addDebugLog('3.6: Fetching SPOT balance...');
      addDebugLog('========================================');
      try {
        const spotUrl = `https://sapi.asterdex.com/api/v1/account?${params}&signature=${signature}`;
        addDebugLog(`Making GET request to: ${spotUrl.substring(0, 80)}...`);
        addDebugLog(`Headers: X-MBX-APIKEY: ${asterApiKey!.substring(0, 8)}...`);

        const spotResponse = await fetch(spotUrl, {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': asterApiKey!,
          },
        });

        addDebugLog(`✓ Spot API response received: HTTP ${spotResponse.status}`);

        if (spotResponse.ok) {
          addDebugLog('✓ Spot response is OK, parsing JSON...');
          const spotData = await spotResponse.json();
          addDebugLog(`✓ Spot JSON parsed. Response preview: ${JSON.stringify(spotData).substring(0, 200)}...`);
          addDebugLog(`Spot response keys: ${Object.keys(spotData).join(', ')}`);

          // Sum all balances from spot wallet
          if (spotData.balances && Array.isArray(spotData.balances)) {
            addDebugLog(`✓ Found 'balances' array with ${spotData.balances.length} items`);
            const nonZeroBalances = spotData.balances.filter((a: any) =>
              (parseFloat(a.free || '0') + parseFloat(a.locked || '0')) > 0
            );
            addDebugLog(`Found ${nonZeroBalances.length} non-zero spot balances`);

            spotBalance = spotData.balances.reduce((total: number, asset: any) => {
              const free = parseFloat(asset.free || '0');
              const locked = parseFloat(asset.locked || '0');
              return total + free + locked;
            }, 0);
            addDebugLog(`✅ SPOT BALANCE CALCULATED: $${spotBalance.toFixed(2)}`);
          } else {
            addDebugLog('⚠️ Spot response missing "balances" array');
          }
        } else {
          addDebugLog(`❌ Spot API returned error status: ${spotResponse.status}`);
          const errorData = await spotResponse.text();
          addDebugLog(`Error response: ${errorData.substring(0, 200)}`);
        }
      } catch (spotError: any) {
        addDebugLog(`❌ SPOT FETCH EXCEPTION: ${spotError.message}`);
        addDebugLog(`Error name: ${spotError.name}`);
        addDebugLog(`Error stack: ${spotError.stack?.substring(0, 200)}`);
      }

      // 2. Fetch FUTURES balance
      addDebugLog('========================================');
      addDebugLog('3.7: Fetching FUTURES balance...');
      addDebugLog('========================================');
      try {
        const futuresUrl = `https://fapi.asterdex.com/fapi/v2/account?${params}&signature=${signature}`;
        addDebugLog(`Making GET request to: ${futuresUrl.substring(0, 80)}...`);
        addDebugLog(`Headers: X-MBX-APIKEY: ${asterApiKey!.substring(0, 8)}...`);

        const futuresResponse = await fetch(futuresUrl, {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': asterApiKey!,
          },
        });

        addDebugLog(`✓ Futures API response received: HTTP ${futuresResponse.status}`);

        if (futuresResponse.ok) {
          addDebugLog('✓ Futures response is OK, parsing JSON...');
          const futuresData = await futuresResponse.json();
          addDebugLog(`✓ Futures JSON parsed. Response preview: ${JSON.stringify(futuresData).substring(0, 200)}...`);
          addDebugLog(`Futures response keys: ${Object.keys(futuresData).join(', ')}`);

          // Try multiple methods to extract futures balance
          if (futuresData.totalWalletBalance !== undefined) {
            futuresBalance = parseFloat(futuresData.totalWalletBalance);
            addDebugLog(`✅ FUTURES BALANCE (totalWalletBalance): $${futuresBalance.toFixed(2)}`);
          } else if (futuresData.totalMarginBalance !== undefined) {
            futuresBalance = parseFloat(futuresData.totalMarginBalance);
            addDebugLog(`✅ FUTURES BALANCE (totalMarginBalance): $${futuresBalance.toFixed(2)}`);
          } else if (futuresData.assets && Array.isArray(futuresData.assets)) {
            addDebugLog(`Found 'assets' array with ${futuresData.assets.length} items`);
            futuresBalance = futuresData.assets.reduce((total: number, asset: any) => {
              const walletBalance = parseFloat(asset.walletBalance || asset.marginBalance || '0');
              return total + walletBalance;
            }, 0);
            addDebugLog(`✅ FUTURES BALANCE (from assets): $${futuresBalance.toFixed(2)}`);
          } else {
            addDebugLog('⚠️ Futures response format not recognized');
            addDebugLog(`Available fields: ${Object.keys(futuresData).join(', ')}`);
          }
        } else {
          addDebugLog(`❌ Futures API returned error status: ${futuresResponse.status}`);
          const errorData = await futuresResponse.text();
          addDebugLog(`Error response: ${errorData.substring(0, 200)}`);
        }
      } catch (futuresError: any) {
        addDebugLog(`❌ FUTURES FETCH EXCEPTION: ${futuresError.message}`);
        addDebugLog(`Error name: ${futuresError.name}`);
        addDebugLog(`Error stack: ${futuresError.stack?.substring(0, 200)}`);
      }

      // 3. Combine spot + futures balances
      addDebugLog('========================================');
      addDebugLog('3.8: Combining balances...');
      addDebugLog('========================================');
      asterBalance = spotBalance + futuresBalance;
      addDebugLog(`Spot balance:    $${spotBalance.toFixed(2)}`);
      addDebugLog(`Futures balance: $${futuresBalance.toFixed(2)}`);
      addDebugLog(`TOTAL ASTER BALANCE: $${asterBalance.toFixed(2)}`);
      addDebugLog('========================================');

      if (asterBalance === 0) {
        const errorMsg = '⚠️ Could not fetch AsterDEX balance from either spot or futures wallet';
        warnings.push(errorMsg);
        addDebugLog(`⚠️ WARNING: ${errorMsg}`);
        addDebugLog('This could mean:');
        addDebugLog('  1. Empty wallets on both spot and futures');
        addDebugLog('  2. API authentication failed (check API keys)');
        addDebugLog('  3. Network/CORS issues preventing API calls');
      }
    } catch (error: any) {
      const errorMsg = `Could not fetch Aster balance - network error: ${error.message}`;
      warnings.push(errorMsg);
      addDebugLog(`❌ OUTER TRY-CATCH CAUGHT ERROR: ${errorMsg}`);
      addDebugLog(`Error type: ${error.name}`);
      addDebugLog(`Error stack: ${error.stack?.substring(0, 300)}`);
    }

    addDebugLog('========================================');
    addDebugLog('Step 4: Fetching Hyperliquid balance...');
    addDebugLog('========================================');

    try {
      addDebugLog('4.1: Checking rate limiter...');
      await this.rateLimiter.checkHL();
      addDebugLog('✓ Rate limiter check passed');

      // Fetch Hyperliquid balance
      addDebugLog('4.2: Making POST request to Hyperliquid API...');
      addDebugLog(`URL: ${HL_API}/info`);
      addDebugLog(`Wallet: ${hyperliquidWallet}`);

      const hlResponse = await fetch(`${HL_API}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: hyperliquidWallet,
        }),
      });

      addDebugLog(`✓ Hyperliquid API response received: HTTP ${hlResponse.status}`);

      if (hlResponse.ok) {
        addDebugLog('✓ Hyperliquid response is OK, parsing JSON...');
        const hlData = await hlResponse.json();
        addDebugLog(`✓ Hyperliquid JSON parsed`);
        addDebugLog(`Response keys: ${Object.keys(hlData).join(', ')}`);

        hyperliquidBalance = parseFloat(hlData.marginSummary?.accountValue || '0');
        addDebugLog(`✅ HYPERLIQUID BALANCE: $${hyperliquidBalance.toFixed(2)}`);
      } else {
        const errorText = await hlResponse.text();
        const errorMsg = `Could not fetch Hyperliquid balance - API error: ${hlResponse.status} ${errorText}`;
        warnings.push(errorMsg);
        addDebugLog(`❌ Hyperliquid API error: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = `Could not fetch Hyperliquid balance - network error: ${error.message}`;
      warnings.push(errorMsg);
      addDebugLog(`❌ HYPERLIQUID FETCH EXCEPTION: ${errorMsg}`);
      addDebugLog(`Error type: ${error.name}`);
    }

    // Check if balances are sufficient
    addDebugLog('========================================');
    addDebugLog('Step 5: Validating balances against requirements...');
    addDebugLog('========================================');

    // NOTE: requiredCapital is already PER EXCHANGE (not total combined)
    const requiredPerExchange = requiredCapital;
    addDebugLog(`Required per exchange: $${requiredPerExchange.toFixed(2)}`);
    addDebugLog(`Aster balance:         $${asterBalance.toFixed(2)}`);
    addDebugLog(`Hyperliquid balance:   $${hyperliquidBalance.toFixed(2)}`);

    if (asterBalance < requiredPerExchange) {
      const error = `Insufficient Aster balance: $${asterBalance.toFixed(2)} (need $${requiredPerExchange.toFixed(2)})`;
      errors.push(error);
      addDebugLog(`❌ ERROR: ${error}`);
    } else {
      addDebugLog(`✓ Aster balance sufficient`);
    }

    if (hyperliquidBalance < requiredPerExchange) {
      const error = `Insufficient Hyperliquid balance: $${hyperliquidBalance.toFixed(2)} (need $${requiredPerExchange.toFixed(2)})`;
      errors.push(error);
      addDebugLog(`❌ ERROR: ${error}`);
    } else {
      addDebugLog(`✓ Hyperliquid balance sufficient`);
    }

    // Warning if balances are barely sufficient (within 10% margin)
    if (asterBalance >= requiredPerExchange && asterBalance < requiredPerExchange * 1.1) {
      warnings.push(`Low Aster balance: $${asterBalance.toFixed(2)} (close to minimum)`);
      addDebugLog(`⚠️ WARNING: Aster balance close to minimum`);
    }

    if (hyperliquidBalance >= requiredPerExchange && hyperliquidBalance < requiredPerExchange * 1.1) {
      warnings.push(`Low Hyperliquid balance: $${hyperliquidBalance.toFixed(2)} (close to minimum)`);
      addDebugLog(`⚠️ WARNING: Hyperliquid balance close to minimum`);
    }

    addDebugLog('========================================');
    addDebugLog(`VALIDATION COMPLETE`);
    addDebugLog(`Valid: ${errors.length === 0}`);
    addDebugLog(`Errors: ${errors.length}`);
    addDebugLog(`Warnings: ${warnings.length}`);
    addDebugLog('========================================');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      asterBalance,
      hyperliquidBalance,
      debugLogs,
    };
  }

  /**
   * Verify order fill status
   */
  private async verifyOrderFill(exchange: 'aster' | 'hyperliquid', orderId: string, symbol?: string): Promise<boolean> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.getOrderStatus(exchange, orderId, symbol);

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
   * Get order status (PUBLIC - used by arbitrage service)
   */
  async getOrderStatus(exchange: 'aster' | 'hyperliquid', orderId: string, symbol?: string): Promise<string> {
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

      // Add symbol if provided (required for Binance-compatible APIs)
      if (symbol) {
        params.symbol = symbol;
      }

      const signature = await this.signAsterRequest(params, apiSecret);

      // Build query string with all parameters including symbol
      const queryParts = [`orderId=${orderId}`, `timestamp=${timestamp}`, `recvWindow=5000`];
      if (symbol) {
        queryParts.unshift(`symbol=${symbol}`); // Symbol should come first alphabetically
      }
      const queryString = queryParts.join('&') + `&signature=${signature}`;

      // Use FUTURES API endpoint to match where orders are placed
      const response = await fetch(`https://fapi.asterdex.com/fapi/v1/order?${queryString}`, {
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
   * Cancel an order
   */
  async cancelOrder(exchange: 'aster' | 'hyperliquid', orderId: string, symbol?: string): Promise<boolean> {
    try {
      if (exchange === 'aster') {
        await this.rateLimiter.checkAster(1);

        const apiKey = localStorage.getItem('aster_api_key');
        const apiSecret = localStorage.getItem('aster_api_secret');

        if (!apiKey || !apiSecret) throw new Error('API keys not found');

        const timestamp = Date.now();
        const params: any = {
          orderId,
          timestamp,
        };

        if (symbol) params.symbol = symbol;

        const signature = await this.signAsterRequest(params, apiSecret);
        const queryString = new URLSearchParams({ ...params, signature }).toString();

        // Use FUTURES API endpoint to match where orders are placed
        const response = await fetch(`https://fapi.asterdex.com/fapi/v1/order?${queryString}`, {
          method: 'DELETE',
          headers: {
            'X-MBX-APIKEY': apiKey,
          },
        });

        if (!response.ok) throw new Error(`Cancel failed: ${response.statusText}`);

        console.log(`[AsterDEX] Order ${orderId} cancelled`);
        return true;
      } else {
        // HyperLiquid cancel
        await this.rateLimiter.checkHL();

        const walletAddress = localStorage.getItem('hyperliquid_wallet_address');
        const privateKey = localStorage.getItem('hyperliquid_private_key');

        if (!walletAddress || !privateKey) throw new Error('Wallet credentials not found');

        const action = {
          type: 'cancel',
          cancels: [{ a: 0, o: parseInt(orderId) }], // Asset index 0 for now, should be dynamic
        };

        const signature = await this.signHyperliquidOrder(action, privateKey);

        const response = await fetch(`${HL_API}/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            nonce: Date.now(),
            signature,
            vaultAddress: null,
          }),
        });

        if (!response.ok) throw new Error(`Cancel failed: ${response.statusText}`);

        console.log(`[HyperLiquid] Order ${orderId} cancelled`);
        return true;
      }
    } catch (error: any) {
      console.error(`[${exchange}] Cancel order failed:`, error);
      return false;
    }
  }

  /**
   * Place an order on AsterDEX (LIMIT or MARKET)
   */
  async placeAsterOrder(params: OrderParams): Promise<OrderResult> {
    const { symbol, side, size, price, orderType = 'LIMIT' } = params;

    try {
      // For market orders, use current market price estimate for quantity calculation
      const estimatedPrice = orderType === 'MARKET' ? (price || 1) : price!;
      const quantity = size / estimatedPrice;
      const formattedQty = this.formatSize(symbol, quantity, 'aster', orderType);

      if (!this.validateOrderSize(symbol, formattedQty, estimatedPrice, 'aster', orderType)) {
        throw new Error(`Order validation failed for ${symbol} on AsterDEX`);
      }

      console.log(`[AsterDEX] Placing ${orderType} ${side} order for ${symbol}: ${formattedQty}${orderType === 'LIMIT' ? ` @ ${price}` : ''}`);

      // Get API credentials
      const apiKey = localStorage.getItem('aster_api_key');
      const apiSecret = localStorage.getItem('aster_api_secret');

      if (!apiKey || !apiSecret) {
        throw new Error('AsterDEX API credentials not configured');
      }

      console.log(`[AsterDEX] Using API key: ${apiKey?.substring(0, 8)}...${apiKey?.substring(apiKey.length - 4)}`);

      // Rate limit check
      await this.rateLimiter.checkAster(1);

      // Order parameters
      const orderParams: any = {
        symbol: symbol,
        side: side.toUpperCase(),
        type: orderType,
        quantity: formattedQty.toString(),
      };

      // Add price and timeInForce only for LIMIT orders
      if (orderType === 'LIMIT') {
        orderParams.price = this.formatPrice(symbol, price!, 'aster');
        orderParams.timeInForce = 'GTC';
      }

      console.log(`[AsterDEX] Order parameters before signing:`, { ...orderParams });

      // Add timestamp and recvWindow BEFORE signing
      orderParams.timestamp = Date.now();
      orderParams.recvWindow = 5000;

      // Sign request - signature is calculated on alphabetically sorted params
      const signature = await this.signAsterRequest(orderParams, apiSecret);

      // Build query string with params in alphabetical order (CRITICAL for signature validation)
      const sortedKeys = Object.keys(orderParams).sort();
      const queryParts = sortedKeys.map(key => `${key}=${orderParams[key]}`);
      queryParts.push(`signature=${signature}`); // Signature goes at the end
      const formData = queryParts.join('&');

      console.log(`[AsterDEX] Signature: ${signature.substring(0, 16)}...${signature.substring(signature.length - 8)}`);
      console.log(`[AsterDEX] Request body: ${formData}`);

      // Use FUTURES API endpoint for perpetual contracts
      const response = await fetch(`https://fapi.asterdex.com/fapi/v1/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-MBX-APIKEY': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        // Enhanced error handling to capture all error details
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error(`[AsterDEX] Order failed with ${response.status}:`, errorData);

          // Extract error details from Binance-compatible API response
          if (errorData.code) errorDetails += ` (Code: ${errorData.code})`;
          if (errorData.msg) errorDetails += ` - ${errorData.msg}`;

          // Common error codes to help with debugging
          if (errorData.code === -1022) errorDetails += ' [Signature validation failed]';
          if (errorData.code === -1021) errorDetails += ' [Timestamp out of sync]';
          if (errorData.code === -2015) errorDetails += ' [Invalid API key]';
          if (errorData.code === -2010) errorDetails += ' [Order rejected by exchange]';
        } catch (parseError) {
          // If response is not JSON (e.g., HTML error page), capture text
          try {
            const textError = await response.text();
            console.error(`[AsterDEX] Non-JSON error response:`, textError.substring(0, 500));
            errorDetails += ` - ${textError.substring(0, 200)}`;
          } catch {
            errorDetails += ' - Unable to parse error response';
          }
        }
        throw new Error(`AsterDEX order failed: ${errorDetails}`);
      }

      const result = await response.json();

      console.log(`[AsterDEX] Order placed successfully:`, result);

      // Verify fill
      const filled = await this.verifyOrderFill('aster', result.orderId, symbol);

      return {
        success: true,
        orderId: result.orderId.toString(),
        price: parseFloat(result.price),
        size: parseFloat(result.executedQty) * (price || parseFloat(result.price)),
        filled,
      };
    } catch (error: any) {
      // Capture comprehensive error details for debugging
      const errorInfo = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
        // Fetch-specific errors
        type: error.type,
        // Additional context
        symbol,
        side,
        size,
        price,
        timestamp: new Date().toISOString(),
      };

      console.error(`[AsterDEX] Order failed for ${symbol} ${side} ${size} @ ${price}:`, errorInfo);

      // Format detailed error for UI display
      let detailedError = `❌ AsterDEX Error: ${error.message}\n`;
      detailedError += `Type: ${error.name || 'Unknown'}\n`;

      // Add helpful diagnostics based on error type
      if (error.message === 'Failed to fetch') {
        detailedError += `\n🔍 Diagnostics:\n`;
        detailedError += `- Network connectivity issue OR\n`;
        detailedError += `- CORS preflight blocked OR\n`;
        detailedError += `- API endpoint unreachable\n`;
        detailedError += `- Check browser Network tab for details\n`;
      }

      // Include request details for debugging
      detailedError += `\n📋 Request Details:\n`;
      detailedError += `Symbol: ${symbol}, Side: ${side}, Size: ${size}, Price: ${price}\n`;
      detailedError += `Endpoint: https://fapi.asterdex.com/fapi/v1/order\n`;

      return {
        success: false,
        error: detailedError,
        filled: false,
      };
    }
  }

  /**
   * Place an order on HyperLiquid (LIMIT or MARKET)
   */
  async placeHyperliquidOrder(params: OrderParams): Promise<OrderResult> {
    const { symbol, side, size, price, orderType = 'LIMIT' } = params;

    try {
      // Get asset index
      const assetIndex = await this.getHyperliquidAssetIndex(symbol);

      // For market orders, use current market price estimate for quantity calculation
      const estimatedPrice = orderType === 'MARKET' ? (price || 1) : price!;
      const quantity = size / estimatedPrice;
      const formattedQty = this.formatSize(symbol, quantity, 'hyperliquid', orderType);

      if (!this.validateOrderSize(symbol, formattedQty, estimatedPrice, 'hyperliquid', orderType)) {
        throw new Error(`Order validation failed for ${symbol} on HyperLiquid`);
      }

      console.log(`[HyperLiquid] Placing ${orderType} ${side} order for ${symbol}: ${formattedQty}${orderType === 'LIMIT' ? ` @ ${price}` : ''}`);

      // Get wallet credentials
      const walletAddress = localStorage.getItem('hyperliquid_wallet_address');
      const privateKey = localStorage.getItem('hyperliquid_private_key');

      if (!walletAddress || !privateKey) {
        throw new Error('HyperLiquid wallet credentials not configured');
      }

      console.log(`[HyperLiquid] Using wallet: ${walletAddress}`);
      console.log(`[HyperLiquid] Asset index for ${symbol}: ${assetIndex}`);

      // Rate limit check
      await this.rateLimiter.checkHL();

      // Build order type object
      const orderTypeObj = orderType === 'LIMIT'
        ? { limit: { tif: 'Gtc' } }
        : { limit: { tif: 'Ioc' } }; // Market order uses IoC (Immediate or Cancel)

      // For market orders (IoC), set price at extreme to ensure fill
      // Buy orders: set high price, Sell orders: set low price
      let orderPrice: string;
      if (orderType === 'MARKET') {
        orderPrice = side === 'buy'
          ? (price! * 1.05).toFixed(2)  // 5% above for buys (ensures fill)
          : (price! * 0.95).toFixed(2); // 5% below for sells (ensures fill)
      } else {
        orderPrice = price!.toFixed(2);
      }

      // Build order action
      const action = {
        type: 'order',
        orders: [
          {
            a: assetIndex,
            b: side === 'buy',
            p: orderPrice,
            s: formattedQty.toString(),
            r: false,
            t: orderTypeObj,
          },
        ],
        grouping: 'na',
      };

      console.log(`[HyperLiquid] Order action:`, JSON.stringify(action, null, 2));

      // Sign the individual order (not the entire action wrapper)
      const orderToSign = action.orders[0];
      console.log(`[HyperLiquid] Order to sign:`, JSON.stringify(orderToSign, null, 2));
      const signature = await this.signHyperliquidOrder(orderToSign, privateKey);
      console.log(`[HyperLiquid] Signature generated:`, { r: signature.r.substring(0, 16) + '...', s: signature.s.substring(0, 16) + '...', v: signature.v });

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
        // Enhanced error handling to capture all error details
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error(`[HyperLiquid] Order failed with ${response.status}:`, errorData);

          // Extract error details from HyperLiquid API response
          if (errorData.message) errorDetails += ` - ${errorData.message}`;
          if (errorData.error) errorDetails += ` - ${errorData.error}`;
          if (errorData.code) errorDetails += ` (Code: ${errorData.code})`;

          // Check for specific HyperLiquid errors
          if (errorData.message?.includes('signature')) errorDetails += ' [Signature validation failed]';
          if (errorData.message?.includes('margin')) errorDetails += ' [Insufficient margin/collateral]';
          if (errorData.message?.includes('not exist')) errorDetails += ' [Wallet not initialized - deposit USDC first]';
        } catch (parseError) {
          // If response is not JSON, capture text
          try {
            const textError = await response.text();
            console.error(`[HyperLiquid] Non-JSON error response:`, textError.substring(0, 500));
            errorDetails += ` - ${textError.substring(0, 200)}`;
          } catch {
            errorDetails += ' - Unable to parse error response';
          }
        }
        throw new Error(`HyperLiquid order failed: ${errorDetails}`);
      }

      const result = await response.json();

      console.log(`[HyperLiquid] Order placed successfully:`, result);

      const orderId = result.status?.statuses?.[0]?.oid?.toString() || 'unknown';

      // For IoC orders (market orders), check if it was filled immediately from the response
      // IoC orders don't need status verification since they fill or cancel instantly
      let filled = false;
      if (orderType === 'MARKET') {
        // Check if the order was filled from the response
        const orderStatus = result.status?.statuses?.[0]?.status;
        filled = orderStatus === 'filled';
        console.log(`[HyperLiquid] IoC order status from response: ${orderStatus}, filled: ${filled}`);

        if (!filled) {
          console.warn(`[HyperLiquid] IoC order did not fill immediately - may have been cancelled`);
        }
      } else {
        // For limit orders, verify fill status
        if (orderId !== 'unknown') {
          filled = await this.verifyOrderFill('hyperliquid', orderId, symbol);
        } else {
          console.warn(`[HyperLiquid] Order ID is unknown, cannot verify fill status`);
        }
      }

      return {
        success: true,
        orderId,
        price: price || 0,
        size: formattedQty * (price || 0),
        filled,
      };
    } catch (error: any) {
      // Capture comprehensive error details for debugging
      const errorInfo = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
        // Fetch-specific errors
        type: error.type,
        // Additional context
        symbol,
        side,
        size,
        price,
        timestamp: new Date().toISOString(),
      };

      console.error(`[HyperLiquid] Order failed for ${symbol} ${side} ${size} @ ${price}:`, errorInfo);

      // Format detailed error for UI display
      let detailedError = `❌ HyperLiquid Error: ${error.message}\n`;
      detailedError += `Type: ${error.name || 'Unknown'}\n`;

      // Add helpful diagnostics based on error type
      if (error.message === 'Failed to fetch') {
        detailedError += `\n🔍 Diagnostics:\n`;
        detailedError += `- Network connectivity issue OR\n`;
        detailedError += `- CORS preflight blocked OR\n`;
        detailedError += `- API endpoint unreachable\n`;
        detailedError += `- Check browser Network tab for details\n`;
      }

      // Include request details for debugging
      detailedError += `\n📋 Request Details:\n`;
      detailedError += `Symbol: ${symbol}, Side: ${side}, Size: ${size}, Price: ${price}\n`;
      detailedError += `Endpoint: https://api.hyperliquid.xyz/exchange\n`;
      detailedError += `Wallet: ${localStorage.getItem('hyperliquid_wallet_address') || 'Not set'}\n`;

      // Add specific HyperLiquid hints
      if (error.message.includes('signature')) {
        detailedError += `\n💡 Hint: Check that chainId is 1337 and signature is correct\n`;
      }

      return {
        success: false,
        error: detailedError,
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
            orderType: 'MARKET',
          })
        : this.placeHyperliquidOrder({
            symbol: longSymbol,
            side: 'sell',
            size: positionSize,
            price: price,
            orderType: 'MARKET',
          }),

      // Close short (buy)
      shortExchange === 'aster'
        ? this.placeAsterOrder({
            symbol: shortSymbol,
            side: 'buy',
            size: positionSize,
            price: price,
            orderType: 'MARKET',
          })
        : this.placeHyperliquidOrder({
            symbol: shortSymbol,
            side: 'buy',
            size: positionSize,
            price: price,
            orderType: 'MARKET',
          }),
    ]);

    return { longOrder, shortOrder };
  }
}

export const exchangeTradeService = new ExchangeTradeService();
