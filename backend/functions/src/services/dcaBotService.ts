/**
 * DCA Bot Service
 * Core business logic for DCA bot execution
 */

import { Firestore } from 'firebase-admin/firestore';
import { DCABotConfig, LiveDCABot, DCABotEntry, BotExecutionLog } from '../types.js';
import { KrakenService } from './krakenService.js';
import { MarketAnalysisService } from './marketAnalysisService.js';
import { orderQueueService } from './orderQueueService.js';
import { OrderType } from '../types/orderQueue.js';

export class DCABotService {
  private db: Firestore;
  private marketAnalysis: MarketAnalysisService;

  constructor(db: Firestore) {
    this.db = db;
    this.marketAnalysis = new MarketAnalysisService();
  }

  /**
   * Get all active bots (including 'exiting' status)
   * Bots in 'exiting' status are still active - they're just selling their current position
   */
  async getActiveBots(): Promise<DCABotConfig[]> {
    const snapshot = await this.db
      .collection('dcaBots')
      .where('status', 'in', ['active', 'exiting'])
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DCABotConfig[];
  }

  /**
   * Get bot by ID with live data
   */
  async getBotById(botId: string, krakenService?: KrakenService): Promise<LiveDCABot | null> {
    const botDoc = await this.db.collection('dcaBots').doc(botId).get();

    if (!botDoc.exists) {
      return null;
    }

    const botData = botDoc.data() as DCABotConfig;

    // Get all entries for this bot
    const entriesSnapshot = await this.db
      .collection('dcaBots')
      .doc(botId)
      .collection('entries')
      .get();

    const entries = entriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DCABotEntry[];

    // Calculate live metrics using actual Kraken trade data
    const filledEntries = entries.filter((e) => e.status === 'filled');
    const pendingEntries = entries.filter((e) => e.status === 'pending');

    let totalInvested = 0;
    let totalQuantity = 0;
    let averagePurchasePrice = 0;

    console.log(`[DCABotService] Bot ${botId}: ${filledEntries.length} filled entries, ${pendingEntries.length} pending entries, ${entries.length} total entries, krakenService=${!!krakenService}`);

    // Try to get actual trade data from Kraken if krakenService is provided
    if (krakenService && filledEntries.length > 0) {
      try {
        // Get actual trade data from Kraken for entries with txids
        const txids = filledEntries
          .filter((e) => e.txid)
          .map((e) => e.txid!);

        console.log(`[DCABotService] Bot ${botId}: Found ${txids.length} txids:`, txids);
        console.log(`[DCABotService] Bot ${botId}: Entry details:`, filledEntries.map(e => ({ id: e.id, price: e.price, quantity: e.quantity, orderAmount: e.orderAmount, txid: e.txid })));

        if (txids.length > 0) {
          const tradesData = await krakenService.queryTrades(txids);
          console.log(`[DCABotService] Bot ${botId}: Raw Kraken trade data:`, JSON.stringify(tradesData, null, 2));

          // Calculate average price from actual Kraken trades
          // Kraken's QueryTrades returns: { txid: { price, cost, vol, fee, ... }, ... }
          // Note: 'cost' includes fees, but we need to exclude fees for accurate average price
          // Average Price = Sum(price * vol) / Sum(vol)
          let weightedPriceSum = 0;

          // Track which entries we processed with Kraken data
          const processedEntryIds = new Set<string>();

          for (const [txid, trade] of Object.entries(tradesData)) {
            const tradeData = trade as any;
            const price = parseFloat(tradeData.price); // Execution price per unit
            const vol = parseFloat(tradeData.vol);     // Volume in base currency (crypto)
            const cost = parseFloat(tradeData.cost);   // Total cost (includes fees)
            const fee = parseFloat(tradeData.fee);     // Trading fee

            console.log(`[DCABotService] Bot ${botId}: Processing trade ${txid}: price=${price}, vol=${vol}, cost=${cost}, fee=${fee}`);

            // Weighted price sum for average calculation
            weightedPriceSum += price * vol;
            totalQuantity += vol;

            // Total invested includes fees (this is what you actually paid)
            totalInvested += cost;

            // Mark the entry as processed
            const matchingEntry = filledEntries.find(e => e.txid === txid);
            if (matchingEntry) {
              processedEntryIds.add(matchingEntry.id);
            }
          }

          // For entries without txid (legacy entries), use stored price field
          const legacyEntries = filledEntries.filter(e => !processedEntryIds.has(e.id));
          if (legacyEntries.length > 0) {
            console.log(`[DCABotService] Bot ${botId}: Processing ${legacyEntries.length} legacy entries without txids`);
            for (const entry of legacyEntries) {
              // Use the stored price (captured at order time) and quantity
              // This is more accurate than orderAmount/quantity which may have rounding errors
              const price = entry.price;
              const quantity = entry.quantity;
              const cost = price * quantity; // Approximate cost without fees

              console.log(`[DCABotService] Bot ${botId}: Legacy entry ${entry.id}: price=${price}, qty=${quantity}, cost=${cost}`);

              weightedPriceSum += price * quantity;
              totalQuantity += quantity;
              totalInvested += cost; // Note: This doesn't include fees for legacy entries
            }
          }

          // Average purchase price = weighted average of all trade prices
          averagePurchasePrice = totalQuantity > 0 ? weightedPriceSum / totalQuantity : 0;
          console.log(`[DCABotService] Bot ${botId}: COMBINED DATA - weightedSum=${weightedPriceSum}, totalQty=${totalQuantity}, avg=${averagePurchasePrice.toFixed(4)}, invested=${totalInvested.toFixed(2)}`);
        } else {
          // All entries are legacy (no txids) - use stored price field
          console.log(`[DCABotService] Bot ${botId}: All entries are legacy (no txids), using stored price field`);
          let weightedPriceSum = 0;

          for (const entry of filledEntries) {
            const price = entry.price;
            const quantity = entry.quantity;

            weightedPriceSum += price * quantity;
            totalQuantity += quantity;
            totalInvested += price * quantity; // Approximate, doesn't include fees
          }

          averagePurchasePrice = totalQuantity > 0 ? weightedPriceSum / totalQuantity : 0;
          console.log(`[DCABotService] Bot ${botId}: LEGACY DATA - Using stored price field: avg=${averagePurchasePrice.toFixed(4)}, invested=${totalInvested.toFixed(2)}, qty=${totalQuantity.toFixed(6)}`);
        }
      } catch (error) {
        console.error(`[DCABotService] Bot ${botId}: Error fetching actual trade data, falling back to stored values:`, error);
        // Fallback to stored values on error
        totalInvested = filledEntries.reduce((sum, e) => sum + e.orderAmount, 0);
        totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);
        averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
        console.log(`[DCABotService] Bot ${botId}: ERROR FALLBACK - Using stored values: avg=${averagePurchasePrice.toFixed(4)}, invested=${totalInvested.toFixed(2)}, qty=${totalQuantity.toFixed(6)}`);
      }
    } else {
      // Fallback to stored values if no krakenService provided
      totalInvested = filledEntries.reduce((sum, e) => sum + e.orderAmount, 0);
      totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);
      averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
      console.log(`[DCABotService] Bot ${botId}: NO KRAKEN SERVICE - Using stored values: avg=${averagePurchasePrice.toFixed(4)}, invested=${totalInvested.toFixed(2)}, qty=${totalQuantity.toFixed(6)}`);
    }

    // Get current market price
    // Use provided krakenService if available, otherwise create a public one
    const priceService = krakenService || new KrakenService();
    let currentPrice = 0;
    try {
      const ticker = await priceService.getTicker(botData.symbol);
      currentPrice = ticker.price;
    } catch (error) {
      console.error('[DCABotService] Error fetching current price:', error);
    }

    const currentValue = totalQuantity * currentPrice;
    const unrealizedPnL = currentValue - totalInvested;
    const unrealizedPnLPercent = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

    console.log(`[DCABotService] Bot ${botId} FINAL CALCULATED VALUES: filledEntries=${filledEntries.length}, totalInvested=${totalInvested}, totalQuantity=${totalQuantity}, currentValue=${currentValue}`);

    // Calculate next entry price
    // Sort entries by timestamp to get the actual last entry
    const sortedEntries = [...filledEntries].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastEntry = sortedEntries[0];
    let nextEntryPrice = null;

    if (filledEntries.length > 0) {
      // Calculate step percentage for the next entry
      const nextStepPercent = this.calculateNextStepPercent(
        filledEntries.length,
        botData.stepPercent,
        botData.stepMultiplier
      );
      // IMPORTANT: Calculate from LAST ENTRY price (not current price)
      // This creates a FIXED target that doesn't move with market fluctuations
      // The bot will enter when price drops to this level, regardless of interim price movements
      const lastFilledEntry = filledEntries[filledEntries.length - 1];
      nextEntryPrice = lastFilledEntry.price * (1 - nextStepPercent / 100);
    } else {
      // First entry: calculate one step down from current price
      nextEntryPrice = currentPrice * (1 - botData.stepPercent / 100);
    }

    // Calculate current TP price
    const currentTpPrice = averagePurchasePrice * (1 + botData.tpTarget / 100);

    // Get trend analysis
    const trendAnalysis = await this.marketAnalysis.analyzeTrend(botData.symbol);

    // Calculate Support & Resistance levels
    const currentSupport = trendAnalysis.support || currentPrice * 0.95;
    const currentResistance = trendAnalysis.resistance || currentPrice * 1.05;
    const nextSupport = currentSupport * 0.95; // Next support level below current

    const liveBot: LiveDCABot = {
      ...botData,
      id: botId,
      // IMPORTANT: Use calculated values, not stored values from botData
      // These are recalculated from actual entries and current market data
      currentEntryCount: filledEntries.length,
      averagePurchasePrice, // Calculated from entries
      totalInvested, // Calculated from entries (will be 0 if no entries)
      totalQuantity, // Total crypto holdings (matches Portfolio page balance)
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      lastEntryTime: lastEntry?.timestamp || null,
      nextEntryPrice,
      currentTpPrice,
      entries,
      techScore: trendAnalysis.techScore,
      trendScore: trendAnalysis.trendScore,
      recommendation: trendAnalysis.recommendation,
      support: trendAnalysis.support,
      resistance: trendAnalysis.resistance,
      currentSupport,
      currentResistance,
      nextSupport,
    };

    return liveBot;
  }

  /**
   * Calculate the step percentage for the next entry
   */
  private calculateNextStepPercent(
    entryNumber: number,
    baseStepPercent: number,
    stepMultiplier: number
  ): number {
    if (entryNumber === 0) return baseStepPercent;
    return baseStepPercent * Math.pow(stepMultiplier, entryNumber);
  }

  /**
   * Calculate the order amount for the next entry
   */
  private calculateNextOrderAmount(
    entryNumber: number,
    initialAmount: number,
    tradeMultiplier: number
  ): number {
    return initialAmount * Math.pow(tradeMultiplier, entryNumber);
  }

  /**
   * Check if bot should enter a position
   */
  async shouldEnterPosition(bot: LiveDCABot, currentPrice: number): Promise<{
    shouldEnter: boolean;
    reason: string;
  }> {
    // Check if max entries reached
    if (bot.currentEntryCount >= bot.reEntryCount) {
      return {
        shouldEnter: false,
        reason: 'Maximum re-entries reached',
      };
    }

    // Check re-entry delay (only for re-entries, not first entry)
    if (bot.currentEntryCount > 0 && bot.lastEntryTime) {
      const lastEntryTime = new Date(bot.lastEntryTime).getTime();
      const timeSinceLastEntry = Date.now() - lastEntryTime;
      const delayMs = bot.reEntryDelay * 60 * 1000; // Convert minutes to ms

      if (timeSinceLastEntry < delayMs) {
        return {
          shouldEnter: false,
          reason: `Re-entry delay not met (${Math.round((delayMs - timeSinceLastEntry) / 60000)} minutes remaining)`,
        };
      }
    }

    // Check if price has dropped enough (only for re-entries)
    if (bot.currentEntryCount > 0 && bot.nextEntryPrice && currentPrice > bot.nextEntryPrice) {
      return {
        shouldEnter: false,
        reason: `Price not low enough (current: ${currentPrice}, target: ${bot.nextEntryPrice})`,
      };
    }

    // Check trend alignment and support/resistance (applies to both first entry and re-entries)
    console.log(`[DCABotService] Bot ${bot.id}: Checking entry conditions - trendAlignmentEnabled=${bot.trendAlignmentEnabled}, currentEntryCount=${bot.currentEntryCount}, techScore=${bot.techScore}, trendScore=${bot.trendScore}`);

    const entryCheck = await this.marketAnalysis.shouldEnter(
      bot.symbol,
      currentPrice,
      bot.supportResistanceEnabled,
      bot.trendAlignmentEnabled,
      bot.support,
      bot.currentEntryCount
    );

    console.log(`[DCABotService] Bot ${bot.id}: Entry check result - shouldEnter=${entryCheck.shouldEnter}, reason=${entryCheck.reason}`);

    return {
      shouldEnter: entryCheck.shouldEnter,
      reason: entryCheck.reason,
    };
  }

  /**
   * Ensure sufficient USD liquidity by converting ETH if needed
   * @param krakenService KrakenService instance with user credentials
   * @param requiredUSD Amount of USD needed for the trade
   * @param symbol Trading pair symbol (for logging)
   * @returns Success status and error message if failed
   */
  private async ensureUSDLiquidity(
    krakenService: KrakenService,
    requiredUSD: number,
    symbol: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Get current USD balance
      const balances = await krakenService.getBalance();
      const usdBalance = parseFloat(balances['ZUSD'] || '0');

      console.log(`[DCABotService] USD liquidity check for ${symbol}: required=$${requiredUSD.toFixed(2)}, available=$${usdBalance.toFixed(2)}`);

      if (usdBalance >= requiredUSD) {
        console.log(`[DCABotService] ✅ Sufficient USD balance - no conversion needed`);
        return { success: true }; // Sufficient USD
      }

      // 2. Calculate USD shortage and apply 10% buffer
      const usdShortage = requiredUSD - usdBalance;
      const usdNeededWithBuffer = usdShortage * 1.10; // Add 10% buffer

      console.log(`[DCABotService] 💡 USD shortage: $${usdShortage.toFixed(2)}, with 10% buffer: $${usdNeededWithBuffer.toFixed(2)}`);

      // 3. Get ETH balance and current price
      // CRITICAL: Check for ETH in multiple forms (standard, flexed, staked)
      const possibleEthKeys = ['XETH', 'ETH', 'ETH.F', 'XETH.F', 'ETH.S', 'XETH.S'];
      let ethBalance = 0;
      const foundEthKeys: string[] = [];
      for (const key of possibleEthKeys) {
        if (balances[key]) {
          const keyBalance = parseFloat(balances[key]);
          ethBalance += keyBalance;
          foundEthKeys.push(`${key}=${keyBalance.toFixed(6)}`);
        }
      }

      console.log(`[DCABotService] 💰 ETH balance sources: ${foundEthKeys.length > 0 ? foundEthKeys.join(', ') : 'none found'} (total: ${ethBalance.toFixed(6)} ETH)`);

      const ethTicker = await krakenService.getTicker('ETH/USD');
      const ethPrice = ethTicker.price;

      // Calculate ETH needed (with extra 2% for trading fees)
      const ethNeeded = (usdNeededWithBuffer * 1.02) / ethPrice;

      console.log(`[DCABotService] ETH check: available=${ethBalance.toFixed(6)} ETH, needed=${ethNeeded.toFixed(6)} ETH at $${ethPrice.toFixed(2)}`);

      if (ethBalance < ethNeeded) {
        const totalAvailable = usdBalance + (ethBalance * ethPrice);
        return {
          success: false,
          error: `Insufficient funds: need $${requiredUSD.toFixed(2)} USD, but only have $${usdBalance.toFixed(2)} USD + ${ethBalance.toFixed(6)} ETH ($${(ethBalance * ethPrice).toFixed(2)}) = $${totalAvailable.toFixed(2)} total`
        };
      }

      // 4. Execute ETH→USD conversion on Kraken
      console.log(`[DCABotService] 🔄 Converting ${ethNeeded.toFixed(6)} ETH to USD for ${symbol} purchase (target: $${usdNeededWithBuffer.toFixed(2)} USD)`);

      const sellResult = await krakenService.placeSellOrder(
        'ETH/USD',
        ethNeeded,
        'market'
      );

      if (!sellResult || !sellResult.txid || sellResult.txid.length === 0) {
        return {
          success: false,
          error: 'ETH→USD conversion failed: no transaction ID returned from Kraken'
        };
      }

      const txid = sellResult.txid[0];
      const usdReceived = ethNeeded * ethPrice; // Approximate (actual may vary slightly)

      console.log(`[DCABotService] ✅ Successfully converted ${ethNeeded.toFixed(6)} ETH to ~$${usdReceived.toFixed(2)} USD (txid: ${txid})`);

      // 5. Wait briefly for Kraken to settle the trade (usually very fast)
      console.log(`[DCABotService] ⏳ Waiting 2 seconds for trade settlement...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 6. Verify new USD balance
      const newBalances = await krakenService.getBalance();
      const newUsdBalance = parseFloat(newBalances['ZUSD'] || '0');
      console.log(`[DCABotService] 💰 New USD balance: $${newUsdBalance.toFixed(2)} (was: $${usdBalance.toFixed(2)})`);

      if (newUsdBalance < requiredUSD) {
        console.warn(`[DCABotService] ⚠️  USD balance still insufficient after conversion. This may be due to settlement delay or fees. Proceeding anyway...`);
      }

      return { success: true };

    } catch (error: any) {
      console.error('[DCABotService] ❌ Error ensuring USD liquidity:', error);

      // If it's a rate limit error, skip the liquidity check and proceed
      // The order will fail at placement if there's truly insufficient funds
      if (error.message && error.message.includes('Temporary lockout')) {
        console.warn('[DCABotService] ⚠️  Rate limit hit during liquidity check - skipping and proceeding with order (will fail at placement if insufficient funds)');
        return { success: true };
      }

      return {
        success: false,
        error: `Liquidity management failed: ${error.message}`
      };
    }
  }

  /**
   * Execute a buy order for a bot
   */
  async executeEntry(
    bot: LiveDCABot,
    krakenService: KrakenService
  ): Promise<{ success: boolean; entry?: DCABotEntry; error?: string }> {
    console.log(`[DCABotService] executeEntry() started for bot ${bot.id} (${bot.symbol})`);

    try {
      // Get current price
      // Note: Duplicate order prevention is now handled in orderQueueService.createOrder()
      console.log(`[DCABotService] Fetching current ticker for ${bot.symbol}...`);
      const ticker = await krakenService.getTicker(bot.symbol);
      const currentPrice = ticker.price;
      console.log(`[DCABotService] Current price: $${currentPrice}`);

      // Calculate order amount for the NEXT entry
      // currentEntryCount = number of filled entries (0, 1, 2, ...)
      // For calculateNextOrderAmount, we need the 0-indexed entry number for the NEXT entry
      // which equals currentEntryCount (0 for first, 1 for second, etc.)
      const orderAmount = this.calculateNextOrderAmount(
        bot.currentEntryCount,
        bot.initialOrderAmount,
        bot.tradeMultiplier
      );

      console.log(`[DCABotService] Bot ${bot.id} entry calculation: currentEntryCount=${bot.currentEntryCount}, initialAmount=${bot.initialOrderAmount}, multiplier=${bot.tradeMultiplier}, calculatedAmount=$${orderAmount}`);

      // Calculate quantity to buy
      const quantity = orderAmount / currentPrice;

      // CRITICAL: Ensure sufficient USD liquidity before creating order
      // This will automatically convert ETH→USD on Kraken if needed
      console.log(`[DCABotService] Checking USD liquidity for $${orderAmount} ${bot.symbol} purchase...`);

      let liquidityCheck;
      try {
        liquidityCheck = await this.ensureUSDLiquidity(
          krakenService,
          orderAmount,
          bot.symbol
        );
      } catch (error: any) {
        console.error(`[DCABotService] ❌ Liquidity check threw error:`, error);
        return {
          success: false,
          error: `Liquidity check failed: ${error.message}`
        };
      }

      if (!liquidityCheck.success) {
        console.error(`[DCABotService] ❌ Liquidity check failed: ${liquidityCheck.error}`);
        return {
          success: false,
          error: liquidityCheck.error
        };
      }

      console.log(`[DCABotService] ✅ Liquidity check passed - proceeding with order creation`);

      // Create pending order in queue instead of executing directly
      console.log(`[DCABotService] Creating pending order: ${quantity.toFixed(8)} ${bot.symbol} @ $${currentPrice} (total: $${orderAmount})`);

      let pendingOrder;
      try {
        pendingOrder = await orderQueueService.createOrder({
          userId: bot.userId,
          botId: bot.id,
          pair: bot.symbol,
          type: OrderType.MARKET,
          side: 'buy',
          volume: quantity.toFixed(8),
          amount: orderAmount, // USD amount
          price: currentPrice.toString(), // Expected market execution price
          reason: 'Waiting for order queue to execute market buy',
        });
        console.log(`[DCABotService] ✅ Created pending order ${pendingOrder.id} for bot ${bot.id}`);
      } catch (error: any) {
        console.error(`[DCABotService] ❌ Failed to create pending order:`, error);
        return {
          success: false,
          error: `Order queue creation failed: ${error.message}`
        };
      }

      // Create entry record (marked as pending until order is executed)
      const entry: DCABotEntry = {
        id: `${bot.id}_entry_${bot.currentEntryCount + 1}`,
        botId: bot.id,
        entryNumber: bot.currentEntryCount + 1,
        orderAmount,
        price: currentPrice,
        quantity,
        timestamp: new Date().toISOString(),
        orderId: pendingOrder.id, // Store pending order ID
        status: 'pending', // Mark as pending
        // txid will be set when order is executed
        // Cycle tracking
        cycleId: bot.cycleId,
        cycleNumber: bot.cycleNumber,
        source: 'bot_execution',
      };

      // Save entry to Firestore (remove undefined fields)
      const cleanEntry: any = { ...entry };
      Object.keys(cleanEntry).forEach(key => {
        if (cleanEntry[key] === undefined) {
          delete cleanEntry[key];
        }
      });

      await this.db
        .collection('dcaBots')
        .doc(bot.id)
        .collection('entries')
        .doc(entry.id)
        .set(cleanEntry);

      // Update bot updatedAt
      await this.db.collection('dcaBots').doc(bot.id).update({
        updatedAt: new Date().toISOString(),
      });

      // Log execution
      await this.logExecution({
        id: `${bot.id}_exec_${Date.now()}`,
        botId: bot.id,
        action: 'entry',
        symbol: bot.symbol,
        price: currentPrice,
        quantity,
        amount: orderAmount,
        entryNumber: bot.currentEntryCount + 1,
        reason: 'Entry conditions met',
        techScore: bot.techScore,
        trendScore: bot.trendScore,
        timestamp: new Date().toISOString(),
        success: true,
        orderId: entry.orderId,
      });

      return { success: true, entry };
    } catch (error: any) {
      console.error('[DCABotService] Error executing entry:', error);

      // Log failed execution
      await this.logExecution({
        id: `${bot.id}_exec_${Date.now()}`,
        botId: bot.id,
        action: 'entry',
        symbol: bot.symbol,
        price: 0,
        quantity: 0,
        amount: 0,
        reason: 'Entry execution failed',
        techScore: bot.techScore,
        trendScore: bot.trendScore,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a sell order (exit position)
   */
  async executeExit(
    bot: LiveDCABot,
    krakenService: KrakenService
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current price
      // Note: Duplicate order prevention is now handled in orderQueueService.createOrder()
      const ticker = await krakenService.getTicker(bot.symbol);
      const currentPrice = ticker.price;

      // Get ACTUAL Kraken balance for this asset using proper Kraken format
      // CRITICAL FIX: Use KrakenService.extractKrakenAsset for proper balance lookup
      const asset = (await import('./krakenService.js')).KrakenService.extractKrakenAsset(bot.symbol);

      let krakenBalance = 0;
      try {
        // Use KrakenService to get actual account balance
        const balances = await krakenService.getBalance();
        console.log(`[DCABotService] Kraken balance response:`, balances);
        console.log(`[DCABotService] Looking for asset: ${asset} (from pair: ${bot.symbol})`);

        // CRITICAL FIX: Try multiple possible asset names (Kraken is inconsistent)
        // For BCH: try BCH, XBCH, XXBCH, BCH.F (flexed), BCH.S (staked), etc.
        const baseAsset = bot.symbol.split('/')[0]; // "BCH" from "BCH/USD"
        const possibleKeys = [
          asset,           // Mapped name (e.g., "BCH")
          baseAsset,       // Display name (e.g., "BCH")
          `X${baseAsset}`, // Single X prefix (e.g., "XBCH")
          `XX${baseAsset}`,// Double X prefix (e.g., "XXBCH")
          `${baseAsset}.F`, // Flexed staking (e.g., "BCH.F")
          `${asset}.F`,     // Flexed with mapped name
          `${baseAsset}.S`, // Staked (e.g., "BCH.S")
          `${asset}.S`,     // Staked with mapped name
        ];

        let balanceString = '0';
        let foundKey = '';

        for (const key of possibleKeys) {
          if (balances[key]) {
            const balance = parseFloat(balances[key]);
            if (balance > 0) {
              balanceString = balances[key];
              foundKey = key;
              break;
            }
          }
        }

        // Parse to number (Kraken returns strings like "0.0000000000")
        krakenBalance = parseFloat(balanceString);

        console.log(`[DCABotService] ${bot.symbol} Kraken balance: ${krakenBalance} ${foundKey || asset} (tried: ${possibleKeys.join(', ')})`);
      } catch (error: any) {
        console.error(`[DCABotService] ❌ Failed to get Kraken balance for ${asset}:`, error.message);

        // If we can't get Kraken balance, log and skip this exit attempt
        await this.logExecution({
          id: `${bot.id}_exec_${Date.now()}`,
          botId: bot.id,
          action: 'exit',
          symbol: bot.symbol,
          price: currentPrice,
          quantity: 0,
          amount: 0,
          reason: `Exit skipped: Failed to fetch Kraken balance - ${error.message}`,
          techScore: bot.techScore,
          trendScore: bot.trendScore,
          timestamp: new Date().toISOString(),
          success: false,
        });

        return { success: false, error: `Failed to get Kraken balance: ${error.message}` };
      }

      if (krakenBalance === 0) {
        console.error(`[DCABotService] ⚠️  No Kraken balance for ${asset} - balance is 0`);
        await this.logExecution({
          id: `${bot.id}_exec_${Date.now()}`,
          botId: bot.id,
          action: 'exit',
          symbol: bot.symbol,
          price: currentPrice,
          quantity: 0,
          amount: 0,
          reason: `Exit skipped: Kraken balance is 0`,
          techScore: bot.techScore,
          trendScore: bot.trendScore,
          timestamp: new Date().toISOString(),
          success: false,
        });
        return { success: false, error: 'Kraken balance is 0' };
      }

      // Get precision requirements from Kraken
      let volumePrecision = 8; // Default precision

      try {
        const pairInfo = await krakenService.getAssetPairs(bot.symbol);
        volumePrecision = pairInfo.lot_decimals;
        console.log(`[DCABotService] ${bot.symbol}: lot_decimals=${volumePrecision}, ordermin=${pairInfo.ordermin}`);
      } catch (error: any) {
        console.warn(`[DCABotService] Could not fetch pair info, using defaults:`, error.message);
      }

      let actualQuantity = krakenBalance;

      // Apply exit percentage (default 90% = sell 90%, keep 10%)
      const exitPercentage = bot.exitPercentage || 90; // Default to 90% if not set
      const quantityBeforePercentage = actualQuantity;
      actualQuantity = actualQuantity * (exitPercentage / 100);

      console.log(`[DCABotService] Applying ${exitPercentage}% exit: ${quantityBeforePercentage.toFixed(volumePrecision)} ${asset} -> ${actualQuantity.toFixed(volumePrecision)} ${asset} (keeping ${100 - exitPercentage}%)`);

      // Round to correct precision (CRITICAL: must match lot_decimals)
      actualQuantity = parseFloat(actualQuantity.toFixed(volumePrecision));

      // Final safety check: don't create order if quantity is zero or invalid
      if (actualQuantity <= 0 || !isFinite(actualQuantity)) {
        console.error(`[DCABotService] ⚠️  Invalid quantity after calculations: ${actualQuantity} - cannot create sell order. Bot will retry on next run.`);

        // Log the failed attempt but DO NOT mark bot as completed
        await this.logExecution({
          id: `${bot.id}_exec_${Date.now()}`,
          botId: bot.id,
          action: 'exit',
          symbol: bot.symbol,
          price: currentPrice,
          quantity: 0,
          amount: 0,
          reason: `Exit attempt failed: Invalid quantity after calculations (${actualQuantity})`,
          techScore: bot.techScore,
          trendScore: bot.trendScore,
          timestamp: new Date().toISOString(),
          success: false,
        });

        return { success: false, error: `Invalid quantity: ${actualQuantity}` };
      }

      // Calculate total amount (USD value)
      const totalAmount = actualQuantity * currentPrice;

      // IMPORTANT: Create the order FIRST, then update bot status
      // This prevents the bot from getting stuck in 'exiting' status if order creation fails
      const pendingOrder = await orderQueueService.createOrder({
        userId: bot.userId,
        botId: bot.id,
        pair: bot.symbol,
        type: OrderType.MARKET,
        side: 'sell',
        volume: actualQuantity.toFixed(volumePrecision), // Use correct precision
        amount: totalAmount, // USD amount
        price: currentPrice.toString(), // Expected market execution price
        reason: 'Take profit target reached - waiting for order queue to execute market sell',
      });

      console.log(`[DCABotService] Created pending exit order ${pendingOrder.id} for bot ${bot.id} - ${actualQuantity.toFixed(volumePrecision)} ${bot.symbol} at $${currentPrice}`);

      // Update bot status to 'exiting' ONLY AFTER order is successfully created
      // (will be set to 'active' or 'completed' after order executes/fails)
      await this.db.collection('dcaBots').doc(bot.id).update({
        status: 'exiting',
        updatedAt: new Date().toISOString(),
      });

      // Log execution
      await this.logExecution({
        id: `${bot.id}_exec_${Date.now()}`,
        botId: bot.id,
        action: 'exit',
        symbol: bot.symbol,
        price: currentPrice,
        quantity: actualQuantity,
        amount: totalAmount,
        reason: 'Take profit target reached - exit order queued',
        techScore: bot.techScore,
        trendScore: bot.trendScore,
        timestamp: new Date().toISOString(),
        success: true,
        orderId: pendingOrder.id, // Store pending order ID
      });

      return { success: true };
    } catch (error: any) {
      console.error('[DCABotService] Error executing exit:', error);

      // Log failed execution
      await this.logExecution({
        id: `${bot.id}_exec_${Date.now()}`,
        botId: bot.id,
        action: 'exit',
        symbol: bot.symbol,
        price: 0,
        quantity: 0,
        amount: 0,
        reason: 'Exit execution failed',
        techScore: bot.techScore,
        trendScore: bot.trendScore,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Process a single bot (check conditions and execute if needed)
   */
  async processBot(
    botId: string,
    krakenApiKey: string,
    krakenApiSecret: string
  ): Promise<{ processed: boolean; action?: string; reason: string }> {
    try {
      // Create KrakenService with credentials
      const krakenService = new KrakenService(krakenApiKey, krakenApiSecret);

      // Get bot with live data (pass krakenService to get accurate pricing)
      const bot = await this.getBotById(botId, krakenService);

      if (!bot) {
        return {
          processed: false,
          reason: 'Bot not found',
        };
      }

      // Only process active and exiting bots (skip paused, stopped, completed)
      // Bots in 'exiting' status should still be processed for new entries
      if (bot.status !== 'active' && bot.status !== 'exiting') {
        return {
          processed: false,
          reason: `Bot status is '${bot.status}', only 'active' and 'exiting' bots are processed`,
        };
      }

      // Get current price
      const ticker = await krakenService.getTicker(bot.symbol);
      const currentPrice = ticker.price;

      // Check if should exit (if has positions)
      if (bot.currentEntryCount > 0 && bot.currentTpPrice) {
        const exitCheck = await this.marketAnalysis.shouldExit(
          bot.symbol,
          currentPrice,
          bot.averagePurchasePrice,
          bot.tpTarget,
          bot.currentTpPrice
        );

        if (exitCheck.shouldExit) {
          const result = await this.executeExit(bot, krakenService);
          return {
            processed: true,
            action: 'exit',
            reason: result.success ? exitCheck.reason : result.error || 'Exit failed',
          };
        }
      }

      // Check if should enter
      const entryCheck = await this.shouldEnterPosition(bot, currentPrice);

      if (entryCheck.shouldEnter) {
        const result = await this.executeEntry(bot, krakenService);
        return {
          processed: true,
          action: 'entry',
          reason: result.success ? 'Entry executed successfully' : result.error || 'Entry failed',
        };
      }

      return {
        processed: false,
        reason: entryCheck.reason,
      };
    } catch (error: any) {
      console.error('[DCABotService] Error processing bot:', error);
      return {
        processed: false,
        reason: error.message,
      };
    }
  }

  /**
   * Log bot execution
   */
  private async logExecution(log: BotExecutionLog): Promise<void> {
    try {
      // Remove undefined fields to avoid Firestore errors
      const cleanLog: any = { ...log };
      Object.keys(cleanLog).forEach(key => {
        if (cleanLog[key] === undefined) {
          delete cleanLog[key];
        }
      });

      await this.db.collection('botExecutions').doc(log.id).set(cleanLog);
    } catch (error) {
      console.error('[DCABotService] Error logging execution:', error);
    }
  }

  /**
   * Get bot execution history
   */
  async getBotExecutions(botId: string, limit: number = 50): Promise<BotExecutionLog[]> {
    const snapshot = await this.db
      .collection('botExecutions')
      .where('botId', '==', botId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as BotExecutionLog);
  }
}

export default DCABotService;
