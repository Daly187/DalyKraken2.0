import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testBotExecutionsQuery() {
  try {
    console.log('Testing botExecutions query...');

    // Get a bot ID from dcaBots collection first
    const botsSnapshot = await db.collection('dcaBots').limit(1).get();

    if (botsSnapshot.empty) {
      console.log('No bots found to test with');
      process.exit(0);
    }

    const botId = botsSnapshot.docs[0].id;
    console.log(`Testing with bot ID: ${botId}`);

    // Try the query that was failing
    const execSnapshot = await db
      .collection('botExecutions')
      .where('botId', '==', botId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    console.log(`✅ Query succeeded! Found ${execSnapshot.size} executions`);

    if (execSnapshot.size > 0) {
      console.log('Sample execution:', execSnapshot.docs[0].data());
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Query failed:', error.message);

    if (error.message.includes('index')) {
      console.log('\n⚠️  Index is still building. This can take several minutes.');
      console.log('The index has been deployed but may not be ready yet.');
    }

    process.exit(1);
  }
}

testBotExecutionsQuery();
