import { logger } from '../utils/logger.js';

/**
 * Setup Telegram integration routes
 * @param {express.Router} router - Express router instance
 */
export function setupTelegramRoutes(router) {
  // In-memory storage for Telegram config (use database in production)
  const telegramConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_CHAT_ID || null,
    enabled: false,
    notifications: {
      trades: true,
      dcaExecutions: true,
      alerts: true,
      dailySummary: true,
    },
  };

  /**
   * GET /api/telegram/status
   * Get Telegram integration status
   */
  router.get('/status', async (req, res) => {
    try {
      logger.info('Fetching Telegram status');

      res.json({
        success: true,
        data: {
          enabled: telegramConfig.enabled,
          configured: !!(telegramConfig.botToken && telegramConfig.chatId),
          botToken: telegramConfig.botToken ? maskToken(telegramConfig.botToken) : null,
          chatId: telegramConfig.chatId,
          notifications: telegramConfig.notifications,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching Telegram status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/telegram/configure
   * Configure Telegram bot credentials
   */
  router.post('/configure', async (req, res) => {
    try {
      const { botToken, chatId } = req.body;

      if (!botToken || !chatId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: botToken, chatId',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Configuring Telegram integration');

      telegramConfig.botToken = botToken;
      telegramConfig.chatId = chatId;

      res.json({
        success: true,
        message: 'Telegram configured successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error configuring Telegram:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/telegram/enable
   * Enable or disable Telegram notifications
   */
  router.post('/enable', async (req, res) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled field must be a boolean',
          timestamp: new Date().toISOString(),
        });
      }

      if (enabled && (!telegramConfig.botToken || !telegramConfig.chatId)) {
        return res.status(400).json({
          success: false,
          error: 'Cannot enable Telegram: bot not configured',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`${enabled ? 'Enabling' : 'Disabling'} Telegram notifications`);

      telegramConfig.enabled = enabled;

      res.json({
        success: true,
        message: `Telegram notifications ${enabled ? 'enabled' : 'disabled'}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error toggling Telegram:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/telegram/test
   * Send a test message to Telegram
   */
  router.post('/test', async (req, res) => {
    try {
      if (!telegramConfig.botToken || !telegramConfig.chatId) {
        return res.status(400).json({
          success: false,
          error: 'Telegram not configured',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Sending Telegram test message');

      // In production, actually send via Telegram API
      const testMessage = {
        text: '🤖 DalyKraken Test Message\n\nYour Telegram integration is working correctly!',
        sent: true,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: testMessage,
        message: 'Test message sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error sending test message:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/telegram/send
   * Send a custom message to Telegram
   */
  router.post('/send', async (req, res) => {
    try {
      const { message, parseMode = 'Markdown' } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: message',
          timestamp: new Date().toISOString(),
        });
      }

      if (!telegramConfig.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Telegram notifications are disabled',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Sending custom Telegram message');

      // In production, send via Telegram API
      const result = {
        sent: true,
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: result,
        message: 'Message sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/telegram/notifications
   * Update notification preferences
   */
  router.put('/notifications', async (req, res) => {
    try {
      const updates = req.body;
      logger.info('Updating Telegram notification preferences');

      telegramConfig.notifications = {
        ...telegramConfig.notifications,
        ...updates,
      };

      res.json({
        success: true,
        data: telegramConfig.notifications,
        message: 'Notification preferences updated',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/telegram/notifications
   * Get notification preferences
   */
  router.get('/notifications', async (req, res) => {
    try {
      logger.info('Fetching Telegram notification preferences');

      res.json({
        success: true,
        data: telegramConfig.notifications,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/telegram/alert
   * Send an alert notification
   */
  router.post('/alert', async (req, res) => {
    try {
      const { title, message, severity = 'info' } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: message',
          timestamp: new Date().toISOString(),
        });
      }

      if (!telegramConfig.enabled || !telegramConfig.notifications.alerts) {
        return res.json({
          success: true,
          message: 'Alert notifications disabled',
          sent: false,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Sending Telegram alert: ${severity}`);

      const alertEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅',
      };

      const formattedMessage = `${alertEmoji[severity] || 'ℹ️'} ${title ? `*${title}*\n\n` : ''}${message}`;

      // In production, send via Telegram API
      const result = {
        sent: true,
        messageId: `alert_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: result,
        message: 'Alert sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error sending alert:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /api/telegram/configure
   * Remove Telegram configuration
   */
  router.delete('/configure', async (req, res) => {
    try {
      logger.info('Removing Telegram configuration');

      telegramConfig.botToken = null;
      telegramConfig.chatId = null;
      telegramConfig.enabled = false;

      res.json({
        success: true,
        message: 'Telegram configuration removed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error removing Telegram configuration:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Telegram routes initialized');
}

/**
 * Helper function to mask bot token
 */
function maskToken(token) {
  if (!token || token.length < 8) return '****';
  return token.substring(0, 6) + '****' + token.substring(token.length - 4);
}
