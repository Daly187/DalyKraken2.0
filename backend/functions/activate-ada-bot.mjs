import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function activateADABot() {
  const botId = 'iyqwj2mymkaiFMlPKl2D';

  await db.collection('dcaBots').doc(botId).update({
    status: 'active',
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ ADA bot activated');
  process.exit(0);
}

activateADABot().catch(console.error);
