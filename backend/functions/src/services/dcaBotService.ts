/**
 * DCA Bot Service
 * Core business logic for DCA bot execution
 */

import { Firestore } from 'firebase-admin/firestore';
import { DCABotConfig, LiveDCABot, DCABotEntry, BotExecutionLog } from '../types.js';
import { KrakenService } from './krakenService.js';
import { MarketAnalysisService } from './marketAnalysisService.js';

export class DCABotService {
  private db: Firestore;
  private marketAnalysis: MarketAnalysisService;

  constructor(db: Firestore) {
    this.db = db;
    this.marketAnalysis = new MarketAnalysisService();
  }

  /**
   * Get all active bots
   */
  async getActiveBots(): Promise<DCABotConfig[]> {
    const snapshot = await this.db
      .collection('dcaBots')
      .where('status', '==', 'active')
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

    let totalInvested = 0;
    let totalQuantity = 0;
    let averagePurchasePrice = 0;

    // Try to get actual trade data from Kraken if krakenService is provided
    if (krakenService && filledEntries.length > 0) {
      try {
        // Get actual trade data from Kraken for entries with txids
        const txids = filledEntries
          .filter((e) => e.txid)
          .map((e) => e.txid!);

        if (txids.length > 0) {
          const tradesData = await krakenService.queryTrades(txids);

          // Calculate average price from actual Kraken trades
          // Kraken's QueryTrades returns: { txid: { price, cost, vol, fee, ... }, ... }
          // Note: 'cost' includes fees, but we need to exclude fees for accurate average price
          // Average Price = Sum(price * vol) / Sum(vol)
          let weightedPriceSum = 0;

          for (const [txid, trade] of Object.entries(tradesData)) {
            const tradeData = trade as any;
            const price = parseFloat(tradeData.price); // Execution price per unit
            const vol = parseFloat(tradeData.vol);     // Volume in base currency (crypto)
            const cost = parseFloat(tradeData.cost);   // Total cost (includes fees)
            const fee = parseFloat(tradeData.fee);     // Trading fee

            // Weighted price sum for average calculation
            weightedPriceSum += price * vol;
            totalQuantity += vol;

            // Total invested includes fees (this is what you actually paid)
            totalInvested += cost;
          }

          // Average purchase price = weighted average of all trade prices
          averagePurchasePrice = totalQuantity > 0 ? weightedPriceSum / totalQuantity : 0;
          console.log(`[DCABotService] Using actual Kraken trade data for bot ${botId}: avg=${averagePurchasePrice.toFixed(4)}, invested=${totalInvested.toFixed(2)}, qty=${totalQuantity.toFixed(6)}`);
        } else {
          // Fallback to stored values if no txids
          totalInvested = filledEntries.reduce((sum, e) => sum + e.orderAmount, 0);
          totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);
          averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
          console.log(`[DCABotService] No txids found for bot ${botId}, using stored values`);
        }
      } catch (error) {
        console.error('[DCABotService] Error fetching actual trade data, falling back to stored values:', error);
        // Fallback to stored values on error
        totalInvested = filledEntries.reduce((sum, e) => sum + e.orderAmount, 0);
        totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);
        averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
      }
    } else {
      // Fallback to stored values if no krakenService provided
      totalInvested = filledEntries.reduce((sum, e) => sum + e.orderAmount, 0);
      totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);
      averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
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
      // IMPORTANT: Always calculate from CURRENT price (not last entry price)
      // This ensures DCA is always entering BELOW current market price
      nextEntryPrice = currentPrice * (1 - nextStepPercent / 100);
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
      currentEntryCount: filledEntries.length,
      averagePurchasePrice,
      totalInvested,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      lastEntryTime: lastEntry?.timestamp || null,
      nextEntryPrice,
      currentTpPrice,
      entries,
      techScore: trendAnalysis.techScore,
      trendScore: trendAnalysis.trendScore,
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

    // Check if price has dropped enough (only for re-entries, not first entry)
    if (bot.currentEntryCount > 0 && bot.nextEntryPrice && currentPrice > bot.nextEntryPrice) {
      return {
        shouldEnter: false,
        reason: `Price not low enough (current: ${currentPrice}, target: ${bot.nextEntryPrice})`,
      };
    }

    // Check trend alignment and support/resistance
    const entryCheck = await this.marketAnalysis.shouldEnter(
      bot.symbol,
      currentPrice,
      bot.supportResistanceEnabled,
      bot.trendAlignmentEnabled,
      bot.support,
      bot.currentEntryCount
    );

    return {
      shouldEnter: entryCheck.shouldEnter,
      reason: entryCheck.reason,
    };
  }

  /**
   * Execute a buy order for a bot
   */
  async executeEntry(
    bot: LiveDCABot,
    krakenService: KrakenService
  ): Promise<{ success: boolean; entry?: DCABotEntry; error?: string }> {
    try {
      // Get current price
      const ticker = await krakenService.getTicker(bot.symbol);
      const currentPrice = ticker.price;

      // Calculate order amount
      const orderAmount = this.calculateNextOrderAmount(
        bot.currentEntryCount,
        bot.initialOrderAmount,
        bot.tradeMultiplier
      );

      // Calculate quantity to buy
      const quantity = orderAmount / currentPrice;

      // Place order
      const orderResult = await krakenService.placeBuyOrder(bot.symbol, quantity);

      // Create entry record
      const entry: DCABotEntry = {
        id: `${bot.id}_entry_${bot.currentEntryCount + 1}`,
        botId: bot.id,
        entryNumber: bot.currentEntryCount + 1,
        orderAmount,
        price: currentPrice,
        quantity,
        timestamp: new Date().toISOString(),
        orderId: orderResult.txid ? orderResult.txid[0] : undefined,
        status: 'filled',
        txid: orderResult.txid ? orderResult.txid[0] : undefined,
      };

      // Save entry to Firestore
      await this.db
        .collection('dcaBots')
        .doc(bot.id)
        .collection('entries')
        .doc(entry.id)
        .set(entry);

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
      const ticker = await krakenService.getTicker(bot.symbol);
      const currentPrice = ticker.price;

      // Calculate total quantity to sell
      const filledEntries = bot.entries.filter((e) => e.status === 'filled');
      const totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);

      if (totalQuantity === 0) {
        return { success: false, error: 'No quantity to sell' };
      }

      // Place sell order
      const orderResult = await krakenService.placeSellOrder(bot.symbol, totalQuantity);

      // Update bot status to completed
      await this.db.collection('dcaBots').doc(bot.id).update({
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });

      // Log execution
      await this.logExecution({
        id: `${bot.id}_exec_${Date.now()}`,
        botId: bot.id,
        action: 'exit',
        symbol: bot.symbol,
        price: currentPrice,
        quantity: totalQuantity,
        amount: totalQuantity * currentPrice,
        reason: 'Take profit target reached',
        techScore: bot.techScore,
        trendScore: bot.trendScore,
        timestamp: new Date().toISOString(),
        success: true,
        orderId: orderResult.txid ? orderResult.txid[0] : undefined,
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

      if (!bot || bot.status !== 'active') {
        return {
          processed: false,
          reason: 'Bot not active or not found',
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
      await this.db.collection('botExecutions').doc(log.id).set(log);
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
