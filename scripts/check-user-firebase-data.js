const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.firestore();
const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';

async function checkUserData() {
  console.log('=== Checking Firebase data for user:', userId, '===\n');

  try {
    // 1. Check main user document
    console.log('1. USER DOCUMENT:');
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('- Display Name:', userData.displayName);
      console.log('- Email:', userData.email);
      console.log('- Subscription Plan:', userData.subscription?.plan || 'none');
      console.log('- Subscription Status:', userData.subscription?.status || 'none');
      console.log('- Current Streak:', userData.currentStreak || 0);
      console.log('- Total XP:', userData.totalXP || 0);
      console.log('- Current Level:', userData.currentLevel || 1);
    } else {
      console.log('User document not found!');
    }

    // 2. Check streak data (CORRECT LOCATION: users/{uid}/progress/streak)
    console.log('\n2. STREAK DATA:');
    const streakDoc = await db.collection('users').doc(userId).collection('progress').doc('streak').get();
    if (streakDoc.exists) {
      const streakData = streakDoc.data();
      console.log('- Current Streak:', streakData.currentStreak || 0);
      console.log('- Longest Streak:', streakData.longestStreak || 0);
      console.log('- Last Active Day:', streakData.lastActiveDay || 'never');
      console.log('- Updated At:', streakData.updatedAt?.toDate() || 'never');
    } else {
      console.log('No streak document found');
    }

    // 3. Check XP data
    console.log('\n3. XP DATA:');
    const xpDoc = await db.collection('users').doc(userId).collection('stats').doc('xp').get();
    if (xpDoc.exists) {
      const xpData = xpDoc.data();
      console.log('- Total XP:', xpData.totalXP || 0);
      console.log('- Current Level:', xpData.currentLevel || 1);
      console.log('- XP This Week:', xpData.weeklyXP || 0);
      console.log('- XP This Month:', xpData.monthlyXP || 0);
    } else {
      console.log('No XP stats document found');
    }

    // 4. Check achievements
    console.log('\n4. ACHIEVEMENTS DATA:');
    const achievementsDoc = await db.collection('users').doc(userId).collection('achievements').doc('data').get();
    if (achievementsDoc.exists) {
      const achievementsData = achievementsDoc.data();
      console.log('- Unlocked Achievements:', achievementsData.unlocked ? Object.keys(achievementsData.unlocked).length : 0);
      console.log('- Total Points:', achievementsData.totalPoints || 0);
      if (achievementsData.unlocked) {
        console.log('- Achievement IDs:', Object.keys(achievementsData.unlocked).slice(0, 5).join(', '), '...');
      }
    } else {
      console.log('No achievements document found');
    }

    // 5. Check review stats
    console.log('\n5. REVIEW STATS:');
    const reviewStatsDoc = await db.collection('users').doc(userId).collection('stats').doc('reviews').get();
    if (reviewStatsDoc.exists) {
      const reviewStats = reviewStatsDoc.data();
      console.log('- Total Reviews:', reviewStats.totalReviews || 0);
      console.log('- Current Streak:', reviewStats.currentStreak || 0);
      console.log('- Last Review Date:', reviewStats.lastReviewDate?.toDate() || 'never');
      console.log('- Items Mastered:', reviewStats.itemsMastered || 0);
    } else {
      console.log('No review stats document found');
    }

    // 6. Check progress data
    console.log('\n6. PROGRESS DATA:');
    const progressDoc = await db.collection('users').doc(userId).collection('progress').doc('overall').get();
    if (progressDoc.exists) {
      const progressData = progressDoc.data();
      console.log('- Hiragana Progress:', progressData.hiragana?.percentComplete || 0, '%');
      console.log('- Katakana Progress:', progressData.katakana?.percentComplete || 0, '%');
      console.log('- Kanji Progress:', progressData.kanji?.percentComplete || 0, '%');
      console.log('- Overall Progress:', progressData.overallPercentComplete || 0, '%');
    } else {
      console.log('No progress document found');
    }

    // 7. Check activity/usage data
    console.log('\n7. ACTIVITY/USAGE DATA:');
    const activityDoc = await db.collection('users').doc(userId).collection('activity').doc('summary').get();
    if (activityDoc.exists) {
      const activityData = activityDoc.data();
      console.log('- Days Active:', activityData.daysActive || 0);
      console.log('- Last Active:', activityData.lastActive?.toDate() || 'never');
      console.log('- Total Study Time:', activityData.totalStudyTime || 0, 'minutes');
    } else {
      console.log('No activity summary document found');
    }

    // 8. Check achievements/activities (where API reads streak from!)
    console.log('\n8. ACHIEVEMENTS/ACTIVITIES (API reads streak from here):');
    const activitiesDoc = await db.collection('users').doc(userId).collection('achievements').doc('activities').get();
    if (activitiesDoc.exists) {
      const activitiesData = activitiesDoc.data();
      console.log('- Current Streak:', activitiesData.currentStreak || 0);
      console.log('- Best Streak:', activitiesData.bestStreak || 0);
      console.log('- Dates:', Object.keys(activitiesData.dates || {}).length, 'days tracked');
    } else {
      console.log('No activities document found');
    }

    // 9. Check if premium features are properly synced
    console.log('\n8. PREMIUM SYNC STATUS:');
    const userData = userDoc.data();
    const isPremium = userData?.subscription?.plan === 'premium_monthly' || userData?.subscription?.plan === 'premium_yearly';
    console.log('- Is Premium User:', isPremium);
    console.log('- Should sync to Firebase:', isPremium);

    if (isPremium) {
      console.log('\n⚠️  USER IS PREMIUM - All data should be synced to Firebase');
      if (!streakDoc.exists) {
        console.log('❌ Missing streak document - sync may not be working');
      }
      if (!xpDoc.exists) {
        console.log('❌ Missing XP stats document - sync may not be working');
      }
      if (!achievementsDoc.exists) {
        console.log('❌ Missing achievements document - sync may not be working');
      }
    }

  } catch (error) {
    console.error('Error checking user data:', error);
  }

  process.exit(0);
}

checkUserData();