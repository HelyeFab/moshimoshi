const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();

// Configuration - change these dates as needed
const SIGNUP_DATE_START = new Date('2026-02-01T00:00:00.000Z');
const SIGNUP_DATE_END = new Date('2026-02-02T00:00:00.000Z');

// Minimum time difference to consider a "return" (in milliseconds)
// 1 hour = 3600000ms, 1 day = 86400000ms
const MIN_RETURN_GAP_MS = 3600000; // 1 hour

async function checkReturningUsers() {
  console.log('='.repeat(80));
  console.log('🔄 CHECKING RETURNING USERS');
  console.log('='.repeat(80));
  console.log(`Signup date range: ${SIGNUP_DATE_START.toISOString()} to ${SIGNUP_DATE_END.toISOString()}`);
  console.log(`Minimum return gap: ${MIN_RETURN_GAP_MS / 3600000} hour(s)`);
  console.log();

  try {
    // Get users who signed up on the target date
    const usersSnapshot = await db.collection('users')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(SIGNUP_DATE_START))
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(SIGNUP_DATE_END))
      .orderBy('createdAt', 'asc')
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ No users found for the specified date range');
      process.exit(0);
      return;
    }

    console.log(`📊 Found ${usersSnapshot.size} users who signed up in this period\n`);

    const returningUsers = [];
    const oneTimeUsers = [];
    const results = [];

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const uid = doc.id;

      // Get Firestore timestamps
      const createdAt = data.createdAt?.toDate?.();
      const lastActive = data.lastActive?.toDate?.();

      // Get Firebase Auth metadata
      let authCreationTime = null;
      let authLastSignIn = null;
      let signInCount = 'N/A';

      try {
        const userRecord = await admin.auth().getUser(uid);
        authCreationTime = new Date(userRecord.metadata.creationTime);
        authLastSignIn = new Date(userRecord.metadata.lastSignInTime);
      } catch (e) {
        // User might not exist in Auth (deleted or test user)
      }

      // Calculate time differences
      const firestoreGap = lastActive && createdAt ? lastActive - createdAt : 0;
      const authGap = authLastSignIn && authCreationTime ? authLastSignIn - authCreationTime : 0;

      // Determine if user has returned (using the larger of the two gaps)
      const maxGap = Math.max(firestoreGap, authGap);
      const hasReturned = maxGap >= MIN_RETURN_GAP_MS;

      const userInfo = {
        uid,
        email: data.email || 'Unknown',
        displayName: data.displayName || 'Unknown',
        createdAt: createdAt ? createdAt.toISOString() : 'Unknown',
        lastActive: lastActive ? lastActive.toISOString() : 'Unknown',
        authLastSignIn: authLastSignIn ? authLastSignIn.toISOString() : 'Unknown',
        firestoreGapHours: (firestoreGap / 3600000).toFixed(2),
        authGapHours: (authGap / 3600000).toFixed(2),
        hasReturned,
        subscription: data.subscription?.plan || 'free'
      };

      results.push(userInfo);

      if (hasReturned) {
        returningUsers.push(userInfo);
      } else {
        oneTimeUsers.push(userInfo);
      }
    }

    // Display Returning Users
    console.log('='.repeat(80));
    console.log(`✅ RETURNING USERS (${returningUsers.length}/${usersSnapshot.size})`);
    console.log('='.repeat(80));

    if (returningUsers.length === 0) {
      console.log('No users have returned yet.\n');
    } else {
      returningUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.displayName} (${user.email})`);
        console.log(`   Created:        ${user.createdAt}`);
        console.log(`   Last Active:    ${user.lastActive}`);
        console.log(`   Auth Last Sign: ${user.authLastSignIn}`);
        console.log(`   Time since signup: ${Math.max(parseFloat(user.firestoreGapHours), parseFloat(user.authGapHours))} hours`);
        console.log(`   Plan: ${user.subscription}`);
      });
    }

    // Display One-Time Users
    console.log('\n' + '='.repeat(80));
    console.log(`⏳ ONE-TIME USERS - Not Returned Yet (${oneTimeUsers.length}/${usersSnapshot.size})`);
    console.log('='.repeat(80));

    if (oneTimeUsers.length === 0) {
      console.log('All users have returned!\n');
    } else {
      oneTimeUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.displayName} (${user.email})`);
        console.log(`   Created:     ${user.createdAt}`);
        console.log(`   Last Active: ${user.lastActive}`);
        console.log(`   Gap: ${user.firestoreGapHours} hours (less than ${MIN_RETURN_GAP_MS / 3600000}h threshold)`);
      });
    }

    // Summary Statistics
    console.log('\n' + '='.repeat(80));
    console.log('📈 RETENTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total users signed up:    ${usersSnapshot.size}`);
    console.log(`Returning users:          ${returningUsers.length} (${((returningUsers.length / usersSnapshot.size) * 100).toFixed(1)}%)`);
    console.log(`One-time users:           ${oneTimeUsers.length} (${((oneTimeUsers.length / usersSnapshot.size) * 100).toFixed(1)}%)`);
    console.log(`\nNote: "Returning" = activity ${MIN_RETURN_GAP_MS / 3600000}+ hours after signup`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkReturningUsers();
