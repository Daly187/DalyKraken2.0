#!/usr/bin/env node

/**
 * Interactive Bot Creator
 * This will ask you simple questions and create the historical-bots.json for you
 */

const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function createBot() {
    console.log('\n--- Create a New Bot ---');

    const symbol = await question('Symbol (e.g., BTC/USD, ETH/USD): ');
    const initialAmount = await question('Initial order amount in USD (e.g., 10): ');
    const status = await question('Status (active/completed/paused) [active]: ') || 'active';

    console.log('\nHow many entries does this bot have?');
    const entryCount = parseInt(await question('Number of entries: '));

    const entries = [];

    for (let i = 1; i <= entryCount; i++) {
        console.log(`\n--- Entry #${i} ---`);
        const price = await question(`  Price: $`);
        const amount = await question(`  Order amount: $`);
        const quantity = parseFloat(amount) / parseFloat(price);
        const date = await question(`  Date (YYYY-MM-DD) [2025-01-15]: `) || '2025-01-15';
        const time = await question(`  Time (HH:MM) [12:00]: `) || '12:00';

        entries.push({
            entryNumber: i,
            orderAmount: parseFloat(amount),
            price: parseFloat(price),
            quantity: quantity,
            timestamp: `${date}T${time}:00.000Z`,
            orderId: `MANUAL-${Date.now()}-${i}`,
            status: "filled"
        });
    }

    return {
        symbol,
        initialOrderAmount: parseFloat(initialAmount) || 10,
        tradeMultiplier: 2,
        reEntryCount: 8,
        stepPercent: 1,
        stepMultiplier: 2,
        tpTarget: 3,
        supportResistanceEnabled: false,
        reEntryDelay: 888,
        trendAlignmentEnabled: true,
        status,
        userId: "default-user",
        comment: `Manually created with ${entries.length} entries`,
        entries
    };
}

async function main() {
    console.log('==========================================');
    console.log('🤖 Interactive DCA Bot Creator');
    console.log('==========================================\n');
    console.log('This tool will help you create bots manually.');
    console.log('You can look at your Audit Log page for the trade data.\n');

    const bots = [];

    while (true) {
        const bot = await createBot();
        bots.push(bot);

        console.log(`\n✅ Bot created for ${bot.symbol} with ${bot.entries.length} entries`);

        const more = await question('\nCreate another bot? (yes/no) [no]: ');
        if (more.toLowerCase() !== 'yes' && more.toLowerCase() !== 'y') {
            break;
        }
    }

    const output = {
        instructions: "Manually created bot configurations",
        generatedAt: new Date().toISOString(),
        totalBots: bots.length,
        bots
    };

    const outputPath = 'scripts/historical-bots.json';
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('\n========================================');
    console.log(`✅ Created ${outputPath}`);
    console.log('========================================\n');
    console.log(`Total bots created: ${bots.length}`);
    bots.forEach(bot => {
        console.log(`  - ${bot.symbol}: ${bot.entries.length} entries`);
    });

    console.log('\n========================================');
    console.log('Next step: Populate the database');
    console.log('========================================');
    console.log('\nRun this command:');
    console.log('  npx ts-node scripts/populate-from-json.ts\n');

    rl.close();
}

main().catch(error => {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
});
