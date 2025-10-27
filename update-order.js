const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function updateOrder() {
  const orderRef = db.collection('pendingOrders').doc('wHRLnVZ7LJbuSN12sK3n');
  await orderRef.update({
    failedApiKeys: [],
    status: 'pending',
    lastError: 'Cleared failed API keys - ready to retry',
    updatedAt: new Date().toISOString(),
  });
  console.log('✅ Order updated successfully');
  process.exit(0);
}

updateOrder().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
