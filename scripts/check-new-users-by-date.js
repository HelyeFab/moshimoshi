const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const db = admin.firestore();

// Target date: February 1st, 2026 (01/02/2026)
const targetDate = new Date('2026-02-01T00:00:00.000Z');
const nextDay = new Date('2026-02-02T00:00:00.000Z');

async function checkNewUsersByDate() {
  console.log('='.repeat(80));
  console.log('🔍 NEW USERS WHO SIGNED UP ON FEBRUARY 1ST, 2026');
  console.log('='.repeat(80));
  console.log(`Date range: ${targetDate.toISOString()} to ${nextDay.toISOString()}`);
  console.log();

  try {
    // Query users where createdAt is between start and end of Feb 1, 2026
    const usersSnapshot = await db.collection('users')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(targetDate))
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(nextDay))
      .orderBy('createdAt', 'asc')
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ No users found who signed up on February 1st, 2026');
      console.log();

      // Let's also check the most recent users to see what dates exist
      console.log('📊 Checking most recent users for reference...');
      const recentUsers = await db.collection('users')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      console.log('\nMost recent 5 users:');
      recentUsers.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || 'Unknown';
        console.log(`  - ${data.email || 'No email'} (created: ${createdAt})`);
      });
    } else {
      console.log(`✅ Found ${usersSnapshot.size} user(s) who signed up on February 1st, 2026\n`);

      let index = 1;
      for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.();

        console.log(`\n${'─'.repeat(80)}`);
        console.log(`👤 USER ${index}/${usersSnapshot.size}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`UID:          ${doc.id}`);
        console.log(`Email:        ${data.email || 'Not set'}`);
        console.log(`Display Name: ${data.displayName || 'Not set'}`);
        console.log(`Created At:   ${createdAt ? createdAt.toISOString() : 'Unknown'}`);
        console.log(`Provider:     ${data.provider || 'Unknown'}`);
        console.log(`Is Admin:     ${data.isAdmin ? 'Yes' : 'No'}`);
        console.log(`Photo URL:    ${data.photoURL || 'Not set'}`);

        // Check subscription status
        if (data.subscription) {
          console.log(`\n💳 Subscription:`);
          console.log(`   Plan:   ${data.subscription.plan || 'free'}`);
          console.log(`   Status: ${data.subscription.status || 'none'}`);
        } else {
          console.log(`\n💳 Subscription: None (free tier)`);
        }

        // Check last activity
        if (data.lastActive) {
          const lastActive = data.lastActive.toDate?.();
          console.log(`\n📊 Last Active: ${lastActive ? lastActive.toISOString() : 'Unknown'}`);
        }

        index++;
      }

      // Summary
      console.log(`\n${'='.repeat(80)}`);
      console.log('📈 SUMMARY');
      console.log(`${'='.repeat(80)}`);
      console.log(`Total new users on Feb 1, 2026: ${usersSnapshot.size}`);

      // Count by provider
      const providerCounts = {};
      usersSnapshot.forEach(doc => {
        const provider = doc.data().provider || 'unknown';
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });
      console.log('\nBy Auth Provider:');
      Object.entries(providerCounts).forEach(([provider, count]) => {
        console.log(`  - ${provider}: ${count}`);
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ QUERY COMPLETE');
    console.log(`${'='.repeat(80)}`);

  } catch (error) {
    console.error('❌ Error querying users:', error);
  } finally {
    process.exit(0);
  }
}

checkNewUsersByDate();
