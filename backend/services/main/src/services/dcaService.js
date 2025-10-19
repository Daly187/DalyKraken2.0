import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { krakenService } from './krakenService.js';
import { dataStore } from './dataStore.js';
import { emitDCAExecution, emitSystemAlert } from '../websocket/index.js';
import { telegramService } from './telegramService.js';

/**
 * DCA (Dollar Cost Averaging) Service
 * Manages automated DCA strategies with cron scheduling
 */
class DCAService {
  constructor() {
    this.strategies = new Map();
    this.executions = new Map();
    this.cronJobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize DCA service
   */
  async initialize(io) {
    if (this.isInitialized) {
      logger.warn('DCA service already initialized');
      return;
    }

    logger.info('Initializing DCA service');

    // Load saved strategies from dataStore
    const savedStrategies = dataStore.get('dca_strategies');
    if (savedStrategies && savedStrategies.data) {
      for (const [id, strategy] of Object.entries(savedStrategies.data)) {
        this.strategies.set(id, strategy);
        if (strategy.active) {
          this.scheduleCronJob(id, strategy);
        }
      }
      logger.info(`Loaded ${this.strategies.size} DCA strategies`);
    }

    this.io = io;
    this.isInitialized = true;
    logger.info('DCA service initialized successfully');
  }

  /**
   * Get current status
   */
  async getStatus() {
    const activeStrategies = Array.from(this.strategies.values()).filter(s => s.active);
    const allExecutions = Array.from(this.executions.values());

    // Calculate total deployed amount
    const totalDeployed = allExecutions.reduce((sum, exec) => sum + (exec.amount || 0), 0);

    // Calculate success rate
    const successfulExecutions = allExecutions.filter(exec => exec.status === 'completed').length;
    const successRate = allExecutions.length > 0 ? (successfulExecutions / allExecutions.length) * 100 : 0;

    // Get last execution timestamp
    const lastExecution = allExecutions.length > 0
      ? allExecutions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp
      : null;

    return {
      isRunning: activeStrategies.length > 0,
      isPaused: false,
      lastExecution,
      nextExecution: activeStrategies.length > 0 ? activeStrategies[0].nextExecution : null,
      totalDeployed,
      totalOrders: allExecutions.length,
      successRate,
      recoveryMode: false,
    };
  }

  /**
   * Start a new DCA strategy
   */
  async startStrategy(config) {
    const { pair, amount, interval, conditions = {} } = config;

    const strategyId = `dca_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const strategy = {
      id: strategyId,
      pair,
      amount,
      interval,
      conditions,
      active: true,
      createdAt: new Date().toISOString(),
      lastExecution: null,
      nextExecution: this.calculateNextExecution(interval),
      executionCount: 0,
      totalSpent: 0,
      totalPurchased: 0,
    };

    this.strategies.set(strategyId, strategy);
    this.saveStrategies();

    // Schedule cron job
    this.scheduleCronJob(strategyId, strategy);

    logger.info(`DCA strategy started: ${strategyId} for ${pair}`);

    // Send alert
    if (this.io) {
      emitSystemAlert({
        type: 'info',
        message: `DCA strategy started for ${pair}`,
        strategyId,
      });
    }

    return strategy;
  }

  /**
   * Stop a DCA strategy
   */
  async stopStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new Error('Strategy not found');
    }

    strategy.active = false;
    strategy.stoppedAt = new Date().toISOString();

    // Cancel cron job
    if (this.cronJobs.has(strategyId)) {
      this.cronJobs.get(strategyId).stop();
      this.cronJobs.delete(strategyId);
    }

    this.saveStrategies();

    logger.info(`DCA strategy stopped: ${strategyId}`);

    return strategy;
  }

  /**
   * Execute a DCA strategy
   */
  async executeStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new Error('Strategy not found');
    }

    logger.info(`Executing DCA strategy: ${strategyId}`);

    try {
      // Check conditions before executing
      if (strategy.conditions) {
        const conditionsMet = await this.checkConditions(strategy);
        if (!conditionsMet) {
          logger.info(`Conditions not met for strategy ${strategyId}, skipping execution`);
          return {
            strategyId,
            executed: false,
            reason: 'Conditions not met',
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Get current price
      const prices = await krakenService.getCurrentPrices([strategy.pair]);
      const currentPrice = prices[strategy.pair] || prices[Object.keys(prices)[0]];

      // Calculate volume to purchase
      const volume = strategy.amount / currentPrice;

      // In production, place actual order
      let orderResult;
      if (process.env.DCA_EXECUTE_ORDERS === 'true') {
        orderResult = await krakenService.placeMarketOrder(
          strategy.pair,
          'buy',
          volume.toFixed(8)
        );
      } else {
        // Mock order for testing
        orderResult = {
          txid: [`MOCK_${Date.now()}`],
          descr: {
            order: `buy ${volume.toFixed(8)} ${strategy.pair} @ market`,
          },
        };
        logger.info('DCA order execution skipped (DCA_EXECUTE_ORDERS not enabled)');
      }

      // Record execution
      const execution = {
        strategyId,
        timestamp: new Date().toISOString(),
        pair: strategy.pair,
        amount: strategy.amount,
        price: currentPrice,
        volume,
        orderResult,
        executed: true,
      };

      const executionId = `exec_${Date.now()}`;
      this.executions.set(executionId, execution);

      // Update strategy
      strategy.lastExecution = execution.timestamp;
      strategy.nextExecution = this.calculateNextExecution(strategy.interval);
      strategy.executionCount += 1;
      strategy.totalSpent += strategy.amount;
      strategy.totalPurchased += volume;

      this.saveStrategies();
      this.saveExecutions();

      logger.info(`DCA strategy executed successfully: ${strategyId}`);

      // Get portfolio balance for notification
      let balance = { total: 0, stables: 0 };
      try {
        const accountBalance = await krakenService.getBalance();
        if (accountBalance) {
          // Calculate total balance
          balance.total = Object.entries(accountBalance).reduce((sum, [asset, amount]) => {
            return sum + parseFloat(amount);
          }, 0);

          // Calculate stables (USD, USDT, USDC, etc.)
          balance.stables = Object.entries(accountBalance).reduce((sum, [asset, amount]) => {
            if (asset.includes('USD') || asset.includes('USDT') || asset.includes('USDC')) {
              return sum + parseFloat(amount);
            }
            return sum;
          }, 0);
        }
      } catch (error) {
        logger.warn('Failed to fetch balance for Telegram notification:', error);
      }

      // Broadcast execution
      if (this.io) {
        emitDCAExecution(execution);
        emitSystemAlert({
          type: 'success',
          message: `DCA executed: Bought ${volume.toFixed(8)} ${strategy.pair} for $${strategy.amount}`,
          strategyId,
        });
      }

      // Send Telegram notification
      try {
        await telegramService.sendDCAExecution(execution, balance);
      } catch (error) {
        logger.warn('Failed to send Telegram notification:', error);
        // Don't fail the execution if notification fails
      }

      return execution;
    } catch (error) {
      logger.error(`Error executing DCA strategy ${strategyId}:`, error);

      const failedExecution = {
        strategyId,
        timestamp: new Date().toISOString(),
        executed: false,
        error: error.message,
      };

      // Send alert
      if (this.io) {
        emitSystemAlert({
          type: 'error',
          message: `DCA execution failed: ${error.message}`,
          strategyId,
        });
      }

      throw error;
    }
  }

  /**
   * Get all strategies
   */
  async getAllStrategies() {
    return Array.from(this.strategies.values());
  }

  /**
   * Get a specific strategy
   */
  async getStrategy(strategyId) {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Get strategy execution history
   */
  async getStrategyHistory(strategyId, limit = 50) {
    const executions = Array.from(this.executions.values())
      .filter(e => e.strategyId === strategyId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return executions;
  }

  /**
   * Update a strategy
   */
  async updateStrategy(strategyId, updates) {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Update allowed fields
    const allowedFields = ['amount', 'interval', 'conditions'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        strategy[field] = updates[field];
      }
    }

    strategy.updatedAt = new Date().toISOString();

    // If interval changed, reschedule cron
    if (updates.interval && strategy.active) {
      if (this.cronJobs.has(strategyId)) {
        this.cronJobs.get(strategyId).stop();
      }
      this.scheduleCronJob(strategyId, strategy);
      strategy.nextExecution = this.calculateNextExecution(strategy.interval);
    }

    this.saveStrategies();

    logger.info(`DCA strategy updated: ${strategyId}`);

    return strategy;
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);

    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Stop cron job if active
    if (this.cronJobs.has(strategyId)) {
      this.cronJobs.get(strategyId).stop();
      this.cronJobs.delete(strategyId);
    }

    this.strategies.delete(strategyId);
    this.saveStrategies();

    logger.info(`DCA strategy deleted: ${strategyId}`);
  }

  /**
   * Get deployment audit trail
   */
  async getDeploymentAudit(options = {}) {
    const { strategyId, limit = 100 } = options;

    let executions = Array.from(this.executions.values());

    if (strategyId) {
      executions = executions.filter(e => e.strategyId === strategyId);
    }

    executions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return executions.slice(0, limit);
  }

  /**
   * Schedule cron job for strategy
   */
  scheduleCronJob(strategyId, strategy) {
    const cronExpression = this.intervalToCron(strategy.interval);

    if (!cronExpression) {
      logger.error(`Invalid interval for strategy ${strategyId}: ${strategy.interval}`);
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      logger.info(`Cron triggered for strategy ${strategyId}`);
      try {
        await this.executeStrategy(strategyId);
      } catch (error) {
        logger.error(`Cron execution failed for strategy ${strategyId}:`, error);
      }
    });

    this.cronJobs.set(strategyId, job);

    logger.info(`Scheduled cron job for strategy ${strategyId}: ${cronExpression}`);
  }

  /**
   * Convert interval to cron expression
   */
  intervalToCron(interval) {
    const intervals = {
      '1h': '0 * * * *',          // Every hour
      '2h': '0 */2 * * *',        // Every 2 hours
      '4h': '0 */4 * * *',        // Every 4 hours
      '6h': '0 */6 * * *',        // Every 6 hours
      '12h': '0 */12 * * *',      // Every 12 hours
      '1d': '0 0 * * *',          // Daily at midnight
      '1w': '0 0 * * 0',          // Weekly on Sunday
      'daily': '0 0 * * *',
      'weekly': '0 0 * * 0',
      'hourly': '0 * * * *',
    };

    return intervals[interval] || null;
  }

  /**
   * Calculate next execution time
   */
  calculateNextExecution(interval) {
    const now = new Date();
    const intervals = {
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'hourly': 60 * 60 * 1000,
    };

    const ms = intervals[interval] || intervals['1d'];
    return new Date(now.getTime() + ms).toISOString();
  }

  /**
   * Check if strategy conditions are met
   */
  async checkConditions(strategy) {
    if (!strategy.conditions || Object.keys(strategy.conditions).length === 0) {
      return true; // No conditions, always execute
    }

    const { minPrice, maxPrice, minVolume, maxVolume } = strategy.conditions;

    // Get current market data
    const prices = await krakenService.getCurrentPrices([strategy.pair]);
    const currentPrice = prices[strategy.pair] || prices[Object.keys(prices)[0]];

    // Check price conditions
    if (minPrice && currentPrice < minPrice) {
      logger.debug(`Price ${currentPrice} below minimum ${minPrice}`);
      return false;
    }

    if (maxPrice && currentPrice > maxPrice) {
      logger.debug(`Price ${currentPrice} above maximum ${maxPrice}`);
      return false;
    }

    // Additional conditions can be added here
    // (volume checks, RSI, moving averages, etc.)

    return true;
  }

  /**
   * Save strategies to dataStore
   */
  saveStrategies() {
    const strategiesObj = {};
    for (const [id, strategy] of this.strategies.entries()) {
      strategiesObj[id] = strategy;
    }
    dataStore.set('dca_strategies', strategiesObj);
  }

  /**
   * Save executions to dataStore
   */
  saveExecutions() {
    const executionsArray = Array.from(this.executions.values());
    dataStore.set('dca_executions', executionsArray);
  }
}

// Export singleton instance
export const dcaService = new DCAService();

// Export initialization function
export async function initializeDCA(io) {
  return await dcaService.initialize(io);
}

// Export class for testing
export { DCAService };
