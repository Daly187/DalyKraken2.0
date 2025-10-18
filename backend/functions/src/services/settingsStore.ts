import * as crypto from 'crypto';

/**
 * Centralized settings storage service for Firebase Functions
 * In production, this should use Firestore for persistent storage
 */
class SettingsStore {
  private settings = {
    apiKeys: {} as Record<string, any>,
    quantifyCryptoKeys: [] as any[],
    krakenKeys: [] as any[],
    coinMarketCapKey: null as string | null,
    preferences: {} as Record<string, any>,
    notifications: {} as Record<string, any>,
  };

  /**
   * Get all API keys
   */
  getApiKeys(): Record<string, any> {
    return this.settings.apiKeys;
  }

  /**
   * Get a specific API key
   */
  getApiKey(name: string): any {
    return this.settings.apiKeys[name];
  }

  /**
   * Set API key
   */
  setApiKey(name: string, data: any): void {
    this.settings.apiKeys[name] = data;
    console.log(`[SettingsStore] API key set: ${name}`);
  }

  /**
   * Delete API key
   */
  deleteApiKey(name: string): void {
    delete this.settings.apiKeys[name];
    console.log(`[SettingsStore] API key deleted: ${name}`);
  }

  /**
   * Get Quantify Crypto keys
   */
  getQuantifyCryptoKeys(): any[] {
    return this.settings.quantifyCryptoKeys || [];
  }

  /**
   * Set Quantify Crypto keys
   */
  setQuantifyCryptoKeys(keys: any[]): void {
    this.settings.quantifyCryptoKeys = keys;
    console.log(`[SettingsStore] Quantify Crypto keys updated: ${keys.length} keys`);
  }

  /**
   * Get the first active Quantify Crypto key
   */
  getActiveQuantifyCryptoKey(): string | null {
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
  getKrakenKeys(): any[] {
    return this.settings.krakenKeys || [];
  }

  /**
   * Set Kraken keys
   */
  setKrakenKeys(keys: any[]): void {
    this.settings.krakenKeys = keys;
    console.log(`[SettingsStore] Kraken keys updated: ${keys.length} keys`);
  }

  /**
   * Get CoinMarketCap key
   */
  getCoinMarketCapKey(): string | null {
    return this.settings.coinMarketCapKey;
  }

  /**
   * Set CoinMarketCap key
   */
  setCoinMarketCapKey(key: string): void {
    this.settings.coinMarketCapKey = key;
    console.log('[SettingsStore] CoinMarketCap key updated');
  }

  /**
   * Get preferences
   */
  getPreferences(): Record<string, any> {
    return this.settings.preferences;
  }

  /**
   * Set preferences
   */
  setPreferences(preferences: Record<string, any>): void {
    this.settings.preferences = {
      ...this.settings.preferences,
      ...preferences,
    };
  }

  /**
   * Get notifications
   */
  getNotifications(): Record<string, any> {
    return this.settings.notifications;
  }

  /**
   * Set notifications
   */
  setNotifications(notifications: Record<string, any>): void {
    this.settings.notifications = {
      ...this.settings.notifications,
      ...notifications,
    };
  }

  /**
   * Reset all settings
   */
  reset(section?: string): void {
    if (section === 'preferences' || !section) {
      this.settings.preferences = {};
    }
    if (section === 'notifications' || !section) {
      this.settings.notifications = {};
    }
    console.log(`[SettingsStore] Settings reset: ${section || 'all'}`);
  }
}

/**
 * Helper function to encrypt sensitive data
 */
export function encryptKey(key: string): string {
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
export function decryptKey(encrypted: string): string {
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
    console.error('[SettingsStore] Error decrypting key:', error);
    return encrypted; // Return as-is if not encrypted
  }
}

/**
 * Helper function to mask API key for display
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Export singleton instance
export const settingsStore = new SettingsStore();
