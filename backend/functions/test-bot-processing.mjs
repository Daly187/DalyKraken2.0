import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import crypto from 'crypto';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Decrypt function
function decryptKey(encrypted) {
  try {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32)),
      iv
    );

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error decrypting key:', error.message);
    return encrypted;
  }
}

async function testBotProcessing() {
  console.log('Testing bot processing logic...\n');

  // Get a bot that should qualify for exit (BCH with 8/8 entries)
  const botSnapshot = await db.collection('dcaBots').doc('3x7ZYcJcDGemb8kePQqz').get();

  if (!botSnapshot.exists) {
    console.log('❌ Bot not found');
    process.exit(1);
  }

  const bot = { id: botSnapshot.id, ...botSnapshot.data() };
  console.log('Bot Info:');
  console.log(`  Symbol: ${bot.symbol}`);
  console.log(`  Status: ${bot.status}`);
  console.log(`  Entry Count: ${bot.currentEntryCount}/${bot.maxEntries}`);
  console.log(`  Average Purchase Price: $${bot.averagePurchasePrice}`);
  console.log(`  TP Target: ${bot.tpTarget}%`);
  console.log(`  Current TP Price: $${bot.currentTpPrice}`);
  console.log('');

  // Get user's API keys
  const userSnapshot = await db.collection('users').doc(bot.userId).get();
  const userData = userSnapshot.data();
  const activeKey = userData.krakenKeys.find(k => k.isActive);

  if (!activeKey) {
    console.log('❌ No active API key');
    process.exit(1);
  }

  const krakenApiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
  const krakenApiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

  console.log('✅ API keys decrypted');
  console.log('');

  // Import the services dynamically
  const { DCABotService } = await import('./lib/services/dcaBotService.js');
  const { KrakenService } = await import('./lib/services/krakenService.js');

  const dcaBotService = new DCABotService();
  const krakenService = new KrakenService(krakenApiKey, krakenApiSecret);

  console.log('Testing market conditions...');

  try {
    // Get current price
    const ticker = await krakenService.getTicker(bot.symbol);
    console.log(`  Current Price: $${ticker.price}`);
    console.log(`  Average Purchase Price: $${bot.averagePurchasePrice}`);

    if (bot.currentTpPrice) {
      console.log(`  Target Price (${bot.tpTarget}%): $${bot.currentTpPrice}`);
      console.log(`  Price vs Target: ${ticker.price >= bot.currentTpPrice ? '✅ Above target' : '❌ Below target'}`);
    }

    console.log('');
    console.log('Calling processBot...');

    const result = await dcaBotService.processBot(bot.id, krakenApiKey, krakenApiSecret);

    console.log('');
    console.log('Result:');
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Action: ${result.action || 'none'}`);
    console.log(`  Reason: ${result.reason}`);

    // Check if pending order was created
    console.log('');
    console.log('Checking for pending orders...');
    const ordersSnapshot = await db.collection('pendingOrders')
      .where('botId', '==', bot.id)
      .get();

    if (ordersSnapshot.empty) {
      console.log('❌ No pending order created');
    } else {
      console.log(`✅ Found ${ordersSnapshot.size} pending order(s):`);
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        console.log(`  ID: ${doc.id}`);
        console.log(`  Side: ${order.side}`);
        console.log(`  Volume: ${order.volume}`);
        console.log(`  Status: ${order.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Temporary lockout')) {
      console.log('\n⚠️  Kraken API rate limit hit. Wait 15 minutes and try again.');
    }
  }

  process.exit(0);
}

testBotProcessing().catch(console.error);
