import { create } from 'zustand';
import { socketClient } from '@/services/socketClient';
import { apiService } from '@/services/apiService';
import { livePriceService } from '@/services/livePriceService';
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

  // Risk
  riskStatus: RiskStatus | null;

  // Audit
  transactions: Transaction[];
  auditSummary: AuditSummary | null;
  dcaDeployments: DCADeployment[];

  // Actions
  login: (username: string, password: string) => Promise<void>;
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
  riskStatus: null,
  transactions: [],
  auditSummary: null,
  dcaDeployments: [],

  // Auth actions
  login: async (username: string, password: string) => {
    // Development-only auth
    if (username === 'admin' && password === 'admin') {
      const user: User = {
        id: '1',
        username: 'admin',
        email: 'admin@dalykraken.com',
      };
      set({ user, isAuthenticated: true });

      // Initialize after login
      await get().initialize();
    } else {
      throw new Error('Invalid credentials');
    }
  },

  logout: () => {
    get().disconnectWebSocket();
    livePriceService.disconnectKraken();
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

      // Load initial data
      await Promise.all([
        get().fetchAccountInfo().catch(console.error),
        get().fetchPortfolio().catch(console.error),
        get().fetchDCAStatus().catch(console.error),
        get().fetchRiskStatus().catch(console.error),
      ]);

      // Subscribe to live price updates
      livePriceService.subscribe((prices) => {
        set({ livePrices: prices });
      });

      set({ initialized: true });
    } catch (error) {
      console.error('[Store] Initialization failed:', error);
      set({ initialized: true }); // Mark as initialized even on error
    }
  },

  // WebSocket actions
  connectWebSocket: async () => {
    await socketClient.connect();

    // Set up event listeners
    socketClient.on('system:connected', () => {
      set((state) => ({
        systemStatus: { ...state.systemStatus, wsConnected: true },
      }));
    });

    socketClient.on('system:disconnected', () => {
      set((state) => ({
        systemStatus: { ...state.systemStatus, wsConnected: false },
      }));
    });

    socketClient.on('market_update', (data) => {
      // Update market data
      set({ marketData: data.markets || [] });
    });

    socketClient.on('portfolio_update', (data) => {
      if (data.portfolio) {
        set({ portfolio: data.portfolio });
        // Cache to localStorage
        localStorage.setItem(CACHE_KEYS.PORTFOLIO, JSON.stringify(data.portfolio));
      }
    });

    socketClient.on('trade_update', (data) => {
      get().addNotification({
        type: 'info',
        title: 'Trade Update',
        message: data.message || 'Trade executed',
      });
    });

    socketClient.on('system_alert', (data) => {
      get().addNotification({
        type: data.severity || 'warning',
        title: 'System Alert',
        message: data.message,
      });
    });
  },

  disconnectWebSocket: () => {
    socketClient.disconnect();
  },

  subscribePortfolioStream: () => {
    socketClient.joinRoom('portfolio');
  },

  subscribeMarketStream: () => {
    socketClient.joinRoom('market');
  },

  subscribeTrendStream: () => {
    socketClient.joinRoom('trends');
  },

  // Account actions
  fetchAccountInfo: async () => {
    try {
      const data = await apiService.getAccountInfo();
      set({ accountInfo: data });
      localStorage.setItem(CACHE_KEYS.ACCOUNT, JSON.stringify(data));
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
      const data = await apiService.getPortfolio();
      set({ portfolio: data });
      localStorage.setItem(CACHE_KEYS.PORTFOLIO, JSON.stringify(data));
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
      const data = await apiService.getMarketOverview();
      set({ marketData: data.markets || [] });
      localStorage.setItem(CACHE_KEYS.MARKET, JSON.stringify(data));
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
      set({ riskStatus: data });
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
}));
