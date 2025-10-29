import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Load the compiled service
import { DCABotService } from './lib/services/dcaBotService.js';
import { KrakenService } from './lib/services/krakenService.js';

// Initialize Firebase Admin (check if already initialized)
let db;
try {
  db = admin.firestore();
} catch {
  const serviceAccount = JSON.parse(
    readFileSync('./serviceAccountKey.json', 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
}

// Simple decryption function (same as in index.ts)
function decryptKey(encryptedKey) {
  // If not encrypted, return as is
  return encryptedKey;
}

async function manualTrigger() {
  console.log('🚀 Manually triggering DCA bot processing...\n');

  try {
    const dcaBotService = new DCABotService(db);

    // Get all active bots
    const activeBots = await dcaBotService.getActiveBots();
    console.log(`Found ${activeBots.length} active bots\n`);

    // Group bots by user
    const botsByUser = {};
    activeBots.forEach(bot => {
      if (!botsByUser[bot.userId]) {
        botsByUser[bot.userId] = [];
      }
      botsByUser[bot.userId].push(bot);
    });

    console.log(`Processing bots for ${Object.keys(botsByUser).length} users\n`);

    // Process each user's bots
    for (const [userId, userBots] of Object.entries(botsByUser)) {
      try {
        // Get user's Kraken API keys
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData || !userData.krakenKeys || userData.krakenKeys.length === 0) {
          console.warn(`⚠️  No Kraken keys for user ${userId}, skipping ${userBots.length} bots`);
          continue;
        }

        const activeKey = userData.krakenKeys.find(k => k.isActive);
        if (!activeKey) {
          console.warn(`⚠️  No active Kraken key for user ${userId}`);
          continue;
        }

        const krakenApiKey = activeKey.encrypted ? decryptKey(activeKey.apiKey) : activeKey.apiKey;
        const krakenApiSecret = activeKey.encrypted ? decryptKey(activeKey.apiSecret) : activeKey.apiSecret;

        console.log(`Processing ${userBots.length} bots for user ${userId}...`);

        // Process each bot
        for (const bot of userBots) {
          try {
            console.log(`\n📊 Processing bot: ${bot.id} (${bot.symbol})`);

            const result = await dcaBotService.processBot(
              bot.id,
              krakenApiKey,
              krakenApiSecret
            );

            console.log(`Result:`, result);

          } catch (error) {
            console.error(`❌ Error processing bot ${bot.id}:`, error.message);
            console.error('Full error:', error);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
      }
    }

    console.log('\n✅ Manual trigger complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

manualTrigger().catch(console.error);
