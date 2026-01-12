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
  History as HistoryIcon,
  Link,
  Plus,
  Trash2,
  Play,
} from 'lucide-react';
import { multiExchangeService, FundingRate, FundingPosition } from '@/services/multiExchangeService';
import { MatchedPair } from '@/services/symbolMappingEngine';
import { fundingArbitrageService, type FundingSpread, type StrategyPosition } from '@/services/fundingArbitrageService';
import { exchangeTradeService } from '@/services/exchangeTradeService';
import { assetMappingService, type AssetMapping } from '@/services/assetMappingService';
import { marketCapService } from '@/services/marketCapService';
import AssetMappingDnD from '@/components/AssetMappingDnD';
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
  const [viewMode, setViewMode] = useState<'all' | 'arbitrage' | 'mapping'>('arbitrage');
  const [fundingRatesCollapsed, setFundingRatesCollapsed] = useState(false);
  const [activePositionsCollapsed, setActivePositionsCollapsed] = useState(false);
  const [fundingHistoryCollapsed, setFundingHistoryCollapsed] = useState(false);

  // Auto-Strategy State
  const [strategyEnabled, setStrategyEnabled] = useState(false);
  const [autoStrategyCollapsed, setAutoStrategyCollapsed] = useState(false);
  const [totalCapital, setTotalCapital] = useState(50); // Capital per exchange
  const [numberOfPairs, setNumberOfPairs] = useState(3); // Number of positions to trade
  const [allocations, setAllocations] = useState<number[]>([50, 30, 20]); // Dynamic allocations
  const [rebalanceInterval, setRebalanceInterval] = useState(60); // Interval in minutes (default: 60 = 1 hour)
  const [minSpreadThreshold, setMinSpreadThreshold] = useState(50); // Minimum annualized APR%
  const [excludedSymbols, setExcludedSymbols] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState('');
  const [top5Spreads, setTop5Spreads] = useState<FundingSpread[]>([]);
  const [strategyPositions, setStrategyPositions] = useState<StrategyPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<StrategyPosition[]>([]);
  const [nextRebalanceTime, setNextRebalanceTime] = useState(0);
  const [isManualRebalancing, setIsManualRebalancing] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [rebalanceCooldown, setRebalanceCooldown] = useState(0);
  const [asterWallet, setAsterWallet] = useState('');
  const [hyperliquidWallet, setHyperliquidWallet] = useState('');

  // Market Eligibility Requirements
  const [minMarketCap, setMinMarketCap] = useState(0); // 0 = no filter
  const [minLiquidity, setMinLiquidity] = useState(0); // 0 = no filter
  const [minAvgAPR, setMinAvgAPR] = useState(0); // 0 = no filter

  // Wallet Balances
  const [asterBalance, setAsterBalance] = useState(0);
  const [hyperliquidBalance, setHyperliquidBalance] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [asterBalanceError, setAsterBalanceError] = useState<string | null>(null);
  const [hyperliquidBalanceError, setHyperliquidBalanceError] = useState<string | null>(null);
  const [hlApiResponse, setHlApiResponse] = useState<any>(null); // Debug: store HL API response
  const [hlDebugAnalysis, setHlDebugAnalysis] = useState<string[]>([]); // Debug: analysis of API response

  // Balance Validation Debug
  const [balanceDebugLogs, setBalanceDebugLogs] = useState<string[]>([]);
  const [asterSpotBalance, setAsterSpotBalance] = useState(0);
  const [asterFuturesBalance, setAsterFuturesBalance] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Strategy Execution Logs
  const [executionLogs, setExecutionLogs] = useState<Array<{ timestamp: number; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
  const [maxLogs, setMaxLogs] = useState(100);

  // Manual Asset Mappings (using imported AssetMapping type from assetMappingService)
  const [manualMappings, setManualMappings] = useState<AssetMapping[]>([]);

  // Test/Dry-Run State
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [showTestResults, setShowTestResults] = useState(false);
  const [testResults, setTestResults] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    debugLogs: string[];
    selectedSpreads: FundingSpread[];
    asterBalance: number;
    hyperliquidBalance: number;
  } | null>(null);

  // Manual Single-Exchange Execution State
  const [isExecutingAster, setIsExecutingAster] = useState(false);
  const [isExecutingHL, setIsExecutingHL] = useState(false);
  const [manualExecutionResult, setManualExecutionResult] = useState<{
    exchange: 'aster' | 'hyperliquid';
    success: boolean;
    message: string;
    orderId?: string;
  } | null>(null);

  // Handlers for the drag-and-drop mapping component
  const handleAddMapping = async (mapping: AssetMapping) => {
    const updatedMappings = await assetMappingService.addMapping(mapping, manualMappings);
    setManualMappings(updatedMappings);
    addNotification({
      type: 'success',
      title: 'Mapping Added',
      message: `${mapping.canonical}: ${mapping.asterSymbol} ↔ ${mapping.hyperliquidSymbol}`,
    });
  };

  const handleRemoveMapping = async (canonical: string) => {
    const idx = manualMappings.findIndex(m => m.canonical === canonical);
    if (idx !== -1) {
      const updated = await assetMappingService.removeMapping(idx, manualMappings);
      setManualMappings(updated);
      addNotification({
        type: 'info',
        title: 'Mapping Removed',
        message: `Removed ${canonical}`,
      });
    }
  };

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

  // Initialize exchange trade service with dynamic precision on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('[DalyFunding] Initializing exchange trade service with dynamic precision...');
        await exchangeTradeService.initialize();
        console.log('[DalyFunding] ✅ Exchange trade service ready with all trading pairs');
      } catch (error) {
        console.error('[DalyFunding] Failed to initialize exchange trade service:', error);
      }
    };

    initializeServices();
  }, []);

  // Load wallet addresses from localStorage
  useEffect(() => {
    const savedAsterWallet = localStorage.getItem('aster_wallet_address') || '';
    const savedHLWallet = localStorage.getItem('hyperliquid_wallet_address') || '';
    setAsterWallet(savedAsterWallet);
    setHyperliquidWallet(savedHLWallet);
  }, []);

  // Load and sync manual asset mappings with Firestore
  useEffect(() => {
    const syncMappings = async () => {
      try {
        // Load from localStorage first (instant display)
        const localMappings = assetMappingService.loadFromLocalStorage();
        if (localMappings.length > 0) {
          setManualMappings(localMappings);
          console.log('[DalyFunding] Loaded', localMappings.length, 'mappings from localStorage cache');
        }

        // Then sync with Firestore in background
        console.log('[DalyFunding] Syncing with Firestore...');
        const syncedMappings = await assetMappingService.sync();
        setManualMappings(syncedMappings);
        console.log('[DalyFunding] Synced', syncedMappings.length, 'mappings from Firestore');
      } catch (error) {
        console.error('[DalyFunding] Failed to sync mappings:', error);
        // Fallback to localStorage only
        const localMappings = assetMappingService.loadFromLocalStorage();
        setManualMappings(localMappings);
      }
    };

    syncMappings();
  }, []);

  // Fetch market cap data on mount and periodically
  useEffect(() => {
    const fetchMarketCaps = async () => {
      try {
        await marketCapService.fetchAllMarketCaps();
      } catch (error) {
        console.error('[DalyFunding] Failed to fetch market caps:', error);
      }
    };

    fetchMarketCaps();
    // Refresh market caps every 5 minutes
    const interval = setInterval(fetchMarketCaps, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch wallet balances
  const fetchWalletBalances = async () => {
    setLoadingBalances(true);
    try {
      // HyperLiquid balance fetch
      if (hyperliquidWallet) {
        try {
          console.log('[DalyFunding] Fetching HyperLiquid balance for wallet:', hyperliquidWallet);

          // Validate wallet address format (should be 42-char hex starting with 0x)
          if (!hyperliquidWallet.startsWith('0x') || hyperliquidWallet.length !== 42) {
            console.warn('[DalyFunding] Warning: Wallet address may be invalid format:', hyperliquidWallet);
            setHyperliquidBalanceError('Invalid wallet address format');
          }

          // Fetch perps clearinghouse state
          const perpsResponse = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'clearinghouseState',
              user: hyperliquidWallet
            }),
          });
          const perpsData = await perpsResponse.json();

          // Check for API errors in perps response
          if (!perpsResponse.ok) {
            console.error('[DalyFunding] Perps API error:', perpsResponse.status, perpsData);
            throw new Error(`Perps API returned ${perpsResponse.status}`);
          }

          // Fetch SPOT clearinghouse state (separate wallet!)
          const spotResponse = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'spotClearinghouseState',
              user: hyperliquidWallet
            }),
          });
          const spotData = await spotResponse.json();

          // Check for API errors in spot response
          if (!spotResponse.ok) {
            console.error('[DalyFunding] Spot API error:', spotResponse.status, spotData);
            throw new Error(`Spot API returned ${spotResponse.status}`);
          }

          // Store both for debugging
          setHlApiResponse({ perps: perpsData, spot: spotData });
          console.log('[DalyFunding] Perps response:', JSON.stringify(perpsData, null, 2));
          console.log('[DalyFunding] Spot response:', JSON.stringify(spotData, null, 2));

          let totalBalance = 0;
          let perpsBalance = 0;
          let spotBalance = 0;
          const debugLog: string[] = [];

          // Check perps balance - try ALL possible locations
          debugLog.push(`📊 PERPS ACCOUNT ANALYSIS`);
          debugLog.push(`Wallet: ${hyperliquidWallet}`);
          debugLog.push(`Top-level keys: ${Object.keys(perpsData || {}).join(', ')}`);

          if (perpsData?.marginSummary) {
            debugLog.push(`\n✓ marginSummary found`);
            debugLog.push(`  Keys: ${Object.keys(perpsData.marginSummary).join(', ')}`);
            debugLog.push(`  accountValue: "${perpsData.marginSummary.accountValue}"`);
            debugLog.push(`  totalRawUsd: "${perpsData.marginSummary.totalRawUsd}"`);

            // Try totalRawUsd first (this is the actual USDC balance)
            if (perpsData.marginSummary.totalRawUsd) {
              const parsed = parseFloat(perpsData.marginSummary.totalRawUsd);
              if (!isNaN(parsed) && parsed > 0) {
                perpsBalance = parsed;
                totalBalance += perpsBalance;
                debugLog.push(`  ✅ Using totalRawUsd: $${perpsBalance}`);
              }
            }

            // Fallback to accountValue if totalRawUsd is 0 (for open positions)
            if (perpsBalance === 0 && perpsData.marginSummary.accountValue) {
              const parsed = parseFloat(perpsData.marginSummary.accountValue);
              if (!isNaN(parsed) && parsed > 0) {
                perpsBalance = parsed;
                totalBalance += perpsBalance;
                debugLog.push(`  ✅ Using accountValue: $${perpsBalance}`);
              }
            }

            if (perpsBalance === 0) {
              debugLog.push(`  ⚠️ Both totalRawUsd and accountValue are zero`);
            }
          } else {
            debugLog.push(`\n❌ No marginSummary found in perps response`);
          }

          // Also check crossMarginSummary as fallback
          if (perpsBalance === 0 && perpsData?.crossMarginSummary) {
            debugLog.push(`\n🔄 Trying crossMarginSummary fallback...`);
            if (perpsData.crossMarginSummary.totalRawUsd) {
              debugLog.push(`  totalRawUsd: "${perpsData.crossMarginSummary.totalRawUsd}"`);
              const parsed = parseFloat(perpsData.crossMarginSummary.totalRawUsd);
              if (!isNaN(parsed) && parsed > 0) {
                perpsBalance = parsed;
                totalBalance += perpsBalance;
                debugLog.push(`  ✅ Found balance in totalRawUsd: $${perpsBalance}`);
              }
            }
            if (perpsBalance === 0 && perpsData.crossMarginSummary.accountValue) {
              debugLog.push(`  accountValue: "${perpsData.crossMarginSummary.accountValue}"`);
              const parsed = parseFloat(perpsData.crossMarginSummary.accountValue);
              if (!isNaN(parsed) && parsed > 0) {
                perpsBalance = parsed;
                totalBalance += perpsBalance;
                debugLog.push(`  ✅ Found balance in accountValue: $${perpsBalance}`);
              }
            }
          }

          debugLog.push(`\n💰 PERPS BALANCE: $${perpsBalance}`);

          // Check spot balance - spotClearinghouseState returns different structure
          debugLog.push(`\n\n📊 SPOT ACCOUNT ANALYSIS`);
          if (spotData?.balances && Array.isArray(spotData.balances)) {
            debugLog.push(`✓ Balances array found with ${spotData.balances.length} tokens:`);

            // Sum ALL token balances (not just USDC)
            spotData.balances.forEach((balance: any) => {
              if (balance?.total) {
                const amount = parseFloat(balance.total);
                if (!isNaN(amount) && amount > 0) {
                  spotBalance += amount;
                  debugLog.push(`  • ${balance.coin}: $${amount}`);
                }
              }
            });

            if (spotBalance === 0) {
              debugLog.push(`  ⚠️ All balances are zero`);
            }

            totalBalance += spotBalance;
          } else {
            debugLog.push(`❌ No balances array found`);
            debugLog.push(`Spot response keys: ${Object.keys(spotData || {}).join(', ')}`);
          }

          debugLog.push(`\n💰 SPOT BALANCE: $${spotBalance}`);
          debugLog.push(`\n💵 TOTAL BALANCE: $${totalBalance}`);

          setHlDebugAnalysis(debugLog);

          // Check withdrawable
          if (perpsData?.withdrawable) {
            console.log('[DalyFunding] Withdrawable:', perpsData.withdrawable);
          }

          setHyperliquidBalance(totalBalance);
          setHyperliquidBalanceError(null);
          console.log('[DalyFunding] Final balances - Perps:', perpsBalance, 'Spot:', spotBalance, 'Total:', totalBalance);
        } catch (hlError) {
          console.error('[DalyFunding] Error fetching Hyperliquid balance:', hlError);
          setHyperliquidBalance(0);
          setHyperliquidBalanceError('Failed to fetch balance');
        }
      } else {
        setHyperliquidBalance(0);
      }

      // AsterDEX balance fetch (requires API keys from localStorage)
      // Fetch from BOTH Spot and Futures accounts and sum them
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
            console.log('[DalyFunding] Fetching AsterDEX balances from BOTH Spot and Futures accounts...');

            // Import crypto library
            const crypto = await import('crypto-js');
            let totalBalance = 0;
            let spotBalance = 0;
            let futuresBalance = 0;

            // Clear previous debug logs
            setBalanceDebugLogs([]);
            const addDebugLog = (msg: string) => {
              setBalanceDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
            };

            // 1. Fetch SPOT balance
            try {
              const spotTimestamp = Date.now();
              const spotParams = `timestamp=${spotTimestamp}`;
              const spotSignature = crypto.default.HmacSHA256(spotParams, asterApiSecret).toString();

              addDebugLog('Fetching Aster SPOT balance...');
              console.log('[DalyFunding] Fetching Aster SPOT balance...');
              const spotResponse = await fetch(`https://sapi.asterdex.com/api/v1/account?${spotParams}&signature=${spotSignature}`, {
                method: 'GET',
                headers: { 'X-MBX-APIKEY': asterApiKey },
              });

              if (spotResponse.ok) {
                const spotData = await spotResponse.json();
                addDebugLog(`Spot API response status: ${spotResponse.status}`);
                if (spotData.balances && Array.isArray(spotData.balances)) {
                  spotBalance = spotData.balances.reduce((total: number, asset: any) => {
                    const free = parseFloat(asset.free || '0');
                    const locked = parseFloat(asset.locked || '0');
                    return total + free + locked;
                  }, 0);
                  totalBalance += spotBalance;
                  setAsterSpotBalance(spotBalance);
                  addDebugLog(`✓ Spot balance: $${spotBalance.toFixed(2)}`);
                  console.log('[DalyFunding] ✓ Spot balance:', spotBalance);
                } else {
                  addDebugLog('⚠️ Spot response missing balances array');
                }
              } else {
                addDebugLog(`❌ Spot fetch failed: HTTP ${spotResponse.status}`);
                console.warn('[DalyFunding] Spot balance fetch failed:', spotResponse.status);
              }
            } catch (spotError: any) {
              addDebugLog(`❌ Spot error: ${spotError.message}`);
              console.warn('[DalyFunding] Spot balance error:', spotError);
            }

            // 2. Fetch FUTURES balance
            try {
              const futuresTimestamp = Date.now();
              const futuresParams = `timestamp=${futuresTimestamp}`;
              const futuresSignature = crypto.default.HmacSHA256(futuresParams, asterApiSecret).toString();

              addDebugLog('Fetching Aster FUTURES balance...');
              console.log('[DalyFunding] Fetching Aster FUTURES balance...');
              const futuresResponse = await fetch(`https://fapi.asterdex.com/fapi/v2/account?${futuresParams}&signature=${futuresSignature}`, {
                method: 'GET',
                headers: { 'X-MBX-APIKEY': asterApiKey },
              });

              if (futuresResponse.ok) {
                const futuresData = await futuresResponse.json();
                addDebugLog(`Futures API response status: ${futuresResponse.status}`);
                addDebugLog(`Response fields: ${Object.keys(futuresData).join(', ')}`);
                console.log('[DalyFunding] Futures API response:', JSON.stringify(futuresData, null, 2));

                // Try multiple balance fields
                if (futuresData.totalWalletBalance !== undefined) {
                  futuresBalance = parseFloat(futuresData.totalWalletBalance);
                  addDebugLog(`✓ Futures balance (totalWalletBalance): $${futuresBalance.toFixed(2)}`);
                  console.log('[DalyFunding] ✓ Futures balance (totalWalletBalance):', futuresBalance);
                } else if (futuresData.totalMarginBalance !== undefined) {
                  futuresBalance = parseFloat(futuresData.totalMarginBalance);
                  addDebugLog(`✓ Futures balance (totalMarginBalance): $${futuresBalance.toFixed(2)}`);
                  console.log('[DalyFunding] ✓ Futures balance (totalMarginBalance):', futuresBalance);
                } else if (futuresData.assets && Array.isArray(futuresData.assets)) {
                  futuresBalance = futuresData.assets.reduce((total: number, asset: any) => {
                    const balance = parseFloat(asset.walletBalance || asset.marginBalance || '0');
                    return total + balance;
                  }, 0);
                  addDebugLog(`✓ Futures balance (from assets): $${futuresBalance.toFixed(2)}`);
                  console.log('[DalyFunding] ✓ Futures balance (from assets):', futuresBalance);
                } else {
                  addDebugLog('⚠️ Futures response format not recognized');
                }
                totalBalance += futuresBalance;
                setAsterFuturesBalance(futuresBalance);
              } else {
                addDebugLog(`❌ Futures fetch failed: HTTP ${futuresResponse.status}`);
                console.warn('[DalyFunding] Futures balance fetch failed:', futuresResponse.status);
                const errorData = await futuresResponse.json();
                addDebugLog(`Error: ${JSON.stringify(errorData).substring(0, 100)}`);
                console.warn('[DalyFunding] Futures error:', errorData);
              }
            } catch (futuresError: any) {
              addDebugLog(`❌ Futures error: ${futuresError.message}`);
              console.warn('[DalyFunding] Futures balance error:', futuresError);
            }

            // Set total balance
            addDebugLog('========================================');
            addDebugLog(`AsterDEX Total Balance: $${totalBalance.toFixed(2)}`);
            addDebugLog(`  - Spot:    $${spotBalance.toFixed(2)}`);
            addDebugLog(`  - Futures: $${futuresBalance.toFixed(2)}`);
            addDebugLog('========================================');

            console.log('[DalyFunding] ========================================');
            console.log('[DalyFunding] AsterDEX Total Balance: $' + totalBalance.toFixed(2));
            console.log('[DalyFunding] ========================================');

            setAsterBalance(totalBalance);
            if (totalBalance > 0) {
              setAsterBalanceError(null);
            } else {
              setAsterBalanceError('No funds found in Spot or Futures accounts');
              addDebugLog('⚠️ Total balance is $0 - check API keys or wallet funding');
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

      // Update validation debug logs if available
      if (status.validationDebugLogs && status.validationDebugLogs.length > 0) {
        setBalanceDebugLogs(status.validationDebugLogs);
      }

      // Update closed positions
      const closed = fundingArbitrageService.getClosedPositions();
      setClosedPositions(closed);
    };

    // Update immediately
    updateStrategyStatus();

    // Update every 5 seconds
    const interval = setInterval(updateStrategyStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Resume strategy on page load if it was previously running
  useEffect(() => {
    if (!isConnected) return;

    const status = fundingArbitrageService.getStatus();
    if (status.enabled) {
      console.log('[DalyFunding] Resuming strategy from previous session...');

      // Restore UI state from saved config
      const config = fundingArbitrageService.getConfig();
      setStrategyEnabled(true);
      setTotalCapital(config.totalCapital);
      setNumberOfPairs(config.numberOfPairs);
      setAllocations(config.allocations);
      setRebalanceInterval(config.rebalanceInterval);
      setMinSpreadThreshold(config.minSpreadThreshold);
      setExcludedSymbols(config.excludedSymbols);
      if (config.walletAddresses.aster) setAsterWallet(config.walletAddresses.aster);
      if (config.walletAddresses.hyperliquid) setHyperliquidWallet(config.walletAddresses.hyperliquid);

      // Resume the strategy
      const { aster: asterRates, hyperliquid: hlRates } = multiExchangeService.getFundingRatesByExchange();
      fundingArbitrageService.resume(asterRates, hlRates);

      console.log('[DalyFunding] Strategy state restored and resumed');
    }
  }, [isConnected]);

  // Track rebalance cooldown
  useEffect(() => {
    if (!strategyEnabled) return;

    const updateCooldown = () => {
      const status = fundingArbitrageService.getRebalanceStatus();
      setRebalanceCooldown(status.cooldownRemaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [strategyEnabled]);

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

  // Convert manual mappings to MatchedPairs with funding rate data
  const manualMatchedPairs: MatchedPair[] = manualMappings.map(mapping => {
    // Find funding rates for each exchange
    const asterRate = fundingRates.find(r => r.exchange === 'aster' && r.symbol === mapping.asterSymbol);
    const hlRate = fundingRates.find(r => r.exchange === 'hyperliquid' && r.symbol === mapping.hyperliquidSymbol);

    // Calculate spread and annual rates
    let spread: number | undefined;
    let annualSpread: number | undefined;
    let opportunity: 'long_aster_short_hl' | 'short_aster_long_hl' | 'none' = 'none';

    if (asterRate && hlRate) {
      // AsterDEX pays every 8 hours (3x daily), HyperLiquid pays hourly (24x daily)
      const asterAnnual = asterRate.rate * 3 * 365;
      const hlAnnual = hlRate.rate * 24 * 365;

      spread = asterRate.rate - hlRate.rate;
      annualSpread = asterAnnual - hlAnnual;

      // Determine arbitrage strategy
      if (spread > 0) {
        opportunity = 'short_aster_long_hl'; // Aster pays more, so short Aster
      } else {
        opportunity = 'long_aster_short_hl'; // HL pays more, so short HL
      }
    }

    return {
      canonical: mapping.canonical,
      aster: asterRate ? {
        symbol: mapping.asterSymbol,
        fundingRate: asterRate.rate,
        annualRate: asterRate.rate * 3 * 365,
        markPrice: asterRate.markPrice,
        multiplier: mapping.multiplier,
      } : undefined,
      hyperliquid: hlRate ? {
        symbol: mapping.hyperliquidSymbol,
        fundingRate: hlRate.rate,
        annualRate: hlRate.rate * 24 * 365,
        markPrice: hlRate.markPrice,
        multiplier: 1, // HyperLiquid doesn't have multipliers
      } : undefined,
      spread,
      annualSpread,
      opportunity,
    };
  });

  // Use manual mappings instead of automatic matching
  const matchedPairs = manualMatchedPairs;
  const arbitrageOpportunities = matchedPairs
    .filter(pair =>
      pair.aster &&
      pair.hyperliquid &&
      pair.spread !== undefined &&
      Math.abs(pair.spread) >= 0.005 // At least 0.005% spread (0.5 basis points)
    )
    .map(pair => ({
      ...pair,
      marketCap: marketCapService.getMarketCap(pair.canonical),
    }))
    .sort((a, b) => Math.abs(b.annualSpread || 0) - Math.abs(a.annualSpread || 0));

  // No more automatic matching - only manual mappings
  const totalMatched = matchedPairs.filter(p => p.aster && p.hyperliquid).length;
  const asterOnlyCount = 0; // Disabled - only manual mappings
  const hlOnlyCount = 0; // Disabled - only manual mappings

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

  // Handle changing number of pairs
  const handleNumberOfPairsChange = (newCount: number) => {
    setNumberOfPairs(newCount);

    // Adjust allocations array to match new count
    if (newCount > allocations.length) {
      // Add new allocations (distribute remaining evenly)
      const currentSum = allocations.reduce((sum, val) => sum + val, 0);
      const remaining = 100 - currentSum;
      const newAllocations = [...allocations];
      const toAdd = newCount - allocations.length;
      const perNew = remaining / toAdd;

      for (let i = 0; i < toAdd; i++) {
        newAllocations.push(Math.round(perNew * 10) / 10);
      }
      setAllocations(newAllocations);
    } else if (newCount < allocations.length) {
      // Remove extra allocations and redistribute
      setAllocations(allocations.slice(0, newCount));
    }
  };

  // Handle allocation change for a specific rank
  const handleAllocationChange = (index: number, value: number) => {
    const newAllocations = [...allocations];
    newAllocations[index] = value;
    setAllocations(newAllocations);
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

    // Validate allocations sum to 100%
    const allocationSum = allocations.reduce((sum, val) => sum + val, 0);
    if (Math.abs(allocationSum - 100) > 0.01) {
      addNotification({
        type: 'error',
        title: 'Invalid Allocations',
        message: `Allocations must sum to 100% (current: ${allocationSum.toFixed(1)}%)`,
      });
      return;
    }

    // Update configuration
    fundingArbitrageService.updateConfig({
      totalCapital,
      numberOfPairs,
      allocations,
      rebalanceInterval,
      minSpreadThreshold,
      excludedSymbols,
      walletAddresses: {
        aster: asterWallet || undefined,
        hyperliquid: hyperliquidWallet || undefined,
      },
      manualMappings, // Pass manual asset mappings
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

  // Manual Single-Exchange Execution Handler
  const handleManualExecution = async (exchange: 'aster' | 'hyperliquid') => {
    const setExecuting = exchange === 'aster' ? setIsExecutingAster : setIsExecutingHL;
    setExecuting(true);
    setManualExecutionResult(null);

    try {
      // Get the top spread from the current list
      if (top5Spreads.length === 0) {
        throw new Error('No arbitrage opportunities available. Wait for funding rates to load.');
      }

      const topSpread = top5Spreads[0];
      const isLongOnThisExchange = topSpread.longExchange === exchange;
      const side = isLongOnThisExchange ? 'buy' : 'sell';

      // Get symbol for this exchange
      const symbol = exchange === 'aster'
        ? (topSpread.aster?.symbol || `${topSpread.canonical}USDT`)
        : (topSpread.hyperliquid?.symbol || `${topSpread.canonical}USDT`);

      // Calculate size based on capital and price
      const markPrice = exchange === 'aster'
        ? (topSpread.aster?.markPrice || 0)
        : (topSpread.hyperliquid?.markPrice || 0);

      if (markPrice <= 0) {
        throw new Error(`No price data for ${symbol} on ${exchange}`);
      }

      // Use capital per exchange setting
      const orderSize = totalCapital; // USD amount

      console.log(`[ManualExecution] ${exchange.toUpperCase()} - ${side.toUpperCase()} $${orderSize} of ${symbol} @ ~$${markPrice.toFixed(4)}`);

      let result;
      if (exchange === 'aster') {
        result = await exchangeTradeService.placeAsterOrder({
          symbol,
          side,
          size: orderSize,
          price: markPrice,
          orderType: 'MARKET',
        });
      } else {
        result = await exchangeTradeService.placeHyperliquidOrder({
          symbol,
          side,
          size: orderSize,
          price: markPrice,
          orderType: 'MARKET',
        });
      }

      if (result.success) {
        setManualExecutionResult({
          exchange,
          success: true,
          message: `${side.toUpperCase()} $${orderSize} ${symbol} executed successfully`,
          orderId: result.orderId,
        });
        addNotification({
          type: 'success',
          title: `${exchange.toUpperCase()} Order Executed`,
          message: `${side.toUpperCase()} $${orderSize} ${symbol}`,
        });
      } else {
        throw new Error(result.error || 'Order execution failed');
      }
    } catch (error: any) {
      console.error(`[ManualExecution] ${exchange} error:`, error);
      setManualExecutionResult({
        exchange,
        success: false,
        message: error.message || 'Unknown error',
      });
      addNotification({
        type: 'error',
        title: `${exchange.toUpperCase()} Order Failed`,
        message: error.message || 'Unknown error',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleStopStrategy = () => {
    fundingArbitrageService.stop();

    addNotification({
      type: 'info',
      title: 'Strategy Stopped',
      message: 'Auto-arbitrage strategy has been stopped and all positions closed',
    });
  };

  // Test/Dry-Run Handler - validates everything without executing trades
  const handleTestStrategy = async () => {
    setIsTestRunning(true);
    setShowTestResults(false);
    setTestResults(null);

    try {
      // Step 1: Validate basic configuration
      if (totalCapital <= 0) {
        setTestResults({
          valid: false,
          errors: ['Invalid capital: Please enter a valid capital amount'],
          warnings: [],
          debugLogs: ['Configuration validation failed: Invalid capital'],
          selectedSpreads: [],
          asterBalance: 0,
          hyperliquidBalance: 0,
        });
        setShowTestResults(true);
        setIsTestRunning(false);
        return;
      }

      const allocationSum = allocations.reduce((sum, val) => sum + val, 0);
      if (Math.abs(allocationSum - 100) > 0.01) {
        setTestResults({
          valid: false,
          errors: [`Invalid allocations: Must sum to 100% (current: ${allocationSum.toFixed(1)}%)`],
          warnings: [],
          debugLogs: ['Configuration validation failed: Allocations do not sum to 100%'],
          selectedSpreads: [],
          asterBalance: 0,
          hyperliquidBalance: 0,
        });
        setShowTestResults(true);
        setIsTestRunning(false);
        return;
      }

      // Step 2: Validate API credentials and fetch balances
      const validation = await exchangeTradeService.validateTradingReadiness(totalCapital);

      // Step 3: Get top spreads that would be selected
      const { aster: asterRates, hyperliquid: hlRates } = multiExchangeService.getFundingRatesByExchange();

      // Temporarily update config to get spreads
      fundingArbitrageService.updateConfig({
        totalCapital,
        numberOfPairs,
        allocations,
        rebalanceInterval,
        minSpreadThreshold,
        excludedSymbols,
        walletAddresses: {
          aster: asterWallet || undefined,
          hyperliquid: hyperliquidWallet || undefined,
        },
        manualMappings,
      });

      const selectedSpreads = fundingArbitrageService.getTopSpreads(asterRates, hlRates);

      // Step 4: Check if any spreads meet threshold
      const spreadsAboveThreshold = selectedSpreads.filter(s => s.annualSpread >= minSpreadThreshold);
      const additionalWarnings: string[] = [];

      if (selectedSpreads.length === 0) {
        additionalWarnings.push('No eligible spreads found - check manual asset mappings');
      } else if (spreadsAboveThreshold.length === 0) {
        additionalWarnings.push(`No spreads meet minimum threshold of ${minSpreadThreshold}% APR. Top spread is ${selectedSpreads[0].annualSpread.toFixed(2)}% APR`);
      } else if (spreadsAboveThreshold.length < numberOfPairs) {
        additionalWarnings.push(`Only ${spreadsAboveThreshold.length} spreads meet threshold (configured for ${numberOfPairs} pairs)`);
      }

      // Step 5: Check manual mappings
      if (manualMappings.length === 0) {
        additionalWarnings.push('No manual asset mappings configured - strategy requires at least one mapping');
      }

      // Fetch actual balances for display
      let asterBal = 0;
      let hlBal = 0;
      try {
        const asterApiKey = localStorage.getItem('aster_api_key');
        const asterApiSecret = localStorage.getItem('aster_api_secret');
        if (asterApiKey && asterApiSecret) {
          const timestamp = Date.now();
          const params = `timestamp=${timestamp}`;
          const crypto = await import('crypto-js');
          const signature = crypto.default.HmacSHA256(params, asterApiSecret).toString();

          // Try futures balance endpoint (fapi)
          const balRes = await fetch(`https://fapi.asterdex.com/fapi/v2/balance?${params}&signature=${signature}`, {
            headers: { 'X-MBX-APIKEY': asterApiKey }
          });
          if (balRes.ok) {
            const balData = await balRes.json();
            const usdtBal = balData.find((b: any) => b.asset === 'USDT');
            if (usdtBal) asterBal = parseFloat(usdtBal.availableBalance || usdtBal.balance || '0');
          }
        }
      } catch (e) {
        console.error('Error fetching Aster balance for test:', e);
      }

      try {
        const hlWallet = localStorage.getItem('hyperliquid_wallet_address');
        if (hlWallet) {
          const hlRes = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: hlWallet })
          });
          if (hlRes.ok) {
            const hlData = await hlRes.json();
            hlBal = parseFloat(hlData.marginSummary?.accountValue || '0');
          }
        }
      } catch (e) {
        console.error('Error fetching Hyperliquid balance for test:', e);
      }

      setTestResults({
        valid: validation.valid && additionalWarnings.length === 0,
        errors: validation.errors,
        warnings: [...validation.warnings, ...additionalWarnings],
        debugLogs: validation.debugLogs || [],
        selectedSpreads: selectedSpreads.slice(0, numberOfPairs),
        asterBalance: asterBal,
        hyperliquidBalance: hlBal,
      });
      setShowTestResults(true);

      addNotification({
        type: validation.valid ? 'success' : 'error',
        title: 'Test Complete',
        message: validation.valid
          ? `All validations passed. ${spreadsAboveThreshold.length} spreads ready for trading.`
          : `Validation failed: ${validation.errors.length} error(s) found`,
      });

    } catch (error) {
      setTestResults({
        valid: false,
        errors: [`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        debugLogs: [`Exception during test: ${error}`],
        selectedSpreads: [],
        asterBalance: 0,
        hyperliquidBalance: 0,
      });
      setShowTestResults(true);
    }

    setIsTestRunning(false);
  };

  const handleManualRebalance = async () => {
    setShowRebalanceModal(false);
    setIsManualRebalancing(true);

    const { aster: asterRates, hyperliquid: hlRates } = multiExchangeService.getFundingRatesByExchange();

    const result = await fundingArbitrageService.manualRebalance(asterRates, hlRates);

    setIsManualRebalancing(false);

    if (result.success) {
      addNotification({
        type: 'success',
        title: 'Rebalance Complete',
        message: `Entered: ${result.positionsEntered}, Exited: ${result.positionsExited}, Active: ${strategyPositions.length}/5`,
      });
    } else {
      addNotification({
        type: 'error',
        title: 'Rebalance Failed',
        message: result.error || 'Failed to rebalance positions',
      });
    }
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
      console.log(`[Top5Update] Aster rates: ${asterRates.size}, HL rates: ${hlRates.size}`);
      const spreads = fundingArbitrageService.getTop5Spreads(asterRates, hlRates, manualMappings);
      console.log(`[Top5Update] Top 5 spreads calculated:`, spreads.map(s => `${s.canonical}: ${s.annualSpread.toFixed(2)}%`));
      setTop5Spreads(spreads);
    };

    // Update immediately
    updateTop5();

    // Update every 10 seconds
    const interval = setInterval(updateTop5, 10000);

    return () => clearInterval(interval);
  }, [isConnected, manualMappings]);

  // Intercept console logs for strategy execution display
  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      // Only capture logs related to arbitrage strategy
      if (message.includes('[Arbitrage]') || message.includes('[HedgedEntry]') || message.includes('[Telegram]')) {
        setExecutionLogs((prev) => {
          const newLog = {
            timestamp: Date.now(),
            message: message.replace(/\[Arbitrage\]\s*/g, '').replace(/\[HedgedEntry\]\s*/g, '').replace(/\[Telegram\]\s*/g, ''),
            type,
          };
          const updated = [newLog, ...prev].slice(0, maxLogs);
          return updated;
        });
      }
    };

    console.log = function (...args: any[]) {
      const message = args.join(' ');
      addLog(message, message.includes('✅') ? 'success' : message.includes('⚠️') ? 'warning' : 'info');
      originalLog.apply(console, args);
    };

    console.warn = function (...args: any[]) {
      const message = args.join(' ');
      addLog(message, 'warning');
      originalWarn.apply(console, args);
    };

    console.error = function (...args: any[]) {
      const message = args.join(' ');
      addLog(message, 'error');
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [maxLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">DalyFunding Strategy</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Delta-Neutral Funding Rate Arbitrage (Aster & Hyperliquid)
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Wallet Balances */}
          <div className="flex items-center gap-3 border-r border-slate-600/50 pr-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Wallet Balances</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Aster:</span>
                  {loadingBalances ? (
                    <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />
                  ) : (
                    <span className="text-sm font-bold text-cyan-400">
                      ${asterBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">HL:</span>
                  {loadingBalances ? (
                    <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />
                  ) : (
                    <span className="text-sm font-bold text-purple-400">
                      ${hyperliquidBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {isConnected ? 'Live Data' : 'Disconnected'}
            </span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {fundingRates.length} assets tracking
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-100 to-green-50 dark:from-green-500/10 dark:to-green-600/5 border-green-200 dark:border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Active Positions</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalPositions}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {totalPositions === 0 ? 'No positions yet' : 'Across all exchanges'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-200 dark:bg-green-500/20 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-500/10 dark:to-blue-600/5 border-blue-200 dark:border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Invested</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">${totalInvested.toFixed(2)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {totalPositions > 0 ? 'Current exposure' : 'Start trading to see stats'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-200 dark:bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-500/10 dark:to-purple-600/5 border-purple-200 dark:border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Funding Earned</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">${totalFundingEarned.toFixed(2)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Lifetime earnings</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-purple-200 dark:bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className={`card bg-gradient-to-br ${totalPnL >= 0 ? 'from-emerald-100 to-emerald-50 dark:from-green-500/10 dark:to-green-600/5 border-emerald-200 dark:border-green-500/20' : 'from-red-100 to-red-50 dark:from-red-500/10 dark:to-red-600/5 border-red-200 dark:border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total P&L</p>
              <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-emerald-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ${totalPnL.toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${totalPnL >= 0 ? 'text-emerald-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : '0.00'}% return
              </p>
            </div>
            <div className={`h-14 w-14 rounded-xl ${totalPnL >= 0 ? 'bg-emerald-200 dark:bg-green-500/20' : 'bg-red-200 dark:bg-red-500/20'} flex items-center justify-center`}>
              <BarChart3 className={`h-7 w-7 ${totalPnL >= 0 ? 'text-emerald-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
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
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label={fundingRatesCollapsed ? "Expand section" : "Collapse section"}
            >
              {fundingRatesCollapsed ? (
                <ChevronRight className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              )}
            </button>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Live Funding Rates
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time 2-way arbitrage between Aster and Hyperliquid</p>
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
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-600/50'
                }`}
              >
                <ArrowDownUp className="h-3 w-3" />
                2-Way Arbitrage ({arbitrageOpportunities.length})
              </button>
              <button
                onClick={() => setViewMode('mapping')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'mapping'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-600/50'
                }`}
              >
                <Link className="h-3 w-3" />
                Asset Mapping ({manualMappings.length})
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-600/50'
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
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-600/50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedExchange('aster')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedExchange === 'aster'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-600/50'
                  }`}
                >
                  Aster
                </button>
                <button
                  onClick={() => setSelectedExchange('hyperliquid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedExchange === 'hyperliquid'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-600/50'
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
                  <tr className="border-b border-slate-200 dark:border-slate-600/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Market Cap
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      AsterDEX
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      HyperLiquid
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Spread
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Annual Spread
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Strategy
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {arbitrageOpportunities.map((pair) => (
                    <tr
                      key={pair.canonical}
                      className="hover:bg-slate-100 dark:hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-slate-900 dark:text-white">{pair.canonical || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-slate-600 dark:text-gray-400">
                          {marketCapService.formatMarketCap(pair.marketCap)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {pair.aster ? (
                          <div className="space-y-1">
                            <div className={`text-sm font-bold ${
                              pair.aster.fundingRate > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {pair.aster.fundingRate > 0 ? '+' : ''}{pair.aster.fundingRate.toFixed(4)}%
                            </div>
                            <div className="text-xs text-slate-600 dark:text-gray-400">
                              Annual: {pair.aster.annualRate > 0 ? '+' : ''}{pair.aster.annualRate.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-gray-500">N/A</span>
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
                            <div className="text-xs text-slate-600 dark:text-gray-400">
                              Annual: {pair.hyperliquid.annualRate > 0 ? '+' : ''}{pair.hyperliquid.annualRate.toFixed(2)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-gray-500">N/A</span>
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
              <AlertCircle className="h-12 w-12 text-slate-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-gray-300">No arbitrage opportunities found</p>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                Waiting for funding rate data from both exchanges...
              </p>
            </div>
          )
        ) : viewMode === 'mapping' ? (
          // Asset Mapping View - Drag-and-Drop Interface
          <AssetMappingDnD
            asterAssets={fundingRates
              .filter(r => r.exchange === 'aster')
              .map(r => r.symbol)
              .sort((a, b) => a.localeCompare(b))}
            hlAssets={fundingRates
              .filter(r => r.exchange === 'hyperliquid')
              .map(r => r.symbol)
              .sort((a, b) => a.localeCompare(b))}
            asterPrices={new Map(
              fundingRates
                .filter(r => r.exchange === 'aster')
                .map(r => [r.symbol, r.markPrice])
            )}
            hlPrices={new Map(
              fundingRates
                .filter(r => r.exchange === 'hyperliquid')
                .map(r => [r.symbol, r.markPrice])
            )}
            mappings={manualMappings}
            onAddMapping={handleAddMapping}
            onRemoveMapping={handleRemoveMapping}
          />
        ) : (
          // All Assets View
          sortedRates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Exchange
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors"
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
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors"
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Annual Rate
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors"
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    24h Volume
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Next Funding
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {sortedRates.map((rate) => {
                  // HyperLiquid: hourly (24x per day), AsterDEX/others: 8-hourly (3x per day)
                  const paymentsPerDay = rate.exchange === 'hyperliquid' ? 24 : 3;
                  const annualRate = rate.rate * paymentsPerDay * 365;
                  return (
                    <tr
                      key={`${rate.exchange}-${rate.symbol}`}
                      className="hover:bg-slate-100 dark:hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Activity className={`h-4 w-4 ${
                            rate.exchange === 'aster' ? 'text-cyan-400' :
                            rate.exchange === 'hyperliquid' ? 'text-purple-400' :
                            rate.exchange === 'lighter' ? 'text-blue-400' :
                            'text-slate-500 dark:text-gray-400'
                          }`} />
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            rate.exchange === 'aster' ? 'bg-cyan-500/20 text-cyan-400' :
                            rate.exchange === 'hyperliquid' ? 'bg-purple-500/20 text-purple-400' :
                            rate.exchange === 'lighter' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-slate-500 dark:text-gray-400'
                          }`}>
                            {rate.exchange}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-slate-900 dark:text-white">{rate.symbol}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-lg font-bold ${
                          rate.rate > 0 ? 'text-green-400' :
                          rate.rate < 0 ? 'text-red-400' :
                          'text-slate-500 dark:text-gray-400'
                        }`}>
                          {rate.rate > 0 ? '+' : ''}{rate.rate.toFixed(4)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-sm font-medium ${
                          annualRate > 0 ? 'text-green-400' :
                          annualRate < 0 ? 'text-red-400' :
                          'text-slate-500 dark:text-gray-400'
                        }`}>
                          {annualRate > 0 ? '+' : ''}{annualRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-mono text-slate-700 dark:text-slate-200">
                          ${rate.markPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          -
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs text-slate-600 dark:text-slate-300">
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
              <Signal className="h-12 w-12 text-slate-400 dark:text-gray-500 mx-auto mb-3 animate-pulse" />
              <p className="text-slate-600 dark:text-gray-300">Waiting for funding rate data...</p>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                Make sure API keys are configured in Settings
              </p>
            </div>
          )
        ))}
      </div>

      {/* Auto-Arbitrage Strategy Configuration */}
      <div className="card">
        <div
          className="flex items-center justify-between mb-6 cursor-pointer"
          onClick={() => setAutoStrategyCollapsed(!autoStrategyCollapsed)}
        >
          <div className="flex items-center gap-3">
            <button className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              {autoStrategyCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Auto-Arbitrage Strategy
              </h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Delta-neutral funding rate arbitrage across HyperLiquid & AsterDEX</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {strategyEnabled ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-lg border border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-green-400">ACTIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-500/20 dark:bg-gray-500/20 rounded-lg border border-slate-500/30 dark:border-gray-500/30">
                <div className="w-2 h-2 rounded-full bg-slate-500 dark:bg-gray-500" />
                <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">INACTIVE</span>
              </div>
            )}
          </div>
        </div>

        {!autoStrategyCollapsed && (
        <div className="space-y-6">
          {/* API Connection & Diagnostics Status */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Signal className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">API Connection Status</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* WebSocket Status */}
              <div className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-gray-300">WebSocket</span>
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
              <div className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-gray-300">Aster Balance</span>
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
              <div className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-gray-300">Hyperliquid Balance</span>
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
              <div className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-gray-300">Top Spread</span>
                  {top5Spreads.length > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-slate-500 dark:text-gray-500" />
                  )}
                </div>
                <div className={`text-sm font-bold ${
                  top5Spreads.length > 0 && top5Spreads[0].annualSpread >= minSpreadThreshold
                    ? 'text-emerald-400'
                    : 'text-yellow-400'
                }`}>
                  {top5Spreads.length > 0 ? `${top5Spreads[0].annualSpread.toFixed(2)}% APR` : 'No data'}
                </div>
                {top5Spreads.length > 0 && (
                  <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">{top5Spreads[0].canonical}</div>
                )}
              </div>
            </div>

            {/* Warning if no qualifying spreads */}
            {top5Spreads.length > 0 && top5Spreads.every(s => s.annualSpread < minSpreadThreshold) && (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>No spreads meet threshold:</strong> All current spreads are below {minSpreadThreshold}% APR.
                  Top spread is {top5Spreads[0].annualSpread.toFixed(2)}% APR ({top5Spreads[0].canonical}).
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
                  <span className="text-xs text-slate-600 dark:text-gray-300">Next Rebalance</span>
                </div>
                <div className="text-xl font-bold text-emerald-400">{getTimeUntilRebalance()}</div>
              </div>
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs text-slate-600 dark:text-gray-300">Active Positions</span>
                </div>
                <div className="text-xl font-bold text-cyan-400">{totalPositions} / 5</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-slate-600 dark:text-gray-300">Capital Deployed</span>
                </div>
                <div className="text-xl font-bold text-purple-400">${totalInvested.toFixed(0)}</div>
              </div>
            </div>
          )}

          {/* Configuration Section */}
          <div className="grid md:grid-cols-3 gap-5">
            {/* Total Capital Per Exchange */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-200 mb-3">
                <Wallet className="h-4 w-4 text-green-400" />
                Capital Per Exchange
                <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="10"
                  min="10"
                  value={totalCapital}
                  onChange={(e) => setTotalCapital(Number(e.target.value))}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-primary-500/50 text-slate-800 dark:text-white pl-8 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="50.00"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                Per exchange (Total: ${(totalCapital * 2).toLocaleString()})
              </p>
            </div>

            {/* Number of Pairs */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-200 mb-3">
                <Layers className="h-4 w-4 text-blue-400" />
                Number of Pairs
                <span className="text-red-400">*</span>
              </label>
              <select
                value={numberOfPairs}
                onChange={(e) => handleNumberOfPairsChange(Number(e.target.value))}
                disabled={strategyEnabled}
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-primary-500/50 text-slate-800 dark:text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Pair' : 'Pairs'}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                Trade top {numberOfPairs} spread{numberOfPairs > 1 ? 's' : ''}
              </p>
            </div>

            {/* Rebalance Interval */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
                <Clock className="h-4 w-4 text-orange-400" />
                Re-scan Interval (minutes)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="1440"
                value={rebalanceInterval}
                onChange={(e) => setRebalanceInterval(Number(e.target.value))}
                disabled={strategyEnabled}
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-primary-500/50 text-slate-800 dark:text-white px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Re-scan for top {numberOfPairs} spreads every {rebalanceInterval} minute{rebalanceInterval !== 1 ? 's' : ''} (60 = 1 hour)
              </p>
            </div>
          </div>

          {/* Dynamic Allocation Inputs */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200 dark:border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Position Allocations
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Percentage of capital per rank</p>
                </div>
              </div>
              <div className="text-sm font-mono text-slate-600 dark:text-slate-300">
                Sum: <span className={`font-bold ${Math.abs(allocations.reduce((s, v) => s + v, 0) - 100) < 0.01 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {allocations.reduce((s, v) => s + v, 0).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {allocations.map((allocation, index) => (
                <div key={index}>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Rank #{index + 1}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={allocation}
                      onChange={(e) => handleAllocationChange(index, Number(e.target.value))}
                      disabled={strategyEnabled}
                      className="w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white px-3 pr-8 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-600"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              💡 Allocations must sum to 100%. Higher ranks get larger positions.
            </p>
          </div>

          {/* Minimum Spread Threshold */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
              <Target className="h-4 w-4 text-purple-400" />
              Minimum Annual Spread (APR%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={minSpreadThreshold}
                onChange={(e) => setMinSpreadThreshold(Number(e.target.value))}
                disabled={strategyEnabled}
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-primary-500/50 text-slate-800 dark:text-white px-4 pr-8 py-3 rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">% APR</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Only enter when annualized spread exceeds this threshold (e.g., 50 = 50% APR)</p>
          </div>

          {/* Market Eligibility Requirements */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Target className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Market Eligibility Requirements
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Filter markets by cap, liquidity, and APR (0 = no filter)</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Min Market Cap */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  Min Market Cap
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="1000000"
                    min="0"
                    value={minMarketCap}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 0) setMinMarketCap(val);
                    }}
                    disabled={strategyEnabled}
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-amber-500/50 text-slate-800 dark:text-white pl-7 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {minMarketCap === 0 ? '⚡ No filter applied' : `Min: $${minMarketCap.toLocaleString()}`}
                </p>
              </div>

              {/* Min Liquidity */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  <Activity className="h-4 w-4 text-blue-400" />
                  Min Liquidity
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="100000"
                    min="0"
                    value={minLiquidity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 0) setMinLiquidity(val);
                    }}
                    disabled={strategyEnabled}
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-amber-500/50 text-slate-800 dark:text-white pl-7 pr-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {minLiquidity === 0 ? '⚡ No filter applied' : `Min: $${minLiquidity.toLocaleString()}`}
                </p>
              </div>

              {/* Min Avg APR */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  Min Avg APR
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={minAvgAPR}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 0) setMinAvgAPR(val);
                    }}
                    disabled={strategyEnabled}
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 focus:border-amber-500/50 text-slate-800 dark:text-white px-4 pr-12 py-3 rounded-xl transition-all focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {minAvgAPR === 0 ? '⚡ No filter applied' : `Min: ${minAvgAPR}% annual`}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                💡 <strong>Tip:</strong> Set values to 0 to disable that filter. Markets failing eligibility will show a clear error with which requirements were not met.
              </p>
            </div>
          </div>

          {/* Wallet Addresses */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-700/30 border border-slate-200 dark:border-slate-600/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-primary-500 dark:text-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Wallet Addresses
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Connected wallets for each exchange</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">AsterDEX Wallet</label>
                <input
                  type="text"
                  value={asterWallet}
                  onChange={(e) => setAsterWallet(e.target.value)}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2 rounded-lg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-600"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">HyperLiquid Wallet</label>
                <input
                  type="text"
                  value={hyperliquidWallet}
                  onChange={(e) => setHyperliquidWallet(e.target.value)}
                  disabled={strategyEnabled}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2 rounded-lg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-600"
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
          <div className="p-5 rounded-xl bg-gradient-to-br from-yellow-100 to-orange-50 dark:from-slate-800/50 dark:to-slate-700/30 border border-yellow-200 dark:border-slate-600/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Symbol Exclusion List
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manually exclude specific symbols from the strategy</p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddExcludedSymbol()}
                disabled={strategyEnabled}
                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-600"
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
                    className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 rounded-lg text-sm"
                  >
                    <span className="text-red-600 dark:text-red-400 font-medium">{symbol}</span>
                    {!strategyEnabled && (
                      <button
                        onClick={() => handleRemoveExcludedSymbol(symbol)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Single-Exchange Execution */}
          {!strategyEnabled && top5Spreads.length > 0 && (
            <div className="bg-slate-100 dark:bg-slate-700/30 rounded-xl p-4 border border-slate-200 dark:border-slate-600/50">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Manual Single-Exchange Execution</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">(Test individual exchanges)</span>
              </div>

              {/* Show what will be traded */}
              <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Top opportunity: <span className="font-bold text-slate-700 dark:text-slate-200">{top5Spreads[0].canonical}</span></div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${top5Spreads[0].longExchange === 'aster' ? 'text-cyan-500' : 'text-purple-500'}`}>
                      {top5Spreads[0].longExchange === 'aster' ? 'Aster' : 'HL'}
                    </span>
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">LONG</span>
                  </div>
                  <ArrowDownUp className="h-4 w-4 text-slate-400" />
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${top5Spreads[0].shortExchange === 'aster' ? 'text-cyan-500' : 'text-purple-500'}`}>
                      {top5Spreads[0].shortExchange === 'aster' ? 'Aster' : 'HL'}
                    </span>
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">SHORT</span>
                  </div>
                  <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-bold">{top5Spreads[0].annualSpread.toFixed(1)}% APR</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleManualExecution('aster')}
                  disabled={isExecutingAster || isExecutingHL}
                  className="flex-1 relative overflow-hidden px-4 py-3 rounded-lg font-semibold text-white transition-all duration-300 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed shadow-md"
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {isExecutingAster ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Execute Aster ({top5Spreads[0].longExchange === 'aster' ? 'LONG' : 'SHORT'})</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleManualExecution('hyperliquid')}
                  disabled={isExecutingAster || isExecutingHL}
                  className="flex-1 relative overflow-hidden px-4 py-3 rounded-lg font-semibold text-white transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed shadow-md"
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {isExecutingHL ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Execute HL ({top5Spreads[0].longExchange === 'hyperliquid' ? 'LONG' : 'SHORT'})</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Execution Result */}
              {manualExecutionResult && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  manualExecutionResult.success
                    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
                    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {manualExecutionResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      manualExecutionResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    }`}>
                      {manualExecutionResult.exchange.toUpperCase()}: {manualExecutionResult.message}
                    </span>
                  </div>
                  {manualExecutionResult.orderId && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Order ID: {manualExecutionResult.orderId}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Strategy Control Buttons */}
          <div className="flex gap-3 pt-2">
            {!strategyEnabled ? (
              <>
                <button
                  type="button"
                  onClick={handleTestStrategy}
                  disabled={isTestRunning}
                  className="relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {isTestRunning ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        <span>Test Dry-Run</span>
                      </>
                    )}
                  </div>
                </button>
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowRebalanceModal(true)}
                  disabled={isManualRebalancing || rebalanceCooldown > 0}
                  className="flex-1 relative overflow-hidden px-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {isManualRebalancing ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>Rebalancing...</span>
                      </>
                    ) : rebalanceCooldown > 0 ? (
                      <>
                        <Clock className="h-5 w-5" />
                        <span>Available in {rebalanceCooldown}s</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5" />
                        <span>Manual Rebalance</span>
                      </>
                    )}
                  </div>
                </button>
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
              </>
            )}
          </div>

          {/* Manual Rebalance Confirmation Modal */}
          {showRebalanceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <RefreshCw className="h-6 w-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Manual Rebalance</h3>
                </div>

                <p className="text-slate-600 dark:text-gray-300 mb-6">
                  This will immediately recalculate the top 5 funding rate spreads and adjust positions accordingly.
                  This may close existing positions and open new ones.
                </p>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
                  <p className="text-sm text-yellow-400">
                    Are you sure you want to rebalance now?
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRebalanceModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg font-medium bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualRebalance}
                    className="flex-1 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white transition-colors"
                  >
                    Confirm Rebalance
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Test Results Modal */}
          {showTestResults && testResults && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-100 dark:bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${testResults.valid ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {testResults.valid ? (
                        <CheckCircle className="h-6 w-6 text-green-400" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-red-400" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                      Test Results {testResults.valid ? '- Ready to Trade' : '- Issues Found'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowTestResults(false)}
                    className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                  {/* Balances */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-lg p-3">
                      <div className="text-xs text-cyan-600 dark:text-cyan-400 mb-1">Aster Balance</div>
                      <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300">${testResults.asterBalance.toFixed(2)}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-lg p-3">
                      <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Hyperliquid Balance</div>
                      <div className="text-lg font-bold text-purple-700 dark:text-purple-300">${testResults.hyperliquidBalance.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Errors */}
                  {testResults.errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold mb-2">
                        <AlertCircle className="h-4 w-4" />
                        Errors ({testResults.errors.length})
                      </div>
                      <ul className="space-y-1 text-sm text-red-600 dark:text-red-300">
                        {testResults.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {testResults.warnings.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-semibold mb-2">
                        <AlertCircle className="h-4 w-4" />
                        Warnings ({testResults.warnings.length})
                      </div>
                      <ul className="space-y-1 text-sm text-yellow-600 dark:text-yellow-300">
                        {testResults.warnings.map((warn, i) => (
                          <li key={i}>• {warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Selected Spreads */}
                  {testResults.selectedSpreads.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold mb-3">
                        <TrendingUp className="h-4 w-4" />
                        Assets That Would Be Purchased ({testResults.selectedSpreads.length})
                      </div>
                      <div className="space-y-2">
                        {testResults.selectedSpreads.map((spread, i) => (
                          <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                i === 0 ? 'bg-yellow-500 text-black' :
                                i === 1 ? 'bg-gray-300 text-black' :
                                i === 2 ? 'bg-amber-600 text-white' :
                                'bg-slate-500 text-white'
                              }`}>
                                #{i + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{spread.canonical}</div>
                                <div className="text-xs text-slate-500 dark:text-gray-400">
                                  Long: {spread.longExchange} @ {(spread.longRate * 100).toFixed(4)}% | Short: {spread.shortExchange} @ {(spread.shortRate * 100).toFixed(4)}%
                                </div>
                              </div>
                            </div>
                            <div className={`text-lg font-bold ${spread.annualSpread >= minSpreadThreshold ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                              {spread.annualSpread.toFixed(2)}% APR
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debug Logs (collapsible) */}
                  {testResults.debugLogs.length > 0 && (
                    <details className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                      <summary className="cursor-pointer p-3 text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white">
                        Debug Logs ({testResults.debugLogs.length} entries)
                      </summary>
                      <div className="p-3 pt-0 text-xs font-mono text-slate-500 dark:text-gray-400 max-h-40 overflow-y-auto">
                        {testResults.debugLogs.map((log, i) => (
                          <div key={i}>{log}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowTestResults(false)}
                    className="flex-1 px-4 py-2 rounded-lg font-medium bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-white transition-colors"
                  >
                    Close
                  </button>
                  {testResults.valid && (
                    <button
                      onClick={() => {
                        setShowTestResults(false);
                        handleStartStrategy();
                      }}
                      className="flex-1 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white transition-colors"
                    >
                      Start Strategy Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Alert */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-600 dark:text-gray-300">
                <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">How Auto-Arbitrage Works</p>
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
        )}
      </div>

      {/* Active Positions */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setActivePositionsCollapsed(!activePositionsCollapsed)}>
          <div className="flex items-center gap-3">
            <div className="transition-transform duration-200" style={{ transform: activePositionsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              <ChevronDown className="h-5 w-5 text-slate-500 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowDownUp className="h-6 w-6 text-primary-400" />
                Active Arbitrage Positions
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                Currently earning from funding rate spreads
              </p>
            </div>
          </div>
          {strategyPositions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-gray-400">Total P&L</div>
                <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {!activePositionsCollapsed && (strategyPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Long Side</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Short Side</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Spread</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Position Size</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">P&L</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Funding Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {strategyPositions.map((position) => (
                  <tr key={position.id} className="hover:bg-slate-100 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                          position.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                          position.rank === 2 ? 'bg-gray-300/20 text-slate-600 dark:text-gray-300' :
                          position.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-500/20 text-slate-500 dark:text-gray-400'
                        }`}>
                          #{position.rank}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-800 dark:text-white">{position.canonical}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{position.allocation}% allocation</div>
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
                        <div className="text-xs text-slate-500 dark:text-slate-400">${position.longCurrentPrice.toFixed(2)}</div>
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
                        <div className="text-xs text-slate-500 dark:text-slate-400">${position.shortCurrentPrice.toFixed(2)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className={`inline-flex flex-col items-center gap-1 px-3 py-2 rounded-lg font-bold ${
                        position.spread >= 1 ? 'bg-emerald-500/20 text-emerald-400' :
                        position.spread >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                        position.spread >= 0 ? 'bg-gray-500/20 text-slate-500 dark:text-gray-400' :
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
                      <div className="font-bold text-slate-800 dark:text-white">${(position.longSize + position.shortSize).toFixed(0)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
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
                      <div className="text-xs text-slate-500 dark:text-gray-500">
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
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Active Positions</h3>
            <p className="text-slate-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {strategyEnabled
                ? 'Waiting for funding rate data and optimal entry opportunities...'
                : 'Start the auto-arbitrage strategy to begin trading funding rate spreads.'}
            </p>
          </div>
        ))}
      </div>

      {/* Funding History (Closed Positions) */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setFundingHistoryCollapsed(!fundingHistoryCollapsed)}>
          <div className="flex items-center gap-3">
            <div className="transition-transform duration-200" style={{ transform: fundingHistoryCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              <ChevronDown className="h-5 w-5 text-slate-500 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <HistoryIcon className="h-6 w-6 text-purple-400" />
                Funding History
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                Closed arbitrage positions and their performance
              </p>
            </div>
          </div>
          {closedPositions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-gray-400">Total Positions</div>
                <div className="text-lg font-bold text-purple-400">
                  {closedPositions.length}
                </div>
              </div>
            </div>
          )}
        </div>

        {!fundingHistoryCollapsed && (closedPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Entry/Exit Spread</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Duration</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Position Size</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">P&L</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Funding Earned</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {closedPositions.map((position) => {
                  const duration = (position.exitTime! - position.entryTime) / (60 * 60 * 1000);
                  return (
                    <tr key={position.id} className="hover:bg-slate-100 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800 dark:text-white">{position.canonical}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Rank #{position.rank} • {position.allocation}%
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="space-y-1">
                          <div className="text-sm text-slate-700 dark:text-slate-200">
                            Entry: <span className="text-green-400">{position.entrySpread.toFixed(4)}%</span>
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200">
                            Exit: <span className={position.spread >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {position.spread.toFixed(4)}%
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm text-slate-700 dark:text-slate-200">{duration.toFixed(1)}h</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(position.exitTime!).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-bold text-slate-800 dark:text-white">
                          ${(position.longSize + position.shortSize).toFixed(0)}
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
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          position.spread < 0 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {position.spread < 0 ? 'Negative Spread' : 'Rebalanced'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-slate-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-gray-400">No closed positions yet</p>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">History will appear once positions are closed</p>
          </div>
        ))}
      </div>

      {/* Strategy Info */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">Multi-Exchange Funding Strategy Overview</h3>
        <div className="space-y-4 text-sm text-slate-500 dark:text-gray-400">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-slate-800 dark:text-white">What is Funding?</strong> Funding rates are periodic payments
              exchanged between long and short positions in perpetual futures markets. When funding is positive,
              longs pay shorts. When negative, shorts pay longs. This strategy captures these payments across
              multiple exchanges simultaneously.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-cyan-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-slate-800 dark:text-white">Dual-Exchange Coverage:</strong> By monitoring funding rates across
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
              <strong className="text-slate-800 dark:text-white">Liquidity & Volume Checks:</strong> Before executing any trade, the system
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
              <strong className="text-slate-800 dark:text-white">Real-Time Data Monitoring:</strong> The strategy uses WebSocket and REST
              connections to each exchange for instant funding rate updates. Aster provides mark price streams via WebSocket,
              HyperLiquid and Lighter use REST API polling for funding data. All data is processed in real-time to identify
              opportunities the moment they arise.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-slate-800 dark:text-white">Automated Entry & Exit:</strong> When auto-execute is enabled and a
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
              <strong className="text-slate-800 dark:text-white">Risk Management:</strong> The strategy includes multiple safety features:
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
            <h3 className="text-sm font-bold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Signal className="h-4 w-4" />
              Connection Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">WebSocket</div>
                <div className={`text-lg font-bold flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Funding Rates</div>
                <div className="text-lg font-bold text-cyan-400">{fundingRates.length} active</div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Matched Pairs</div>
                <div className="text-lg font-bold text-purple-400">{totalMatched} pairs</div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4">
                <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Arbitrage Opportunities</div>
                <div className="text-lg font-bold text-emerald-400">{arbitrageOpportunities.length} found</div>
              </div>
            </div>
          </div>

          {/* Wallet Configuration */}
          <div>
            <h3 className="text-sm font-bold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet Configuration
            </h3>
            <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Aster Wallet</div>
                  <div className="font-mono text-sm">
                    {asterWallet ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-cyan-400 truncate">{asterWallet}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-slate-500 dark:text-gray-500">Not configured</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">
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
                  <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">Hyperliquid Wallet</div>
                  <div className="font-mono text-sm">
                    {hyperliquidWallet ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-purple-400 truncate">{hyperliquidWallet}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-slate-500 dark:text-gray-500">Not configured</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                    Balance: ${hyperliquidBalance.toFixed(2)}
                    {loadingBalances ? ' (Loading...)' : hyperliquidBalance === 0 && hyperliquidWallet ? ' (Wallet empty - deposit funds to trade)' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Configuration */}
          <div>
            <h3 className="text-sm font-bold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Strategy Configuration
            </h3>
            <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">Status</div>
                  <div className={`text-sm font-bold ${strategyEnabled ? 'text-green-400' : 'text-slate-500 dark:text-gray-500'}`}>
                    {strategyEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">Total Capital</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">${totalCapital.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">Min APR</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{minSpreadThreshold}%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">Excluded Symbols</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{excludedSymbols.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Issue Detection */}
          <div>
            <h3 className="text-sm font-bold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
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
                    <span className="text-slate-600 dark:text-gray-300"> Not receiving live funding rate updates. Refresh the page to reconnect.</span>
                  </div>
                </div>
              )}

              {/* No wallet addresses */}
              {!asterWallet && !hyperliquidWallet && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-yellow-400">No Wallet Addresses:</strong>
                    <span className="text-slate-600 dark:text-gray-300"> Configure wallet addresses in the "Auto-Arbitrage Strategy" section to enable balance tracking.</span>
                  </div>
                </div>
              )}

              {/* Spreads below threshold */}
              {strategyEnabled && top5Spreads.length > 0 && top5Spreads.every(s => s.annualSpread < minSpreadThreshold) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-yellow-400">No Qualifying Spreads:</strong>
                    <span className="text-slate-600 dark:text-gray-300"> All spreads are below {minSpreadThreshold}% APR threshold. Top spread is {top5Spreads[0].annualSpread.toFixed(2)}% APR ({top5Spreads[0].canonical}). Consider lowering the threshold or wait for higher volatility.</span>
                  </div>
                </div>
              )}

              {/* Strategy active with qualifying spreads */}
              {strategyEnabled && top5Spreads.some(s => s.annualSpread >= minSpreadThreshold) && strategyPositions.length === 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-green-400">Ready to Trade:</strong>
                    <span className="text-slate-600 dark:text-gray-300"> {top5Spreads.filter(s => s.annualSpread >= minSpreadThreshold).length} spreads qualify. Next rebalance in {getTimeUntilRebalance()}.</span>
                  </div>
                </div>
              )}

              {/* Everything OK */}
              {isConnected && (asterWallet || hyperliquidWallet) && fundingRates.length > 0 && !strategyEnabled && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-blue-400">System Ready:</strong>
                    <span className="text-slate-600 dark:text-gray-300"> All systems operational. Click "Start Auto-Strategy" to begin trading.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Strategy Execution Log */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-600/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Strategy Execution Log</h3>
                <span className="text-xs text-slate-500 dark:text-gray-400">
                  (Last {executionLogs.length} events)
                </span>
              </div>
              <button
                onClick={() => setExecutionLogs([])}
                className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-600 dark:text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
              >
                Clear Logs
              </button>
            </div>

            <div className="bg-slate-950/50 rounded-lg border border-slate-700/50 p-4 max-h-96 overflow-y-auto font-mono text-xs">
              {executionLogs.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-gray-500 py-8">
                  No execution logs yet. Start the strategy to see live execution details.
                </div>
              ) : (
                <div className="space-y-1">
                  {executionLogs.map((log, idx) => {
                    const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    const colorClass =
                      log.type === 'error' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                      log.type === 'warning' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                      log.type === 'success' ? 'text-green-400 bg-green-500/10 border-green-500/30' :
                      'text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/30';

                    const icon =
                      log.type === 'error' ? '❌' :
                      log.type === 'warning' ? '⚠️' :
                      log.type === 'success' ? '✅' :
                      log.message.includes('🎯') ? '🎯' :
                      log.message.includes('🔄') ? '🔄' :
                      log.message.includes('🚨') ? '🚨' :
                      log.message.includes('💰') ? '💰' :
                      log.message.includes('📊') ? '📊' :
                      '📝';

                    return (
                      <div
                        key={idx}
                        className={`px-3 py-2 rounded border ${colorClass} transition-all`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500 dark:text-gray-500 select-none">[{time}]</span>
                          <span className="select-none">{icon}</span>
                          <span className="flex-1" style={{ whiteSpace: 'pre-wrap' }}>
                            {log.message}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500 dark:text-gray-500 flex items-center gap-2">
              <span>💡 Tip: This log shows real-time strategy execution details without needing the browser console.</span>
            </div>
          </div>

          {/* Raw Data (for debugging) */}
          <details className="bg-slate-100 dark:bg-slate-700/30 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-slate-600 dark:text-gray-300 hover:text-white transition-colors">
              Show Raw Debugging Data
            </summary>
            <div className="px-4 pb-4 space-y-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-slate-500 dark:text-gray-400 mb-1">Loaded Wallet Addresses (localStorage):</div>
                <div className="text-cyan-400">Aster: {localStorage.getItem('aster_wallet_address') || 'null'}</div>
                <div className="text-purple-400">Hyperliquid: {localStorage.getItem('hyperliquid_wallet_address') || 'null'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-slate-500 dark:text-gray-400 mb-1">Aster API Configuration:</div>
                <div className="text-slate-800 dark:text-white">API Key: {localStorage.getItem('aster_api_key') ? localStorage.getItem('aster_api_key')!.substring(0, 12) + '...' : 'not set'}</div>
                <div className="text-slate-800 dark:text-white">API Secret: {localStorage.getItem('aster_api_secret') ? '***' + localStorage.getItem('aster_api_secret')!.slice(-4) : 'not set'}</div>
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
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-slate-500 dark:text-gray-400 mb-1">State Values:</div>
                <div className="text-slate-800 dark:text-white">asterWallet: {asterWallet || 'empty'}</div>
                <div className="text-slate-800 dark:text-white">hyperliquidWallet: {hyperliquidWallet || 'empty'}</div>
                <div className="text-slate-800 dark:text-white">loadingBalances: {loadingBalances.toString()}</div>
                <div className="text-slate-800 dark:text-white">asterBalance: ${asterBalance.toFixed(2)}</div>
                <div className="text-slate-800 dark:text-white">hyperliquidBalance: ${hyperliquidBalance.toFixed(2)}</div>
                {hyperliquidBalanceError && (
                  <div className="text-red-400 mt-2">HL Error: {hyperliquidBalanceError}</div>
                )}
              </div>
              {/* Balance Analysis Section */}
              {hlDebugAnalysis.length > 0 && (
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded p-4 font-mono text-xs">
                  <div className="text-cyan-400 mb-3 font-bold text-sm flex items-center gap-2">
                    <span>🔍</span>
                    <span>BALANCE DETECTION ANALYSIS</span>
                  </div>
                  <div className="space-y-1">
                    {hlDebugAnalysis.map((line, idx) => (
                      <div
                        key={idx}
                        className={`${
                          line.includes('❌') || line.includes('Failed') ? 'text-red-400' :
                          line.includes('✅') || line.includes('success') ? 'text-green-400' :
                          line.includes('⚠️') ? 'text-yellow-400' :
                          line.includes('💰') || line.includes('💵') ? 'text-emerald-400 font-bold' :
                          line.includes('📊') ? 'text-cyan-400 font-bold mt-2' :
                          'text-slate-600 dark:text-gray-300'
                        }`}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw API Response Section */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 font-mono text-xs">
                <div className="text-slate-500 dark:text-gray-400 mb-1">HyperLiquid API Response (Raw JSON):</div>
                {hlApiResponse ? (
                  <pre className="text-white overflow-x-auto text-[10px] max-h-96 overflow-y-auto">
                    {JSON.stringify(hlApiResponse, null, 2)}
                  </pre>
                ) : (
                  <div className="text-slate-500 dark:text-gray-500">No response yet - click refresh balances button</div>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
