#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const querystring = require('querystring');

// Cleaned API credentials (removed line breaks and extra characters)
const API_KEY = 'eOZ8yHjRMKC2N3SFTak-wvq8jvANN/7LEqnz9j0YhPHaxLxiKQT7U-J2';

// Private key with line breaks removed - combined as one string
const API_SECRET = 'HkQdSAfm/925WQoj6hNru4EXlP4v5sjjq-ILvRjT2AlwTVHxzkqakRu7qL-rKOvFTMPvRpazHzIgXyynBt-Z64nQQ==';

console.log('Testing with cleaned keys...');
console.log('API Key length:', API_KEY.length);
console.log('API Secret length:', API_SECRET.length);

function krakenRequest(path, params = {}) {
    return new Promise((resolve, reject) => {
        const nonce = Date.now() * 1000;
        params.nonce = nonce;

        const postData = querystring.stringify(params);

        // Create signature using Kraken's required method
        const secret = Buffer.from(API_SECRET, 'base64');
        const hash = crypto.createHash('sha256');
        const hmac = crypto.createHmac('sha512', secret);

        const hashDigest = hash.update(nonce + postData).digest();
        const message = Buffer.concat([Buffer.from(path, 'utf8'), hashDigest]);
        const signature = hmac.update(message).digest('base64');

        const options = {
            hostname: 'api.kraken.com',
            path: path,
            method: 'POST',
            headers: {
                'API-Key': API_KEY,
                'API-Sign': signature,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'DalyKraken/2.0'
            }
        };

        console.log('\nMaking request to:', path);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error && json.error.length > 0) {
                        console.error('API returned errors:', json.error);
                        reject(new Error('Kraken API Error: ' + json.error.join(', ')));
                    } else {
                        resolve(json.result);
                    }
                } catch (error) {
                    console.error('Failed to parse response:', data);
                    reject(new Error('Parse error: ' + error.message));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error('Request error: ' + error.message));
        });

        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('\n==========================================');
    console.log('🤖 DalyKraken Trade Fetcher');
    console.log('==========================================\n');

    try {
        // First test with account balance (simpler endpoint)
        console.log('Testing API connection with Balance endpoint...');
        try {
            const balance = await krakenRequest('/0/private/Balance');
            console.log('✅ API connection successful!');
            console.log('Account balance:', Object.keys(balance).length, 'assets\n');
        } catch (error) {
            console.error('Balance test failed:', error.message);
            console.log('\nTrying TradesHistory anyway...\n');
        }

        // Fetch trades
        console.log('⏳ Fetching trade history...');
        const trades = await krakenRequest('/0/private/TradesHistory');

        console.log('✅ Successfully fetched trades!\n');

        // Process trades
        const tradesList = Object.entries(trades.trades || {});
        console.log(`Total trades found: ${tradesList.length}`);

        // Filter BUY trades only
        const buyTrades = tradesList.filter(([_, trade]) => trade.type === 'buy');
        console.log(`BUY trades: ${buyTrades.length}\n`);

        // Group by symbol
        const grouped = {};
        buyTrades.forEach(([txid, trade]) => {
            let symbol = trade.pair;

            // Normalize symbol names
            const symbolMap = {
                'XXBTZUSD': 'BTC/USD',
                'XBTUSDT': 'BTC/USD',
                'XBTUSD': 'BTC/USD',
                'XETHZUSD': 'ETH/USD',
                'ETHUSDT': 'ETH/USD',
                'ETHUSD': 'ETH/USD',
                'SOLUSD': 'SOL/USD',
                'SOLUSDT': 'SOL/USD',
                'XRPUSD': 'XRP/USD',
                'ADAUSD': 'ADA/USD',
                'DOGEUSD': 'DOGE/USD',
                'XDGUSD': 'DOGE/USD',
            };

            symbol = symbolMap[symbol] || symbol;

            // Remove X/Z prefixes
            symbol = symbol.replace(/^X/, '').replace(/^Z/, '');

            // Try to format as CRYPTO/USD
            if (!symbol.includes('/')) {
                const match = symbol.match(/^([A-Z]+)(USD|USDT)$/);
                if (match) {
                    symbol = `${match[1]}/USD`;
                }
            }

            if (!grouped[symbol]) {
                grouped[symbol] = [];
            }

            grouped[symbol].push({
                ...trade,
                txid,
                timestamp: new Date(trade.time * 1000)
            });
        });

        console.log('Trades grouped by symbol:');
        console.log('----------------------------------------');
        Object.entries(grouped).forEach(([symbol, trades]) => {
            trades.sort((a, b) => a.timestamp - b.timestamp);
            const totalCost = trades.reduce((sum, t) => sum + parseFloat(t.cost), 0);
            console.log(`${symbol.padEnd(15)} ${trades.length.toString().padStart(3)} trades  Total: $${totalCost.toFixed(2)}`);
        });
        console.log('----------------------------------------\n');

        // Generate bots
        const bots = Object.entries(grouped).map(([symbol, trades]) => {
            trades.sort((a, b) => a.timestamp - b.timestamp);

            const entries = trades.map((trade, index) => ({
                entryNumber: index + 1,
                orderAmount: parseFloat(trade.cost),
                price: parseFloat(trade.price),
                quantity: parseFloat(trade.vol),
                timestamp: trade.timestamp.toISOString(),
                orderId: trade.ordertxid || trade.txid,
                txid: trade.txid,
                status: "filled"
            }));

            return {
                symbol,
                initialOrderAmount: Math.max(1, Math.round(parseFloat(trades[0].cost))),
                tradeMultiplier: 2,
                reEntryCount: 8,
                stepPercent: 1,
                stepMultiplier: 2,
                tpTarget: 3,
                supportResistanceEnabled: false,
                reEntryDelay: 888,
                trendAlignmentEnabled: true,
                status: "active",
                userId: "default-user",
                comment: `${trades.length} historical trades from ${trades[0].timestamp.toLocaleDateString()} to ${trades[trades.length-1].timestamp.toLocaleDateString()}`,
                entries
            };
        });

        const output = {
            instructions: "Auto-generated from Kraken trade history",
            generatedAt: new Date().toISOString(),
            totalSymbols: bots.length,
            totalBuyTrades: buyTrades.length,
            bots
        };

        // Save
        const outputPath = 'scripts/historical-bots.json';
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        console.log(`✅ Generated ${outputPath}`);
        console.log(`\nCreated ${bots.length} bot configurations with ${buyTrades.length} total trades\n`);

        console.log('========================================');
        console.log('✅ Ready to populate database!');
        console.log('========================================');
        console.log('\nNext: Run the population script:');
        console.log('  npx ts-node scripts/populate-from-json.ts\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nPlease verify your API keys are correct.');
        console.error('Make sure they have "Query Funds" and "Query Open/Closed Orders" permissions.\n');
        process.exit(1);
    }
}

main();
