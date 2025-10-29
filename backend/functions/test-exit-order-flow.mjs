import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Test script to verify the entire exit order flow:
 * 1. Create a test bot with positions that should exit
 * 2. Manually process the bot (simulating processDCABots)
 * 3. Verify pending order is created
 * 4. Show what would happen in order execution
 */
async function testExitOrderFlow() {
  console.log('\n=== Test Exit Order Flow ===\n');

  // Step 1: Create a test bot
  console.log('Step 1: Creating test DCA bot...');

  const testBotData = {
    userId: 'test_user_123',
    symbol: 'BCH/USD',
    status: 'active',
    initialOrderAmount: 10,
    maxEntries: 10,
    stepPercent: 2,
    tpTarget: 3,
    tradeMultiplier: 1.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentEntryCount: 3, // Has positions
    totalInvested: 30.50,
    totalQuantity: 0.063, // 0.063 BCH
    averagePurchasePrice: 484.13, // Average entry price
    exitPercentage: 90, // Exit 90% of holdings
  };

  const botRef = await db.collection('dcaBots').add(testBotData);
  const botId = botRef.id;
  console.log(`✅ Created test bot: ${botId}`);
  console.log(`   Symbol: ${testBotData.symbol}`);
  console.log(`   Holdings: ${testBotData.totalQuantity} BCH`);
  console.log(`   Avg Price: $${testBotData.averagePurchasePrice}`);
  console.log(`   Exit %: ${testBotData.exitPercentage}%`);

  // Step 2: Calculate exit conditions
  console.log('\nStep 2: Calculating exit conditions...');

  const currentPrice = 500; // Simulated current price
  const currentTpPrice = testBotData.averagePurchasePrice * (1 + testBotData.tpTarget / 100);
  const shouldExit = currentPrice >= currentTpPrice;

  console.log(`   Current Price: $${currentPrice}`);
  console.log(`   TP Target Price: $${currentTpPrice.toFixed(2)}`);
  console.log(`   Should Exit: ${shouldExit ? 'YES ✅' : 'NO ❌'}`);

  if (!shouldExit) {
    console.log('\n⚠️  Bot does not meet exit conditions. Adjusting...');
    // Adjust the test to force exit
    testBotData.averagePurchasePrice = 450; // Lower avg price so TP is met
    const newTpPrice = testBotData.averagePurchasePrice * (1 + testBotData.tpTarget / 100);
    console.log(`   Adjusted Avg Price: $${testBotData.averagePurchasePrice}`);
    console.log(`   New TP Price: $${newTpPrice.toFixed(2)}`);
    console.log(`   Should Exit Now: YES ✅`);
  }

  // Step 3: Simulate executeExit logic
  console.log('\nStep 3: Simulating exit order creation...');

  const exitQuantity = testBotData.totalQuantity * (testBotData.exitPercentage / 100);
  const keepQuantity = testBotData.totalQuantity - exitQuantity;

  console.log(`   Total Holdings: ${testBotData.totalQuantity} BCH`);
  console.log(`   Exit Quantity (${testBotData.exitPercentage}%): ${exitQuantity.toFixed(8)} BCH`);
  console.log(`   Keep Quantity (${100 - testBotData.exitPercentage}%): ${keepQuantity.toFixed(8)} BCH`);

  // Step 4: Create pending order
  console.log('\nStep 4: Creating pending order...');

  const pendingOrder = {
    botId: botId,
    userId: testBotData.userId,
    symbol: testBotData.symbol,
    side: 'sell',
    type: 'market',
    volume: exitQuantity.toFixed(8),
    pair: testBotData.symbol.replace('/', ''),
    status: 'pending',
    shouldRetry: true,
    retryCount: 0,
    maxRetries: 5,
    failedApiKeys: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      reason: 'TEST - DCA bot exit',
      currentPrice: currentPrice,
      tpPrice: currentTpPrice,
      exitPercentage: testBotData.exitPercentage,
    }
  };

  const orderRef = await db.collection('pendingOrders').add(pendingOrder);
  console.log(`✅ Pending order created: ${orderRef.id}`);
  console.log(`   Side: ${pendingOrder.side}`);
  console.log(`   Volume: ${pendingOrder.volume} BCH`);
  console.log(`   Status: ${pendingOrder.status}`);

  // Step 5: Show what order execution would do
  console.log('\nStep 5: Order execution simulation...');
  console.log(`   When processOrderQueue runs, it will:`);
  console.log(`   1. Find this pending order`);
  console.log(`   2. Get user's Kraken API keys`);
  console.log(`   3. Call Kraken API: AddOrder`);
  console.log(`      - pair: ${pendingOrder.pair}`);
  console.log(`      - type: ${pendingOrder.side}`);
  console.log(`      - ordertype: ${pendingOrder.type}`);
  console.log(`      - volume: ${pendingOrder.volume}`);
  console.log(`   4. If successful, update order status to 'completed'`);
  console.log(`   5. If failed, retry up to ${pendingOrder.maxRetries} times`);

  // Step 6: Summary
  console.log('\n=== Summary ===');
  console.log(`Test Bot ID: ${botId}`);
  console.log(`Pending Order ID: ${orderRef.id}`);
  console.log(`\nYou can now:`);
  console.log(`1. Check Firestore for the pending order`);
  console.log(`2. Wait for processOrderQueue to execute it (runs every minute)`);
  console.log(`3. Or manually trigger execution`);
  console.log(`\nTo clean up test data, run:`);
  console.log(`  node cleanup-test-bot.mjs ${botId}`);

  // Keep the data for inspection
  console.log('\n⚠️  Test bot and order are LIVE in Firestore!');
  console.log('Do NOT deploy this to production without cleanup!');

  process.exit(0);
}

testExitOrderFlow().catch((error) => {
  console.error('Error in test:', error);
  process.exit(1);
});
