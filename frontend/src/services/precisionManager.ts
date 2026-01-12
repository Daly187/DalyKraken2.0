/**
 * Universal Precision Manager
 * Automatically fetches and manages precision rules for all trading pairs
 * Supports AsterDEX and HyperLiquid
 */

interface PrecisionRules {
  symbol: string;
  exchange: 'asterdex' | 'hyperliquid';

  // Price precision
  priceDecimals: number;
  priceTick?: number;
  priceMin?: number;
  priceMax?: number;

  // Quantity precision
  qtyDecimals: number;
  qtyStep: number;
  qtyMin: number;
  qtyMax?: number;

  // Market order rules (may differ from limit)
  marketQtyStep?: number;
  marketQtyMin?: number;
  marketQtyMax?: number;

  // Notional requirements
  minNotional: number;

  // Metadata
  baseAsset: string;
  quoteAsset: string;
  lastUpdate: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  correctedPrice?: number;
  correctedQuantity?: number;
  notional?: number;
}

class PrecisionManager {
  private rules: Map<string, Map<string, PrecisionRules>> = new Map();
  private lastUpdate: Map<string, number> = new Map();
  private updateInterval = 60 * 60 * 1000; // 1 hour
  private initialized = false;

  /**
   * Initialize precision manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[PrecisionManager] Already initialized');
      return;
    }

    console.log('[PrecisionManager] Initializing...');

    try {
      await Promise.all([
        this.loadAsterDEXRules(),
        this.loadHyperliquidRules(),
      ]);

      this.initialized = true;
      console.log('[PrecisionManager] ✅ Initialization complete');
      this.printSummary();

      // Set up auto-refresh
      this.startAutoRefresh();
    } catch (error) {
      console.error('[PrecisionManager] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load precision rules from AsterDEX
   */
  private async loadAsterDEXRules(): Promise<void> {
    try {
      const response = await fetch('https://fapi.asterdex.com/fapi/v1/exchangeInfo');

      if (!response.ok) {
        throw new Error(`AsterDEX API error: ${response.status}`);
      }

      const data = await response.json();
      const rules = new Map<string, PrecisionRules>();

      for (const symbol of data.symbols) {
        // Skip non-trading symbols
        if (symbol.status !== 'TRADING') continue;

        // Extract filters
        const priceFilter = symbol.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
        const lotFilter = symbol.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
        const marketLotFilter = symbol.filters?.find((f: any) => f.filterType === 'MARKET_LOT_SIZE');
        const notionalFilter = symbol.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');

        if (!priceFilter || !lotFilter) {
          console.warn(`[PrecisionManager] Missing filters for ${symbol.symbol}`);
          continue;
        }

        const priceTick = parseFloat(priceFilter.tickSize);
        const qtyStep = parseFloat(lotFilter.stepSize);

        rules.set(symbol.symbol, {
          symbol: symbol.symbol,
          exchange: 'asterdex',
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,

          // Price precision
          priceDecimals: this.countDecimals(priceTick),
          priceTick,
          priceMin: parseFloat(priceFilter.minPrice),
          priceMax: parseFloat(priceFilter.maxPrice),

          // Quantity precision
          qtyDecimals: this.countDecimals(qtyStep),
          qtyStep,
          qtyMin: parseFloat(lotFilter.minQty),
          qtyMax: parseFloat(lotFilter.maxQty),

          // Market order rules
          marketQtyStep: marketLotFilter ? parseFloat(marketLotFilter.stepSize) : qtyStep,
          marketQtyMin: marketLotFilter ? parseFloat(marketLotFilter.minQty) : parseFloat(lotFilter.minQty),
          marketQtyMax: marketLotFilter ? parseFloat(marketLotFilter.maxQty) : parseFloat(lotFilter.maxQty),

          // Notional
          minNotional: notionalFilter ? parseFloat(notionalFilter.notional) : 5,

          lastUpdate: Date.now(),
        });
      }

      this.rules.set('asterdex', rules);
      this.lastUpdate.set('asterdex', Date.now());

      console.log(`[PrecisionManager] Loaded ${rules.size} AsterDEX symbols`);
    } catch (error) {
      console.error('[PrecisionManager] Failed to load AsterDEX rules:', error);
      throw error;
    }
  }

  /**
   * Load precision rules from HyperLiquid
   */
  private async loadHyperliquidRules(): Promise<void> {
    try {
      // Fetch both meta and assetCtx for complete precision info
      const [metaResponse, assetCtxResponse] = await Promise.all([
        fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' }),
        }),
        fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        }),
      ]);

      if (!metaResponse.ok) {
        throw new Error(`HyperLiquid meta API error: ${metaResponse.status}`);
      }

      const metaData = await metaResponse.json();
      let assetCtxs: any[] = [];

      if (assetCtxResponse.ok) {
        const assetCtxData = await assetCtxResponse.json();
        // metaAndAssetCtxs returns [meta, assetCtxs]
        if (Array.isArray(assetCtxData) && assetCtxData.length >= 2) {
          assetCtxs = assetCtxData[1] || [];
        }
      }

      const rules = new Map<string, PrecisionRules>();

      if (metaData.universe) {
        metaData.universe.forEach((asset: any, index: number) => {
          const symbol = asset.name;
          const qtyStep = Math.pow(10, -asset.szDecimals);

          // Get the asset context for tick size info
          const ctx = assetCtxs[index];

          // Hyperliquid tick sizes are based on the mark price
          // For most assets, the tick size is related to significant figures
          // We calculate it based on typical price ranges
          // Default to 5 significant figures rule
          let priceTick: number | undefined;
          let priceDecimals = 5; // default

          if (ctx && ctx.markPx) {
            const markPrice = parseFloat(ctx.markPx);
            // Hyperliquid uses 5 significant figures for prices
            // Calculate tick size based on current price
            if (markPrice >= 10000) {
              priceTick = 1;
              priceDecimals = 0;
            } else if (markPrice >= 1000) {
              priceTick = 0.1;
              priceDecimals = 1;
            } else if (markPrice >= 100) {
              priceTick = 0.01;
              priceDecimals = 2;
            } else if (markPrice >= 10) {
              priceTick = 0.001;
              priceDecimals = 3;
            } else if (markPrice >= 1) {
              priceTick = 0.0001;
              priceDecimals = 4;
            } else if (markPrice >= 0.1) {
              priceTick = 0.00001;
              priceDecimals = 5;
            } else {
              priceTick = 0.000001;
              priceDecimals = 6;
            }
          }

          rules.set(symbol, {
            symbol,
            exchange: 'hyperliquid',
            baseAsset: symbol,
            quoteAsset: 'USDC',

            // Quantity precision (HyperLiquid uses szDecimals)
            qtyDecimals: asset.szDecimals,
            qtyStep,
            qtyMin: qtyStep,

            // Price precision with tick size
            priceDecimals,
            priceTick,

            // Notional
            minNotional: 10, // HyperLiquid typical minimum

            lastUpdate: Date.now(),
          });
        });
      }

      this.rules.set('hyperliquid', rules);
      this.lastUpdate.set('hyperliquid', Date.now());

      console.log(`[PrecisionManager] Loaded ${rules.size} HyperLiquid symbols`);
    } catch (error) {
      console.error('[PrecisionManager] Failed to load HyperLiquid rules:', error);
      throw error;
    }
  }

  /**
   * Round price to correct precision
   */
  roundPrice(exchange: string, symbol: string, price: number): number {
    const rules = this.getRules(exchange, symbol);

    if (!rules) {
      console.warn(`[PrecisionManager] No rules for ${symbol} on ${exchange}, using default`);
      return parseFloat(price.toFixed(4));
    }

    // Use tick size if available (both AsterDEX and Hyperliquid)
    if (rules.priceTick) {
      const rounded = Math.round(price / rules.priceTick) * rules.priceTick;
      return parseFloat(rounded.toFixed(rules.priceDecimals));
    }

    // Default: round to decimal places
    return parseFloat(price.toFixed(rules.priceDecimals));
  }

  /**
   * Round quantity to correct precision
   */
  roundQuantity(exchange: string, symbol: string, quantity: number, orderType: 'LIMIT' | 'MARKET' = 'LIMIT'): number {
    const rules = this.getRules(exchange, symbol);

    if (!rules) {
      console.warn(`[PrecisionManager] No rules for ${symbol} on ${exchange}, using default`);
      return parseFloat(quantity.toFixed(2));
    }

    // Use market rules for market orders if available
    const stepSize = (orderType === 'MARKET' && rules.marketQtyStep) ? rules.marketQtyStep : rules.qtyStep;
    const minQty = (orderType === 'MARKET' && rules.marketQtyMin) ? rules.marketQtyMin : rules.qtyMin;
    const maxQty = (orderType === 'MARKET' && rules.marketQtyMax) ? rules.marketQtyMax : rules.qtyMax;

    // Round UP to nearest step to ensure we meet minimum notional
    let rounded = Math.ceil(quantity / stepSize) * stepSize;

    // Ensure within bounds
    rounded = Math.max(minQty, rounded);
    if (maxQty) {
      rounded = Math.min(maxQty, rounded);
    }

    // Fix decimal places
    return parseFloat(rounded.toFixed(rules.qtyDecimals));
  }

  /**
   * Calculate quantity from dollar value
   */
  calculateQuantityFromDollar(exchange: string, symbol: string, dollarValue: number, price: number): number {
    const roundedPrice = this.roundPrice(exchange, symbol, price);
    const rawQuantity = dollarValue / roundedPrice;
    const roundedQuantity = this.roundQuantity(exchange, symbol, rawQuantity);

    // Verify notional meets minimum
    const notional = roundedPrice * roundedQuantity;
    const rules = this.getRules(exchange, symbol);

    if (rules && notional < rules.minNotional) {
      console.warn(`[PrecisionManager] Notional ${notional.toFixed(2)} below minimum ${rules.minNotional}, adjusting...`);

      // Adjust quantity up to meet minimum (with 1% buffer)
      const minQuantity = (rules.minNotional * 1.01) / roundedPrice;
      return this.roundQuantity(exchange, symbol, minQuantity);
    }

    return roundedQuantity;
  }

  /**
   * Validate order parameters
   */
  validateOrder(
    exchange: string,
    symbol: string,
    price: number,
    quantity: number,
    orderType: 'LIMIT' | 'MARKET' = 'LIMIT'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const rules = this.getRules(exchange, symbol);

    if (!rules) {
      warnings.push(`No precision rules found for ${symbol} on ${exchange}`);
      return { valid: true, errors, warnings };
    }

    // Validate price (for limit orders)
    const correctedPrice = orderType !== 'MARKET' ? this.roundPrice(exchange, symbol, price) : price;

    if (orderType !== 'MARKET') {
      if (Math.abs(correctedPrice - price) > 0.0000001) {
        warnings.push(`Price ${price} will be rounded to ${correctedPrice}`);
      }

      if (rules.priceMin && correctedPrice < rules.priceMin) {
        errors.push(`Price ${correctedPrice} below minimum ${rules.priceMin}`);
      }

      if (rules.priceMax && correctedPrice > rules.priceMax) {
        errors.push(`Price ${correctedPrice} above maximum ${rules.priceMax}`);
      }
    }

    // Validate quantity
    const correctedQuantity = this.roundQuantity(exchange, symbol, quantity, orderType);

    if (Math.abs(correctedQuantity - quantity) > 0.0000001) {
      warnings.push(`Quantity ${quantity} will be rounded to ${correctedQuantity}`);
    }

    const minQty = (orderType === 'MARKET' && rules.marketQtyMin) ? rules.marketQtyMin : rules.qtyMin;
    const maxQty = (orderType === 'MARKET' && rules.marketQtyMax) ? rules.marketQtyMax : rules.qtyMax;

    if (correctedQuantity < minQty) {
      errors.push(`Quantity ${correctedQuantity} below minimum ${minQty}`);
    }

    if (maxQty && correctedQuantity > maxQty) {
      errors.push(`Quantity ${correctedQuantity} above maximum ${maxQty}`);
    }

    // Validate notional
    const notional = orderType !== 'MARKET' ? correctedPrice * correctedQuantity : 0;

    if (orderType !== 'MARKET' && notional < rules.minNotional) {
      errors.push(`Notional value ${notional.toFixed(2)} below minimum ${rules.minNotional}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      correctedPrice: orderType !== 'MARKET' ? correctedPrice : undefined,
      correctedQuantity,
      notional: orderType !== 'MARKET' ? notional : undefined,
    };
  }

  /**
   * Get symbol info for debugging
   */
  getSymbolInfo(exchange: string, symbol: string): any {
    const rules = this.getRules(exchange, symbol);

    if (!rules) {
      return {
        found: false,
        message: `No rules found for ${symbol} on ${exchange}`,
      };
    }

    return {
      found: true,
      exchange,
      symbol,
      price: {
        decimals: rules.priceDecimals,
        tickSize: rules.priceTick,
        min: rules.priceMin,
        max: rules.priceMax,
      },
      quantity: {
        decimals: rules.qtyDecimals,
        stepSize: rules.qtyStep,
        min: rules.qtyMin,
        max: rules.qtyMax,
      },
      minNotional: rules.minNotional,
      lastUpdate: new Date(rules.lastUpdate).toISOString(),
    };
  }

  /**
   * Get rules for a symbol
   */
  private getRules(exchange: string, symbol: string): PrecisionRules | undefined {
    const exchangeRules = this.rules.get(exchange.toLowerCase());
    if (!exchangeRules) return undefined;

    // Try exact match first
    let rules = exchangeRules.get(symbol);

    // Try without USDT suffix for Hyperliquid
    if (!rules && exchange.toLowerCase() === 'hyperliquid' && symbol.endsWith('USDT')) {
      rules = exchangeRules.get(symbol.replace('USDT', ''));
    }

    return rules;
  }

  /**
   * Count decimal places in a number
   */
  private countDecimals(value: number): number {
    if (Math.floor(value) === value) return 0;

    const str = value.toString();

    // Handle scientific notation
    if (str.indexOf('e-') !== -1) {
      const parts = str.split('e-');
      const base = parts[0].split('.')[1] || '';
      return base.length + parseInt(parts[1]);
    }

    // Normal decimal
    if (str.indexOf('.') !== -1) {
      return str.split('.')[1].length;
    }

    return 0;
  }

  /**
   * Start auto-refresh of rules
   */
  private startAutoRefresh(): void {
    setInterval(async () => {
      console.log('[PrecisionManager] 🔄 Refreshing rules...');

      for (const exchange of this.rules.keys()) {
        const lastUpdate = this.lastUpdate.get(exchange) || 0;
        const age = Date.now() - lastUpdate;

        if (age > this.updateInterval) {
          try {
            if (exchange === 'asterdex') {
              await this.loadAsterDEXRules();
            } else if (exchange === 'hyperliquid') {
              await this.loadHyperliquidRules();
            }
            console.log(`[PrecisionManager] ✅ Refreshed ${exchange} rules`);
          } catch (error) {
            console.error(`[PrecisionManager] ❌ Failed to refresh ${exchange}:`, error);
          }
        }
      }
    }, this.updateInterval);
  }

  /**
   * Print summary of loaded rules
   */
  private printSummary(): void {
    console.log('[PrecisionManager] ========================================');
    console.log('[PrecisionManager] PRECISION RULES SUMMARY');
    console.log('[PrecisionManager] ========================================');

    for (const [exchange, rules] of this.rules.entries()) {
      console.log(`[PrecisionManager] ${exchange.toUpperCase()}: ${rules.size} symbols loaded`);

      // Show sample rules for common symbols
      const commonSymbols = ['BTCUSDT', 'ETHUSDT', 'ZKUSDT', 'BTC', 'ETH', 'ZK'];

      for (const symbol of commonSymbols) {
        const rule = rules.get(symbol);
        if (rule) {
          console.log(`[PrecisionManager]   ${symbol}:`);
          console.log(`[PrecisionManager]     Price: ${rule.priceDecimals} decimals, tick: ${rule.priceTick || 'N/A'}`);
          console.log(`[PrecisionManager]     Qty: ${rule.qtyDecimals} decimals, step: ${rule.qtyStep}`);
          console.log(`[PrecisionManager]     Min notional: $${rule.minNotional}`);
        }
      }
    }
  }
}

// Export singleton instance
export const precisionManager = new PrecisionManager();
