import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Centralized settings storage service
 * In production, this should use a database like PostgreSQL or MongoDB
 */
class SettingsStore {
  constructor() {
    this.settings = {
      apiKeys: {},
      quantifyCryptoKeys: [],
      krakenKeys: [],
      coinMarketCapKey: null,
      preferences: {},
      notifications: {},
    };
  }

  /**
   * Get all API keys
   */
  getApiKeys() {
    return this.settings.apiKeys;
  }

  /**
   * Get a specific API key
   */
  getApiKey(name) {
    return this.settings.apiKeys[name];
  }

  /**
   * Set API key
   */
  setApiKey(name, data) {
    this.settings.apiKeys[name] = data;
    logger.debug(`API key set: ${name}`);
  }

  /**
   * Delete API key
   */
  deleteApiKey(name) {
    delete this.settings.apiKeys[name];
    logger.debug(`API key deleted: ${name}`);
  }

  /**
   * Get Quantify Crypto keys
   */
  getQuantifyCryptoKeys() {
    return this.settings.quantifyCryptoKeys || [];
  }

  /**
   * Set Quantify Crypto keys
   */
  setQuantifyCryptoKeys(keys) {
    this.settings.quantifyCryptoKeys = keys;
    logger.debug(`Quantify Crypto keys updated: ${keys.length} keys`);
  }

  /**
   * Get the first active Quantify Crypto key
   */
  getActiveQuantifyCryptoKey() {
    const keys = this.getQuantifyCryptoKeys();
    if (!keys || keys.length === 0) {
      return null;
    }

    // Find first active key
    const activeKey = keys.find(k => k.isActive !== false);
    if (activeKey && activeKey.apiKey) {
      // Decrypt if encrypted
      if (activeKey.encrypted) {
        return decryptKey(activeKey.apiKey);
      }
      return activeKey.apiKey;
    }

    return null;
  }

  /**
   * Get Kraken keys
   */
  getKrakenKeys() {
    return this.settings.krakenKeys || [];
  }

  /**
   * Set Kraken keys
   */
  setKrakenKeys(keys) {
    this.settings.krakenKeys = keys;
    logger.debug(`Kraken keys updated: ${keys.length} keys`);
  }

  /**
   * Get CoinMarketCap key
   */
  getCoinMarketCapKey() {
    return this.settings.coinMarketCapKey;
  }

  /**
   * Set CoinMarketCap key
   */
  setCoinMarketCapKey(key) {
    this.settings.coinMarketCapKey = key;
    logger.debug('CoinMarketCap key updated');
  }

  /**
   * Get preferences
   */
  getPreferences() {
    return this.settings.preferences;
  }

  /**
   * Set preferences
   */
  setPreferences(preferences) {
    this.settings.preferences = {
      ...this.settings.preferences,
      ...preferences,
    };
  }

  /**
   * Get notifications
   */
  getNotifications() {
    return this.settings.notifications;
  }

  /**
   * Set notifications
   */
  setNotifications(notifications) {
    this.settings.notifications = {
      ...this.settings.notifications,
      ...notifications,
    };
  }

  /**
   * Reset all settings
   */
  reset(section) {
    if (section === 'preferences' || !section) {
      this.settings.preferences = {};
    }
    if (section === 'notifications' || !section) {
      this.settings.notifications = {};
    }
    logger.info(`Settings reset: ${section || 'all'}`);
  }
}

/**
 * Helper function to encrypt sensitive data
 */
function encryptKey(key) {
  const algorithm = 'aes-256-cbc';
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32)),
    iv
  );

  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Helper function to decrypt sensitive data
 */
function decryptKey(encrypted) {
  try {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32)),
      iv
    );

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Error decrypting key:', error);
    return encrypted; // Return as-is if not encrypted
  }
}

/**
 * Helper function to mask API key for display
 */
function maskApiKey(key) {
  if (!key || key.length < 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Export singleton instance
export const settingsStore = new SettingsStore();
export { encryptKey, decryptKey, maskApiKey };
