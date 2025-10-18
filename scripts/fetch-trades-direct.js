#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const querystring = require('querystring');

// Your API credentials
const API_KEY = 'eOZ8yHjRMKC2N3SFTak-wvq8jvANN/7LEqnz9j0YhPHaxLxiKQT7U-J2';
const API_SECRET = 'HkQdSAfm/925WQoj6hNru4EXlP4v5sjjq-ILvRjT2AlwTVHxzkqakRu7qL-rKOvFTMPvRpazHzIgXyynBt-Z64nQQ==';

function krakenRequest(path, params = {}) {
    return new Promise((resolve, reject) => {
        const nonce = Date.now() * 1000;
        params.nonce = nonce;

        const postData = querystring.stringify(params);

        // Create signature
        const secret = Buffer.from(API_SECRET, 'base64');
        const hash = crypto.createHash('sha256');
        const hmac = crypto.createHmac('sha512', secret);

        const hashDigest = hash.update(nonce + postData).digest('binary');
        const message = path + hashDigest;
        const signature = hmac.update(message, 'binary').digest('base64');

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

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error && json.error.length > 0) {
                        reject(new Error('Kraken API Error: ' + json.error.join(', ')));
                    } else {
                        resolve(json.result);
                    }
                } catch (error) {
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
    console.log('==========================================');
    console.log('🤖 Fetching Your Kraken Trade History');
    console.log('==========================================\n');

    try {
        console.log('⏳ Fetching trades from Kraken...\n');

        const trades = await krakenRequest('/0/private/TradesHistory', {
            trades: true
        });

        console.log('✅ Successfully fetched trades!\n');

        // Group trades by symbol
        const grouped = {};
        let buyTradeCount = 0;

        Object.entries(trades.trades || {}).forEach(([txid, trade]) => {
            // Only process BUY trades
            if (trade.type !== 'buy') return;

            buyTradeCount++;

            // Normalize symbol
            let symbol = trade.pair;

            // Remove X and Z prefixes that Kraken uses
            symbol = symbol.replace(/^X/, '').replace(/^Z/, '');

            // Common replacements
            const replacements = {
                'XBTUSDT': 'BTC/USD',
                'XBTUSD': 'BTC/USD',
                'XXBTZUSD': 'BTC/USD',
                'ETHUSDT': 'ETH/USD',
                'ETHUSD': 'ETH/USD',
                'XETHZUSD': 'ETH/USD',
                'SOLUSDT': 'SOL/USD',
                'SOLUSD': 'SOL/USD',
                'XRPUSDT': 'XRP/USD',
                'XRPUSD': 'XRP/USD',
                'ADAUSDT': 'ADA/USD',
                'ADAUSD': 'ADA/USD',
                'DOGEUSDT': 'DOGE/USD',
                'DOGEUSD': 'DOGE/USD',
                'XDGUSD': 'DOGE/USD'
            };

            symbol = replacements[symbol] || symbol;

            // If no replacement found, try to parse it
            if (!symbol.includes('/')) {
                // Try to extract crypto/fiat pair
                const match = symbol.match(/^([A-Z]+)(USD|USDT|EUR)$/);
                if (match) {
                    symbol = `${match[1]}/${match[2] === 'USDT' ? 'USD' : match[2]}`;
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

        console.log(`Found ${buyTradeCount} BUY trades across ${Object.keys(grouped).length} symbols\n`);

        // Display summary
        console.log('Trade Summary by Symbol:');
        console.log('----------------------------------------');
        Object.entries(grouped).forEach(([symbol, trades]) => {
            trades.sort((a, b) => a.timestamp - b.timestamp);
            const totalCost = trades.reduce((sum, t) => sum + parseFloat(t.cost), 0);
            console.log(`${symbol.padEnd(15)} ${trades.length.toString().padStart(3)} trades  $${totalCost.toFixed(2).padStart(10)}`);
        });
        console.log('----------------------------------------\n');

        // Generate bots JSON
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

            const firstTrade = trades[0];
            const initialAmount = Math.round(parseFloat(firstTrade.cost));

            return {
                symbol,
                initialOrderAmount: initialAmount || 10,
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
                comment: `Generated from ${trades.length} historical trades`,
                entries
            };
        });

        const output = {
            instructions: "Auto-generated from your Kraken trade history",
            generatedAt: new Date().toISOString(),
            totalSymbols: bots.length,
            totalTrades: buyTradeCount,
            bots
        };

        // Save to file
        const jsonPath = 'scripts/historical-bots.json';
        fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

        console.log(`✅ Created ${jsonPath}\n`);
        console.log('Bot configurations generated:');
        bots.forEach(bot => {
            console.log(`  - ${bot.symbol}: ${bot.entries.length} entries, $${bot.entries.reduce((s, e) => s + e.orderAmount, 0).toFixed(2)} total`);
        });

        console.log('\n========================================');
        console.log('✅ Ready to populate database!');
        console.log('========================================\n');
        console.log('Next step: Run the population script');
        console.log('  npx ts-node scripts/populate-from-json.ts\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

main();
