import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkExecutions() {
  try {
    console.log('Checking botExecutions collection...\n');

    // Get all executions without filtering or ordering (no index needed)
    const snapshot = await db
      .collection('botExecutions')
      .limit(20)
      .get();

    console.log(`Found ${snapshot.size} execution logs in total\n`);

    if (snapshot.size > 0) {
      console.log('Recent executions:');
      snapshot.docs.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`\n${idx + 1}. ${doc.id}`);
        console.log(`   Bot ID: ${data.botId}`);
        console.log(`   Symbol: ${data.symbol}`);
        console.log(`   Action: ${data.action}`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Reason: ${data.reason}`);
        console.log(`   Timestamp: ${data.timestamp}`);
        if (data.error) {
          console.log(`   Error: ${data.error}`);
        }
      });
    } else {
      console.log('❌ No execution logs found in botExecutions collection');
      console.log('This means either:');
      console.log('1. Bot processing has not run yet');
      console.log('2. No bots met all entry requirements');
      console.log('3. The logging code is not being executed');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkExecutions();
