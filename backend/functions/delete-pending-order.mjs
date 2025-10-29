import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deletePendingOrder() {
  const orderId = 'KqSngaaz6zq3RUxPCJRk';

  console.log(`Deleting pending order ${orderId}...`);

  await db.collection('pendingOrders').doc(orderId).delete();

  console.log('✅ Order deleted');

  // Also pause the ADA bot
  const botId = 'iyqwj2mymkaiFMlPKl2D';
  await db.collection('dcaBots').doc(botId).update({
    status: 'paused',
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ ADA bot paused');

  process.exit(0);
}

deletePendingOrder().catch(console.error);
