import { create } from 'zustand';
// import { socketClient } from '@/services/socketClient'; // Disabled - not using backend WebSocket
import { apiService } from '@/services/apiService';
import { livePriceService } from '@/services/livePriceService';
import { globalPriceManager } from '@/services/globalPriceManager';
import type {
  User,
  AccountInfo,
  Portfolio,
  LivePrice,
  MarketData,
  DCAStatus,
  DCAConfig,
  SystemStatus,
  Notification,
  RiskStatus,
  ScanResult,
  BotScore,
  Transaction,
  AuditSummary,
  DCADeployment,
  DCABotConfig,
  LiveDCABot,
} from '@/types';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;

  // System
  initialized: boolean;
  systemStatus: SystemStatus;
  notifications: Notification[];

  // Account & Portfolio
  accountInfo: AccountInfo | null;
  portfolio: Portfolio | null;
  livePrices: Map<string, LivePrice>;

  // Market
  marketData: MarketData[];

  // DCA
  dcaStatus: DCAStatus | null;
  dcaConfig: DCAConfig | null;
  scanResults: ScanResult[];
  botScores: BotScore[];

  // DCA Bots
  dcaBots: LiveDCABot[];
  dcaBotsError: string | null;
  dcaBotsLoading: boolean;
  selectedBot: LiveDCABot | null;

  // Risk
  riskStatus: RiskStatus | null;

  // Audit
  transactions: Transaction[];
  auditSummary: AuditSummary | null;
  dcaDeployments: DCADeployment[];

  // Actions
  login: (username: string, password: string) => Promise<{ requiresTOTP: boolean; requiresTOTPSetup: boolean; userId: string; username: string }>;
  verifyTOTP: (userId: string, token: string) => Promise<{ success: boolean }>;
  setupTOTP: (userId: string) => Promise<{ success: boolean; secret: string; qrCode: string }>;
  confirmTOTPSetup: (userId: string, secret: string, token: string) => Promise<{ success: boolean }>;
  checkAuth: () => Promise<boolean>;
  logout: () => void;
  initialize: () => Promise<void>;

  // WebSocket actions
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
  subscribePortfolioStream: () => void;
  subscribeMarketStream: () => void;
  subscribeTrendStream: () => void;

  // Account actions
  fetchAccountInfo: () => Promise<void>;
  fetchPortfolio: () => Promise<void>;
  fetchLivePrices: () => Promise<void>;

  // Market actions
  fetchMarketOverview: () => Promise<void>;
  fetchTop20: () => Promise<void>;

  // DCA actions
  fetchDCAStatus: () => Promise<void>;
  fetchDCAConfig: () => Promise<void>;
  startDCA: () => Promise<void>;
  stopDCA: () => Promise<void>;
  scanMarkets: (timeGraph: string) => Promise<void>;
  executeDCA: (data: any) => Promise<void>;
  fetchBotScores: () => Promise<void>;
  refreshBotScores: () => Promise<void>;

  // DCA Bot actions
  fetchDCABots: () => Promise<void>;
  createDCABot: (config: Omit<DCABotConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
  updateDCABot: (id: string, updates: Partial<DCABotConfig>) => Promise<void>;
  deleteDCABot: (id: string) => Promise<void>;
  pauseDCABot: (id: string) => Promise<void>;
  resumeDCABot: (id: string) => Promise<void>;
  triggerDCABots: () => Promise<any>;
  selectBot: (bot: LiveDCABot | null) => void;

  // Cost Basis actions
  syncTradeHistory: () => Promise<void>;

  // Risk actions
  fetchRiskStatus: () => Promise<void>;

  // Audit actions
  fetchTransactions: (params?: any) => Promise<void>;
  fetchAuditSummary: () => Promise<void>;
  syncKraken: () => Promise<void>;
  fetchDCADeployments: () => Promise<void>;

  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // System actions
  updateSystemStatus: (status: Partial<SystemStatus>) => void;
}

const CACHE_KEYS = {
  PORTFOLIO: 'dalykraken_portfolio',
  ACCOUNT: 'dalykraken_account',
  MARKET: 'dalykraken_market',
};

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  initialized: false,
  systemStatus: {
    wsConnected: false,
    apiAvailable: false,
    cacheAvailable: false,
    snapshotAvailable: false,
    krakenConnected: false,
    lastHealthCheck: new Date().toISOString(),
  },
  notifications: [],
  accountInfo: null,
  portfolio: null,
  livePrices: new Map(),
  marketData: [],
  dcaStatus: null,
  dcaConfig: null,
  scanResults: [],
  botScores: [],
  dcaBots: [],
  dcaBotsError: null,
  dcaBotsLoading: false,
  selectedBot: null,
  riskStatus: null,
  transactions: [],
  auditSummary: null,
  dcaDeployments: [],

  // Auth actions
  login: async (username: string, password: string) => {
    try {
      const response = await apiService.login(username, password);

      if (response.success) {
        // Store user info for TOTP flow
        return {
          requiresTOTP: response.requiresTOTP || false,
          requiresTOTPSetup: response.requiresTOTPSetup || false,
          userId: response.userId,
          username: response.username,
        };
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('[Store] Login error:', error);
      throw error;
    }
  },

  verifyTOTP: async (userId: string, token: string) => {
    try {
      const response = await apiService.verifyTOTP(userId, token);

      if (response.success && response.token) {
        // Store JWT token
        localStorage.setItem('auth_token', response.token);

        // Set user info
        const user: User = {
          id: response.user.userId,
          username: response.user.username,
        };

        set({ user, isAuthenticated: true });

        // Initialize after successful login
        await get().initialize();

        return { success: true };
      } else {
        throw new Error(response.error || 'TOTP verification failed');
      }
    } catch (error: any) {
      console.error('[Store] TOTP verification error:', error);
      throw error;
    }
  },

  setupTOTP: async (userId: string) => {
    try {
      const response = await apiService.setupTOTP(userId);
      return response;
    } catch (error: any) {
      console.error('[Store] TOTP setup error:', error);
      throw error;
    }
  },

  confirmTOTPSetup: async (userId: string, secret: string, token: string) => {
    try {
      const response = await apiService.confirmTOTPSetup(userId, secret, token);

      if (response.success && response.token) {
        // Store JWT token
        localStorage.setItem('auth_token', response.token);

        // Set user info
        const user: User = {
          id: response.user.userId,
          username: response.user.username,
        };

        set({ user, isAuthenticated: true });

        // Initialize after successful setup
        await get().initialize();

        return { success: true };
      } else {
        throw new Error(response.error || 'TOTP confirmation failed');
      }
    } catch (error: any) {
      console.error('[Store] TOTP confirmation error:', error);
      throw error;
    }
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      console.log('[Store] checkAuth called, token exists:', !!token);

      if (!token) {
        console.log('[Store] No token found, returning false');
        return false;
      }

      const response = await apiService.verifyAuthToken();
      console.log('[Store] verifyAuthToken response:', response);

      if (response.success && response.user) {
        const user: User = {
          id: response.user.userId,
          username: response.user.username,
        };

        set({ user, isAuthenticated: true });
        console.log('[Store] Auth check successful, user set');
        return true;
      }

      console.log('[Store] Auth check returned success=false or no user');
      return false;
    } catch (error) {
      console.error('[Store] Auth check failed with error:', error);
      // Don't remove auth_token on network errors - the token might still be valid
      // Only clear on explicit logout or when server confirms token is invalid
      console.log('[Store] NOT removing auth_token on error - token may still be valid');
      return false;
    }
  },

  logout: () => {
    console.log('[Store] LOGOUT called! Stack trace:', new Error().stack);
    get().disconnectWebSocket();
    globalPriceManager.cleanup();
    console.log('[Store] Global price manager cleaned up');

    // Clear auth token
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');

    set({
      user: null,
      isAuthenticated: false,
      initialized: false,
      accountInfo: null,
      portfolio: null,
    });
  },

  initialize: async () => {
    try {
      // Try WebSocket connection first
      try {
        await get().connectWebSocket();
        set((state) => ({
          systemStatus: { ...state.systemStatus, wsConnected: true },
        }));
      } catch (error) {
        console.warn('[Store] WebSocket connection failed, using REST fallback');
        set((state) => ({
          systemStatus: { ...state.systemStatus, wsConnected: false },
        }));
      }

      // Initialize global price manager (starts background price updates)
      globalPriceManager.initialize();
      console.log('[Store] Global price manager initialized');

      // Subscribe to global price updates
      globalPriceManager.subscribeToPrices((prices: Map<string, LivePrice>) => {
        set({ livePrices: prices });
      });

      // Load initial data
      await Promise.all([
        get().fetchAccountInfo().catch(console.error),
        get().fetchPortfolio().catch(console.error),
        get().fetchDCAStatus().catch(console.error),
        get().fetchRiskStatus().catch(console.error),
      ]);

      // Auto-sync trade history on first login (if never synced)
      const hasEverSynced = localStorage.getItem('dalykraken_trades_synced');
      const lastSync = localStorage.getItem('dalykraken_last_sync');

      if (!hasEverSynced) {
        console.log('[Store] First login detected, auto-syncing trade history...');
        // Don't await - let it run in background
        get().syncTradeHistory().catch((error) => {
          console.warn('[Store] Auto-sync failed (can sync manually later):', error);
        });
      } else if (lastSync) {
        // Check if last sync was more than 7 days ago
        const lastSyncDate = new Date(lastSync);
        const daysSinceLastSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastSync > 7) {
          console.log(`[Store] Last sync was ${Math.floor(daysSinceLastSync)} days ago, auto-syncing...`);
          // Don't await - let it run in background
          get().syncTradeHistory().catch((error) => {
            console.warn('[Store] Auto-sync failed (can sync manually later):', error);
          });
        } else {
          console.log(`[Store] Trade history last synced ${Math.floor(daysSinceLastSync)} days ago`);
        }
      }

      set({ initialized: true });
    } catch (error) {
      console.error('[Store] Initialization failed:', error);
      set({ initialized: true }); // Mark as initialized even on error
    }
  },

  // WebSocket actions (DISABLED - using direct Kraken WebSocket instead)
  connectWebSocket: async () => {
    // Disabled - backend WebSocket not needed
    // We connect directly to Kraken's WebSocket via livePriceService
    console.log('[useStore] Backend WebSocket disabled - using direct Kraken connection');
  },

  disconnectWebSocket: () => {
    // Disabled
  },

  subscribePortfolioStream: () => {
    // Disabled
  },

  subscribeMarketStream: () => {
    // Disabled
  },

  subscribeTrendStream: () => {
    // Disabled
  },

  // Account actions
  fetchAccountInfo: async () => {
    try {
      const response = await apiService.getAccountInfo();
      // Backend returns { success, data: accountData }
      const accountData = response.data || response;
      set({ accountInfo: accountData });
      localStorage.setItem(CACHE_KEYS.ACCOUNT, JSON.stringify(accountData));
    } catch (error) {
      // Try to load from cache
      const cached = localStorage.getItem(CACHE_KEYS.ACCOUNT);
      if (cached) {
        set({ accountInfo: JSON.parse(cached) });
      }
      throw error;
    }
  },

  fetchPortfolio: async () => {
    try {
      const response = await apiService.getPortfolio();
      // Backend returns { success, data: portfolioData }
      const portfolioData = response.data || response;
      set({ portfolio: portfolioData });
      localStorage.setItem(CACHE_KEYS.PORTFOLIO, JSON.stringify(portfolioData));
    } catch (error) {
      // Try to load from cache
      const cached = localStorage.getItem(CACHE_KEYS.PORTFOLIO);
      if (cached) {
        set({ portfolio: JSON.parse(cached) });
      }
      throw error;
    }
  },

  fetchLivePrices: async () => {
    try {
      const data = await apiService.getLivePrices();
      const pricesMap = new Map<string, LivePrice>();

      if (Array.isArray(data)) {
        data.forEach((price: LivePrice) => {
          pricesMap.set(price.symbol, price);
        });
      }

      set({ livePrices: pricesMap });
    } catch (error) {
      console.error('[Store] Failed to fetch live prices:', error);
    }
  },

  // Market actions
  fetchMarketOverview: async () => {
    try {
      const response = await apiService.getMarketOverview();
      // Backend returns { success, data: { markets: [] } }
      const marketData = response.data || response;
      set({ marketData: marketData.markets || [] });
      localStorage.setItem(CACHE_KEYS.MARKET, JSON.stringify(marketData));
    } catch (error) {
      const cached = localStorage.getItem(CACHE_KEYS.MARKET);
      if (cached) {
        const data = JSON.parse(cached);
        set({ marketData: data.markets || [] });
      }
      throw error;
    }
  },

  fetchTop20: async () => {
    try {
      const data = await apiService.getTop20();
      set({ marketData: data.markets || [] });
    } catch (error) {
      console.error('[Store] Failed to fetch top 20:', error);
    }
  },

  // DCA actions
  fetchDCAStatus: async () => {
    try {
      const data = await apiService.getDCAStatus();
      set({ dcaStatus: data });
    } catch (error) {
      console.error('[Store] Failed to fetch DCA status:', error);
    }
  },

  fetchDCAConfig: async () => {
    try {
      const data = await apiService.getDCAConfig();
      set({ dcaConfig: data });
    } catch (error) {
      console.error('[Store] Failed to fetch DCA config:', error);
    }
  },

  startDCA: async () => {
    try {
      await apiService.startDCA();
      await get().fetchDCAStatus();
      get().addNotification({
        type: 'success',
        title: 'DCA Started',
        message: 'DalyDCA strategy has been started',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'DCA Start Failed',
        message: error.message || 'Failed to start DCA',
      });
      throw error;
    }
  },

  stopDCA: async () => {
    try {
      await apiService.stopDCA();
      await get().fetchDCAStatus();
      get().addNotification({
        type: 'info',
        title: 'DCA Stopped',
        message: 'DalyDCA strategy has been stopped',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'DCA Stop Failed',
        message: error.message || 'Failed to stop DCA',
      });
      throw error;
    }
  },

  scanMarkets: async (timeGraph: string) => {
    try {
      const data = await apiService.scanMarkets(timeGraph);
      set({ scanResults: data.results || [] });
      get().addNotification({
        type: 'success',
        title: 'Scan Complete',
        message: `Found ${data.results?.length || 0} opportunities`,
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Scan Failed',
        message: error.message || 'Failed to scan markets',
      });
      throw error;
    }
  },

  executeDCA: async (data: any) => {
    try {
      await apiService.executeDCA(data);
      get().addNotification({
        type: 'success',
        title: 'DCA Executed',
        message: 'DCA order has been placed',
      });
      await get().fetchPortfolio();
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'DCA Execution Failed',
        message: error.message || 'Failed to execute DCA',
      });
      throw error;
    }
  },

  fetchBotScores: async () => {
    try {
      const data = await apiService.getBotScoresSnapshot();
      set({ botScores: data.scores || [] });
    } catch (error) {
      console.error('[Store] Failed to fetch bot scores:', error);
    }
  },

  refreshBotScores: async () => {
    try {
      const data = await apiService.refreshBotScores();
      set({ botScores: data.scores || [] });
      get().addNotification({
        type: 'success',
        title: 'Scores Refreshed',
        message: 'Bot scores have been updated',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Refresh Failed',
        message: error.message || 'Failed to refresh scores',
      });
      throw error;
    }
  },

  // Risk actions
  fetchRiskStatus: async () => {
    try {
      const data = await apiService.getRiskStatus();
      set({ riskStatus: data as any });
    } catch (error) {
      console.error('[Store] Failed to fetch risk status:', error);
    }
  },

  // Audit actions
  fetchTransactions: async (params?: any) => {
    try {
      const data = await apiService.getTransactions(params);
      set({ transactions: data.transactions || [] });
    } catch (error) {
      console.error('[Store] Failed to fetch transactions:', error);
    }
  },

  fetchAuditSummary: async () => {
    try {
      const data = await apiService.getAuditSummary();
      set({ auditSummary: data });
    } catch (error) {
      console.error('[Store] Failed to fetch audit summary:', error);
    }
  },

  syncKraken: async () => {
    try {
      await apiService.syncKraken();
      get().addNotification({
        type: 'success',
        title: 'Sync Complete',
        message: 'Kraken data has been synchronized',
      });
      await get().fetchTransactions();
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Sync Failed',
        message: error.message || 'Failed to sync with Kraken',
      });
      throw error;
    }
  },

  fetchDCADeployments: async () => {
    try {
      const data = await apiService.getDCADeployments();
      set({ dcaDeployments: data.deployments || [] });
    } catch (error) {
      console.error('[Store] Failed to fetch DCA deployments:', error);
    }
  },

  // Notification actions
  addNotification: (notification) => {
    const newNotification: Notification = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...notification,
      timestamp: new Date().toISOString(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
    }));
  },

  markNotificationRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  // System actions
  updateSystemStatus: (status) => {
    set((state) => ({
      systemStatus: {
        ...state.systemStatus,
        ...status,
        lastHealthCheck: new Date().toISOString(),
      },
    }));
  },

  // DCA Bot actions
  fetchDCABots: async () => {
    set({ dcaBotsLoading: true, dcaBotsError: null });
    try {
      console.log('[Store] Fetching DCA bots...');
      const data = await apiService.getDCABots();
      console.log('[Store] DCA bots API full response:', JSON.stringify(data, null, 2));

      // Handle case where fallback returned non-DCA data
      if (data.success === undefined) {
        console.warn('[Store] Response missing success field, may be from fallback API');
        throw new Error('Invalid API response format - please check your connection');
      }

      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response');
      }

      set({ dcaBots: data.bots || [], dcaBotsError: null, dcaBotsLoading: false });
      console.log('[Store] Successfully loaded', data.bots?.length || 0, 'DCA bots');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load DCA bots';
      console.error('[Store] Failed to fetch DCA bots:', errorMessage);
      console.error('[Store] Full error:', error);
      set({ dcaBotsError: errorMessage, dcaBotsLoading: false });
    }
  },

  createDCABot: async (config) => {
    try {
      const data = await apiService.createDCABot(config);
      await get().fetchDCABots();
      get().addNotification({
        type: 'success',
        title: 'Bot Created',
        message: `DCA bot for ${config.symbol} has been created`,
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Bot Creation Failed',
        message: error.message || 'Failed to create DCA bot',
      });
      throw error;
    }
  },

  updateDCABot: async (id, updates) => {
    try {
      await apiService.updateDCABot(id, updates);
      await get().fetchDCABots();
      get().addNotification({
        type: 'success',
        title: 'Bot Updated',
        message: 'DCA bot has been updated',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Bot Update Failed',
        message: error.message || 'Failed to update DCA bot',
      });
      throw error;
    }
  },

  deleteDCABot: async (id) => {
    try {
      await apiService.deleteDCABot(id);
      await get().fetchDCABots();
      get().addNotification({
        type: 'success',
        title: 'Bot Deleted',
        message: 'DCA bot has been deleted',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Bot Deletion Failed',
        message: error.message || 'Failed to delete DCA bot',
      });
      throw error;
    }
  },

  pauseDCABot: async (id) => {
    try {
      await apiService.pauseDCABot(id);
      await get().fetchDCABots();
      get().addNotification({
        type: 'info',
        title: 'Bot Paused',
        message: 'DCA bot has been paused',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Bot Pause Failed',
        message: error.message || 'Failed to pause DCA bot',
      });
      throw error;
    }
  },

  resumeDCABot: async (id) => {
    try {
      await apiService.resumeDCABot(id);
      await get().fetchDCABots();
      get().addNotification({
        type: 'success',
        title: 'Bot Resumed',
        message: 'DCA bot has been resumed',
      });
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Bot Resume Failed',
        message: error.message || 'Failed to resume DCA bot',
      });
      throw error;
    }
  },

  triggerDCABots: async () => {
    try {
      const response = await apiService.triggerDCABots();
      await get().fetchDCABots();

      const summary = response.summary || {};
      const message = `Processed ${summary.processed || 0} bots: ${summary.entries || 0} entries, ${summary.exits || 0} exits`;

      get().addNotification({
        type: 'success',
        title: 'Bots Triggered',
        message,
      });

      return response;
    } catch (error: any) {
      get().addNotification({
        type: 'error',
        title: 'Trigger Failed',
        message: error.message || 'Failed to trigger bot processing',
      });
      throw error;
    }
  },

    selectBot: (bot) => {
    set({ selectedBot: bot });
  },

  // Cost Basis actions
  syncTradeHistory: async () => {
    try {
      console.log('[Store] Syncing trade history...');
      await apiService.syncTradeHistory();

      // Mark as synced
      localStorage.setItem('dalykraken_trades_synced', 'true');
      localStorage.setItem('dalykraken_last_sync', new Date().toISOString());

      get().addNotification({
        type: 'success',
        title: 'Trade History Synced',
        message: 'Your Kraken trade history has been synced successfully',
      });

      // Refresh portfolio to get updated P&L
      await get().fetchPortfolio();
    } catch (error: any) {
      console.error('[Store] Trade sync failed:', error);
      get().addNotification({
        type: 'error',
        title: 'Sync Failed',
        message: error.message || 'Failed to sync trade history',
      });
      throw error;
    }
  },
}));
