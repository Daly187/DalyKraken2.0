import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Info,
  Wallet,
  ArrowDownUp,
  Clock,
  Target,
  BarChart3,
  Zap,
  Activity,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Signal,
  Layers,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { multiExchangeService, FundingRate, FundingPosition } from '@/services/multiExchangeService';
import { MatchedPair } from '@/services/symbolMappingEngine';
import { fundingArbitrageService, type FundingSpread, type StrategyPosition } from '@/services/fundingArbitrageService';
import { useStore } from '@/store/useStore';

export default function DalyFunding() {
  const addNotification = useStore((state) => state.addNotification);

  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [selectedExchange, setSelectedExchange] = useState<'all' | 'aster' | 'hyperliquid'>('all');
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [positions, setPositions] = useState<FundingPosition[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sortBy, setSortBy] = useState<'rate' | 'symbol' | 'markPrice'>('rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'all' | 'arbitrage' | 'diagnostics'>('arbitrage');
  const [fundingRatesCollapsed, setFundingRatesCollapsed] = useState(false);

  // Auto-Strategy State
  const [strategyEnabled, setStrategyEnabled] = useState(false);
  const [paperMode, setPaperMode] = useState(true); // Default to paper mode for testing
  const [totalCapital, setTotalCapital] = useState(10000);
  const [minSpreadThreshold, setMinSpreadThreshold] = useState(0.5);
  const [excludedSymbols, setExcludedSymbols] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState('');
  const [top5Spreads, setTop5Spreads] = useState<FundingSpread[]>([]);
  const [strategyPositions, setStrategyPositions] = useState<StrategyPosition[]>([]);
  const [nextRebalanceTime, setNextRebalanceTime] = useState(0);
  const [asterWallet, setAsterWallet] = useState('');
  const [hyperliquidWallet, setHyperliquidWallet] = useState('');

  // Wallet Balances
  const [asterBalance, setAsterBalance] = useState(0);
  const [hyperliquidBalance, setHyperliquidBalance] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Paper trading balances
  const [paperAsterBalance, setPaperAsterBalance] = useState(100);
  const [paperHyperliquidBalance, setPaperHyperliquidBalance] = useState(100);
  const [asterBalanceError, setAsterBalanceError] = useState<string | null>(null);
  const [hyperliquidBalanceError, setHyperliquidBalanceError] = useState<string | null>(null);

  // Legacy Strategy Configuration (keep for backward compatibility)
  const [positionSize, setPositionSize] = useState(100);
  const [fundingThreshold, setFundingThreshold] = useState(0.01);
  const [minVolume24h, setMinVolume24h] = useState(1000000);
  const [maxSpread, setMaxSpread] = useState(0.1);
  const [autoExecute, setAutoExecute] = useState(false);

  // Available trading pairs (normalized format) - Complete Aster DEX asset list
  const availablePairs = [
    // Top 10 by Market Cap
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT',

    // Layer 1 Blockchains
    'ATOMUSDT', 'LTCUSDT', 'BCHUSDT', 'ETCUSDT', 'FILUSDT',
    'NEARUSDT', 'APTUSDT', 'ALGOUSDT', 'VETUSD', 'ICPUSDT',
    'XLMUSDT', 'XMRUSDT', 'QNTUSDT', 'HBARUSDT', 'INJUSDT',
    'SUIUSDT', 'SEIUSDT', 'FLOWUSDT', 'EGLDUSDT', 'XTZUSDT',
    'EOSUSDT', 'ARUSDT', 'ZILUSDT', 'KASUSDT', 'TONUSDT',
    'FETUSDT', 'BEAMUSDT', 'IMXUSDT', 'RUNEUSDT', 'MINAUSDT',

    // Layer 2 & Scaling Solutions
    'ARBUSDT', 'OPUSDT', 'LDOUSDT', 'METISUSDT', 'STXUSDT',
    'MANTAUSDT', 'BLASTUSDT', 'POLYGONUSDT', 'ZKUSDT',

    // DeFi Tokens
    'LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'SNXUSDT',
    'CRVUSDT', 'COMPUSDT', 'SUSHIUSDT', 'BALUSDT', '1INCHUSDT',
    'YFIUSDT', 'LRCUSDT', 'ZRXUSDT', 'GMXUSDT', 'DYDXUSDT',
    'RDNTUSDT', 'PENDLEUSDT', 'WOOUSDT', 'SPELLUSDT',

    // Meme Coins
    'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'BONKUSDT', 'WIFUSDT',
    '1000SATSUSDT', 'ORDIUSDT', 'RATSUSDT', 'MEMECUSDT', 'DOGSUSDT',
    'POPCATUSDT', 'MEWUSDT', 'BOMEUSDT', 'NEIROUSDT',

    // Gaming & Metaverse
    'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'ENJUSDT', 'GALAUSDT',
    'GMTUSDT', 'APECUSDT', 'ILVSDT', 'YGGUSDT', 'RONINUSDT',
    'PIXELUSDT', 'PORTALUSDT', 'XAIUSDT', 'BLURUSDT', 'BELDUSDT',
    'SUPERUSDT', 'ALICEUSDT', 'TLMUSDT',

    // AI & Big Data
    'RENDERUSDT', 'GRTTUSDT', 'FETCHUSDT', 'AIUSDT', 'AGIXUSDT',
    'OCEUSDT', 'NMRUSDT', 'PHBUSDT', 'WLDUSDT', 'ARKMUSDT',
    'TIAUSDT', 'AKASHUSDT', 'ARKUSDT',

    // Storage & Infrastructure
    'ARUSDT', 'STORJUSDT', 'ICPUSDT', 'THETAUSDT', 'VIDTUSDT',
    'LPTUSDT', 'RNDRYSDT', 'HNTUSDT', 'IOTAUSDT',

    // Exchange Tokens
    'UNIUSDT', 'CAKEUSDT', 'SXPUSDT', 'MDXUSDT', 'GFTUSDT',
    '1INCHUSDT', 'DEXEUSDT', 'PERPUSDT',

    // Privacy Coins
    'XMRUSDT', 'ZCASHUSDT', 'SCRTUSDT', 'ROSUSDT', 'DASHUSDT',

    // Oracles & Data
    'LINKUSDT', 'BANDUSDT', 'TLMUSDT', 'APITUSDT', 'DIAUSDT',

    // Stablecoins & Yield
    'USTUSDT', 'LUNAUSTDT', 'FRAXUSDT', 'PAXGUSDT',

    // NFT & Collectibles
    'BLUESUSDT', 'RAREUSDT', 'LOOKUSDT', 'X2Y2USDT',

    // Emerging & New Projects
    'JUPUSDT', 'PYTHUSDT', 'WUSDT', 'JTOUSDT', 'DYMUSDT',
    'ALTUSDT', 'PIXFIUSDT', 'MAGICUSDT', 'SYNUSDT', 'SFPUSDT',
    'OMGUSDT', 'ANTUSDT', 'BATUSDT', 'CHZUSDT', 'ENJUSDT',
    'IOSTUSDT', 'ICXUSDT', 'KAVAUSDT', 'KSMUSDT', 'KNCUSDT',
    'ONTUSDT', 'QTUMUSDT', 'RENUSDT', 'RLCUSDT', 'SCUSDT',
    'SRMUSDT', 'STMXUSDT', 'TRBUSDT', 'WAVESUSDT', 'WINUSDT',

    // Miscellaneous High Opportunity
    'FTMUSDT', 'LUNA2USDT', 'GRTUSDT', 'JASMYUSDT', 'CKBUSDT',
    'CELRUSDT', 'CTSIUSDT', 'DARUSDT', 'C98USDT', 'GLMRUSDT',
    'CELOUSDT', 'CLVUSDT', 'CVXUSDT', 'LDOUSDT', 'LEVERUSDT',
    'LITUSDT', 'MCUSDT', 'MDTUSDT', 'MOVRUSDT', 'MTLUSDT',
    'OGNUSDT', 'POLYXUSDT', 'QIUSDT', 'RIFUSDT', 'VANRYUSDT',
  ];

  // Load wallet addresses from localStorage
  useEffect(() => {
    const savedAsterWallet = localStorage.getItem('aster_wallet_address') || '';
    const savedHLWallet = localStorage.getItem('hyperliquid_wallet_address') || '';
    setAsterWallet(savedAsterWallet);
    setHyperliquidWallet(savedHLWallet);
  }, []);

  // Fetch wallet balances
  const fetchWalletBalances = async () => {
    setLoadingBalances(true);
    try {
      // HyperLiquid balance fetch
      if (hyperliquidWallet) {
        try {
          const hlResponse = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'clearinghouseState',
              user: hyperliquidWallet
            }),
          });
          const hlData = await hlResponse.json();
          if (hlData && hlData.marginSummary && hlData.marginSummary.accountValue) {
            setHyperliquidBalance(parseFloat(hlData.marginSummary.accountValue));
            console.log('[DalyFunding] Hyperliquid balance:', hlData.marginSummary.accountValue);
          } else {
            console.warn('[DalyFunding] Invalid Hyperliquid response:', hlData);
            setHyperliquidBalance(0);
          }
        } catch (hlError) {
          console.error('[DalyFunding] Error fetching Hyperliquid balance:', hlError);
          setHyperliquidBalance(0);
        }
      } else {
        setHyperliquidBalance(0);
      }

      // AsterDEX balance fetch (requires API keys from localStorage)
      setAsterBalanceError(null); // Clear previous error
      if (asterWallet) {
        try {
          const asterApiKey = localStorage.getItem('aster_api_key');
          const asterApiSecret = localStorage.getItem('aster_api_secret');

          if (!asterApiKey || !asterApiSecret) {
            setAsterBalanceError('API keys not configured in Settings');
            console.log('[DalyFunding] Aster API keys not found in Settings');
            setAsterBalance(0);
          } else {
            // Aster uses Binance-compatible API
            const timestamp = Date.now();
            const params = `timestamp=${timestamp}`;

            // Create signature (HMAC SHA256)
            const crypto = await import('crypto-js');
            const signature = crypto.default.HmacSHA256(params, asterApiSecret).toString();

            console.log('[DalyFunding] Fetching Aster SPOT balance with API key:', asterApiKey.substring(0, 8) + '...');

            // Aster Spot API endpoint: https://sapi.asterdex.com/api/v1/account
            const asterResponse = await fetch(`https://sapi.asterdex.com/api/v1/account?${params}&signature=${signature}`, {
              method: 'GET',
              headers: {
                'X-MBX-APIKEY': asterApiKey,
              },
            });

            const asterData = await asterResponse.json();

            console.log('[DalyFunding] Aster API Response Status:', asterResponse.status);
            console.log('[DalyFunding] Aster API Full Response:', JSON.stringify(asterData, null, 2));

            if (!asterResponse.ok) {
              const errorMsg = asterData.msg || asterData.message || `HTTP ${asterResponse.status}`;
              setAsterBalanceError(`API Error: ${errorMsg}`);
              console.error('[DalyFunding] Aster API error:', errorMsg);
              setAsterBalance(0);
            } else if (asterData) {
              // Binance Spot API compatible response parsing
              let balance = 0;

              // Method 1: Sum all balances from balances array (Spot API format)
              if (asterData.balances && Array.isArray(asterData.balances)) {
                console.log('[DalyFunding] Found Spot API balances array, calculating total...');
                balance = asterData.balances.reduce((total: number, asset: any) => {
                  const free = parseFloat(asset.free || '0');
                  const locked = parseFloat(asset.locked || '0');
                  const assetBalance = free + locked;
                  if (assetBalance > 0) {
                    console.log(`  - ${asset.asset}: ${assetBalance} (free: ${free}, locked: ${locked})`);
                  }
                  return total + assetBalance;
                }, 0);
                console.log('[DalyFunding] ✓ Calculated total from Spot balances:', balance);
              }
              // Method 2: Check for totalWalletBalance (Futures format fallback)
              else if (asterData.totalWalletBalance !== undefined) {
                balance = parseFloat(asterData.totalWalletBalance);
                console.log('[DalyFunding] ✓ Found balance in totalWalletBalance:', balance);
              }
              // Method 3: Check for totalMarginBalance
              else if (asterData.totalMarginBalance !== undefined) {
                balance = parseFloat(asterData.totalMarginBalance);
                console.log('[DalyFunding] ✓ Found balance in totalMarginBalance:', balance);
              }
              // Method 4: Sum all assets (Futures API format)
              else if (asterData.assets && Array.isArray(asterData.assets)) {
                console.log('[DalyFunding] Found Futures assets array, calculating total...');
                balance = asterData.assets.reduce((total: number, asset: any) => {
                  const walletBalance = parseFloat(asset.walletBalance || asset.marginBalance || '0');
                  if (walletBalance > 0) {
                    console.log(`  - ${asset.asset}: ${walletBalance}`);
                  }
                  return total + walletBalance;
                }, 0);
                console.log('[DalyFunding] ✓ Calculated total from Futures assets:', balance);
              }
              // No recognized field found
              else {
                console.warn('[DalyFunding] ❌ Could not find balance field.');
                console.warn('[DalyFunding] Available root fields:', Object.keys(asterData));
                if (asterData.balances) {
                  console.warn('[DalyFunding] Balances found:', asterData.balances.slice(0, 3));
                }
                setAsterBalanceError(`Balance field not recognized. Check console for API response.`);
              }

              setAsterBalance(balance);
              if (balance > 0) {
                setAsterBalanceError(null);
                console.log('[DalyFunding] ✓ Balance successfully set to:', balance);
              } else {
                console.warn('[DalyFunding] ⚠️ Balance is 0 - this may indicate incorrect field parsing or truly empty account');
              }
            } else {
              setAsterBalanceError('Empty response from API');
              console.warn('[DalyFunding] Empty Aster response');
              setAsterBalance(0);
            }
          }
        } catch (asterError: any) {
          const errorMsg = asterError.message || 'Network error';
          setAsterBalanceError(errorMsg);
          console.error('[DalyFunding] Error fetching Aster balance:', asterError);
          setAsterBalance(0);
        }
      } else {
        setAsterBalanceError('Wallet address not configured');
        setAsterBalance(0);
      }

    } catch (error) {
      console.error('[DalyFunding] Error fetching wallet balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  // Fetch balances on mount and every 30 seconds
  useEffect(() => {
    if (asterWallet || hyperliquidWallet) {
      fetchWalletBalances();
      const interval = setInterval(fetchWalletBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [asterWallet, hyperliquidWallet]);

  // Update strategy status periodically
  useEffect(() => {
    const updateStrategyStatus = () => {
      const status = fundingArbitrageService.getStatus();
      setStrategyPositions(status.positions);
      setNextRebalanceTime(status.nextRebalanceTime);
      setStrategyEnabled(status.enabled);
    };

    // Update immediately
    updateStrategyStatus();

    // Update every 5 seconds
    const interval = setInterval(updateStrategyStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Connect to WebSocket feeds on mount
  useEffect(() => {
    console.log('[DalyFunding] Connecting to multi-exchange feeds...');

    // Connect to all exchanges - AsterDEX will auto-discover all available perpetuals
    multiExchangeService.connectAll();
    setIsConnected(true);

    // Subscribe to funding rate updates
    const unsubscribe = multiExchangeService.onFundingRateUpdate((fundingRate) => {
      setFundingRates(prev => {
        const updated = [...prev];
        const index = updated.findIndex(
          f => f.exchange === fundingRate.exchange && f.symbol === fundingRate.symbol
        );

        if (index >= 0) {
          updated[index] = fundingRate;
        } else {
          updated.push(fundingRate);
        }

        return updated;
      });

      // Check if funding rate exceeds threshold
      if (autoExecute && Math.abs(fundingRate.rate) >= fundingThreshold) {
        addNotification({
          type: 'info',
          title: 'Funding Rate Alert',
          message: `${fundingRate.exchange} ${fundingRate.symbol}: ${fundingRate.rate.toFixed(3)}%`,
        });
      }
    });

    return () => {
      unsubscribe();
      multiExchangeService.disconnectAll();
      setIsConnected(false);
    };
  }, [autoExecute, fundingThreshold]);

  // Filter and sort funding rates
  const filteredRates = selectedExchange === 'all'
    ? fundingRates
    : fundingRates.filter(f => f.exchange === selectedExchange);

  const sortedRates = [...filteredRates].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'rate':
        comparison = a.rate - b.rate;
        break;
      case 'symbol':
        comparison = a.symbol.localeCompare(b.symbol);
        break;
      case 'markPrice':
        comparison = a.markPrice - b.markPrice;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column: 'rate' | 'symbol' | 'markPrice') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Get matched pairs and arbitrage opportunities
  const matchedPairs = multiExchangeService.getMatchedPairs();
  const arbitrageOpportunities = matchedPairs
    .filter(pair =>
      pair.aster &&
      pair.hyperliquid &&
      pair.spread !== undefined &&
      Math.abs(pair.spread) >= 0.005 // At least 0.005% spread (0.5 basis points)
    )
    .sort((a, b) => Math.abs(b.annualSpread || 0) - Math.abs(a.annualSpread || 0));

  // Get exclusive assets (only on one exchange)
  const exclusiveAssets = multiExchangeService.getExclusiveAssets();
  const totalMatched = matchedPairs.filter(p => p.aster && p.hyperliquid).length;
  const asterOnlyCount = exclusiveAssets.asterOnly.length;
  const hlOnlyCount = exclusiveAssets.hyperliquidOnly.length;

  // Calculate statistics
  const totalPositions = strategyPositions.length;
  const totalInvested = strategyPositions.reduce((sum, p) => sum + (p.longSize + p.shortSize), 0);
  const totalFundingEarned = strategyPositions.reduce((sum, p) => sum + p.fundingEarned, 0);
  const totalPnL = strategyPositions.reduce((sum, p) => sum + p.pnl, 0);

  // Calculate time until next rebalance
  const getTimeUntilRebalance = () => {
    if (!nextRebalanceTime) return 'Not scheduled';
    const diff = nextRebalanceTime - Date.now();
    if (diff <= 0) return 'Rebalancing...';

    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  // Strategy control handlers
  const handleStartStrategy = () => {
    if (totalCapital <= 0) {
      addNotification({
        type: 'error',
        title: 'Invalid Capital',
        message: 'Please enter a valid capital amount',
      });
      return;
    }

    // Update configuration
    fundingArbitrageService.updateConfig({
      paperMode,
      totalCapital,
      minSpreadThreshold,
      excludedSymbols,
      walletAddresses: {
        aster: asterWallet || undefined,
        hyperliquid: hyperliquidWallet || undefined,
      },
    });

    // Get current funding rates organized by exchange
    const { aster: asterRates, hyperliquid: hlRates } = multiExchangeService.getFundingRatesByExchange();

    // Start strategy
    fundingArbitrageService.start(asterRates, hlRates);

    addNotification({
      type: 'success',
      title: 'Strategy Started',
      message: `Auto-arbitrage strategy started with $${totalCapital.toLocaleString()} capital`,
    });
  };

  const handleStopStrategy = () => {
    fundingArbitrageService.stop();

    addNotification({
      type: 'info',
      title: 'Strategy Stopped',
      message: 'Auto-arbitrage strategy has been stopped and all positions closed',
    });
  };

  const handleAddExcludedSymbol = () => {
    if (excludeInput && !excludedSymbols.includes(excludeInput.toUpperCase())) {
      setExcludedSymbols([...excludedSymbols, excludeInput.toUpperCase()]);
      setExcludeInput('');
    }
  };

  const handleRemoveExcludedSymbol = (symbol: string) => {
    setExcludedSymbols(excludedSymbols.filter(s => s !== symbol));
  };

  const handleSaveWalletAddresses = () => {
    localStorage.setItem('aster_wallet_address', asterWallet);
    localStorage.setItem('hyperliquid_wallet_address', hyperliquidWallet);

    // Immediately fetch balances after saving
    fetchWalletBalances();

    addNotification({
      type: 'success',
      title: 'Wallets Saved',
      message: 'Wallet addresses have been saved. Fetching balances...',
    });
  };

  // Update top 5 spreads periodically
  useEffect(() => {
    if (!isConnected) return;

    const updateTop5 = () => {
      const { aster: asterRates, hyperliquid: hlRates } = multiExchangeService.getFundingRatesByExchange();
      const spreads = fundingArbitrageService.getTop5Spreads(asterRates, hlRates);
      setTop5Spreads(spreads);
    };

    // Update immediately
    updateTop5();

    // Update every 10 seconds
    const interval = setInterval(updateTop5, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="space-y-6">
      {/* Paper/Live Mode Toggle */}
      <div className="card bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
              paperMode ? 'bg-yellow-500/20' : 'bg-green-500/20'
            }`}>
              {paperMode ? (
                <span className="text-2xl">📝</span>
              ) : (
                <span className="text-2xl">🔴</span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {paperMode ? 'Paper Trading Mode' : 'Live Trading Mode'}
              </h3>
              <p className="text-xs text-gray-400">
                {paperMode
                  ? 'Testing with $100 per exchange • No real money at risk'
                  : 'Live trading with real money • Actual trades executed'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {paperMode && (
              <div className="text-right mr-4">
                <div className="text-xs text-gray-400 mb-1">Paper Balances</div>
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-xs text-cyan-400 font-medium">Aster: </span>
                    <span className="text-sm font-bold text-white">${paperAsterBalance.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-purple-400 font-medium">HL: </span>
                    <span className="text-sm font-bold text-white">${paperHyperliquidBalance.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!paperMode}
                onChange={(e) => setPaperMode(!e.target.checked)}
                disabled={strategyEnabled}
                className="sr-only peer"
              />
              <div className="w-20 h-10 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              <span className="ml-3 text-sm font-medium text-gray-300">
                {paperMode ? 'Paper' : 'LIVE'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">DalyFunding Strategy</h1>
          <p className="text-sm text-gray-400 mt-1">
            Delta-Neutral Funding Rate Arbitrage (Aster & Hyperliquid)
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Wallet Balances */}
          <div className="flex items-center gap-3 border-r border-slate-600/50 pr-4">
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">Wallet Balances</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="text-sm font-medium text-gray-300">Aster:</span>
                  {loadingBalances ? (
                    <RefreshCw className="h-3 w-3 text-gray-400 animate-spin" />
                  ) : (
                    <span className="text-sm font-bold text-cyan-400">
                      ${asterBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-sm font-medium text-gray-300">HL:</span>
                  {loadingBalances ? (
                    <RefreshCw className="h-3 w-3 text-gray-400 animate-spin" />
                  ) : (
                    <span className="text-sm font-bold text-purple-400">
                      ${hyperliquidBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Total: ${(asterBalance + hyperliquidBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={fetchWalletBalances}
              disabled={loadingBalances}
              className="btn btn-secondary btn-sm p-2"
              title="Refresh balances"
            >
              <RefreshCw className={`h-4 w-4 ${loadingBalances ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Live Data' : 'Disconnected'}
            </span>
          </div>
          <div className="text-sm text-gray-400">
            {fundingRates.length} assets tracking
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Positions</p>
              <p className="text-2xl font-bold text-white">{totalPositions}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPositions === 0 ? 'No positions yet' : 'Across all exchanges'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-green-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Invested</p>
              <p className="text-2xl font-bold text-white">${totalInvested.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPositions > 0 ? 'Current exposure' : 'Start trading to see stats'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Funding Earned</p>
              <p className="text-2xl font-bold text-white">${totalFundingEarned.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-purple-400" />
            </div>
          </div>
        </div>

        <div className={`card bg-gradient-to-br ${totalPnL >= 0 ? 'from-green-500/10 to-green-600/5 border-green-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total P&L</p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${totalPnL.toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : '0.00'}% return
              </p>
            </div>
            <div className={`h-14 w-14 rounded-xl ${totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
              <BarChart3 className={`h-7 w-7 ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Live Funding Rates Monitor */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFundingRatesCollapsed(!fundingRatesCollapsed)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label={fundingRatesCollapsed ? "Expand section" : "Collapse section"}
            >
              {fundingRatesCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Live Funding Rates
              </h2>
              <p className="text-sm text-gray-400 mt-1">Real-time 2-way arbitrage between Aster and Hyperliquid</p>
            </div>
          </div>
          {!fundingRatesCollapsed && (
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex gap-2 border-r border-slate-600/50 pr-4">
              <button
                onClick={() => setViewMode('arbitrage')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'arbitrage'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                <ArrowDownUp className="h-3 w-3" />
                2-Way Arbitrage ({arbitrageOpportunities.length})
              </button>
              <button
                onClick={() => setViewMode('diagnostics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'diagnostics'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                <Activity className="h-3 w-3" />
                Diagnostics ({totalMatched} matched)
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                }`}
              >
                <Layers className="h-3 w-3" />
                All Assets ({sortedRates.length})
              </button>
            </div>

            {/* Exchange Filter (only shown in All Assets view) */}
            {viewMode === 'all' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedExchange('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedExchange === 'all'
                      ? 'bg-primary-500 text-white'
                      : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedExchange('aster')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedExchange === 'aster'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                  }`}
                >
                  Aster
                </button>
                <button
                  onClick={() => setSelectedExchange('hyperliquid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedExchange === 'hyperliquid'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600/50'
                  }`}
                >
                  Hyperliquid
                </button>
              </div>
            )}
            </div>
          )}
        </div>

        {!fundingRatesCollapsed && (viewMode === 'arbitrage' ? (
          // Arbitrage Opportunities View
          arbitrageOpportunities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-600/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      AsterDEX
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      HyperLiquid
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Spread
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Annual Spread
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Strategy
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {arbitrageOpportunities.map((pair) => (
                    <tr
                      key={pair.canonical}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-emerald-400" />
                          <span className="font-bold text-white">{pair.canonical}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {pair.aster ? (
                          <div className="space-y-1">
                            <div className={`text-sm font-bold ${
                              pair.aster.fundingRate > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {pair.aster.fundingRate > 0 ? '+' : ''}{pair.aster.fundingRate.toFixed(4)}%
                            </div>
                            <div className="text-xs text-gray-400">
                              Annual: {pair.aster.annualRate > 0 ? '+' : ''}{pair.aster.annualRate.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {pair.hyperliquid ? (
                          <div className="space-y-1">
                            <div className={`text-sm font-bold ${
                              pair.hyperliquid.fundingRate > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {pair.hyperliquid.fundingRate > 0 ? '+' : ''}{pair.hyperliquid.fundingRate.toFixed(4)}%
                            </div>
                            <div className="text-xs text-gray-400">
                              Annual: {pair.hyperliquid.annualRate > 0 ? '+' : ''}{pair.hyperliquid.annualRate.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold ${
                          Math.abs(pair.spread || 0) >= 0.01
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {pair.spread && pair.spread > 0 ? '+' : ''}
                          {pair.spread?.toFixed(4)}%
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`text-lg font-bold ${
                          Math.abs(pair.annualSpread || 0) >= 1
                            ? 'text-emerald-400'
                            : 'text-yellow-400'
                        }`}>
                          {pair.annualSpread && pair.annualSpread > 0 ? '+' : ''}
                          {pair.annualSpread?.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {pair.opportunity === 'long_aster_short_hl' && (
                            <>
                              <div className="flex items-center gap-1 text-xs">
                                <TrendingUp className="h-3 w-3 text-cyan-400" />
                                <span className="text-cyan-400 font-medium">Long Aster</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <TrendingDown className="h-3 w-3 text-purple-400" />
                                <span className="text-purple-400 font-medium">Short HL</span>
                              </div>
                            </>
                          )}
                          {pair.opportunity === 'short_aster_long_hl' && (
                            <>
                              <div className="flex items-center gap-1 text-xs">
                                <TrendingDown className="h-3 w-3 text-cyan-400" />
                                <span className="text-cyan-400 font-medium">Short Aster</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <TrendingUp className="h-3 w-3 text-purple-400" />
                                <span className="text-purple-400 font-medium">Long HL</span>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 transition-all"
                          onClick={() => {
                            addNotification({
                              type: 'success',
                              title: 'Arbitrage Opportunity',
                              message: `${pair.canonical}: ${pair.annualSpread?.toFixed(2)}% annual spread`,
                            });
                          }}
                        >
                          Execute
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-400">No arbitrage opportunities found</p>
              <p className="text-sm text-gray-500 mt-1">
                Waiting for funding rate data from both exchanges...
              </p>
            </div>
          )
        ) : viewMode === 'diagnostics' ? (
          // Diagnostics View - Symbol Mapping Status
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-sm font-medium text-gray-400">Matched Assets</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{totalMatched}</div>
                <div className="text-xs text-gray-500 mt-1">Available on both exchanges</div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-cyan-400" />
                  <span className="text-sm font-medium text-gray-400">AsterDEX Only</span>
                </div>
                <div className="text-3xl font-bold text-cyan-400">{asterOnlyCount}</div>
                <div className="text-xs text-gray-500 mt-1">Exclusive to AsterDEX</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-purple-400" />
                  <span className="text-sm font-medium text-gray-400">HyperLiquid Only</span>
                </div>
                <div className="text-3xl font-bold text-purple-400">{hlOnlyCount}</div>
                <div className="text-xs text-gray-500 mt-1">Exclusive to HyperLiquid</div>
              </div>
            </div>

            {/* Matched Pairs Table */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Matched Assets ({totalMatched})
              </h3>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800 border-b border-slate-600/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Canonical</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">AsterDEX Symbol</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">HyperLiquid Symbol</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Multiplier</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {matchedPairs
                      .filter(p => p.aster && p.hyperliquid)
                      .sort((a, b) => a.canonical.localeCompare(b.canonical))
                      .map((pair) => (
                        <tr key={pair.canonical} className="hover:bg-slate-700/20">
                          <td className="px-3 py-2 font-bold text-white">{pair.canonical}</td>
                          <td className="px-3 py-2">
                            <span className="text-cyan-400 font-mono text-xs">
                              {pair.aster?.symbol}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-purple-400 font-mono text-xs">
                              {pair.hyperliquid?.symbol}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`text-xs ${
                              (pair.aster?.multiplier || 1) > 1 ? 'text-yellow-400 font-bold' : 'text-gray-500'
                            }`}>
                              {pair.aster?.multiplier || 1}x
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              Matched
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exchange-Exclusive Assets */}
            <div className="grid grid-cols-2 gap-4">
              {/* AsterDEX Only */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-cyan-500/20">
                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  AsterDEX Exclusive ({asterOnlyCount})
                </h3>
                <div className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {exclusiveAssets.asterOnly
                      .sort((a, b) => a.canonical.localeCompare(b.canonical))
                      .map((pair) => (
                        <div key={pair.canonical} className="flex items-center justify-between p-2 bg-cyan-500/5 rounded">
                          <span className="font-bold text-white">{pair.canonical}</span>
                          <span className="text-xs text-cyan-400 font-mono">{pair.aster?.symbol}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* HyperLiquid Only */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-purple-500/20">
                <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  HyperLiquid Exclusive ({hlOnlyCount})
                </h3>
                <div className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {exclusiveAssets.hyperliquidOnly
                      .sort((a, b) => a.canonical.localeCompare(b.canonical))
                      .map((pair) => (
                        <div key={pair.canonical} className="flex items-center justify-between p-2 bg-purple-500/5 rounded">
                          <span className="font-bold text-white">{pair.canonical}</span>
                          <span className="text-xs text-purple-400 font-mono">{pair.hyperliquid?.symbol}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // All Assets View
          sortedRates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Exchange
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center gap-1">
                      Symbol
                      {sortBy === 'symbol' && (
                        <span className="text-primary-400">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={() => handleSort('rate')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Funding Rate (8h)
                      {sortBy === 'rate' && (
                        <span className="text-primary-400">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Annual Rate
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={() => handleSort('markPrice')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Mark Price
                      {sortBy === 'markPrice' && (
                        <span className="text-primary-400">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    24h Volume
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Next Funding
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedRates.map((rate) => {
                  // HyperLiquid: hourly (24x per day), AsterDEX/others: 8-hourly (3x per day)
                  const paymentsPerDay = rate.exchange === 'hyperliquid' ? 24 : 3;
                  const annualRate = rate.rate * paymentsPerDay * 365;
                  return (
                    <tr
                      key={`${rate.exchange}-${rate.symbol}`}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Activity className={`h-4 w-4 ${
                            rate.exchange === 'aster' ? 'text-cyan-400' :
                            rate.exchange === 'hyperliquid' ? 'text-purple-400' :
                            rate.exchange === 'lighter' ? 'text-blue-400' :
                            'text-gray-400'
                          }`} />
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            rate.exchange === 'aster' ? 'bg-cyan-500/20 text-cyan-400' :
                            rate.exchange === 'hyperliquid' ? 'bg-purple-500/20 text-purple-400' :
                            rate.exchange === 'lighter' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {rate.exchange}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-white">{rate.symbol}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-lg font-bold ${
                          rate.rate > 0 ? 'text-green-400' :
                          rate.rate < 0 ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {rate.rate > 0 ? '+' : ''}{rate.rate.toFixed(4)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-sm font-medium ${
                          annualRate > 0 ? 'text-green-400' :
                          annualRate < 0 ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {annualRate > 0 ? '+' : ''}{annualRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-mono text-gray-300">
                          ${rate.markPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm text-gray-400">
                          -
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs text-gray-400">
                          {rate.nextFundingTime > 0
                            ? new Date(rate.nextFundingTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all"
                          onClick={() => {
                            setSelectedPair(rate.symbol);
                            addNotification({
                              type: 'info',
                              title: 'Symbol Selected',
                              message: `Now tracking ${rate.symbol} on ${rate.exchange}`,
                            });
                          }}
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="text-center py-12">
              <Signal className="h-12 w-12 text-gray-600 mx-auto mb-3 animate-pulse" />
              <p className="text-gray-400">Waiting for funding rate data...</p>
              <p className="text-xs text-gray-500 mt-1">
                Make sure API keys are configured in Settings
              </p>
            </div>
          )
        ))}
      </div>

      {/* Auto-Arbitrage Strategy Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Auto-Arbitrage Strategy
            </h2>
            <p className="text-sm text-gray-400 mt-1">Delta-neutral funding rate arbitrage across HyperLiquid & AsterDEX</p>
          </div>
          <div className="flex items-center gap-3">
            {strategyEnabled ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-lg border border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-green-400">ACTIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-500/20 rounded-lg border border-gray-500/30">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-sm font-semibold text-gray-400">INACTIVE</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* API Connection & Diagnostics Status */}
          <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Signal className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">API Connection Status</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* WebSocket Status */}
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">WebSocket</span>
                  {isConnected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className={`text-sm font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>

              {/* Aster Balance */}
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Aster Balance</span>
                  {asterWallet ? (
                    <CheckCircle className="h-4 w-4 text-cyan-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <div className="text-sm font-bold text-cyan-400">
                  {asterWallet ? `$${asterBalance.toFixed(2)}` : 'No wallet'}
                </div>
              </div>

              {/* Hyperliquid Balance */}
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Hyperliquid Balance</span>
                  {hyperliquidWallet ? (
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <div className="text-sm font-bold text-purple-400">
                  {hyperliquidWallet ? `$${hyperliquidBalance.toFixed(2)}` : 'No wallet'}
                </div>
              </div>

              {/* Top Spread */}
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Top Spread</span>
                  {top5Spreads.length > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <div className={`text-sm font-bold ${
                  top5Spreads.length > 0 && top5Spreads[0].spread >= minSpreadThreshold
                    ? 'text-emerald-400'
                    : 'text-yellow-400'
                }`}>
                  {top5Spreads.length > 0 ? `${top5Spreads[0].spread.toFixed(4)}%` : 'No data'}
                </div>
                {top5Spreads.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">{top5Spreads[0].canonical}</div>
                )}
              </div>
            </div>

            {/* Warning if no qualifying spreads */}
            {top5Spreads.length > 0 && top5Spreads.every(s => s.spread < minSpreadThreshold) && (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-300">
                  <strong>No spreads meet threshold:</strong> All current spreads are below {minSpreadThreshold}%.
                  Top spread is {top5Spreads[0].spread.toFixed(4)}% ({top5Spreads[0].canonical}).
                  Consider lowering the threshold or waiting for better opportunities.
                </div>
              </div>
            )}
          </div>

          {/* Strategy Status Overview */}
          {strategyEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-gray-400">Next Rebalance</span>
                </div>
                <div className="text-xl font-bold text-emerald-400">{getTimeUntilRebalance()}</div>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs text-gray-400">Active Positions</span>
                </div>
                <div className="text-xl font-bold text-cyan-400">{totalPositions} / 5</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-gray-400">Capital Deployed</span>
                </div>
                <div className="text-xl font-bold text-purple-400">${totalInvested.toFixed(0)}</div>
              </div>
            </div>
          )}

          {/* Configuration Section */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Total Capital */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Wallet className="h-4 w-4 text-green-400" />
                Total Capital (100% Allocation)
                <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="100"
                  min="100"
                  value={totalCapital}
                  onChange={(e) => setTotalCapital(Number(e.target.value))}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="10000.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Allocations: 30%, 30%, 20%, 10%, 10% (Rank 1-5)
              </p>
            </div>

            {/* Minimum Spread Threshold */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Target className="h-4 w-4 text-purple-400" />
                Minimum Spread Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={minSpreadThreshold}
                  onChange={(e) => setMinSpreadThreshold(Number(e.target.value))}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-800/50 border border-slate-600/50 focus:border-primary-500/50 text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="0.5"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Only enter when spread exceeds this value</p>
            </div>
          </div>

          {/* Wallet Addresses */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">
                  Wallet Addresses
                </label>
                <p className="text-xs text-gray-400">Connected wallets for each exchange</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">AsterDEX Wallet</label>
                <input
                  type="text"
                  value={asterWallet}
                  onChange={(e) => setAsterWallet(e.target.value)}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">HyperLiquid Wallet</label>
                <input
                  type="text"
                  value={hyperliquidWallet}
                  onChange={(e) => setHyperliquidWallet(e.target.value)}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="0x..."
                />
              </div>
            </div>
            {!strategyEnabled && (
              <button
                onClick={handleSaveWalletAddresses}
                className="btn btn-secondary btn-sm mt-3"
              >
                Save Wallet Addresses
              </button>
            )}
          </div>

          {/* Exclusion List */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white">
                  Symbol Exclusion List
                </label>
                <p className="text-xs text-gray-400">Manually exclude specific symbols from the strategy</p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddExcludedSymbol()}
                disabled={strategyEnabled}
                className="flex-1 bg-slate-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter symbol (e.g., BTCUSDT)"
              />
              <button
                onClick={handleAddExcludedSymbol}
                disabled={strategyEnabled || !excludeInput}
                className="btn btn-secondary btn-sm"
              >
                Add
              </button>
            </div>
            {excludedSymbols.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {excludedSymbols.map(symbol => (
                  <div
                    key={symbol}
                    className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-lg text-sm"
                  >
                    <span className="text-red-400 font-medium">{symbol}</span>
                    {!strategyEnabled && (
                      <button
                        onClick={() => handleRemoveExcludedSymbol(symbol)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strategy Control Buttons */}
          <div className="flex gap-3 pt-2">
            {!strategyEnabled ? (
              <button
                type="button"
                onClick={handleStartStrategy}
                className="flex-1 relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500 hover:from-emerald-600 hover:via-cyan-600 hover:to-purple-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              >
                <div className="relative flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5" />
                  <span>Start Auto-Arbitrage Strategy</span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopStrategy}
                className="flex-1 relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
              >
                <div className="relative flex items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Stop Strategy & Close All Positions</span>
                </div>
              </button>
            )}
          </div>

          {/* Info Alert */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-blue-300 mb-2">How Auto-Arbitrage Works</p>
                <ul className="space-y-1 text-xs">
                  <li>• Identifies top 5 funding rate spreads between HyperLiquid and AsterDEX</li>
                  <li>• Opens offsetting long/short positions (delta-neutral, no market risk)</li>
                  <li>• Allocates capital: Rank 1 (30%), Rank 2 (30%), Rank 3 (20%), Rank 4 (10%), Rank 5 (10%)</li>
                  <li>• Rebalances every 4 hours automatically</li>
                  <li>• Exits immediately if spread turns negative</li>
                  <li>• Profitable spreads outside top 5 are held until next rebalance</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ArrowDownUp className="h-6 w-6 text-primary-400" />
              Active Arbitrage Positions
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Currently earning from funding rate spreads
            </p>
          </div>
          {strategyPositions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-gray-400">Total P&L</div>
                <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {strategyPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Long Side</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Short Side</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Spread</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Position Size</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">P&L</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Funding Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {strategyPositions.map((position) => (
                  <tr key={position.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                          position.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                          position.rank === 2 ? 'bg-gray-300/20 text-gray-300' :
                          position.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          #{position.rank}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-white">{position.canonical}</div>
                      <div className="text-xs text-gray-500">{position.allocation}% allocation</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-3 w-3 text-green-400" />
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            position.longExchange === 'aster' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {position.longExchange.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-green-400 font-medium">
                          {position.longFundingRate > 0 ? '+' : ''}{position.longFundingRate.toFixed(4)}%
                        </div>
                        <div className="text-xs text-gray-500">${position.longCurrentPrice.toFixed(2)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-400" />
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            position.shortExchange === 'aster' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {position.shortExchange.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-red-400 font-medium">
                          {position.shortFundingRate > 0 ? '+' : ''}{position.shortFundingRate.toFixed(4)}%
                        </div>
                        <div className="text-xs text-gray-500">${position.shortCurrentPrice.toFixed(2)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className={`inline-flex flex-col items-center gap-1 px-3 py-2 rounded-lg font-bold ${
                        position.spread >= 1 ? 'bg-emerald-500/20 text-emerald-400' :
                        position.spread >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                        position.spread >= 0 ? 'bg-gray-500/20 text-gray-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        <div className="text-sm">
                          {position.spread.toFixed(4)}%
                        </div>
                        <div className="text-xs opacity-75">
                          Entry: {position.entrySpread.toFixed(4)}%
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="font-bold text-white">${(position.longSize + position.shortSize).toFixed(0)}</div>
                      <div className="text-xs text-gray-500">
                        ${position.longSize.toFixed(0)} + ${position.shortSize.toFixed(0)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className={`text-lg font-bold ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs ${
                        position.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {((position.pnl / (position.longSize + position.shortSize)) * 100).toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="text-sm font-bold text-purple-400">
                        ${position.fundingEarned.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {((Date.now() - position.entryTime) / (60 * 60 * 1000)).toFixed(1)}h
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-purple-500/20 mb-4">
              <ArrowDownUp className="h-10 w-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Active Positions</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              {strategyEnabled
                ? 'Waiting for funding rate data and optimal entry opportunities...'
                : 'Start the auto-arbitrage strategy to begin trading funding rate spreads.'}
            </p>
          </div>
        )}
      </div>

      {/* Funding Rate History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Funding Rate History
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Historical funding rates for {selectedPair}
            </p>
          </div>
        </div>

        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No funding rate data available</p>
          <p className="text-xs text-gray-500 mt-1">Data will appear once you start tracking positions</p>
        </div>
      </div>

      {/* Strategy Info */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">Multi-Exchange Funding Strategy Overview</h3>
        <div className="space-y-4 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">What is Funding?</strong> Funding rates are periodic payments
              exchanged between long and short positions in perpetual futures markets. When funding is positive,
              longs pay shorts. When negative, shorts pay longs. This strategy captures these payments across
              multiple exchanges simultaneously.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-cyan-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Dual-Exchange Coverage:</strong> By monitoring funding rates across
              Aster DEX and Hyperliquid simultaneously, this strategy identifies the best 2-way arbitrage opportunities
              between these two exchanges. Each exchange has unique characteristics:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li><strong className="text-cyan-400">Aster:</strong> Decentralized perpetuals with up to 125x leverage, 8-hour funding</li>
                <li><strong className="text-purple-400">Hyperliquid:</strong> On-chain L1 DEX with CEX-like performance, hourly funding</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Liquidity & Volume Checks:</strong> Before executing any trade, the system
              verifies that the market has sufficient liquidity by checking:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li>24-hour trading volume exceeds your minimum threshold</li>
                <li>Order book depth can absorb your position size</li>
                <li>Bid-ask spread is within acceptable limits</li>
              </ul>
              This prevents slippage and ensures you can enter/exit positions efficiently.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Real-Time Data Monitoring:</strong> The strategy uses WebSocket and REST
              connections to each exchange for instant funding rate updates. Aster provides mark price streams via WebSocket,
              HyperLiquid and Lighter use REST API polling for funding data. All data is processed in real-time to identify
              opportunities the moment they arise.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Automated Entry & Exit:</strong> When auto-execute is enabled and a
              funding rate exceeds your threshold (while passing liquidity checks), the system automatically opens
              a position. Positions are monitored continuously and can be automatically closed when:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li>Funding rate mean-reverts below threshold</li>
                <li>Market conditions change (liquidity drops, spread widens)</li>
                <li>Target profit is achieved</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-white">Risk Management:</strong> The strategy includes multiple safety features:
              position sizing controls, spread limits, volume requirements, and automatic circuit breakers to protect
              your capital. Never trade on illiquid markets, and always maintain control over your exposure across
              all three exchanges.
            </div>
          </div>

          <div className="p-4 mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <strong className="text-blue-300">Setup Required:</strong> To use this strategy, configure your
                API keys for Aster and/or Hyperliquid in the Settings page.
                The strategy will automatically connect to all exchanges and begin monitoring funding rates in real-time.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Diagnostics */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            System Diagnostics
          </h2>
        </div>

        <div className="space-y-6">
          {/* Connection Status */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Signal className="h-4 w-4" />
              Connection Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">WebSocket</div>
                <div className={`text-lg font-bold flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Funding Rates</div>
                <div className="text-lg font-bold text-cyan-400">{fundingRates.length} active</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Matched Pairs</div>
                <div className="text-lg font-bold text-purple-400">{totalMatched} pairs</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Arbitrage Opportunities</div>
                <div className="text-lg font-bold text-emerald-400">{arbitrageOpportunities.length} found</div>
              </div>
            </div>
          </div>

          {/* Wallet Configuration */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet Configuration
            </h3>
            <div className="bg-slate-700/30 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Aster Wallet</div>
                  <div className="font-mono text-sm">
                    {asterWallet ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-cyan-400 truncate">{asterWallet}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-gray-500">Not configured</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Balance: ${asterBalance.toFixed(2)}
                    {asterBalanceError && (
                      <div className="text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {asterBalanceError}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Hyperliquid Wallet</div>
                  <div className="font-mono text-sm">
                    {hyperliquidWallet ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-purple-400 truncate">{hyperliquidWallet}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-gray-500">Not configured</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Balance: ${hyperliquidBalance.toFixed(2)}
                    {loadingBalances ? ' (Loading...)' : hyperliquidBalance === 0 && hyperliquidWallet ? ' (Wallet empty - deposit funds to trade)' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Configuration */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Strategy Configuration
            </h3>
            <div className="bg-slate-700/30 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Status</div>
                  <div className={`text-sm font-bold ${strategyEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {strategyEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total Capital</div>
                  <div className="text-sm font-bold text-white">${totalCapital.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Min Spread</div>
                  <div className="text-sm font-bold text-white">{minSpreadThreshold}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Excluded Symbols</div>
                  <div className="text-sm font-bold text-white">{excludedSymbols.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top 5 Spreads Analysis */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top 5 Spreads (Entry Candidates)
            </h3>
            <div className="bg-slate-700/30 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-400">Symbol</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400">Spread</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400">Annual</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400">Long</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400">Short</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {top5Spreads.length > 0 ? (
                    top5Spreads.map((spread, idx) => (
                      <tr key={spread.canonical} className={idx === 0 ? 'bg-emerald-500/5' : ''}>
                        <td className="px-4 py-3 font-mono font-bold text-white">{spread.canonical}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${
                            spread.spread >= minSpreadThreshold ? 'text-green-400' : 'text-yellow-400'
                          }`}>
                            {spread.spread.toFixed(4)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{spread.annualSpread.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-center">
                          <span className={spread.longExchange === 'aster' ? 'text-cyan-400' : 'text-purple-400'}>
                            {spread.longExchange}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={spread.shortExchange === 'aster' ? 'text-cyan-400' : 'text-purple-400'}>
                            {spread.shortExchange}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {spread.spread >= minSpreadThreshold ? (
                            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Qualifies</span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">Below threshold</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No spread data available. Waiting for funding rates...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Issue Detection */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Issue Detection
            </h3>
            <div className="space-y-2">
              {/* No connection */}
              {!isConnected && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-red-400">WebSocket Disconnected:</strong>
                    <span className="text-gray-300"> Not receiving live funding rate updates. Refresh the page to reconnect.</span>
                  </div>
                </div>
              )}

              {/* No wallet addresses */}
              {!asterWallet && !hyperliquidWallet && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-yellow-400">No Wallet Addresses:</strong>
                    <span className="text-gray-300"> Configure wallet addresses in the "Auto-Arbitrage Strategy" section to enable balance tracking.</span>
                  </div>
                </div>
              )}

              {/* Spreads below threshold */}
              {strategyEnabled && top5Spreads.length > 0 && top5Spreads.every(s => s.spread < minSpreadThreshold) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-yellow-400">No Qualifying Spreads:</strong>
                    <span className="text-gray-300"> All spreads are below {minSpreadThreshold}% threshold. Top spread is {top5Spreads[0].spread.toFixed(4)}% ({top5Spreads[0].canonical}). Lower the threshold to {(top5Spreads[0].spread * 0.9).toFixed(2)}% or wait for higher volatility.</span>
                  </div>
                </div>
              )}

              {/* Strategy active with qualifying spreads */}
              {strategyEnabled && top5Spreads.some(s => s.spread >= minSpreadThreshold) && strategyPositions.length === 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-green-400">Ready to Trade:</strong>
                    <span className="text-gray-300"> {top5Spreads.filter(s => s.spread >= minSpreadThreshold).length} spreads qualify. Next rebalance in {getTimeUntilRebalance()}.</span>
                  </div>
                </div>
              )}

              {/* Everything OK */}
              {isConnected && (asterWallet || hyperliquidWallet) && fundingRates.length > 0 && !strategyEnabled && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-blue-400">System Ready:</strong>
                    <span className="text-gray-300"> All systems operational. Click "Start Auto-Strategy" to begin trading.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Raw Data (for debugging) */}
          <details className="bg-slate-700/30 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-gray-300 hover:text-white transition-colors">
              Show Raw Debugging Data
            </summary>
            <div className="px-4 pb-4 space-y-2">
              <div className="bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-gray-400 mb-1">Loaded Wallet Addresses (localStorage):</div>
                <div className="text-cyan-400">Aster: {localStorage.getItem('aster_wallet_address') || 'null'}</div>
                <div className="text-purple-400">Hyperliquid: {localStorage.getItem('hyperliquid_wallet_address') || 'null'}</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-gray-400 mb-1">Aster API Configuration:</div>
                <div className="text-white">API Key: {localStorage.getItem('aster_api_key') ? localStorage.getItem('aster_api_key')!.substring(0, 12) + '...' : 'not set'}</div>
                <div className="text-white">API Secret: {localStorage.getItem('aster_api_secret') ? '***' + localStorage.getItem('aster_api_secret')!.slice(-4) : 'not set'}</div>
                {asterBalanceError && (
                  <div className="text-red-400 mt-2">Error: {asterBalanceError}</div>
                )}
                <button
                  onClick={fetchWalletBalances}
                  className="mt-2 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded text-xs font-bold transition-colors"
                >
                  🔄 Test Connection
                </button>
              </div>
              <div className="bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-gray-400 mb-1">State Values:</div>
                <div className="text-white">asterWallet: {asterWallet || 'empty'}</div>
                <div className="text-white">hyperliquidWallet: {hyperliquidWallet || 'empty'}</div>
                <div className="text-white">loadingBalances: {loadingBalances.toString()}</div>
                <div className="text-white">asterBalance: ${asterBalance.toFixed(2)}</div>
                <div className="text-white">hyperliquidBalance: ${hyperliquidBalance.toFixed(2)}</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-gray-400 mb-1">Top 5 Spreads Data:</div>
                <pre className="text-white overflow-x-auto">{JSON.stringify(top5Spreads, null, 2)}</pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
