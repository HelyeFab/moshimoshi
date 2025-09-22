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

      // Let's list all users to help debug
      console.log('\n📋 Listing all users in the database:');
      const allUsers = await db.collection('users').get();
      allUsers.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.email || 'no email'} (${data.displayName || 'no name'})`);
      });
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

    // Check for activities/streak data in the user document
    if (userData.activities) {
      console.log('\n📊 Activities/Streak data from user document:');
      console.log(`  - Current Streak: ${userData.activities.currentStreak || 0} days`);
      console.log(`  - Best Streak: ${userData.activities.bestStreak || 0} days`);
      console.log(`  - Last Activity: ${userData.activities.lastActivity ? new Date(userData.activities.lastActivity).toLocaleDateString() : 'Never'}`);

      if (userData.activities.dates) {
        const dates = Object.keys(userData.activities.dates).sort().reverse().slice(0, 7);
        console.log(`  - Recent activity dates (last 7):`);
        dates.forEach(date => {
          console.log(`    • ${date}`);
        });
      }
    } else {
      console.log('\n⚠️  No activities data in user document');
    }

    // Check for activities in a subcollection
    const activitiesRef = db.collection('users').doc(userId).collection('activities');
    const activitiesSnapshot = await activitiesRef.limit(1).get();

    if (!activitiesSnapshot.empty) {
      console.log('\n📂 Found activities subcollection');
      const activityData = activitiesSnapshot.docs[0].data();
      console.log('  Activity data:', JSON.stringify(activityData, null, 2));
    }

    // Check for achievements data
    if (userData.achievements) {
      console.log('\n🏆 Achievements data:');
      console.log(`  - Total Points: ${userData.achievements.totalPoints || 0}`);
      console.log(`  - Unlocked Count: ${userData.achievements.unlocked?.length || 0}`);
      if (userData.achievements.unlocked && userData.achievements.unlocked.length > 0) {
        console.log(`  - Recent unlocks: ${userData.achievements.unlocked.slice(-3).join(', ')}`);
      }
    }

    // Check for progress data
    const progressRef = db.collection('users').doc(userId).collection('progress');
    const progressSnapshot = await progressRef.get();

    if (!progressSnapshot.empty) {
      console.log(`\n📈 Progress collection has ${progressSnapshot.size} documents`);

      // Check for streak-related progress
      progressSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.streak || data.currentStreak || data.activities) {
          console.log(`  - Document ${doc.id} has streak data:`, {
            streak: data.streak,
            currentStreak: data.currentStreak,
            hasActivities: !!data.activities
          });
        }
      });
    }

  } catch (error) {
    console.error('Error checking streak:', error);
  } finally {
    // Close the Firebase connection
    await admin.app().delete();
  }
}

// Get email from command line or use default
const userEmail = process.argv[2] || 'beanobriendev@gmail.com';
checkUserStreak(userEmail);