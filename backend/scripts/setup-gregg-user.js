/**
 * Setup Script for greggdaly187@gmail.com
 *
 * This script:
 * 1. Creates a user account for Gregg Daly
 * 2. Migrates any existing 'default-user' data to the new user
 * 3. Sets up the account for TOTP authentication
 *
 * Usage:
 *   node setup-gregg-user.js
 */

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const GREGG_EMAIL = 'greggdaly187@gmail.com';
const GREGG_USERNAME = 'greggdaly';

async function setupGreggUser() {
  try {
    console.log('🚀 Starting setup for Gregg Daly...\n');

    // Step 1: Check if user already exists
    console.log('📧 Checking for existing user with email:', GREGG_EMAIL);
    const existingUsers = await db
      .collection('users')
      .where('email', '==', GREGG_EMAIL)
      .get();

    let userId;

    if (!existingUsers.empty) {
      userId = existingUsers.docs[0].id;
      console.log('✅ User already exists with ID:', userId);
      console.log('   Username:', existingUsers.docs[0].data().username);
    } else {
      // Step 2: Create new user account
      console.log('\n📝 Creating new user account...');

      // Generate a temporary password (user will change it on first login)
      const tempPassword = 'DalyKraken2024!';
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const userRef = await db.collection('users').add({
        username: GREGG_USERNAME,
        email: GREGG_EMAIL,
        passwordHash,
        totpEnabled: false, // Will be set up on first login
        createdAt: new Date(),
        lastLogin: null,
      });

      userId = userRef.id;
      console.log('✅ User created successfully!');
      console.log('   User ID:', userId);
      console.log('   Username:', GREGG_USERNAME);
      console.log('   Email:', GREGG_EMAIL);
      console.log('   Temp Password:', tempPassword);
      console.log('   ⚠️  IMPORTANT: Change this password after first login!');
    }

    // Step 3: Migrate existing 'default-user' data
    console.log('\n🔄 Migrating existing data...');

    // Migrate DCA Bots
    console.log('\n   📊 Migrating DCA Bots...');
    const botsSnapshot = await db
      .collection('dcaBots')
      .where('userId', '==', 'default-user')
      .get();

    if (botsSnapshot.empty) {
      console.log('   ℹ️  No bots found with userId="default-user"');
    } else {
      const batch = db.batch();
      botsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { userId });
      });
      await batch.commit();
      console.log('   ✅ Migrated', botsSnapshot.size, 'DCA bot(s)');
    }

    // Migrate Trade History
    console.log('\n   📈 Migrating Trade History...');
    const defaultUserTradesRef = db
      .collection('users')
      .doc('default-user')
      .collection('trades');

    const tradesSnapshot = await defaultUserTradesRef.get();

    if (tradesSnapshot.empty) {
      console.log('   ℹ️  No trade history found for default-user');
    } else {
      const batch = db.batch();
      const newUserTradesRef = db
        .collection('users')
        .doc(userId)
        .collection('trades');

      tradesSnapshot.docs.forEach(doc => {
        const newDocRef = newUserTradesRef.doc(doc.id);
        batch.set(newDocRef, doc.data());
      });

      await batch.commit();
      console.log('   ✅ Migrated', tradesSnapshot.size, 'trade(s)');
    }

    // Migrate Cost Basis
    console.log('\n   💰 Migrating Cost Basis Data...');
    const defaultUserCostBasisRef = db
      .collection('users')
      .doc('default-user')
      .collection('costBasis');

    const costBasisSnapshot = await defaultUserCostBasisRef.get();

    if (costBasisSnapshot.empty) {
      console.log('   ℹ️  No cost basis data found for default-user');
    } else {
      const batch = db.batch();
      const newUserCostBasisRef = db
        .collection('users')
        .doc(userId)
        .collection('costBasis');

      costBasisSnapshot.docs.forEach(doc => {
        const newDocRef = newUserCostBasisRef.doc(doc.id);
        batch.set(newDocRef, doc.data());
      });

      await batch.commit();
      console.log('   ✅ Migrated', costBasisSnapshot.size, 'cost basis record(s)');
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📋 Account Details:');
    console.log('   User ID:', userId);
    console.log('   Username:', GREGG_USERNAME);
    console.log('   Email:', GREGG_EMAIL);

    if (existingUsers.empty) {
      console.log('   Temp Password:', tempPassword);
      console.log('\n🔐 Next Steps:');
      console.log('   1. Go to http://localhost:5173/login (or your production URL)');
      console.log('   2. Login with:');
      console.log('      Username:', GREGG_USERNAME);
      console.log('      Password:', tempPassword);
      console.log('   3. Set up Google Authenticator (scan QR code)');
      console.log('   4. Change your password in Settings');
      console.log('   5. Add your Kraken API keys in Settings');
    } else {
      console.log('\n🔐 Next Steps:');
      console.log('   1. Login with your existing credentials');
      console.log('   2. Verify all your bots and data have been migrated');
      console.log('   3. Add your Kraken API keys in Settings if not already added');
    }

    console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   - All your DCA bots are now linked to this account');
    console.log('   - Your trade history and cost basis have been migrated');
    console.log('   - API keys need to be added in the Settings page');
    console.log('   - Enable 2FA if not already enabled for maximum security');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    process.exit(1);
  }
}

// Run the setup
setupGreggUser();
