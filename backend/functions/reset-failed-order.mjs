import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function resetFailedOrder() {
  const orderId = 'BHLhcWYk5wuxS16JF889';

  console.log(`Resetting failed order ${orderId}...`);

  await db.collection('pendingOrders').doc(orderId).update({
    status: 'retry',
    failedApiKeys: [], // Clear failed API keys
    nextRetryAt: new Date().toISOString(), // Retry immediately
    lastError: 'Reset by admin - will retry with all API keys',
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Order reset to retry status with cleared failed API keys');
  process.exit(0);
}

resetFailedOrder().catch(console.error);
