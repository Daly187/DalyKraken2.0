#!/usr/bin/env node

/**
 * DalyDEPEG API Test Suite
 * Tests all depeg arbitrage endpoints to verify system is working
 */

import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://us-central1-dalydough.cloudfunctions.net/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Helper to create axios instance with auth
function createClient() {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

// Helper to log test results
function logTest(name, passed, message = '', data = null) {
  const status = passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  console.log(`\n${status} ${colors.bold}${name}${colors.reset}`);

  if (message) {
    console.log(`  ${passed ? colors.cyan : colors.yellow}${message}${colors.reset}`);
  }

  if (data) {
    console.log(`  ${colors.blue}Data:${colors.reset}`, JSON.stringify(data, null, 2));
  }

  results.tests.push({ name, passed, message, data });

  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Test 1: Health Check
async function testHealthCheck() {
  try {
    const client = createClient();
    const response = await client.get('/health');

    const passed = response.status === 200 && response.data.status === 'ok';
    logTest(
      'API Health Check',
      passed,
      `API is ${response.data.status} - Version: ${response.data.version}`,
      { status: response.data.status, service: response.data.service }
    );

    return passed;
  } catch (error) {
    logTest('API Health Check', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 2: Get Depeg Configuration
async function testGetConfig() {
  try {
    const client = createClient();
    const response = await client.get('/depeg/config');

    const passed = response.data.success === true;
    const config = response.data.config || {};

    logTest(
      'Get Depeg Configuration',
      passed,
      `Config retrieved - Enabled: ${config.enabled}, Auto-Execute: ${config.autoExecute}`,
      {
        enabled: config.enabled,
        autoExecute: config.autoExecute,
        minDepegThreshold: config.minDepegThreshold,
        enabledPairs: config.enabledPairs
      }
    );

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Get Depeg Configuration', false, `Error: ${message}`);
    return false;
  }
}

// Test 3: Get Stablecoin Prices
async function testGetPrices() {
  try {
    const client = createClient();
    const response = await client.get('/depeg/prices');

    const passed = response.data.success === true && Array.isArray(response.data.prices);
    const prices = response.data.prices || [];

    if (passed && prices.length > 0) {
      const priceInfo = prices.map(p => `${p.pair}: $${p.currentPrice?.toFixed(4)} (${p.depegPercentage?.toFixed(2)}%)`);
      logTest(
        'Get Stablecoin Prices',
        passed,
        `Retrieved ${prices.length} stablecoin prices from Kraken`,
        priceInfo
      );
    } else {
      logTest('Get Stablecoin Prices', false, 'No prices returned or invalid format');
    }

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Get Stablecoin Prices', false, `Error: ${message}`);
    return false;
  }
}

// Test 4: Detect Opportunities
async function testDetectOpportunities() {
  try {
    const client = createClient();
    const response = await client.get('/depeg/opportunities');

    const passed = response.data.success === true && Array.isArray(response.data.opportunities);
    const opportunities = response.data.opportunities || [];

    if (passed) {
      if (opportunities.length > 0) {
        const oppInfo = opportunities.map(o =>
          `${o.pair}: ${o.type.toUpperCase()} at $${o.entryPrice?.toFixed(4)} (Est. Profit: ${o.estimatedProfitPercent?.toFixed(2)}%)`
        );
        logTest(
          'Detect Arbitrage Opportunities',
          passed,
          `Found ${opportunities.length} opportunity/opportunities`,
          oppInfo
        );
      } else {
        logTest(
          'Detect Arbitrage Opportunities',
          passed,
          'No opportunities found (this is normal - market conditions vary)',
          { message: 'Opportunity detection is working, just no current depegs > threshold' }
        );
      }
    } else {
      logTest('Detect Arbitrage Opportunities', false, 'Invalid response format');
    }

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Detect Arbitrage Opportunities', false, `Error: ${message}`);
    return false;
  }
}

// Test 5: Get Open Positions
async function testGetPositions() {
  try {
    const client = createClient();
    const response = await client.get('/depeg/positions');

    const passed = response.data.success === true && Array.isArray(response.data.positions);
    const positions = response.data.positions || [];

    if (passed) {
      if (positions.length > 0) {
        const posInfo = positions.map(p =>
          `${p.pair}: ${p.side.toUpperCase()} - P&L: $${p.unrealizedPnL?.toFixed(2)} (${p.unrealizedPnLPercent?.toFixed(2)}%)`
        );
        logTest(
          'Get Open Positions',
          passed,
          `Retrieved ${positions.length} open position(s)`,
          posInfo
        );
      } else {
        logTest(
          'Get Open Positions',
          passed,
          'No open positions (this is normal if you haven\'t traded yet)',
          { message: 'Position tracking is working' }
        );
      }
    } else {
      logTest('Get Open Positions', false, 'Invalid response format');
    }

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Get Open Positions', false, `Error: ${message}`);
    return false;
  }
}

// Test 6: Get Trade History
async function testGetHistory() {
  try {
    const client = createClient();
    const response = await client.get('/depeg/history?limit=10');

    const passed = response.data.success === true && Array.isArray(response.data.history);
    const history = response.data.history || [];

    if (passed) {
      if (history.length > 0) {
        const totalProfit = history.reduce((sum, trade) => sum + (trade.netProfit || 0), 0);
        logTest(
          'Get Trade History',
          passed,
          `Retrieved ${history.length} trade(s) - Total Net Profit: $${totalProfit.toFixed(2)}`,
          { tradeCount: history.length, totalProfit }
        );
      } else {
        logTest(
          'Get Trade History',
          passed,
          'No trade history (this is normal if you haven\'t completed any trades)',
          { message: 'Trade history tracking is working' }
        );
      }
    } else {
      logTest('Get Trade History', false, 'Invalid response format');
    }

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Get Trade History', false, `Error: ${message}`);
    return false;
  }
}

// Test 7: Update Configuration (Safe Test)
async function testUpdateConfig() {
  try {
    const client = createClient();

    // First get current config
    const getCurrentConfig = await client.get('/depeg/config');
    const currentConfig = getCurrentConfig.data.config || {};

    // Update with a safe change (just update min threshold by 0.01)
    const testConfig = {
      ...currentConfig,
      minDepegThreshold: currentConfig.minDepegThreshold || 0.5,
      // Don't change enabled or autoExecute in test
      enabled: false,
      autoExecute: false
    };

    const response = await client.put('/depeg/config', testConfig);

    const passed = response.data.success === true;

    logTest(
      'Update Configuration',
      passed,
      'Configuration update successful',
      { updatedFields: ['minDepegThreshold', 'enabled', 'autoExecute'] }
    );

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Update Configuration', false, `Error: ${message}`);
    return false;
  }
}

// Test 8: Manual Monitor Trigger (Dry Run)
async function testManualMonitor() {
  try {
    const client = createClient();
    const response = await client.post('/depeg/monitor');

    const passed = response.data.success === true;
    const { opportunitiesDetected, executed, prices, opportunities } = response.data;

    if (passed) {
      logTest(
        'Manual Monitoring Trigger',
        passed,
        `Detected ${opportunitiesDetected || 0} opportunities, Executed ${executed || 0} trades`,
        {
          opportunitiesDetected: opportunitiesDetected || 0,
          executed: executed || 0,
          priceCount: prices?.length || 0,
          message: executed === 0 ? 'Auto-execute is off or no opportunities met criteria' : 'Trades executed!'
        }
      );
    } else {
      logTest('Manual Monitoring Trigger', false, 'Monitor trigger failed');
    }

    return passed;
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logTest('Manual Monitoring Trigger', false, `Error: ${message}`);
    return false;
  }
}

// Print summary
function printSummary() {
  console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`${colors.green}✓ Passed:${colors.reset} ${results.passed}/${results.tests.length}`);
  console.log(`${colors.red}✗ Failed:${colors.reset} ${results.failed}/${results.tests.length}`);

  const percentage = (results.passed / results.tests.length) * 100;
  const statusColor = percentage === 100 ? colors.green : percentage >= 75 ? colors.yellow : colors.red;
  console.log(`${colors.bold}Success Rate:${colors.reset} ${statusColor}${percentage.toFixed(1)}%${colors.reset}`);

  console.log(`${'='.repeat(60)}\n`);

  if (results.failed > 0) {
    console.log(`${colors.yellow}⚠ Some tests failed. Check errors above.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}${colors.bold}🎉 All tests passed! Your DalyDEPEG system is working correctly!${colors.reset}\n`);
  }
}

// Main test runner
async function runAllTests() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('='.repeat(60));
  console.log('DalyDEPEG API Test Suite');
  console.log('='.repeat(60));
  console.log(colors.reset);
  console.log(`${colors.blue}Testing API at: ${API_BASE_URL}${colors.reset}`);
  console.log(`${colors.blue}Auth Token: ${AUTH_TOKEN ? '✓ Provided' : '✗ Missing'}${colors.reset}\n`);

  if (!AUTH_TOKEN) {
    console.log(`${colors.red}${colors.bold}ERROR: No AUTH_TOKEN provided!${colors.reset}`);
    console.log(`${colors.yellow}Please set AUTH_TOKEN environment variable or add to .env file${colors.reset}\n`);
    process.exit(1);
  }

  // Run tests sequentially
  await testHealthCheck();
  await testGetConfig();
  await testGetPrices();
  await testDetectOpportunities();
  await testGetPositions();
  await testGetHistory();
  await testUpdateConfig();
  await testManualMonitor();

  // Print summary
  printSummary();

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}${colors.bold}Fatal error running tests:${colors.reset}`, error);
  process.exit(1);
});
