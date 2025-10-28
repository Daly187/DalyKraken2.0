import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('/Users/Daly/Desktop/DalyDough/DalyKraken2.0/backend/functions/serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();

async function checkPendingOrders() {
  console.log('🔍 Checking for pending sell orders...\n');

  try {
    const ordersSnapshot = await db.collection('pendingOrders')
      .where('status', '==', 'pending')
      .where('side', '==', 'sell')
      .limit(5)
      .get();

    if (ordersSnapshot.empty) {
      console.log('❌ No pending sell orders found');
      process.exit(0);
    }

    console.log(`✅ Found ${ordersSnapshot.size} pending sell order(s)\n`);

    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      console.log('📋 Order ID:', doc.id);
      console.log('   Pair:', order.pair);
      console.log('   Volume:', order.volume);
      console.log('   Side:', order.side);
      console.log('   Type:', order.type);
      console.log('   Status:', order.status);
      console.log('   Created:', order.createdAt);
      console.log('   Attempts:', order.attempts || 0);
      console.log('   Last Error:', order.lastError || 'None');
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkPendingOrders();
