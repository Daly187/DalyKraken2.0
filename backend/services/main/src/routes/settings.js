import { logger } from '../utils/logger.js';
import { settingsStore, encryptKey, decryptKey, maskApiKey } from '../services/settingsStore.js';

/**
 * Setup settings and configuration routes
 * @param {express.Router} router - Express router instance
 */
export function setupSettingsRoutes(router) {
  // Use shared settings store instead of local storage
  const settings = settingsStore.settings;

  /**
   * GET /api/settings/api-keys
   * Get list of configured API keys (masked)
   */
  router.get('/api-keys', async (req, res) => {
    try {
      logger.info('Fetching API keys list');

      // Return masked version of API keys
      const maskedKeys = Object.entries(settings.apiKeys).map(([name, data]) => ({
        name,
        publicKey: data.publicKey ? maskApiKey(data.publicKey) : null,
        hasPrivateKey: !!data.privateKey,
        createdAt: data.createdAt,
        lastUsed: data.lastUsed || null,
        isActive: data.isActive !== false,
      }));

      res.json({
        success: true,
        data: maskedKeys,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching API keys:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/settings/api-keys
   * Add or update API key configuration
   */
  router.post('/api-keys', async (req, res) => {
    try {
      const { name, publicKey, privateKey, overwrite = false } = req.body;

      if (!name || !publicKey || !privateKey) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, publicKey, privateKey',
          timestamp: new Date().toISOString(),
        });
      }

      if (settings.apiKeys[name] && !overwrite) {
        return res.status(409).json({
          success: false,
          error: 'API key with this name already exists. Set overwrite=true to update.',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`${settings.apiKeys[name] ? 'Updating' : 'Adding'} API key: ${name}`);

      // Encrypt private key before storing (in production, use proper encryption)
      settings.apiKeys[name] = {
        publicKey,
        privateKey: encryptKey(privateKey),
        createdAt: settings.apiKeys[name]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      res.json({
        success: true,
        message: `API key ${name} ${settings.apiKeys[name] ? 'updated' : 'added'} successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error saving API key:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /api/settings/api-keys/:name
   * Delete an API key configuration
   */
  router.delete('/api-keys/:name', async (req, res) => {
    try {
      const { name } = req.params;

      if (!settings.apiKeys[name]) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Deleting API key: ${name}`);
      delete settings.apiKeys[name];

      res.json({
        success: true,
        message: `API key ${name} deleted successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error deleting API key:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/settings/api-keys/:name/test
   * Test an API key connection
   */
  router.post('/api-keys/:name/test', async (req, res) => {
    try {
      const { name } = req.params;

      if (!settings.apiKeys[name]) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Testing API key: ${name}`);

      // In production, actually test the API key against Kraken
      const testResult = {
        success: true,
        connection: 'successful',
        permissions: ['query', 'trade', 'withdraw'], // Mock permissions
        testedAt: new Date().toISOString(),
      };

      // Update last used timestamp
      settings.apiKeys[name].lastUsed = new Date().toISOString();

      res.json({
        success: true,
        data: testResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error testing API key:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/settings/preferences
   * Get user preferences
   */
  router.get('/preferences', async (req, res) => {
    try {
      logger.info('Fetching user preferences');

      res.json({
        success: true,
        data: settings.preferences,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/settings/preferences
   * Update user preferences
   */
  router.put('/preferences', async (req, res) => {
    try {
      const updates = req.body;
      logger.info('Updating user preferences');

      settings.preferences = {
        ...settings.preferences,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: settings.preferences,
        message: 'Preferences updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/settings/notifications
   * Get notification settings
   */
  router.get('/notifications', async (req, res) => {
    try {
      logger.info('Fetching notification settings');

      res.json({
        success: true,
        data: settings.notifications,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching notification settings:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/settings/notifications
   * Update notification settings
   */
  router.put('/notifications', async (req, res) => {
    try {
      const updates = req.body;
      logger.info('Updating notification settings');

      settings.notifications = {
        ...settings.notifications,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: settings.notifications,
        message: 'Notification settings updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/settings/all
   * Get all settings
   */
  router.get('/all', async (req, res) => {
    try {
      logger.info('Fetching all settings');

      const allSettings = {
        apiKeys: Object.entries(settings.apiKeys).map(([name, data]) => ({
          name,
          publicKey: maskApiKey(data.publicKey),
          hasPrivateKey: !!data.privateKey,
          isActive: data.isActive,
        })),
        preferences: settings.preferences,
        notifications: settings.notifications,
      };

      res.json({
        success: true,
        data: allSettings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching all settings:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/settings/reset
   * Reset settings to defaults
   */
  router.post('/reset', async (req, res) => {
    try {
      const { section } = req.body;
      logger.info(`Resetting settings section: ${section || 'all'}`);

      if (section === 'preferences' || !section) {
        settings.preferences = {};
      }
      if (section === 'notifications' || !section) {
        settings.notifications = {};
      }
      // Never reset API keys without explicit confirmation

      res.json({
        success: true,
        message: `Settings ${section || 'all'} reset successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error resetting settings:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/settings/quantify-crypto-keys
   * Get Quantify Crypto API keys
   */
  router.get('/quantify-crypto-keys', async (req, res) => {
    try {
      logger.info('Fetching Quantify Crypto keys');

      const keys = settingsStore.getQuantifyCryptoKeys();

      // Mask the keys for security
      const maskedKeys = keys.map(key => ({
        ...key,
        apiKey: key.apiKey ? maskApiKey(key.apiKey) : null,
      }));

      res.json({
        success: true,
        data: maskedKeys,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching Quantify Crypto keys:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/settings/quantify-crypto-keys
   * Save Quantify Crypto API keys
   */
  router.post('/quantify-crypto-keys', async (req, res) => {
    try {
      const { keys } = req.body;

      if (!keys || !Array.isArray(keys)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid keys format. Expected array of key objects.',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Saving ${keys.length} Quantify Crypto key(s)`);

      // Encrypt API keys before storing
      const encryptedKeys = keys.map(key => ({
        ...key,
        apiKey: key.apiKey ? encryptKey(key.apiKey) : null,
        encrypted: true,
        updatedAt: new Date().toISOString(),
      }));

      settingsStore.setQuantifyCryptoKeys(encryptedKeys);

      res.json({
        success: true,
        message: `${keys.length} Quantify Crypto key(s) saved successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error saving Quantify Crypto keys:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/settings/kraken-keys
   * Get Kraken API keys
   */
  router.get('/kraken-keys', async (req, res) => {
    try {
      logger.info('Fetching Kraken keys');

      const keys = settingsStore.getKrakenKeys();

      // Mask the keys for security
      const maskedKeys = keys.map(key => ({
        ...key,
        apiKey: key.apiKey ? maskApiKey(key.apiKey) : null,
        apiSecret: key.apiSecret ? maskApiKey(key.apiSecret) : null,
      }));

      res.json({
        success: true,
        data: maskedKeys,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching Kraken keys:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/settings/kraken-keys
   * Save Kraken API keys
   */
  router.post('/kraken-keys', async (req, res) => {
    try {
      const { keys } = req.body;

      if (!keys || !Array.isArray(keys)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid keys format. Expected array of key objects.',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Saving ${keys.length} Kraken key(s)`);

      // Encrypt API keys before storing
      const encryptedKeys = keys.map(key => ({
        ...key,
        apiKey: key.apiKey ? encryptKey(key.apiKey) : key.apiKey,
        apiSecret: key.apiSecret ? encryptKey(key.apiSecret) : key.apiSecret,
        encrypted: true,
        updatedAt: new Date().toISOString(),
      }));

      settingsStore.setKrakenKeys(encryptedKeys);

      res.json({
        success: true,
        message: `${keys.length} Kraken key(s) saved successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error saving Kraken keys:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/settings/coinmarketcap-key
   * Get CoinMarketCap API key
   */
  router.get('/coinmarketcap-key', async (req, res) => {
    try {
      logger.info('Fetching CoinMarketCap key');

      const key = settingsStore.getCoinMarketCapKey();

      res.json({
        success: true,
        data: key ? { apiKey: maskApiKey(key), hasKey: true } : { hasKey: false },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching CoinMarketCap key:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/settings/coinmarketcap-key
   * Save CoinMarketCap API key
   */
  router.post('/coinmarketcap-key', async (req, res) => {
    try {
      const { key } = req.body;

      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'API key is required',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Saving CoinMarketCap key');

      // Encrypt key before storing
      const encryptedKey = encryptKey(key);
      settingsStore.setCoinMarketCapKey(encryptedKey);

      res.json({
        success: true,
        message: 'CoinMarketCap key saved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error saving CoinMarketCap key:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info('Settings routes initialized');
}
