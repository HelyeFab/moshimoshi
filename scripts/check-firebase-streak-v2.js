const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

async function checkUserStreak(userEmail) {
  try {
    console.log(`\n🔍 Checking streak data for: ${userEmail}\n`);

    // First, find the user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ User not found with email:', userEmail);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log('✅ User found:');
    console.log(`  - User ID: ${userId}`);
    console.log(`  - Display Name: ${userData.displayName || 'Not set'}`);
    console.log(`  - Email: ${userData.email}`);
    console.log(`  - Subscription: ${userData.subscription?.plan || 'free'}`);
    console.log(`  - Is Premium: ${userData.subscription?.plan === 'premium_monthly' || userData.subscription?.plan === 'premium_yearly'}`);

    // Check for activities subcollection (this is where your data is!)
    const activitiesCol = await db.collection('users').doc(userId).collection('activities').get();

    if (!activitiesCol.empty) {
      console.log('\n📊 Activities/Streak data from activities subcollection:');

      activitiesCol.forEach(doc => {
        const data = doc.data();
        console.log(`\n  Document ID: ${doc.id}`);

        if (data.currentStreak !== undefined) {
          console.log(`  - Current Streak: ${data.currentStreak} days`);
        }
        if (data.bestStreak !== undefined) {
          console.log(`  - Best Streak: ${data.bestStreak} days`);
        }
        if (data.lastActivity) {
          const lastActivityDate = new Date(data.lastActivity);
          console.log(`  - Last Activity: ${lastActivityDate.toLocaleDateString()} ${lastActivityDate.toLocaleTimeString()}`);
          console.log(`    (Timestamp: ${data.lastActivity})`);
        }
        if (data.dates) {
          const dates = Object.keys(data.dates).sort().reverse();
          console.log(`  - Activity dates (${dates.length} total):`);
          dates.slice(0, 10).forEach(date => {
            console.log(`    • ${date}: ${data.dates[date]}`);
          });
        }
      });
    } else {
      console.log('\n⚠️  No activities subcollection found');
    }

    // Check for achievements subcollection
    const achievementsCol = await db.collection('users').doc(userId).collection('achievements').get();

    if (!achievementsCol.empty) {
      console.log('\n🏆 Achievements data from achievements subcollection:');

      achievementsCol.forEach(doc => {
        const data = doc.data();
        console.log(`  Document ID: ${doc.id}`);
        if (data.totalPoints !== undefined) {
          console.log(`  - Total Points: ${data.totalPoints}`);
        }
        if (data.unlocked) {
          console.log(`  - Unlocked achievements: ${Array.isArray(data.unlocked) ? data.unlocked.length : 'N/A'}`);
        }
      });
    }

    // Calculate if streak is active (activity within last 48 hours to account for timezone)
    const activitiesData = activitiesCol.empty ? null : activitiesCol.docs[0].data();
    if (activitiesData && activitiesData.lastActivity) {
      const now = Date.now();
      const lastActivity = activitiesData.lastActivity;
      const hoursSinceLastActivity = (now - lastActivity) / (1000 * 60 * 60);

      console.log('\n📈 Streak Analysis:');
      console.log(`  - Hours since last activity: ${hoursSinceLastActivity.toFixed(1)}`);
      console.log(`  - Streak is ${hoursSinceLastActivity <= 48 ? '✅ ACTIVE' : '❌ BROKEN'}`);

      // Check today's date
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (activitiesData.dates) {
        console.log(`  - Activity today (${today}): ${activitiesData.dates[today] ? '✅ Yes' : '❌ No'}`);
        console.log(`  - Activity yesterday (${yesterday}): ${activitiesData.dates[yesterday] ? '✅ Yes' : '❌ No'}`);
      }
    }

  } catch (error) {
    console.error('Error checking streak:', error);
  } finally {
    // Close the Firebase connection
    await admin.app().delete();
  }
}

// Get email from command line or use default
const userEmail = process.argv[2] || 'emmanuelfabiani23@gmail.com';
checkUserStreak(userEmail);