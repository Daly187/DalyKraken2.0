#!/usr/bin/env node

/**
 * Automated Trade Fetcher and Bot Populator
 *
 * This script will:
 * 1. Prompt you for Kraken API keys
 * 2. Fetch your trade history from Kraken
 * 3. Auto-generate the historical-bots.json file
 * 4. Run the population script
 */

const readline = require('readline');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function getKrakenTrades(apiKey, apiSecret) {
    return new Promise((resolve, reject) => {
        const path = '/0/private/TradesHistory';
        const nonce = Date.now() * 1000;
        const postData = `nonce=${nonce}`;

        // Generate signature
        const message = path + crypto.createHash('sha256').update(nonce + postData).digest();
        const signature = crypto
            .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
            .update(message)
            .digest('base64');

        const options = {
            hostname: 'api.kraken.com',
            path: path,
            method: 'POST',
            headers: {
                'API-Key': apiKey,
                'API-Sign': signature,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error && json.error.length > 0) {
                        reject(new Error(json.error.join(', ')));
                    } else {
                        resolve(json.result);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function groupTradesBySymbol(trades) {
    const grouped = {};

    Object.entries(trades.trades || {}).forEach(([txid, trade]) => {
        // Only process BUY trades
        if (trade.type !== 'buy') return;

        // Normalize symbol names
        let symbol = trade.pair
            .replace(/^X/, '')
            .replace(/^Z/, '')
            .replace(/XBT/, 'BTC')
            .replace(/XDG/, 'DOGE');

        // Format as CRYPTO/USD
        if (!symbol.includes('/')) {
            symbol = symbol.replace(/(BTC|ETH|SOL|XRP|ADA|DOGE|DOT|LINK|UNI|AVAX|ATOM|LTC|BCH|XLM|ALGO|NEAR|SAND|MANA|GRT|FIL)(.*)/, '$1/$2');
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

    // Sort each group by time
    Object.keys(grouped).forEach(symbol => {
        grouped[symbol].sort((a, b) => a.timestamp - b.timestamp);
    });

    return grouped;
}

function generateBotsJSON(groupedTrades) {
    const bots = Object.entries(groupedTrades).map(([symbol, trades]) => {
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

        const initialAmount = Math.round(parseFloat(trades[0].cost));

        return {
            symbol,
            initialOrderAmount: initialAmount,
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
            entries
        };
    });

    return {
        instructions: "Auto-generated from Kraken trade history on " + new Date().toISOString(),
        bots,
        generatedAt: new Date().toISOString()
    };
}

async function main() {
    console.log('==========================================');
    console.log('🤖 DalyDCA Automated Bot Population');
    console.log('==========================================\n');

    try {
        // Check if service account key exists
        if (!fs.existsSync('backend/functions/serviceAccountKey.json')) {
            console.error('❌ Firebase service account key not found!');
            console.log('Please download it from Firebase Console and save as:');
            console.log('backend/functions/serviceAccountKey.json\n');
            process.exit(1);
        }

        console.log('✅ Firebase service account key found\n');

        // Get API keys
        console.log('Please enter your Kraken API credentials:');
        const apiKey = await question('API Key: ');
        const apiSecret = await question('API Secret (hidden): ');

        if (!apiKey || !apiSecret) {
            console.error('\n❌ API credentials are required');
            process.exit(1);
        }

        console.log('\n⏳ Fetching trade history from Kraken...');
        const trades = await getKrakenTrades(apiKey.trim(), apiSecret.trim());

        const grouped = groupTradesBySymbol(trades);
        const symbolCount = Object.keys(grouped).length;
        const totalTrades = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

        console.log(`✅ Found ${totalTrades} BUY trades across ${symbolCount} symbols\n`);

        // Display summary
        console.log('Trade Summary:');
        console.log('----------------------------------------');
        Object.entries(grouped).forEach(([symbol, trades]) => {
            console.log(`${symbol}: ${trades.length} trades`);
        });
        console.log('----------------------------------------\n');

        // Generate JSON
        console.log('⏳ Generating historical-bots.json...');
        const botsData = generateBotsJSON(grouped);
        const jsonPath = 'scripts/historical-bots.json';
        fs.writeFileSync(jsonPath, JSON.stringify(botsData, null, 2));
        console.log(`✅ Created ${jsonPath}\n`);

        // Ask if user wants to populate now
        const populate = await question('Do you want to populate the database now? (yes/no): ');

        if (populate.toLowerCase() === 'yes' || populate.toLowerCase() === 'y') {
            console.log('\n⏳ Running population script...\n');
            console.log('==========================================\n');

            try {
                execSync('npx ts-node scripts/populate-from-json.ts', {
                    stdio: 'inherit',
                    cwd: process.cwd()
                });
            } catch (error) {
                console.error('\n❌ Population script failed');
                console.log('You can run it manually with: npm run populate-bots');
                process.exit(1);
            }
        } else {
            console.log('\n✅ historical-bots.json is ready!');
            console.log('\nTo populate the database later, run:');
            console.log('  npm run populate-bots\n');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
