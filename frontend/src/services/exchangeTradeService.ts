/**
 * Exchange Trade Service
 * Handles order execution on AsterDEX and HyperLiquid
 */

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
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  asterBalance?: number;
  hyperliquidBalance?: number;
}

class ExchangeTradeService {
  /**
   * Validate API keys and balances before trading
   */
  async validateTradingReadiness(requiredCapital: number): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check Aster API keys
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
      // Fetch Aster balance
      const timestamp = Date.now();
      const params = `timestamp=${timestamp}`;
      const crypto = await import('crypto-js');
      const signature = crypto.default.HmacSHA256(params, asterApiSecret!).toString();

      const asterResponse = await fetch(`https://fapi.asterdex.com/fapi/v1/account?${params}&signature=${signature}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': asterApiKey!,
        },
      });

      if (asterResponse.ok) {
        const asterData = await asterResponse.json();
        asterBalance = parseFloat(asterData.totalWalletBalance || '0');
      } else {
        warnings.push('Could not fetch Aster balance - API error');
      }
    } catch (error) {
      warnings.push('Could not fetch Aster balance - network error');
    }

    try {
      // Fetch Hyperliquid balance
      const hlResponse = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: hyperliquidWallet
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
    // Need at least 50% of required capital on each exchange
    const requiredPerExchange = requiredCapital / 2;

    if (asterBalance < requiredPerExchange) {
      errors.push(`Insufficient Aster balance: $${asterBalance.toFixed(2)} (need $${requiredPerExchange.toFixed(2)})`);
    }

    if (hyperliquidBalance < requiredPerExchange) {
      errors.push(`Insufficient Hyperliquid balance: $${hyperliquidBalance.toFixed(2)} (need $${requiredPerExchange.toFixed(2)})`);
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
   * Place a limit order on AsterDEX
   */
  async placeAsterOrder(params: OrderParams): Promise<OrderResult> {
    const { symbol, side, size, price } = params;

    try {
      console.log(`[AsterDEX] Placing ${side} order for ${symbol}: ${size} USD @ ${price}`);

      // Get API credentials
      const apiKey = localStorage.getItem('aster_api_key');
      const apiSecret = localStorage.getItem('aster_api_secret');

      if (!apiKey || !apiSecret) {
        throw new Error('AsterDEX API credentials not configured');
      }

      // Calculate quantity from USD size and price
      const quantity = size / price;

      // AsterDEX uses Binance Futures-compatible API
      // POST /fapi/v1/order
      const endpoint = 'https://fapi.asterdex.com/fapi/v1/order';

      const orderParams = {
        symbol: symbol,
        side: side.toUpperCase(), // BUY or SELL
        type: 'LIMIT',
        quantity: quantity.toFixed(8),
        price: price.toFixed(2),
        timeInForce: 'GTC', // Good Till Cancel
        timestamp: Date.now(),
      };

      // TODO: Implement proper signing for AsterDEX
      // For now, this is a placeholder structure
      // You'll need to add HMAC SHA256 signature like Binance

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MBX-APIKEY': apiKey,
        },
        body: JSON.stringify(orderParams),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`AsterDEX order failed: ${error.msg || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[AsterDEX] Order placed successfully:`, result);

      return {
        success: true,
        orderId: result.orderId,
        price: parseFloat(result.price),
        size: parseFloat(result.executedQty) * price,
      };
    } catch (error: any) {
      console.error(`[AsterDEX] Order failed:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Place a limit order on HyperLiquid
   */
  async placeHyperliquidOrder(params: OrderParams): Promise<OrderResult> {
    const { symbol, side, size, price } = params;

    try {
      console.log(`[HyperLiquid] Placing ${side} order for ${symbol}: ${size} USD @ ${price}`);

      // Get wallet credentials
      const walletAddress = localStorage.getItem('hyperliquid_wallet_address');
      const privateKey = localStorage.getItem('hyperliquid_private_key');

      if (!walletAddress || !privateKey) {
        throw new Error('HyperLiquid wallet credentials not configured');
      }

      // Calculate quantity from USD size and price
      const quantity = size / price;

      // Convert symbol format (BTCUSDT -> BTC)
      const coin = symbol.replace('USDT', '');

      // HyperLiquid uses POST /exchange
      const endpoint = 'https://api.hyperliquid.xyz/exchange';

      const orderParams = {
        action: {
          type: 'order',
          orders: [
            {
              a: 0, // Asset index (would need to look this up from meta)
              b: side === 'buy', // true for buy, false for sell
              p: price.toFixed(2), // Limit price
              s: quantity.toFixed(8), // Size
              r: false, // Reduce only
              t: {
                limit: {
                  tif: 'Gtc', // Good till cancel
                },
              },
            },
          ],
          grouping: 'na',
        },
        nonce: Date.now(),
        signature: {
          r: '0x0', // Placeholder - needs proper signing
          s: '0x0',
          v: 27,
        },
        vaultAddress: null,
      };

      // TODO: Implement proper EIP-712 signing for HyperLiquid
      // This requires ethers.js and proper message signing
      // For now, this is a placeholder structure

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderParams),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HyperLiquid order failed: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[HyperLiquid] Order placed successfully:`, result);

      return {
        success: true,
        orderId: result.status?.statuses?.[0]?.oid || 'unknown',
        price: price,
        size: quantity * price,
      };
    } catch (error: any) {
      console.error(`[HyperLiquid] Order failed:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Place both sides of the arbitrage trade simultaneously
   * Uses limit orders at the same price to avoid slippage
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

    // Place both orders simultaneously
    const [longOrder, shortOrder] = await Promise.all([
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

    // Check if both orders succeeded
    if (longOrder.success && shortOrder.success) {
      console.log(`[Arbitrage] Trade executed successfully!`);
      console.log(`  Long order: ${longOrder.orderId}`);
      console.log(`  Short order: ${shortOrder.orderId}`);
    } else {
      console.error(`[Arbitrage] Trade partially failed!`);
      if (!longOrder.success) {
        console.error(`  Long order failed: ${longOrder.error}`);
      }
      if (!shortOrder.success) {
        console.error(`  Short order failed: ${shortOrder.error}`);
      }
    }

    return { longOrder, shortOrder };
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
