const admin = require('firebase-admin');
const serviceAccount = require('./backend/functions/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function checkDcaBots() {
  console.log('=== Checking dcaBots Collection ===\n');
  
  // Get all bots from dcaBots collection
  const snapshot = await db.collection('dcaBots').get();
  console.log('Total documents in dcaBots collection: ' + snapshot.size + '\n');
  
  if (snapshot.size > 0) {
    console.log('Sample documents:\n');
    let count = 0;
    snapshot.forEach(doc => {
      if (count < 5) {
        const data = doc.data();
        console.log('Doc ID: ' + doc.id);
        console.log('  userId field: "' + data.userId + '"');
        console.log('  ownerId field: "' + data.ownerId + '"');
        console.log('  symbol: ' + data.symbol);
        console.log('  status: ' + data.status);
        console.log('');
        count++;
      }
    });
    
    // Check if userId field exists on documents
    const docsWithUserId = [];
    const docsWithOwnerId = [];
    const docsWithNeither = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) docsWithUserId.push(doc.id);
      if (data.ownerId) docsWithOwnerId.push(doc.id);
      if (!data.userId && !data.ownerId) docsWithNeither.push(doc.id);
    });
    
    console.log('=== Field Analysis ===');
    console.log('Documents with userId field: ' + docsWithUserId.length);
    console.log('Documents with ownerId field: ' + docsWithOwnerId.length);
    console.log('Documents with neither: ' + docsWithNeither.length);
    
    // Get unique userIds
    const uniqueUserIds = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) uniqueUserIds.add(data.userId);
    });
    const userIdArray = Array.from(uniqueUserIds);
    console.log('\nUnique userId values: ' + userIdArray.join(', '));
  }
  
  // Also check the users collection to see user IDs
  console.log('\n=== Checking Users Collection ===');
  const usersSnapshot = await db.collection('users').get();
  console.log('Total users: ' + usersSnapshot.size);
  usersSnapshot.forEach(doc => {
    console.log('User ID: ' + doc.id + ', username: ' + doc.data().username);
  });
  
  process.exit(0);
}

checkDcaBots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
