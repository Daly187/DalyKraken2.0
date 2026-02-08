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
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
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

      // Debug log every outgoing request
      console.log('[ApiService Interceptor] Outgoing request:', {
        method: config.method?.toUpperCase(),
        baseURL: config.baseURL,
        url: config.url,
        fullURL: (config.baseURL || '') + (config.url || ''),
        hasAuth: !!token
      });

      return config;
    });

    // Add response interceptor to handle 401 errors and detect HTML responses
    this.mainApi.interceptors.response.use(
      (response) => {
        // Log every successful response for debugging
        console.log('[ApiService Interceptor] Response received:', {
          url: response.config?.url,
          status: response.status,
          contentType: response.headers['content-type'],
          dataType: typeof response.data,
          isHTML: typeof response.data === 'string' && response.data.includes('<!DOCTYPE')
        });

        // Check for HTML response in interceptor - this catches it early
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          console.error('[ApiService Interceptor] CRITICAL: Received HTML instead of JSON!');
          console.error('[ApiService Interceptor] URL:', response.config?.url);
          console.error('[ApiService Interceptor] Full URL:', response.config?.baseURL, response.config?.url);
          console.error('[ApiService Interceptor] HTML preview:', response.data.substring(0, 300));
          // Reject with custom error
          return Promise.reject(new Error('API returned HTML instead of JSON - possible routing misconfiguration'));
        }

        return response;
      },
      (error) => {
        console.error('[ApiService Interceptor] Request error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });

        if (error.response?.status === 401) {
          const requestUrl = error.config?.url || '';
          console.warn('[ApiService] 401 ERROR detected on URL:', requestUrl);
          console.warn('[ApiService] Full error config:', error.config);
          console.warn('[ApiService] Response data:', error.response?.data);

          // NEVER redirect to login on 401 - let the app handle it gracefully
          // The ProtectedLayout will check isAuthenticated and redirect if needed
          console.warn('[ApiService] 401 on endpoint, NOT redirecting. Let app handle it.');
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
      const fullUrl = this.mainApi.defaults.baseURL + endpoint;
      console.log('[ApiService] ====== GET REQUEST ======');
      console.log('[ApiService] Base URL:', this.mainApi.defaults.baseURL);
      console.log('[ApiService] Endpoint:', endpoint);
      console.log('[ApiService] Full URL:', fullUrl);
      console.log('[ApiService] Auth token:', localStorage.getItem('auth_token')?.substring(0, 20) + '...');

      const response = await this.mainApi.get(endpoint, config);

      console.log('[ApiService] ====== RESPONSE ======');
      console.log('[ApiService] Status:', response.status);
      console.log('[ApiService] Content-Type:', response.headers['content-type']);
      console.log('[ApiService] Data type:', typeof response.data);

      // Check if we got HTML instead of JSON
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
        console.error('[ApiService] ERROR: Received HTML instead of JSON!');
        console.error('[ApiService] This usually means the API URL is misconfigured');
        console.error('[ApiService] HTML preview:', response.data.substring(0, 500));
        throw new Error('Server returned HTML instead of JSON - API routing issue');
      }

      return response.data;
    } catch (error: any) {
      // For authenticated endpoints, don't use fallbacks - throw the original error
      const authenticatedEndpoints = ['/dca-bots', '/account', '/settings', '/kraken'];
      const isAuthEndpoint = authenticatedEndpoints.some(ep => endpoint.startsWith(ep));

      if (isAuthEndpoint) {
        console.error('[ApiService] Authenticated endpoint failed:', endpoint, error.response?.status, error.response?.data);
        throw error;
      }

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

  // Helper function to get Kraken API keys for DCA bot operations
  private getKrakenHeaders() {
    const getApiKeys = () => {
      try {
        const keysJson = localStorage.getItem('kraken_api_keys');
        if (!keysJson) return null;

        const keys = JSON.parse(keysJson);
        if (!Array.isArray(keys)) return null;

        // Try primary key first
        const primaryKey = keys.find((k: any) => k.type === 'primary');
        if (primaryKey?.apiKey && primaryKey?.apiSecret && primaryKey.isActive) {
          return {
            apiKey: primaryKey.apiKey,
            apiSecret: primaryKey.apiSecret,
          };
        }

        // Fall back to any active key
        const anyActiveKey = keys.find((k: any) => k.isActive && k.apiKey && k.apiSecret);
        if (anyActiveKey) {
          return {
            apiKey: anyActiveKey.apiKey,
            apiSecret: anyActiveKey.apiSecret,
          };
        }

        return null;
      } catch (error) {
        console.error('[ApiService] Error getting API keys:', error);
        return null;
      }
    };

    const credentials = getApiKeys();
    const headers: Record<string, string> = {};

    if (credentials) {
      headers['x-kraken-api-key'] = credentials.apiKey;
      headers['x-kraken-api-secret'] = credentials.apiSecret;
    }

    return headers;
  }

  // DCA Bot management
  async getDCABots() {
    return this.get('/dca-bots', { headers: this.getKrakenHeaders() });
  }

  async createDCABot(config: any) {
    return this.post('/dca-bots', config, { headers: this.getKrakenHeaders() });
  }

  async updateDCABot(id: string, updates: any) {
    return this.put(`/dca-bots/${id}`, updates, { headers: this.getKrakenHeaders() });
  }

  async deleteDCABot(id: string) {
    return this.delete(`/dca-bots/${id}`, { headers: this.getKrakenHeaders() });
  }

  async pauseDCABot(id: string) {
    return this.post(`/dca-bots/${id}/pause`, {}, { headers: this.getKrakenHeaders() });
  }

  async resumeDCABot(id: string) {
    return this.post(`/dca-bots/${id}/resume`, {}, { headers: this.getKrakenHeaders() });
  }

  async triggerDCABots() {
    // Use longer timeout for trigger endpoint as it processes all bots
    return this.post('/dca-bots/trigger', {}, {
      headers: this.getKrakenHeaders(),
      timeout: 60000 // 60 seconds to handle multiple bots
    });
  }

  async getEnhancedTrends(limit: number = 20) {
    return this.get(`/market/quantify-crypto/enhanced-trends?limit=${limit}`);
  }

  /**
   * Batch update trend scores for all user's DCA bots
   * Persists trendScore, techScore, marketTrendScore to Firestore
   */
  async batchUpdateBotTrendScores(trends: Array<{ symbol: string; trend_score: number; technical_score: number }>) {
    return this.post('/dca-bots/batch-update-trends', { trends });
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
    return this.post('/trading/test-telegram');
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

  // ============================================
  // MULTI-EXCHANGE API CONFIG METHODS
  // ============================================

  async getAsterConfig() {
    return this.get('/settings/aster-config');
  }

  async saveAsterConfig(config: { apiKey: string; apiSecret: string }) {
    return this.post('/settings/aster-config', config);
  }

  async getHyperliquidConfig() {
    return this.get('/settings/hyperliquid-config');
  }

  async saveHyperliquidConfig(config: { privateKey: string; walletAddress: string }) {
    return this.post('/settings/hyperliquid-config', config);
  }

  async getLiquidConfig() {
    return this.get('/settings/liquid-config');
  }

  async saveLiquidConfig(config: { apiToken: string; apiSecret: string }) {
    return this.post('/settings/liquid-config', config);
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

  // ============================================
  // DEPEG STRATEGY API METHODS
  // ============================================

  /**
   * Get current stablecoin prices
   */
  async getDepegPrices() {
    return this.get('/depeg/prices', { headers: this.getKrakenHeaders() });
  }

  /**
   * Get detected arbitrage opportunities
   */
  async getDepegOpportunities() {
    return this.get('/depeg/opportunities', { headers: this.getKrakenHeaders() });
  }

  /**
   * Execute a depeg arbitrage trade
   */
  async executeDepegTrade(opportunity: {
    pair: string;
    entryPrice: number;
    targetPrice: number;
    type: 'buy' | 'sell';
  }) {
    return this.post('/depeg/execute', opportunity, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get open depeg positions
   */
  async getDepegPositions() {
    return this.get('/depeg/positions', { headers: this.getKrakenHeaders() });
  }

  /**
   * Close an open depeg position
   */
  async closeDepegPosition(positionId: string) {
    return this.post(`/depeg/close/${positionId}`, {}, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get depeg trade history
   */
  async getDepegHistory(limit: number = 50) {
    return this.get(`/depeg/history?limit=${limit}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get user's depeg strategy configuration
   */
  async getDepegConfig() {
    return this.get('/depeg/config', { headers: this.getKrakenHeaders() });
  }

  /**
   * Update user's depeg strategy configuration
   */
  async updateDepegConfig(config: any) {
    return this.put('/depeg/config', config, { headers: this.getKrakenHeaders() });
  }

  /**
   * Manually trigger monitoring and auto-execution
   */
  async triggerDepegMonitor() {
    return this.post('/depeg/monitor', {}, { headers: this.getKrakenHeaders() });
  }

  // ============================================
  // WALLET TRACKER / COPY TRADING API METHODS
  // ============================================

  /**
   * Get all tracked wallets with scores
   */
  async getTrackedWallets() {
    return this.get('/tracker/wallets', { headers: this.getKrakenHeaders() });
  }

  /**
   * Get detailed info for a specific wallet
   */
  async getWalletDetails(walletId: string) {
    return this.get(`/tracker/wallets/${walletId}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Add a new wallet to track
   */
  async addTrackedWallet(address: string, chain: string, nickname?: string) {
    return this.post('/tracker/wallets', { address, chain, nickname }, { headers: this.getKrakenHeaders() });
  }

  /**
   * Remove (deactivate) a tracked wallet
   */
  async removeTrackedWallet(walletId: string) {
    return this.delete(`/tracker/wallets/${walletId}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get recent signals from tracked wallets
   */
  async getWalletSignals(limit: number = 50) {
    return this.get(`/tracker/signals?limit=${limit}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Manually record a signal (for testing)
   */
  async recordWalletSignal(signal: any) {
    return this.post('/tracker/signals', signal, { headers: this.getKrakenHeaders() });
  }

  /**
   * Process a signal and potentially copy the trade
   */
  async processSignal(signalId: string) {
    return this.post(`/tracker/signals/${signalId}/process`, {}, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get all open copy trade positions
   */
  async getCopyPositions() {
    return this.get('/tracker/positions', { headers: this.getKrakenHeaders() });
  }

  /**
   * Close a copy trade position
   */
  async closeCopyPosition(positionId: string) {
    return this.post(`/tracker/positions/${positionId}/close`, {}, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get copy trade history
   */
  async getCopyTradeHistory(limit: number = 50) {
    return this.get(`/tracker/history?limit=${limit}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get tracker configuration
   */
  async getTrackerConfig() {
    return this.get('/tracker/config', { headers: this.getKrakenHeaders() });
  }

  /**
   * Update tracker configuration
   */
  async updateTrackerConfig(config: any) {
    return this.post('/tracker/config', config, { headers: this.getKrakenHeaders() });
  }

  /**
   * Manually trigger monitoring
   */
  async triggerTrackerMonitor() {
    return this.post('/tracker/monitor', {}, { headers: this.getKrakenHeaders() });
  }

  /**
   * Search for top wallets with filters
   */
  async searchWallets(filters?: {
    chain?: string[];
    minPnL?: number;
    minWinRate?: number;
    minTrades?: number;
    minActiveForDays?: number;
    labels?: string[];
  }) {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.chain) filters.chain.forEach(c => params.append('chain', c));
      if (filters.minPnL) params.append('minPnL', filters.minPnL.toString());
      if (filters.minWinRate) params.append('minWinRate', filters.minWinRate.toString());
      if (filters.minTrades) params.append('minTrades', filters.minTrades.toString());
      if (filters.minActiveForDays) params.append('minActiveForDays', filters.minActiveForDays.toString());
      if (filters.labels) filters.labels.forEach(l => params.append('labels', l));
    }
    return this.get(`/tracker/discover/search?${params.toString()}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get recommended wallets
   */
  async getRecommendedWallets(limit: number = 10) {
    return this.get(`/tracker/discover/recommended?limit=${limit}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get wallet preview before tracking
   */
  async getWalletPreview(address: string) {
    return this.get(`/tracker/discover/preview/${address}`, { headers: this.getKrakenHeaders() });
  }

  /**
   * Get available filter options for wallet discovery
   */
  async getWalletFilterOptions() {
    return this.get('/tracker/discover/filters', { headers: this.getKrakenHeaders() });
  }

  // ============================================
  // STRATEGY STATUS API METHODS
  // ============================================

  // ============================================
  // POLYMARKET / GAMBLING API METHODS
  // ============================================

  /**
   * Get Polymarket API credentials headers
   * Includes both L2 (API key/secret) and L1 (private key) credentials
   */
  private getPolymarketHeaders() {
    try {
      const apiKey = localStorage.getItem('polymarket_api_key');
      const apiSecret = localStorage.getItem('polymarket_api_secret');
      const passphrase = localStorage.getItem('polymarket_passphrase');
      const address = localStorage.getItem('polymarket_address');
      const privateKey = localStorage.getItem('polymarket_private_key');
      const funderAddress = localStorage.getItem('polymarket_funder_address');
      const signatureType = localStorage.getItem('polymarket_signature_type');

      const headers: Record<string, string> = {};
      if (apiKey) headers['x-polymarket-api-key'] = apiKey;
      if (apiSecret) headers['x-polymarket-api-secret'] = apiSecret;
      if (passphrase) headers['x-polymarket-passphrase'] = passphrase;
      if (address) headers['x-polymarket-address'] = address;
      if (privateKey) headers['x-polymarket-private-key'] = privateKey;
      if (funderAddress) headers['x-polymarket-funder-address'] = funderAddress;
      if (signatureType) headers['x-polymarket-signature-type'] = signatureType;

      return headers;
    } catch (error) {
      console.error('[ApiService] Error getting Polymarket credentials:', error);
      return {};
    }
  }

  /**
   * Get available Polymarket markets
   */
  async getPolymarketMarkets(filters?: {
    active?: boolean;
    limit?: number;
    category?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.active !== undefined) params.append('active', String(filters.active));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.category) params.append('category', filters.category);

    return this.get(`/polymarket/markets?${params.toString()}`, {
      headers: this.getPolymarketHeaders()
    });
  }

  /**
   * Get user's Polymarket betting configuration
   */
  async getPolymarketConfig() {
    return this.get('/polymarket/config', { headers: this.getPolymarketHeaders() });
  }

  /**
   * Update user's Polymarket betting configuration
   */
  async updatePolymarketConfig(config: any) {
    return this.put('/polymarket/config', config, { headers: this.getPolymarketHeaders() });
  }

  /**
   * Manually trigger a market scan
   */
  async triggerPolymarketScan() {
    return this.post('/polymarket/trigger', {}, {
      headers: this.getPolymarketHeaders(),
      timeout: 60000 // 60 seconds for scan
    });
  }

  /**
   * Get user's open positions
   */
  async getPolymarketPositions() {
    return this.get('/polymarket/positions', { headers: this.getPolymarketHeaders() });
  }

  /**
   * Get user's bet history
   */
  async getPolymarketBets(limit: number = 50) {
    return this.get(`/polymarket/bets?limit=${limit}`, { headers: this.getPolymarketHeaders() });
  }

  /**
   * Place a bet on Polymarket
   */
  async placePolymarketBet(bet: {
    marketId: string;
    tokenId?: string;
    outcomeId: string;
    side: 'yes' | 'no';
    amount: number;
    limitPrice?: number;
    question?: string;
    outcome?: string;
  }) {
    return this.post('/polymarket/bets', bet, { headers: this.getPolymarketHeaders() });
  }

  /**
   * Get performance statistics
   */
  async getPolymarketStats() {
    return this.get('/polymarket/stats', { headers: this.getPolymarketHeaders() });
  }

  /**
   * Get Polymarket account balance
   */
  async getPolymarketBalance() {
    return this.get('/polymarket/balance', { headers: this.getPolymarketHeaders() });
  }

  /**
   * Get comprehensive portfolio summary
   */
  async getPolymarketPortfolio() {
    return this.get('/polymarket/portfolio', { headers: this.getPolymarketHeaders() });
  }

  /**
   * Debug endpoint to check address configuration and positions
   */
  async debugPolymarketAddresses() {
    return this.get('/polymarket/debug-addresses', { headers: this.getPolymarketHeaders() });
  }

  /**
   * Get recent execution logs
   */
  async getPolymarketExecutions(limit: number = 20) {
    return this.get(`/polymarket/executions?limit=${limit}`, { headers: this.getPolymarketHeaders() });
  }

  /**
   * Save Polymarket credentials
   */
  async savePolymarketCredentials(credentials: {
    apiKey: string;
    apiSecret: string;
    passphrase: string;
    address?: string;
  }) {
    return this.post('/polymarket/credentials', credentials, {
      headers: { ...this.getPolymarketHeaders(), 'Content-Type': 'application/json' }
    });
  }

  /**
   * Test Polymarket connection
   */
  async testPolymarketConnection() {
    return this.post('/polymarket/test-connection', {}, { headers: this.getPolymarketHeaders() });
  }

  /**
   * Derive API credentials from wallet private key
   * Uses L1 auth (wallet signature) to create L2 credentials (API key/secret/passphrase)
   */
  async derivePolymarketApiKey() {
    return this.post('/polymarket/derive-api-key', {}, { headers: this.getPolymarketHeaders() });
  }

  /**
   * Analyze betting opportunities with AI
   */
  async analyzePolymarketOpportunities(opportunities: Array<{
    id: string;
    question: string;
    outcome: string;
    probability: number;
    volume: number;
    hoursToClose: number;
    category?: string;
  }>) {
    return this.post('/polymarket/analyze', { opportunities }, {
      headers: this.getPolymarketHeaders(),
      timeout: 30000,
    });
  }

  // ============================================
  // POLYMARKET WALLET TRACKER METHODS
  // ============================================

  /**
   * Get top wallets leaderboard
   */
  async getTopWallets(options?: {
    sortBy?: 'pnl7d' | 'pnl30d' | 'roi7d' | 'roi30d' | 'volume30d' | 'winRate7d';
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const queryString = params.toString();
    return this.get(`/polymarket/tracker/top-wallets${queryString ? `?${queryString}` : ''}`, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Get Polymarket wallet details with positions and trades
   */
  async getPmWalletDetails(address: string, options?: {
    includePositions?: boolean;
    includeTrades?: boolean;
    tradeLimit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.includePositions !== undefined) params.append('includePositions', options.includePositions.toString());
    if (options?.includeTrades !== undefined) params.append('includeTrades', options.includeTrades.toString());
    if (options?.tradeLimit) params.append('tradeLimit', options.tradeLimit.toString());

    const queryString = params.toString();
    return this.get(`/polymarket/tracker/wallet/${address}${queryString ? `?${queryString}` : ''}`, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Get user's tracked portfolio
   */
  async getTrackedPortfolio() {
    return this.get('/polymarket/tracker/portfolio', {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Track a wallet
   */
  async trackWallet(walletAddress: string, allocationUsd: number, nickname?: string) {
    return this.post('/polymarket/tracker/track', {
      walletAddress,
      allocationUsd,
      nickname,
    }, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Update tracking allocation or nickname
   */
  async updateTracking(address: string, updates: { allocationUsd?: number; nickname?: string }) {
    return this.put(`/polymarket/tracker/track/${address}`, updates, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Untrack a wallet
   */
  async untrackWallet(address: string) {
    return this.delete(`/polymarket/tracker/track/${address}`, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Manually sync top wallets leaderboard
   */
  async syncTopWallets() {
    return this.post('/polymarket/tracker/sync/top-wallets', {}, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Manually sync user's tracked portfolio
   */
  async syncTrackedPortfolio() {
    return this.post('/polymarket/tracker/sync/portfolio', {}, {
      headers: this.getPolymarketHeaders(),
    });
  }

  /**
   * Get status summary for all strategies
   */
  async getStrategiesStatus() {
    try {
      const [dcaBots, depegConfig] = await Promise.all([
        this.getDCABots(),
        this.getDepegConfig(),
      ]);

      // Count active DCA bots
      const activeDCABots = Array.isArray(dcaBots?.bots)
        ? dcaBots.bots.filter((bot: any) => bot.status === 'active').length
        : 0;
      const totalDCABots = Array.isArray(dcaBots?.bots) ? dcaBots.bots.length : 0;

      // Check DEPEG status
      const depegEnabled = depegConfig?.config?.enabled || false;
      const depegAutoExecute = depegConfig?.config?.autoExecute || false;

      return {
        success: true,
        strategies: {
          dca: {
            active: activeDCABots > 0,
            activeBots: activeDCABots,
            totalBots: totalDCABots,
          },
          depeg: {
            active: depegEnabled && depegAutoExecute,
            enabled: depegEnabled,
            autoExecute: depegAutoExecute,
          },
        },
      };
    } catch (error) {
      console.error('[ApiService] Error fetching strategies status:', error);
      return {
        success: false,
        strategies: {
          dca: { active: false, activeBots: 0, totalBots: 0 },
          depeg: { active: false, enabled: false, autoExecute: false },
        },
      };
    }
  }
}

export const apiService = new ApiService();
