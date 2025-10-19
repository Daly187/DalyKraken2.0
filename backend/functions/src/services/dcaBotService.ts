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
  async getBotById(botId: string): Promise<LiveDCABot | null> {
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

    // Calculate live metrics
    const filledEntries = entries.filter((e) => e.status === 'filled');

    const totalInvested = filledEntries.reduce((sum, e) => sum + e.orderAmount, 0);
    const totalQuantity = filledEntries.reduce((sum, e) => sum + e.quantity, 0);
    const averagePurchasePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;

    // Get current market price
    const krakenService = new KrakenService();
    let currentPrice = 0;
    try {
      const ticker = await krakenService.getTicker(botData.symbol);
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

    if (lastEntry) {
      const nextStepPercent = this.calculateNextStepPercent(
        filledEntries.length,
        botData.stepPercent,
        botData.stepMultiplier
      );
      nextEntryPrice = lastEntry.price * (1 - nextStepPercent / 100);
    } else {
      // First entry at current market price
      nextEntryPrice = currentPrice;
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

    // Check re-entry delay
    if (bot.lastEntryTime) {
      const lastEntryTime = new Date(bot.lastEntryTime).getTime();
      const timeSinceLastEntry = Date.now() - lastEntryTime;
      const delayMs = bot.reEntryDelay * 60 * 1000; // Convert minutes to ms

      if (bot.currentEntryCount > 0 && timeSinceLastEntry < delayMs) {
        return {
          shouldEnter: false,
          reason: `Re-entry delay not met (${Math.round((delayMs - timeSinceLastEntry) / 60000)} minutes remaining)`,
        };
      }
    }

    // Check if price has dropped enough
    if (bot.nextEntryPrice && currentPrice > bot.nextEntryPrice) {
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
      bot.support
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
      // Get bot with live data
      const bot = await this.getBotById(botId);

      if (!bot || bot.status !== 'active') {
        return {
          processed: false,
          reason: 'Bot not active or not found',
        };
      }

      const krakenService = new KrakenService(krakenApiKey, krakenApiSecret);

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
