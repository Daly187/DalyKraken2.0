import { logger } from '../utils/logger.js';

/**
 * Telegram Service
 * Handles sending notifications via Telegram Bot API
 */
class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    this.enabled = false;
    this.notifications = {
      trades: true,
      dcaExecutions: true,
      alerts: true,
      dailySummary: true,
    };
  }

  /**
   * Configure Telegram bot
   */
  configure(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    logger.info('Telegram bot configured');
  }

  /**
   * Enable or disable Telegram notifications
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`Telegram notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update notification preferences
   */
  updateNotificationPreferences(preferences) {
    this.notifications = {
      ...this.notifications,
      ...preferences,
    };
    logger.info('Telegram notification preferences updated');
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      configured: !!(this.botToken && this.chatId),
      botToken: this.botToken ? this.maskToken(this.botToken) : null,
      chatId: this.chatId,
      notifications: this.notifications,
    };
  }

  /**
   * Send a message via Telegram
   */
  async sendMessage(message, parseMode = 'Markdown') {
    if (!this.enabled) {
      logger.debug('Telegram notifications disabled, message not sent');
      return { sent: false, reason: 'disabled' };
    }

    if (!this.botToken || !this.chatId) {
      logger.warn('Telegram not configured, message not sent');
      return { sent: false, reason: 'not_configured' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Telegram API error:', data);
        throw new Error(data.description || 'Failed to send Telegram message');
      }

      logger.info('Telegram message sent successfully');
      return {
        sent: true,
        messageId: data.result.message_id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  /**
   * Send a trade entry notification
   */
  async sendTradeEntry(tradeData, balance) {
    if (!this.notifications.trades) {
      return { sent: false, reason: 'trade_notifications_disabled' };
    }

    const { pair, type, volume, price, amount, orderResult } = tradeData;

    const message = `🟢 *TRADE ENTRY*\n\n` +
      `*Pair:* ${pair}\n` +
      `*Type:* ${type.toUpperCase()}\n` +
      `*Volume:* ${parseFloat(volume).toFixed(8)}\n` +
      `*Price:* $${parseFloat(price).toFixed(2)}\n` +
      `*Amount:* $${parseFloat(amount).toFixed(2)}\n` +
      `*Order ID:* \`${orderResult?.txid?.[0] || 'N/A'}\`\n\n` +
      `💰 *Portfolio Balance*\n` +
      `*Total:* $${parseFloat(balance.total || 0).toFixed(2)}\n` +
      `*Stables:* $${parseFloat(balance.stables || 0).toFixed(2)}\n\n` +
      `⏰ ${new Date().toLocaleString()}`;

    return await this.sendMessage(message);
  }

  /**
   * Send a trade closure notification
   */
  async sendTradeClosure(tradeData, balance) {
    if (!this.notifications.trades) {
      return { sent: false, reason: 'trade_notifications_disabled' };
    }

    const { pair, type, volume, price, amount, profit, profitPercent, orderResult } = tradeData;

    const profitEmoji = profit >= 0 ? '📈' : '📉';
    const message = `🔴 *TRADE CLOSED*\n\n` +
      `*Pair:* ${pair}\n` +
      `*Type:* ${type.toUpperCase()}\n` +
      `*Volume:* ${parseFloat(volume).toFixed(8)}\n` +
      `*Price:* $${parseFloat(price).toFixed(2)}\n` +
      `*Amount:* $${parseFloat(amount).toFixed(2)}\n` +
      `*Order ID:* \`${orderResult?.txid?.[0] || 'N/A'}\`\n\n` +
      `${profitEmoji} *Profit/Loss*\n` +
      `*Amount:* ${profit >= 0 ? '+' : ''}$${parseFloat(profit || 0).toFixed(2)}\n` +
      `*Percent:* ${profitPercent >= 0 ? '+' : ''}${parseFloat(profitPercent || 0).toFixed(2)}%\n\n` +
      `💰 *Portfolio Balance*\n` +
      `*Total:* $${parseFloat(balance.total || 0).toFixed(2)}\n` +
      `*Stables:* $${parseFloat(balance.stables || 0).toFixed(2)}\n\n` +
      `⏰ ${new Date().toLocaleString()}`;

    return await this.sendMessage(message);
  }

  /**
   * Send a DCA execution notification
   */
  async sendDCAExecution(executionData, balance) {
    if (!this.notifications.dcaExecutions) {
      return { sent: false, reason: 'dca_notifications_disabled' };
    }

    const { pair, amount, price, volume, strategyId } = executionData;

    const message = `💎 *DCA EXECUTION*\n\n` +
      `*Pair:* ${pair}\n` +
      `*Amount:* $${parseFloat(amount).toFixed(2)}\n` +
      `*Price:* $${parseFloat(price).toFixed(2)}\n` +
      `*Volume:* ${parseFloat(volume).toFixed(8)}\n` +
      `*Strategy:* \`${strategyId}\`\n\n` +
      `💰 *Portfolio Balance*\n` +
      `*Total:* $${parseFloat(balance.total || 0).toFixed(2)}\n` +
      `*Stables:* $${parseFloat(balance.stables || 0).toFixed(2)}\n\n` +
      `⏰ ${new Date().toLocaleString()}`;

    return await this.sendMessage(message);
  }

  /**
   * Send an alert notification
   */
  async sendAlert(title, message, severity = 'info') {
    if (!this.notifications.alerts) {
      return { sent: false, reason: 'alert_notifications_disabled' };
    }

    const alertEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    };

    const formattedMessage = `${alertEmoji[severity] || 'ℹ️'} ${title ? `*${title}*\n\n` : ''}${message}`;

    return await this.sendMessage(formattedMessage);
  }

  /**
   * Send a test message
   */
  async sendTestMessage() {
    const message = '🤖 *DalyKraken Test Message*\n\n' +
      'Your Telegram integration is working correctly!\n\n' +
      `⏰ ${new Date().toLocaleString()}`;

    return await this.sendMessage(message);
  }

  /**
   * Mask bot token for security
   */
  maskToken(token) {
    if (!token || token.length < 8) return '****';
    return token.substring(0, 6) + '****' + token.substring(token.length - 4);
  }
}

// Export singleton instance
export const telegramService = new TelegramService();

// Export class for testing
export { TelegramService };
