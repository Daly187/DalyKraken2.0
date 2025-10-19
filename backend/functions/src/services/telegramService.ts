import { db } from '../db.js';

/**
 * Telegram Service for Firebase Functions
 * Handles sending notifications via Telegram Bot API
 */
export class TelegramService {
  private botToken: string | null = null;
  private chatId: string | null = null;
  private enabled: boolean = false;
  private notifications = {
    trades: true,
    dcaExecutions: true,
    alerts: true,
    dailySummary: true,
  };

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from Firestore
   */
  private async loadConfig() {
    try {
      const doc = await db.collection('settings').doc('telegram').get();
      if (doc.exists) {
        const data = doc.data();
        this.botToken = data?.botToken || process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = data?.chatId || process.env.TELEGRAM_CHAT_ID || null;
        this.enabled = data?.enabled || false;
        this.notifications = data?.notifications || this.notifications;
      } else {
        // Fallback to environment variables
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = process.env.TELEGRAM_CHAT_ID || null;
      }
    } catch (error) {
      console.warn('[Telegram] Failed to load config from Firestore, using env vars');
      this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
      this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    }
  }

  /**
   * Configure Telegram bot
   */
  async configure(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;

    // Save to Firestore
    await db.collection('settings').doc('telegram').set({
      botToken,
      chatId,
      enabled: this.enabled,
      notifications: this.notifications,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('[Telegram] Bot configured');
  }

  /**
   * Enable or disable Telegram notifications
   */
  async setEnabled(enabled: boolean) {
    this.enabled = enabled;

    // Save to Firestore
    await db.collection('settings').doc('telegram').set({
      enabled,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[Telegram] Notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: Partial<typeof this.notifications>) {
    this.notifications = {
      ...this.notifications,
      ...preferences,
    };

    // Save to Firestore
    await db.collection('settings').doc('telegram').set({
      notifications: this.notifications,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('[Telegram] Notification preferences updated');
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
  async sendMessage(message: string, parseMode: string = 'Markdown'): Promise<any> {
    if (!this.enabled) {
      console.log('[Telegram] Notifications disabled, message not sent');
      return { sent: false, reason: 'disabled' };
    }

    if (!this.botToken || !this.chatId) {
      console.warn('[Telegram] Not configured, message not sent');
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
        console.error('[Telegram] API error:', data);
        throw new Error(data.description || 'Failed to send Telegram message');
      }

      console.log('[Telegram] Message sent successfully');
      return {
        sent: true,
        messageId: data.result.message_id,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[Telegram] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a trade entry notification
   */
  async sendTradeEntry(tradeData: any, balance: any): Promise<any> {
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
  async sendTradeClosure(tradeData: any, balance: any): Promise<any> {
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
  async sendDCAExecution(executionData: any, balance: any): Promise<any> {
    if (!this.notifications.dcaExecutions) {
      return { sent: false, reason: 'dca_notifications_disabled' };
    }

    const { pair, amount, price, volume, strategyId, symbol } = executionData;

    const message = `💎 *DCA EXECUTION*\n\n` +
      `*Pair:* ${symbol || pair}\n` +
      `*Amount:* $${parseFloat(amount).toFixed(2)}\n` +
      `*Price:* $${parseFloat(price).toFixed(2)}\n` +
      `*Volume:* ${parseFloat(volume).toFixed(8)}\n` +
      `*Strategy:* \`${strategyId || 'N/A'}\`\n\n` +
      `💰 *Portfolio Balance*\n` +
      `*Total:* $${parseFloat(balance.total || 0).toFixed(2)}\n` +
      `*Stables:* $${parseFloat(balance.stables || 0).toFixed(2)}\n\n` +
      `⏰ ${new Date().toLocaleString()}`;

    return await this.sendMessage(message);
  }

  /**
   * Send an alert notification
   */
  async sendAlert(title: string, message: string, severity: string = 'info'): Promise<any> {
    if (!this.notifications.alerts) {
      return { sent: false, reason: 'alert_notifications_disabled' };
    }

    const alertEmoji: Record<string, string> = {
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
  async sendTestMessage(): Promise<any> {
    const message = '🤖 *DalyKraken Test Message*\n\n' +
      'Your Telegram integration is working correctly!\n\n' +
      `⏰ ${new Date().toLocaleString()}`;

    return await this.sendMessage(message);
  }

  /**
   * Mask bot token for security
   */
  private maskToken(token: string): string {
    if (!token || token.length < 8) return '****';
    return token.substring(0, 6) + '****' + token.substring(token.length - 4);
  }
}

// Export singleton instance
export const telegramService = new TelegramService();
