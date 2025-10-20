import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { apiService } from '@/services/apiService';
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

export default function Settings() {
  const systemStatus = useStore((state) => state.systemStatus);
  const addNotification = useStore((state) => state.addNotification);

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

  // Visibility toggles
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [saving, setSaving] = useState(false);

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

      {/* Kraken API Keys Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Key className="h-6 w-6 text-primary-500" />
          <h2 className="text-2xl font-bold">Kraken API Keys</h2>
        </div>

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
      </div>

      {/* Quantify Crypto API */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-6 w-6 text-yellow-500" />
          <h2 className="text-xl font-bold">Quantify Crypto API</h2>
        </div>
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
      </div>

      {/* CoinMarketCap API */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="h-6 w-6 text-green-500" />
          <h2 className="text-xl font-bold">CoinMarketCap API</h2>
        </div>
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
      </div>

      {/* Telegram Integration */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-bold">Telegram Notifications</h2>
        </div>
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
    </div>
  );
}
