import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import config from '../config/env';

class ApiService {
  private mainApi: AxiosInstance;
  private cacheApi: AxiosInstance;
  private snapshotApi: AxiosInstance;
  private lastFetchTimes: Map<string, number> = new Map();
  private throttleDelay = 100; // 100ms minimum between same requests

  constructor() {
    console.log('[ApiService] Initializing with:', {
      mainUrl: config.api.mainUrl,
      cacheUrl: config.api.cacheUrl,
      snapshotUrl: config.api.snapshotUrl,
    });

    this.mainApi = axios.create({
      baseURL: config.api.mainUrl,
      timeout: config.api.timeout.main,
    });

    this.cacheApi = axios.create({
      baseURL: config.api.cacheUrl,
      timeout: config.api.timeout.cache,
    });

    this.snapshotApi = axios.create({
      baseURL: config.api.snapshotUrl,
      timeout: config.api.timeout.snapshot,
    });

    // Add request interceptor to attach JWT token to all requests
    this.mainApi.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor to handle 401 errors
    this.mainApi.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear auth and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private shouldThrottle(key: string): boolean {
    const lastFetch = this.lastFetchTimes.get(key);
    if (!lastFetch) return false;

    const elapsed = Date.now() - lastFetch;
    return elapsed < this.throttleDelay;
  }

  private updateFetchTime(key: string): void {
    this.lastFetchTimes.set(key, Date.now());
  }

  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const key = `GET:${endpoint}`;

    if (this.shouldThrottle(key)) {
      // Return cached result instead of throwing error
      console.log('[ApiService] Request throttled, waiting...');
      await new Promise(resolve => setTimeout(resolve, this.throttleDelay));
    }

    try {
      this.updateFetchTime(key);
      const response = await this.mainApi.get(endpoint, config);
      return response.data;
    } catch (error) {
      console.warn('[ApiService] Main API failed, trying fallbacks:', error);
      return this.getFallback<T>(endpoint);
    }
  }

  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.mainApi.post(endpoint, data, config);
    return response.data;
  }

  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.mainApi.put(endpoint, data, config);
    return response.data;
  }

  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.mainApi.delete(endpoint, config);
    return response.data;
  }

  private async getFallback<T>(endpoint: string): Promise<T> {
    // Try Cache API first (5055)
    try {
      const cacheEndpoint = this.mapToCacheEndpoint(endpoint);
      const response = await this.cacheApi.get(cacheEndpoint);
      console.log('[ApiService] Served from Cache API');
      return response.data;
    } catch (cacheError) {
      console.warn('[ApiService] Cache API failed:', cacheError);
    }

    // Try Snapshot service (5002)
    try {
      const snapshotEndpoint = this.mapToSnapshotEndpoint(endpoint);
      const response = await this.snapshotApi.get(snapshotEndpoint);
      console.log('[ApiService] Served from Snapshot service');
      return response.data;
    } catch (snapshotError) {
      console.warn('[ApiService] Snapshot service failed:', snapshotError);
    }

    // All fallbacks failed
    throw new Error('All API endpoints unavailable');
  }

  private mapToCacheEndpoint(endpoint: string): string {
    // Map main API endpoints to cache API compatibility endpoints
    const mapping: Record<string, string> = {
      '/account-info': '/account-info',
      '/portfolio': '/portfolio',
      '/market/overview': '/market-overview',
      '/risk/status': '/risk-status',
      '/scanner/data': '/scanner-data',
      '/market/live-prices': '/market-overview',
      '/daly-dca/status': '/dca-status',
    };

    return mapping[endpoint] || '/snapshot';
  }

  private mapToSnapshotEndpoint(endpoint: string): string {
    // Map main API endpoints to snapshot service endpoints
    const mapping: Record<string, string> = {
      '/account-info': '/account',
      '/portfolio': '/portfolio',
      '/market/overview': '/market',
      '/risk/status': '/risk',
      '/scanner/data': '/scanner',
      '/market/live-prices': '/market',
      '/daly-dca/status': '/dca-status',
    };

    return mapping[endpoint] || '/latest';
  }

  async getAccountInfo() {
    return this.get('/account/info');
  }

  async getPortfolio() {
    // Get Kraken API keys from localStorage for authenticated balance fetch
    const getApiKeys = () => {
      try {
        const keysJson = localStorage.getItem('kraken_api_keys');
        if (!keysJson) return null;

        const keys = JSON.parse(keysJson);
        if (!Array.isArray(keys)) return null;

        // Try primary key first
        const primaryKey = keys.find((k: any) => k.type === 'primary');
        if (primaryKey?.apiKey && primaryKey?.apiSecret && primaryKey.isActive) {
          return { apiKey: primaryKey.apiKey, apiSecret: primaryKey.apiSecret };
        }

        // Try fallback keys
        for (const keyType of ['fallback1', 'fallback2']) {
          const key = keys.find((k: any) => k.type === keyType);
          if (key?.apiKey && key?.apiSecret && key.isActive) {
            return { apiKey: key.apiKey, apiSecret: key.apiSecret };
          }
        }

        return null;
      } catch (error) {
        console.error('[ApiService] Error reading API keys:', error);
        return null;
      }
    };

    const credentials = getApiKeys();
    const headers: Record<string, string> = {};

    if (credentials) {
      headers['x-kraken-api-key'] = credentials.apiKey;
      headers['x-kraken-api-secret'] = credentials.apiSecret;
    }

    return this.get('/portfolio/overview', { headers });
  }

  async getMarketOverview() {
    return this.get('/market/overview');
  }

  async getLivePrices() {
    return this.get('/market/live-prices');
  }

  async getTop20() {
    return this.get('/market/top-20');
  }

  async getRiskStatus() {
    // Since there's no risk-status endpoint, return mock risk data
    return {
      success: true,
      data: {
        riskLevel: 'Low',
        diversificationScore: 75,
        volatilityIndex: 2.3,
        maxDrawdown: -5.2,
        sharpeRatio: 1.8,
        beta: 0.85,
        timestamp: new Date().toISOString()
      }
    };
  }

  async getScannerData() {
    return this.get('/scanner/data');
  }

  async getDCAStatus() {
    return this.get('/dca/status');
  }

  async getDCAConfig() {
    return this.get('/daly-dca/config');
  }

  async startDCA() {
    return this.post('/daly-dca/start');
  }

  async stopDCA() {
    return this.post('/daly-dca/stop');
  }

  async scanMarkets(timeGraph: string) {
    return this.post('/daly-dca/scan', { time_graph: timeGraph });
  }

  async executeDCA(data: any) {
    return this.post('/daly-dca/execute', data);
  }

  async getBotScoresSnapshot() {
    return this.get('/daly-dca/bot-scores-snapshot');
  }

  async refreshBotScores() {
    return this.post('/daly-dca/refresh-scores');
  }

  async getTransactions(params?: any) {
    return this.get('/audit/transactions', { params });
  }

  async getAuditSummary() {
    return this.get('/audit/summary');
  }

  async syncKraken() {
    return this.post('/audit/sync-kraken');
  }

  async exportAudit(format: 'json' | 'csv') {
    return this.get(`/audit/export?format=${format}`);
  }

  async getDCADeployments() {
    return this.get('/audit/dca-deployments');
  }

  async getDCASummary() {
    return this.get('/audit/dca-summary');
  }

  // DCA Bot management
  async getDCABots() {
    return this.get('/dca-bots');
  }

  async createDCABot(config: any) {
    return this.post('/dca-bots', config);
  }

  async updateDCABot(id: string, updates: any) {
    return this.put(`/dca-bots/${id}`, updates);
  }

  async deleteDCABot(id: string) {
    return this.delete(`/dca-bots/${id}`);
  }

  async pauseDCABot(id: string) {
    return this.post(`/dca-bots/${id}/pause`);
  }

  async resumeDCABot(id: string) {
    return this.post(`/dca-bots/${id}/resume`);
  }

  async triggerDCABots() {
    return this.post('/dca-bots/trigger');
  }

  async getEnhancedTrends(limit: number = 20) {
    return this.get(`/market/quantify-crypto/enhanced-trends?limit=${limit}`);
  }

  async getKrakenKeys() {
    return this.get('/settings/kraken-keys');
  }

  async saveKrakenKeys(keys: any[]) {
    return this.post('/settings/kraken-keys', { keys });
  }

  async testKrakenKey(keyId: string) {
    return this.post('/kraken/test', { keyId });
  }

  async reloadKrakenKeys() {
    return this.post('/kraken/reload');
  }

  async getQuantifyCryptoKeys() {
    return this.get('/settings/quantify-crypto-keys');
  }

  async saveQuantifyCryptoKeys(keys: any[]) {
    return this.post('/settings/quantify-crypto-keys', { keys });
  }

  async testQuantifyCrypto() {
    return this.get('/quantify-crypto/test');
  }

  async getCoinMarketCapKey() {
    return this.get('/settings/coinmarketcap-key');
  }

  async saveCoinMarketCapKey(key: string) {
    return this.post('/settings/coinmarketcap-key', { key });
  }

  async getTelegramConfig() {
    return this.get('/telegram/config');
  }

  async saveTelegramConfig(config: any) {
    return this.post('/telegram/config', config);
  }

  async testTelegram() {
    return this.post('/telegram/test');
  }

  async getTelegramStatus() {
    return this.get('/telegram/status');
  }

  async sendTelegramPulse() {
    return this.post('/telegram/send-pulse');
  }

  async getHealth() {
    return this.get('/health');
  }

  // Cost Basis & Trade History
  async syncTradeHistory(userId?: string) {
    // Get Kraken API keys from localStorage for authentication
    const getApiKeys = () => {
      try {
        const keysJson = localStorage.getItem('kraken_api_keys');
        if (!keysJson) return null;

        const keys = JSON.parse(keysJson);
        if (!Array.isArray(keys)) return null;

        // Try primary key first
        const primaryKey = keys.find((k: any) => k.type === 'primary');
        if (primaryKey?.apiKey && primaryKey?.apiSecret && primaryKey.isActive) {
          return { apiKey: primaryKey.apiKey, apiSecret: primaryKey.apiSecret };
        }

        // Try fallback keys
        for (const keyType of ['fallback1', 'fallback2']) {
          const key = keys.find((k: any) => k.type === keyType);
          if (key?.apiKey && key?.apiSecret && key.isActive) {
            return { apiKey: key.apiKey, apiSecret: key.apiSecret };
          }
        }

        return null;
      } catch (error) {
        console.error('[ApiService] Error reading API keys:', error);
        return null;
      }
    };

    const credentials = getApiKeys();
    const headers: Record<string, string> = {};

    if (credentials) {
      headers['x-kraken-api-key'] = credentials.apiKey;
      headers['x-kraken-api-secret'] = credentials.apiSecret;
    }

    return this.post('/portfolio/sync-trades', { userId }, { headers });
  }

  async getCostBasis(asset: string, userId?: string) {
    const params = userId ? { userId } : {};
    return this.get(`/portfolio/cost-basis/${asset}`, { params });
  }

  // Authentication methods
  async login(username: string, password: string) {
    const response = await this.mainApi.post('/auth/login', { username, password });
    return response.data;
  }

  async verifyTOTP(userId: string, token: string) {
    const response = await this.mainApi.post('/auth/verify-totp', { userId, token });
    return response.data;
  }

  async setupTOTP(userId: string) {
    const response = await this.mainApi.post('/auth/setup-totp', { userId });
    return response.data;
  }

  async confirmTOTPSetup(userId: string, secret: string, token: string) {
    const response = await this.mainApi.post('/auth/confirm-totp-setup', { userId, secret, token });
    return response.data;
  }

  async verifyAuthToken() {
    const response = await this.mainApi.get('/auth/verify');
    return response.data;
  }

  async createUser(username: string, password: string) {
    const response = await this.mainApi.post('/auth/create-user', { username, password });
    return response.data;
  }
}

export const apiService = new ApiService();
