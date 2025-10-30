/**
 * Telegram Notification Service
 * Sends notifications for arbitrage strategy events
 */

import { apiService } from './apiService';

class TelegramNotificationService {
  private enabled: boolean = false;

  constructor() {
    // Check if Telegram is configured
    this.enabled = !!(localStorage.getItem('telegram_bot_token') && localStorage.getItem('telegram_chat_id'));
  }

  /**
   * Send a notification via Telegram
   */
  private async send(message: string): Promise<void> {
    if (!this.enabled) {
      console.log('[Telegram] Notifications disabled (not configured)');
      return;
    }

    try {
      const botToken = localStorage.getItem('telegram_bot_token');
      const chatId = localStorage.getItem('telegram_chat_id');

      if (!botToken || !chatId) {
        console.warn('[Telegram] Missing credentials');
        return;
      }

      // Send via Telegram API directly
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      console.log('[Telegram] Notification sent');
    } catch (error) {
      console.error('[Telegram] Failed to send notification:', error);
    }
  }

  /**
   * Notify when strategy starts
   */
  async notifyStrategyStarted(totalCapital: number): Promise<void> {
    const message = `
🤖 <b>Auto-Arbitrage Strategy Started</b>

💰 Total Capital: $${totalCapital.toLocaleString()}
📊 Allocations: 30%, 30%, 20%, 10%, 10%
🔄 Rebalance: Every 4 hours
⚡ Ready to capture funding rate opportunities!
    `.trim();

    await this.send(message);
  }

  /**
   * Notify when strategy stops
   */
  async notifyStrategyStopped(): Promise<void> {
    const message = `
🛑 <b>Auto-Arbitrage Strategy Stopped</b>

All positions have been closed.
    `.trim();

    await this.send(message);
  }

  /**
   * Notify when a position is opened
   */
  async notifyPositionOpened(
    canonical: string,
    rank: number,
    allocation: number,
    longExchange: string,
    shortExchange: string,
    longPrice: number,
    shortPrice: number,
    spread: number,
    positionSize: number
  ): Promise<void> {
    const message = `
✅ <b>Position Opened: ${canonical}</b>

🏆 Rank: #${rank} (${allocation}% allocation)
💵 Size: $${positionSize.toFixed(2)}

📈 <b>Long:</b> ${longExchange.toUpperCase()} @ $${longPrice.toFixed(2)}
📉 <b>Short:</b> ${shortExchange.toUpperCase()} @ $${shortPrice.toFixed(2)}

💹 <b>Spread:</b> ${spread.toFixed(4)}%
🎯 Expected APR: ${(spread * 365).toFixed(2)}%
    `.trim();

    await this.send(message);
  }

  /**
   * Notify when a position is closed
   */
  async notifyPositionClosed(
    canonical: string,
    reason: string,
    entrySpread: number,
    exitSpread: number,
    pnl: number,
    fundingEarned: number,
    durationHours: number
  ): Promise<void> {
    const pnlEmoji = pnl >= 0 ? '💚' : '❌';
    const reasonText = reason === 'negative_spread' ? '⚠️ Negative Spread' :
                       reason === 'rebalance' ? '🔄 Rebalance' :
                       '🛑 Manual Close';

    const message = `
${pnlEmoji} <b>Position Closed: ${canonical}</b>

📍 Reason: ${reasonText}
⏱️ Duration: ${durationHours.toFixed(1)} hours

📊 <b>Entry Spread:</b> ${entrySpread.toFixed(4)}%
📊 <b>Exit Spread:</b> ${exitSpread.toFixed(4)}%

💰 <b>P&L:</b> ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}
🎁 <b>Funding Earned:</b> $${fundingEarned.toFixed(2)}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify when rebalancing occurs
   */
  async notifyRebalance(
    entered: string[],
    exited: string[],
    totalPositions: number
  ): Promise<void> {
    const enteredText = entered.length > 0 ? entered.join(', ') : 'None';
    const exitedText = exited.length > 0 ? exited.join(', ') : 'None';

    const message = `
🔄 <b>Portfolio Rebalance Complete</b>

✅ <b>Entered:</b> ${enteredText}
❌ <b>Exited:</b> ${exitedText}

📊 <b>Active Positions:</b> ${totalPositions} / 5
    `.trim();

    await this.send(message);
  }

  /**
   * Notify when a spread goes negative
   */
  async notifyNegativeSpread(
    canonical: string,
    spread: number
  ): Promise<void> {
    const message = `
⚠️ <b>Negative Spread Alert!</b>

Asset: ${canonical}
Spread: ${spread.toFixed(4)}%

Position will be closed immediately.
    `.trim();

    await this.send(message);
  }

  /**
   * Enable/disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

export const telegramNotificationService = new TelegramNotificationService();
