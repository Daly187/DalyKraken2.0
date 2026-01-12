import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDogeBot() {
  const DOGE_BOT_ID = '966Pw4VsBBW0uc8wJKvh';

  console.log('=== DOGE BOT INVESTIGATION ===\n');

  // 1. Get bot details
  const botDoc = await db.collection('dcaBots').doc(DOGE_BOT_ID).get();
  const bot = botDoc.data();
  console.log('Bot Status:', bot.status);
  console.log('Symbol:', bot.symbol);
  console.log('TP Target:', bot.tpTarget + '%');
  console.log('Trend Alignment Enabled:', bot.trendAlignmentEnabled);
  console.log('Last Known Price:', bot.lastKnownPrice);
  console.log('Last Updated:', bot.updatedAt);
  console.log('Price Last Updated:', bot.priceLastUpdated);

  // 2. Get filled entries
  const entriesSnap = await db.collection('dcaBots').doc(DOGE_BOT_ID)
    .collection('entries')
    .where('status', '==', 'filled')
    .get();

  console.log('\nFilled Entries:', entriesSnap.size);

  let totalCost = 0;
  let totalQty = 0;
  entriesSnap.docs.forEach(e => {
    const entry = e.data();
    totalCost += entry.price * entry.quantity;
    totalQty += entry.quantity;
  });

  const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
  const tpPrice = avgPrice * (1 + bot.tpTarget / 100);
  const pnlPercent = bot.lastKnownPrice ? ((bot.lastKnownPrice - avgPrice) / avgPrice) * 100 : 0;

  console.log('Avg Purchase Price:', avgPrice.toFixed(6));
  console.log('TP Price:', tpPrice.toFixed(6));
  console.log('Current P&L:', pnlPercent.toFixed(2) + '%');
  console.log('Above TP:', bot.lastKnownPrice >= tpPrice ? 'YES' : 'NO');

  // 3. Get recent executions for this bot
  console.log('\n=== RECENT EXECUTIONS ===');
  const execsSnap = await db.collection('botExecutions')
    .where('botId', '==', DOGE_BOT_ID)
    .get();

  // Sort manually since we can't use orderBy without index
  const execs = execsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  execs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  console.log('Total executions for this bot:', execs.length);

  execs.slice(0, 15).forEach(exec => {
    console.log('---');
    console.log('Time:', exec.timestamp);
    console.log('Action:', exec.action);
    console.log('Success:', exec.success);
    console.log('Reason:', exec.reason);
    if (exec.techScore) console.log('Tech:', exec.techScore.toFixed(0), 'Trend:', exec.trendScore?.toFixed(0));
    if (exec.error) console.log('Error:', exec.error);
  });

  // 4. Check pending orders for DOGE
  console.log('\n=== PENDING ORDERS FOR DOGE ===');
  const ordersSnap = await db.collection('pendingOrders').get();
  const dogeOrders = ordersSnap.docs.filter(d => d.data().pair === 'DOGE/USD' || d.data().botId === DOGE_BOT_ID);

  console.log('DOGE orders found:', dogeOrders.length);

  dogeOrders.forEach(doc => {
    const order = doc.data();
    console.log('---');
    console.log('Order ID:', doc.id);
    console.log('Side:', order.side);
    console.log('Status:', order.status);
    console.log('Created:', order.createdAt);
    console.log('Updated:', order.updatedAt);
    if (order.error) console.log('Error:', order.error);
  });

  // 5. Check when bot processing last ran
  console.log('\n=== BOT PROCESSING CHECK ===');
  const allExecs = await db.collection('botExecutions').get();
  const allExecData = allExecs.docs.map(d => d.data());
  allExecData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (allExecData.length > 0) {
    console.log('Most recent execution:', allExecData[0].timestamp);
    console.log('Bot:', allExecData[0].symbol);
    console.log('Action:', allExecData[0].action);
  }

  process.exit(0);
}

checkDogeBot().catch(e => { console.error(e); process.exit(1); });
