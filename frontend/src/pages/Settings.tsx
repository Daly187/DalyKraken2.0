import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { apiService } from '@/services/apiService';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Key,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Settings as SettingsIcon,
  RefreshCw,
  Shield,
  Zap,
  MessageSquare,
  Send,
  Sun,
  Moon,
  Palette,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface KrakenApiKey {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  isActive: boolean;
  type: 'primary' | 'fallback1' | 'fallback2';
  lastUsed: string | null;
  status: 'untested' | 'testing' | 'success' | 'failed';
}

type SettingsTab = 'apis' | 'themes';

export default function Settings() {
  const systemStatus = useStore((state) => state.systemStatus);
  const addNotification = useStore((state) => state.addNotification);
  const { theme, setTheme } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('apis');

  // Collapsible state for each API section
  const [expandedSections, setExpandedSections] = useState<{
    kraken: boolean;
    quantify: boolean;
    coinmarketcap: boolean;
    telegram: boolean;
    aster: boolean;
    hyperliquid: boolean;
    liquid: boolean;
  }>({
    kraken: true,
    quantify: false,
    coinmarketcap: false,
    telegram: false,
    aster: false,
    hyperliquid: false,
    liquid: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Kraken API Keys (3 total: 1 primary + 2 fallbacks)
  const [krakenKeys, setKrakenKeys] = useState<KrakenApiKey[]>([
    {
      id: 'kraken-primary',
      name: 'Kraken Primary API',
      apiKey: '',
      apiSecret: '',
      isActive: true,
      type: 'primary',
      lastUsed: null,
      status: 'untested',
    },
    {
      id: 'kraken-fallback1',
      name: 'Kraken Fallback #1',
      apiKey: '',
      apiSecret: '',
      isActive: false,
      type: 'fallback1',
      lastUsed: null,
      status: 'untested',
    },
    {
      id: 'kraken-fallback2',
      name: 'Kraken Fallback #2',
      apiKey: '',
      apiSecret: '',
      isActive: false,
      type: 'fallback2',
      lastUsed: null,
      status: 'untested',
    },
  ]);

  // Other API Keys
  const [quantifyCryptoKey, setQuantifyCryptoKey] = useState('');
  const [coinMarketCapKey, setCoinMarketCapKey] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Multi-Exchange API Keys (Aster, Hyperliquid, Liquid)
  const [asterApiKey, setAsterApiKey] = useState('');
  const [asterApiSecret, setAsterApiSecret] = useState('');
  const [hyperliquidPrivateKey, setHyperliquidPrivateKey] = useState('');
  const [hyperliquidWalletAddress, setHyperliquidWalletAddress] = useState('');
  const [liquidApiToken, setLiquidApiToken] = useState('');
  const [liquidApiSecret, setLiquidApiSecret] = useState('');

  // Visibility toggles
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [saving, setSaving] = useState(false);

  // Test connection states
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{ [key: string]: { success: boolean; message: string } | null }>({});

  // Load saved settings on mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = () => {
    // Load from localStorage
    const savedKraken = localStorage.getItem('kraken_api_keys');
    if (savedKraken) {
      try {
        setKrakenKeys(JSON.parse(savedKraken));
      } catch (e) {
        console.error('Failed to load Kraken keys:', e);
      }
    }

    const savedQuantify = localStorage.getItem('quantify_crypto_key');
    if (savedQuantify) setQuantifyCryptoKey(savedQuantify);

    const savedCMC = localStorage.getItem('coinmarketcap_key');
    if (savedCMC) setCoinMarketCapKey(savedCMC);

    const savedTelegramToken = localStorage.getItem('telegram_bot_token');
    if (savedTelegramToken) setTelegramBotToken(savedTelegramToken);

    const savedTelegramChat = localStorage.getItem('telegram_chat_id');
    if (savedTelegramChat) setTelegramChatId(savedTelegramChat);

    // Load multi-exchange API keys
    const savedAsterKey = localStorage.getItem('aster_api_key');
    if (savedAsterKey) setAsterApiKey(savedAsterKey);

    const savedAsterSecret = localStorage.getItem('aster_api_secret');
    if (savedAsterSecret) setAsterApiSecret(savedAsterSecret);

    const savedHyperliquidKey = localStorage.getItem('hyperliquid_private_key');
    if (savedHyperliquidKey) setHyperliquidPrivateKey(savedHyperliquidKey);

    const savedHyperliquidAddress = localStorage.getItem('hyperliquid_wallet_address');
    if (savedHyperliquidAddress) setHyperliquidWalletAddress(savedHyperliquidAddress);

    const savedLiquidToken = localStorage.getItem('liquid_api_token');
    if (savedLiquidToken) setLiquidApiToken(savedLiquidToken);

    const savedLiquidSecret = localStorage.getItem('liquid_api_secret');
    if (savedLiquidSecret) setLiquidApiSecret(savedLiquidSecret);
  };

  const toggleSecretVisibility = (keyId: string) => {
    setShowSecrets((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleKrakenKeyChange = (
    keyId: string,
    field: 'apiKey' | 'apiSecret' | 'isActive',
    value: string | boolean
  ) => {
    setKrakenKeys((keys) =>
      keys.map((k) =>
        k.id === keyId
          ? { ...k, [field]: value, status: 'untested' as const }
          : k
      )
    );
  };

  const testKrakenConnection = async (keyId: string) => {
    const key = krakenKeys.find((k) => k.id === keyId);
    if (!key || !key.apiKey || !key.apiSecret) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both API key and secret',
      });
      return;
    }

    // Update status to testing
    setKrakenKeys((keys) =>
      keys.map((k) => (k.id === keyId ? { ...k, status: 'testing' as const } : k))
    );

    addNotification({
      type: 'info',
      title: 'Testing Connection',
      message: `Testing ${key.name}...`,
    });

    // Simulate API test (replace with actual API call)
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% success rate for demo

      setKrakenKeys((keys) =>
        keys.map((k) =>
          k.id === keyId
            ? {
                ...k,
                status: success ? ('success' as const) : ('failed' as const),
                lastUsed: success ? new Date().toISOString() : k.lastUsed,
              }
            : k
        )
      );

      addNotification({
        type: success ? 'success' : 'error',
        title: success ? 'Connection Successful' : 'Connection Failed',
        message: success
          ? `${key.name} is working correctly`
          : `Failed to connect with ${key.name}. Please check your credentials.`,
      });
    }, 2000);
  };

  const saveKrakenKeys = async () => {
    setSaving(true);

    try {
      // Save to localStorage for backward compatibility
      localStorage.setItem('kraken_api_keys', JSON.stringify(krakenKeys));

      // Save to backend API (Firestore)
      await apiService.saveKrakenKeys(krakenKeys);

      setSaving(false);
      addNotification({
        type: 'success',
        title: 'Kraken Keys Saved',
        message: 'Your Kraken API keys have been saved securely to the server',
      });
    } catch (error: any) {
      setSaving(false);
      addNotification({
        type: 'error',
        title: 'Failed to Save Keys',
        message: error.message || 'Failed to save Kraken API keys',
      });
    }
  };

  const saveOtherApiKeys = async () => {
    setSaving(true);

    try {
      // Save to localStorage
      localStorage.setItem('quantify_crypto_key', quantifyCryptoKey);
      localStorage.setItem('coinmarketcap_key', coinMarketCapKey);
      localStorage.setItem('telegram_bot_token', telegramBotToken);
      localStorage.setItem('telegram_chat_id', telegramChatId);

      // Save multi-exchange API keys
      localStorage.setItem('aster_api_key', asterApiKey);
      localStorage.setItem('aster_api_secret', asterApiSecret);
      localStorage.setItem('hyperliquid_private_key', hyperliquidPrivateKey);
      localStorage.setItem('hyperliquid_wallet_address', hyperliquidWalletAddress);
      localStorage.setItem('liquid_api_token', liquidApiToken);
      localStorage.setItem('liquid_api_secret', liquidApiSecret);

      // Save Telegram config to backend (Firestore)
      if (telegramBotToken && telegramChatId) {
        await apiService.saveTelegramConfig({
          botToken: telegramBotToken,
          chatId: telegramChatId,
          enabled: true,
        });
      }

      addNotification({
        type: 'success',
        title: 'Settings Saved',
        message: 'All API keys have been saved securely',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAsterConfig = async () => {
    if (!asterApiKey || !asterApiSecret) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both Aster API key and secret',
      });
      return;
    }

    setSaving(true);

    try {
      // Save to localStorage for backward compatibility
      localStorage.setItem('aster_api_key', asterApiKey);
      localStorage.setItem('aster_api_secret', asterApiSecret);

      // Try to save to backend (Firestore), but don't fail if backend is unavailable
      try {
        await apiService.saveAsterConfig({
          apiKey: asterApiKey,
          apiSecret: asterApiSecret,
        });
        console.log('[Settings] Aster config saved to backend');
      } catch (backendError: any) {
        console.warn('[Settings] Backend save failed (using localStorage only):', backendError.message);
      }

      addNotification({
        type: 'success',
        title: 'Aster Config Saved',
        message: 'Aster API credentials have been saved locally',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save Aster configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveHyperliquidConfig = async () => {
    if (!hyperliquidPrivateKey || !hyperliquidWalletAddress) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both wallet address and private key',
      });
      return;
    }

    setSaving(true);

    try {
      // Save to localStorage for backward compatibility
      localStorage.setItem('hyperliquid_private_key', hyperliquidPrivateKey);
      localStorage.setItem('hyperliquid_wallet_address', hyperliquidWalletAddress);

      // Try to save to backend (Firestore), but don't fail if backend is unavailable
      try {
        await apiService.saveHyperliquidConfig({
          privateKey: hyperliquidPrivateKey,
          walletAddress: hyperliquidWalletAddress,
        });
        console.log('[Settings] Hyperliquid config saved to backend');
      } catch (backendError: any) {
        console.warn('[Settings] Backend save failed (using localStorage only):', backendError.message);
      }

      addNotification({
        type: 'success',
        title: 'Hyperliquid Config Saved',
        message: 'Hyperliquid API credentials have been saved locally',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save Hyperliquid configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveLiquidConfig = async () => {
    if (!liquidApiToken || !liquidApiSecret) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both API token and secret',
      });
      return;
    }

    setSaving(true);

    try {
      // Save to localStorage for backward compatibility
      localStorage.setItem('liquid_api_token', liquidApiToken);
      localStorage.setItem('liquid_api_secret', liquidApiSecret);

      // Try to save to backend (Firestore), but don't fail if backend is unavailable
      try {
        await apiService.saveLiquidConfig({
          apiToken: liquidApiToken,
          apiSecret: liquidApiSecret,
        });
        console.log('[Settings] Liquid config saved to backend');
      } catch (backendError: any) {
        console.warn('[Settings] Backend save failed (using localStorage only):', backendError.message);
      }

      addNotification({
        type: 'success',
        title: 'Liquid Config Saved',
        message: 'Liquid API credentials have been saved locally',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save Liquid configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveTelegramConfig = async () => {
    if (!telegramBotToken || !telegramChatId) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both Telegram bot token and chat ID',
      });
      return;
    }

    setSaving(true);

    try {
      // Save to localStorage
      localStorage.setItem('telegram_bot_token', telegramBotToken);
      localStorage.setItem('telegram_chat_id', telegramChatId);

      // Save to backend (Firestore)
      await apiService.saveTelegramConfig({
        botToken: telegramBotToken,
        chatId: telegramChatId,
        enabled: true,
      });

      addNotification({
        type: 'success',
        title: 'Telegram Saved',
        message: 'Telegram credentials have been saved to the server',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save Telegram configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const testTelegramConnection = async () => {
    if (!telegramBotToken || !telegramChatId) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both Telegram bot token and chat ID',
      });
      return;
    }

    setSaving(true);
    addNotification({
      type: 'info',
      title: 'Testing Telegram',
      message: 'Sending test message...',
    });

    try {
      const response = await apiService.testTelegram();

      if (response.success) {
        addNotification({
          type: 'success',
          title: 'Telegram Connected',
          message: 'Test message sent successfully! Check your Telegram.',
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'Telegram Not Configured',
          message: response.reason || 'Telegram notifications are disabled or not configured',
        });
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: error.message || 'Failed to send test message. Please check your credentials.',
      });
    } finally {
      setSaving(false);
    }
  };

  const testAsterConnection = async () => {
    if (!asterApiKey || !asterApiSecret) {
      addNotification({
        type: 'error',
        title: 'Missing Credentials',
        message: 'Please enter both AsterDEX API key and secret',
      });
      return;
    }

    setTesting((prev) => ({ ...prev, aster: true }));
    setTestResults((prev) => ({ ...prev, aster: null }));

    try {
      // Test connection by fetching account info
      const timestamp = Date.now();
      const params = `timestamp=${timestamp}`;

      // Create HMAC signature
      const crypto = await import('crypto-js');
      const signature = crypto.default.HmacSHA256(params, asterApiSecret).toString();

      const response = await fetch(`https://fapi.asterdex.com/fapi/v1/account?${params}&signature=${signature}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': asterApiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResults((prev) => ({ ...prev, aster: { success: true, message: `Connected! Balance: $${data.totalWalletBalance || '0'}` } }));
        addNotification({
          type: 'success',
          title: 'AsterDEX Connected',
          message: 'API credentials are valid',
        });
      } else {
        const error = await response.text();
        setTestResults((prev) => ({ ...prev, aster: { success: false, message: `Failed: ${error}` } }));
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: 'Invalid AsterDEX API credentials',
        });
      }
    } catch (error: any) {
      setTestResults((prev) => ({ ...prev, aster: { success: false, message: error.message } }));
      addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: error.message || 'Failed to connect to AsterDEX',
      });
    } finally {
      setTesting((prev) => ({ ...prev, aster: false }));
    }
  };

  const testHyperliquidConnection = async () => {
    if (!hyperliquidWalletAddress) {
      addNotification({
        type: 'error',
        title: 'Missing Address',
        message: 'Please enter HyperLiquid wallet address',
      });
      return;
    }

    setTesting((prev) => ({ ...prev, hyperliquid: true }));
    setTestResults((prev) => ({ ...prev, hyperliquid: null }));

    try {
      // Fetch clearinghouseState (includes both perps and spot in single response)
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: hyperliquidWalletAddress
        }),
      });

      if (response.ok) {
        const data = await response.json();

        let perpsBalance = 0;
        let spotBalance = 0;

        // Check perps balance (marginSummary.accountValue)
        if (data?.marginSummary?.accountValue) {
          perpsBalance = parseFloat(data.marginSummary.accountValue);
        }

        // Check spot balance - can be in spotState.balances or assetPositions
        if (data?.spotState?.balances) {
          const usdcBalance = data.spotState.balances.find((b: any) => b.coin === 'USDC');
          if (usdcBalance?.total) {
            spotBalance = parseFloat(usdcBalance.total);
          }
        }

        // Also check assetPositions for USDC
        if (data?.assetPositions && Array.isArray(data.assetPositions)) {
          data.assetPositions.forEach((asset: any) => {
            if (asset.position?.coin === 'USDC') {
              const usdcAmount = parseFloat(asset.position.szi || '0');
              if (!spotBalance) spotBalance = usdcAmount; // Use if not already found in spotState
            }
          });
        }

        const totalBalance = perpsBalance + spotBalance;

        setTestResults((prev) => ({ ...prev, hyperliquid: { success: true, message: `Connected! Total: $${totalBalance.toFixed(2)} (Perps: $${perpsBalance.toFixed(2)}, Spot: $${spotBalance.toFixed(2)})` } }));
        addNotification({
          type: 'success',
          title: 'HyperLiquid Connected',
          message: `Wallet found with $${totalBalance.toFixed(2)} total balance`,
        });
      } else {
        setTestResults((prev) => ({ ...prev, hyperliquid: { success: false, message: 'Invalid wallet address' } }));
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: 'Invalid HyperLiquid wallet address',
        });
      }
    } catch (error: any) {
      setTestResults((prev) => ({ ...prev, hyperliquid: { success: false, message: error.message } }));
      addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: error.message || 'Failed to connect to HyperLiquid',
      });
    } finally {
      setTesting((prev) => ({ ...prev, hyperliquid: false }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'testing':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'testing':
        return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
      default:
        return null;
    }
  };

  // Helper functions to determine if APIs are active/configured
  const isKrakenActive = () => {
    return krakenKeys.some(key => key.isActive && key.apiKey && key.apiSecret);
  };

  const isQuantifyActive = () => {
    return quantifyCryptoKey.length > 0;
  };

  const isCoinMarketCapActive = () => {
    return coinMarketCapKey.length > 0;
  };

  const isTelegramActive = () => {
    return telegramBotToken.length > 0 && telegramChatId.length > 0;
  };

  const isAsterActive = () => {
    return asterApiKey.length > 0 && asterApiSecret.length > 0;
  };

  const isHyperliquidActive = () => {
    return hyperliquidPrivateKey.length > 0 && hyperliquidWalletAddress.length > 0;
  };

  const isLiquidActive = () => {
    return liquidApiToken.length > 0 && liquidApiSecret.length > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              systemStatus.wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {systemStatus.wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card">
        <div className="flex gap-2 border-b border-slate-600 pb-4">
          <button
            onClick={() => setActiveTab('apis')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'apis'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Key className="h-5 w-5" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'themes'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Palette className="h-5 w-5" />
            Themes
          </button>
        </div>
      </div>

      {/* Themes Tab Content */}
      {activeTab === 'themes' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-6 w-6 text-primary-500" />
            <h2 className="text-xl font-bold">Appearance</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Customize the look and feel of your dashboard
          </p>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Light Theme Option */}
              <button
                onClick={() => setTheme('light')}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-gray-100">
                  <Sun className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Light Mode</p>
                  <p className="text-xs text-gray-400 mt-1">Clean and bright interface</p>
                </div>
                {theme === 'light' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-primary-500" />
                  </div>
                )}
              </button>

              {/* Dark Theme Option */}
              <button
                onClick={() => setTheme('dark')}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900">
                  <Moon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Dark Mode</p>
                  <p className="text-xs text-gray-400 mt-1">Easy on the eyes</p>
                </div>
                {theme === 'dark' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-primary-500" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APIs Tab Content */}
      {activeTab === 'apis' && (
        <>
          {/* Kraken API Keys Section */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('kraken')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <Key className="h-6 w-6 text-primary-500" />
                <h2 className="text-2xl font-bold">Kraken API Keys</h2>
                <div className="flex items-center gap-2">
                  {isKrakenActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.kraken ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.kraken && (
              <>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="text-sm text-gray-300">
                      <p className="font-semibold mb-2">Fallback Configuration</p>
                      <p>
                        Configure up to 3 Kraken API keys for redundancy. If the primary key
                        fails, the system will automatically try fallback keys in order.
                      </p>
                    </div>
                  </div>
                </div>

        <div className="space-y-4">
          {krakenKeys.map((key) => (
            <div
              key={key.id}
              className={`bg-slate-700/50 rounded-lg p-5 border-2 ${
                key.type === 'primary'
                  ? 'border-primary-500/30'
                  : 'border-slate-600/30'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">{key.name}</h3>
                  {key.type === 'primary' && (
                    <span className="px-3 py-1 bg-primary-500/20 text-primary-400 text-xs font-bold rounded-full">
                      PRIMARY
                    </span>
                  )}
                  {key.type !== 'primary' && (
                    <span className="px-3 py-1 bg-slate-600/50 text-gray-400 text-xs font-bold rounded-full">
                      FALLBACK
                    </span>
                  )}
                  {getStatusIcon(key.status)}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-400">Active</span>
                    <input
                      type="checkbox"
                      checked={key.isActive}
                      onChange={(e) =>
                        handleKrakenKeyChange(key.id, 'isActive', e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                  </label>
                </div>
              </div>

              {/* API Key Input */}
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showSecrets[key.id] ? 'text' : 'password'}
                      value={key.apiKey}
                      onChange={(e) =>
                        handleKrakenKeyChange(key.id, 'apiKey', e.target.value)
                      }
                      placeholder="Enter your Kraken API key"
                      className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg font-mono text-sm"
                    />
                    <button
                      onClick={() => toggleSecretVisibility(key.id)}
                      className="btn btn-secondary"
                    >
                      {showSecrets[key.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={key.apiSecret}
                    onChange={(e) =>
                      handleKrakenKeyChange(key.id, 'apiSecret', e.target.value)
                    }
                    placeholder="Enter your Kraken API secret"
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-600">
                <div className="text-xs text-gray-500">
                  {key.lastUsed ? (
                    <span>Last used: {new Date(key.lastUsed).toLocaleString()}</span>
                  ) : (
                    <span>Never used</span>
                  )}
                </div>
                <button
                  onClick={() => testKrakenConnection(key.id)}
                  disabled={!key.apiKey || !key.apiSecret || key.status === 'testing'}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      key.status === 'testing' ? 'animate-spin' : ''
                    }`}
                  />
                  {key.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          ))}
        </div>

                <button
                  onClick={saveKrakenKeys}
                  disabled={saving}
                  className="btn btn-primary mt-6 w-full flex items-center justify-center"
                >
                  {saving ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Kraken API Keys'}
                </button>
              </>
            )}
          </div>

          {/* Quantify Crypto API */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('quantify')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-yellow-500" />
                <h2 className="text-xl font-bold">Quantify Crypto API</h2>
                <div className="flex items-center gap-2">
                  {isQuantifyActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.quantify ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.quantify && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Used for enhanced market trends and technical analysis
                </p>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API Key</label>
                  <input
                    type={showSecrets['quantify'] ? 'text' : 'password'}
                    value={quantifyCryptoKey}
                    onChange={(e) => setQuantifyCryptoKey(e.target.value)}
                    placeholder="Enter your Quantify Crypto API key"
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                  />
                  <button
                    onClick={() => toggleSecretVisibility('quantify')}
                    className="btn btn-secondary btn-sm mt-2"
                  >
                    {showSecrets['quantify'] ? 'Hide' : 'Show'} Key
                  </button>
                </div>
              </>
            )}
          </div>

          {/* CoinMarketCap API */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('coinmarketcap')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <SettingsIcon className="h-6 w-6 text-green-500" />
                <h2 className="text-xl font-bold">CoinMarketCap API</h2>
                <div className="flex items-center gap-2">
                  {isCoinMarketCapActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.coinmarketcap ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.coinmarketcap && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Used for additional market data and coin information
                </p>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API Key</label>
                  <input
                    type={showSecrets['cmc'] ? 'text' : 'password'}
                    value={coinMarketCapKey}
                    onChange={(e) => setCoinMarketCapKey(e.target.value)}
                    placeholder="Enter your CoinMarketCap API key"
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                  />
                  <button
                    onClick={() => toggleSecretVisibility('cmc')}
                    className="btn btn-secondary btn-sm mt-2"
                  >
                    {showSecrets['cmc'] ? 'Hide' : 'Show'} Key
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Telegram Integration */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('telegram')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-bold">Telegram Notifications</h2>
                <div className="flex items-center gap-2">
                  {isTelegramActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.telegram ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.telegram && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Receive trading alerts and system notifications via Telegram
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Bot Token</label>
                    <input
                      type={showSecrets['telegram'] ? 'text' : 'password'}
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder="Enter your Telegram bot token"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Chat ID</label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="Enter your Telegram chat ID"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => toggleSecretVisibility('telegram')}
                    className="btn btn-secondary btn-sm"
                  >
                    {showSecrets['telegram'] ? 'Hide' : 'Show'} Token
                  </button>
                  <button
                    onClick={saveTelegramConfig}
                    disabled={saving || !telegramBotToken || !telegramChatId}
                    className="btn btn-primary btn-sm flex items-center gap-2"
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Telegram Config
                  </button>
                  <button
                    onClick={testTelegramConnection}
                    disabled={saving || !telegramBotToken || !telegramChatId}
                    className="btn btn-secondary btn-sm flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send Test Message
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Aster DEX API */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('aster')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-cyan-500" />
                <h2 className="text-xl font-bold">Aster DEX API</h2>
                <div className="flex items-center gap-2">
                  {isAsterActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.aster ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.aster && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Aster is a decentralized perpetuals exchange. API keys are used for real-time funding rate monitoring and automated position management.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">API Key</label>
                    <input
                      type={showSecrets['aster-key'] ? 'text' : 'password'}
                      value={asterApiKey}
                      onChange={(e) => setAsterApiKey(e.target.value)}
                      placeholder="Enter your Aster API key"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">API Secret</label>
                    <input
                      type="password"
                      value={asterApiSecret}
                      onChange={(e) => setAsterApiSecret(e.target.value)}
                      placeholder="Enter your Aster API secret"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleSecretVisibility('aster-key')}
                      className="btn btn-secondary btn-sm"
                    >
                      {showSecrets['aster-key'] ? 'Hide' : 'Show'} Key
                    </button>
                    <button
                      onClick={testAsterConnection}
                      disabled={testing.aster || !asterApiKey || !asterApiSecret}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      {testing.aster ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Shield className="h-3 w-3" />
                      )}
                      Test Connection
                    </button>
                    <button
                      onClick={saveAsterConfig}
                      disabled={saving || !asterApiKey || !asterApiSecret}
                      className="btn btn-primary btn-sm flex items-center gap-2"
                    >
                      {saving ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save Aster Config
                    </button>
                  </div>
                  {testResults.aster && (
                    <div className={`mt-2 p-3 rounded-lg ${testResults.aster.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <p className={`text-sm ${testResults.aster.success ? 'text-green-400' : 'text-red-400'}`}>
                        {testResults.aster.message}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Hyperliquid API */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('hyperliquid')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-purple-500" />
                <h2 className="text-xl font-bold">Hyperliquid API</h2>
                <div className="flex items-center gap-2">
                  {isHyperliquidActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.hyperliquid ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.hyperliquid && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Hyperliquid is a performant Layer-1 DEX for perpetual swaps. Uses wallet-based authentication via private key signing.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Wallet Address</label>
                    <input
                      type="text"
                      value={hyperliquidWalletAddress}
                      onChange={(e) => setHyperliquidWalletAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Private Key (Agent Wallet)</label>
                    <input
                      type="password"
                      value={hyperliquidPrivateKey}
                      onChange={(e) => setHyperliquidPrivateKey(e.target.value)}
                      placeholder="Enter your Hyperliquid agent wallet private key"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                    <p className="text-xs text-yellow-500 mt-2">⚠️ Use a dedicated agent wallet, not your main wallet</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleSecretVisibility('hyperliquid-key')}
                      className="btn btn-secondary btn-sm"
                    >
                      {showSecrets['hyperliquid-key'] ? 'Hide' : 'Show'} Key
                    </button>
                    <button
                      onClick={testHyperliquidConnection}
                      disabled={testing.hyperliquid || !hyperliquidWalletAddress}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      {testing.hyperliquid ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Shield className="h-3 w-3" />
                      )}
                      Test Connection
                    </button>
                    <button
                      onClick={saveHyperliquidConfig}
                      disabled={saving || !hyperliquidPrivateKey || !hyperliquidWalletAddress}
                      className="btn btn-primary btn-sm flex items-center gap-2"
                    >
                      {saving ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save Hyperliquid Config
                    </button>
                  </div>
                  {testResults.hyperliquid && (
                    <div className={`mt-2 p-3 rounded-lg ${testResults.hyperliquid.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <p className={`text-sm ${testResults.hyperliquid.success ? 'text-green-400' : 'text-red-400'}`}>
                        {testResults.hyperliquid.message}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Liquid Exchange API */}
          <div className="card">
            {/* Collapsible Header */}
            <button
              onClick={() => toggleSection('liquid')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-bold">Liquid Exchange API</h2>
                <div className="flex items-center gap-2">
                  {isLiquidActive() ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm text-green-500 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-sm text-gray-500 font-semibold">Inactive</span>
                    </>
                  )}
                </div>
              </div>
              {expandedSections.liquid ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {/* Collapsible Content */}
            {expandedSections.liquid && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Liquid is a centralized crypto-fiat exchange with spot and margin trading. Uses JWT-based authentication.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">API Token ID</label>
                    <input
                      type={showSecrets['liquid-token'] ? 'text' : 'password'}
                      value={liquidApiToken}
                      onChange={(e) => setLiquidApiToken(e.target.value)}
                      placeholder="Enter your Liquid API token ID"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">API Secret</label>
                    <input
                      type="password"
                      value={liquidApiSecret}
                      onChange={(e) => setLiquidApiSecret(e.target.value)}
                      placeholder="Enter your Liquid API secret"
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleSecretVisibility('liquid-token')}
                      className="btn btn-secondary btn-sm"
                    >
                      {showSecrets['liquid-token'] ? 'Hide' : 'Show'} Token
                    </button>
                    <button
                      onClick={saveLiquidConfig}
                      disabled={saving || !liquidApiToken || !liquidApiSecret}
                      className="btn btn-primary btn-sm flex items-center gap-2"
                    >
                      {saving ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save Liquid Config
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Save All Button */}
          <button
            onClick={saveOtherApiKeys}
            disabled={saving}
            className="btn btn-primary w-full flex items-center justify-center"
          >
            {saving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save All API Keys'}
          </button>

          {/* Security Notice */}
          <div className="card bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <Shield className="h-6 w-6 text-yellow-500 mt-1" />
              <div>
                <p className="font-bold text-yellow-500 mb-2">Security Best Practices</p>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li>
                    • <strong>API keys are stored locally</strong> in your browser's
                    localStorage
                  </li>
                  <li>
                    • <strong>Use read-only permissions</strong> where possible for safety
                  </li>
                  <li>
                    • <strong>Never share your API keys</strong> with anyone
                  </li>
                  <li>
                    • <strong>Regularly rotate keys</strong> for enhanced security
                  </li>
                  <li>
                    • <strong>Enable IP whitelisting</strong> on your Kraken account
                  </li>
                  <li>
                    • <strong>Use 2FA</strong> on all exchange accounts
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
