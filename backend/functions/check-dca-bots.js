import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDCABots() {
  try {
    console.log('Fetching DCA bots from Firebase...\n');

    // Get all DCA bots
    const dcaBotsSnapshot = await db.collection('dcaBots').get();

    if (dcaBotsSnapshot.empty) {
      console.log('No DCA bots found');
      process.exit(1);
    }

    console.log(`Found ${dcaBotsSnapshot.size} DCA bots\n`);
    console.log('=== DCA BOTS DATA ===\n');

    const bots = [];
    dcaBotsSnapshot.forEach(doc => {
      const data = doc.data();
      bots.push({
        id: doc.id,
        ...data
      });
    });

    // Sort by asset name for easier reading
    bots.sort((a, b) => (a.asset || '').localeCompare(b.asset || ''));

    // Display first 3 bots with all fields to understand structure
    console.log('SAMPLE BOTS (showing all fields):');
    bots.slice(0, 3).forEach((bot, i) => {
      console.log(`\nBot ${i + 1}:`);
      console.log(JSON.stringify(bot, null, 2));
    });

    // Focus on INJ and DASH
    console.log('\n=== SPECIFIC BOTS: INJ and DASH ===\n');

    const injBot = bots.find(b => b.symbol && b.symbol.includes('INJ'));
    const dashBot = bots.find(b => b.symbol && b.symbol.includes('DASH'));

    if (injBot) {
      console.log('INJ Bot:');
      console.log(JSON.stringify(injBot, null, 2));
    } else {
      console.log('INJ Bot: NOT FOUND');
    }

    console.log('\n');

    if (dashBot) {
      console.log('DASH Bot:');
      console.log(JSON.stringify(dashBot, null, 2));
    } else {
      console.log('DASH Bot: NOT FOUND');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDCABots();
