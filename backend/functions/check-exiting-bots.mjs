import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function checkExitingBots() {
  console.log('Checking bots in exiting status...\n');

  try {
    const exitingBotsSnapshot = await db.collection('dcaBots')
      .where('status', '==', 'exiting')
      .get();

    console.log('Found', exitingBotsSnapshot.size, 'bot(s) in exiting status:\n');
    
    exitingBotsSnapshot.forEach(doc => {
      const bot = doc.data();
      console.log('Bot ID:', doc.id);
      console.log('  Symbol:', bot.symbol);
      console.log('  User ID:', bot.userId);
      console.log('  Status:', bot.status);
      console.log('  Updated At:', bot.updatedAt);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkExitingBots();
