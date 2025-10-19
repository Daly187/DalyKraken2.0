/**
 * Migration Script: Move 'default-user' data to greggdaly account
 *
 * This script migrates all data associated with 'default-user' to the
 * authenticated user account for greggdaly187@gmail.com
 *
 * IMPORTANT: Run this AFTER creating the user account and setting up TOTP
 *
 * Usage:
 *   1. Get your JWT token after logging in
 *   2. Set TOKEN environment variable
 *   3. Run: TOKEN="your-jwt-token" node migrate-default-user.js
 */

const admin = require('firebase-admin');

// Check for service account key
let serviceAccountPath = '../service-account-key.json';
try {
  require(serviceAccountPath);
} catch (e) {
  console.error('❌ Error: service-account-key.json not found');
  console.log('\n📝 To get your service account key:');
  console.log('   1. Go to Firebase Console');
  console.log('   2. Project Settings > Service Accounts');
  console.log('   3. Click "Generate New Private Key"');
  console.log('   4. Save as backend/service-account-key.json');
  console.log('');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateDefaultUser() {
  try {
    console.log('🔄 DalyKraken 2.0 - Data Migration Tool');
    console.log('==========================================\n');

    // Step 1: Find the user account for greggdaly187@gmail.com
    console.log('🔍 Finding user account for greggdaly187@gmail.com...');

    const usersSnapshot = await db
      .collection('users')
      .where('email', '==', 'greggdaly187@gmail.com')
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error('❌ User account not found!');
      console.log('\n📝 Please create the account first:');
      console.log('   bash backend/scripts/setup-gregg-user-simple.sh');
      console.log('');
      process.exit(1);
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log('✅ Found user account:');
    console.log('   User ID:', userId);
    console.log('   Username:', userData.username);
    console.log('   Email:', userData.email);
    console.log('');

    // Step 2: Migrate DCA Bots
    console.log('📊 Migrating DCA Bots...');

    const botsSnapshot = await db
      .collection('dcaBots')
      .where('userId', '==', 'default-user')
      .get();

    if (botsSnapshot.empty) {
      console.log('   ℹ️  No bots found with userId="default-user"');
    } else {
      const botBatch = db.batch();
      const botIds = [];

      botsSnapshot.docs.forEach(doc => {
        botIds.push(doc.id);
        botBatch.update(doc.ref, {
          userId: userId,
          updatedAt: new Date().toISOString(),
        });
      });

      await botBatch.commit();
      console.log('   ✅ Migrated', botsSnapshot.size, 'DCA bot(s)');
      console.log('   Bot IDs:', botIds.join(', '));
    }

    // Step 3: Migrate Trade History
    console.log('\n📈 Migrating Trade History...');

    const defaultUserTradesRef = db
      .collection('users')
      .doc('default-user')
      .collection('trades');

    const tradesSnapshot = await defaultUserTradesRef.get();

    if (tradesSnapshot.empty) {
      console.log('   ℹ️  No trade history found');
    } else {
      const tradeBatch = db.batch();
      const newUserTradesRef = db
        .collection('users')
        .doc(userId)
        .collection('trades');

      let tradeCount = 0;
      tradesSnapshot.docs.forEach(doc => {
        const newDocRef = newUserTradesRef.doc(doc.id);
        tradeBatch.set(newDocRef, doc.data());
        tradeCount++;
      });

      await tradeBatch.commit();
      console.log('   ✅ Migrated', tradeCount, 'trade(s)');
    }

    // Step 4: Migrate Cost Basis
    console.log('\n💰 Migrating Cost Basis Data...');

    const defaultUserCostBasisRef = db
      .collection('users')
      .doc('default-user')
      .collection('costBasis');

    const costBasisSnapshot = await defaultUserCostBasisRef.get();

    if (costBasisSnapshot.empty) {
      console.log('   ℹ️  No cost basis data found');
    } else {
      const costBasisBatch = db.batch();
      const newUserCostBasisRef = db
        .collection('users')
        .doc(userId)
        .collection('costBasis');

      let cbCount = 0;
      const assets = [];
      costBasisSnapshot.docs.forEach(doc => {
        const newDocRef = newUserCostBasisRef.doc(doc.id);
        costBasisBatch.set(newDocRef, doc.data());
        assets.push(doc.id);
        cbCount++;
      });

      await costBasisBatch.commit();
      console.log('   ✅ Migrated', cbCount, 'cost basis record(s)');
      console.log('   Assets:', assets.join(', '));
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ MIGRATION COMPLETE!');
    console.log('='.repeat(60));

    console.log('\n📊 Migration Summary:');
    console.log('   • DCA Bots:', botsSnapshot.size);
    console.log('   • Trade History:', tradesSnapshot.size);
    console.log('   • Cost Basis Records:', costBasisSnapshot.size);

    console.log('\n✅ All data has been linked to:');
    console.log('   Email:', userData.email);
    console.log('   Username:', userData.username);
    console.log('   User ID:', userId);

    console.log('\n🔐 Next Steps:');
    console.log('   1. Login to the app with your account');
    console.log('   2. Verify all your bots are visible');
    console.log('   3. Add your Kraken API keys in Settings');
    console.log('   4. Test a bot to ensure everything works');

    console.log('\n⚠️  CLEANUP (Optional):');
    console.log('   You can safely delete the old default-user data:');
    console.log('   - /users/default-user/trades/*');
    console.log('   - /users/default-user/costBasis/*');
    console.log('   (Already migrated to your account)');

    console.log('');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateDefaultUser();
