// Test achievement sync to Firebase
// Run this in the browser console while logged in as a premium user

async function testAchievementSync() {
  try {
    console.log('Starting achievement sync test...');

    // Get current user
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    if (!data.authenticated) {
      console.log('Not authenticated. Please log in first.');
      return;
    }

    const userId = data.user.uid;
    console.log('User ID:', userId);

    // Check if premium
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase/config');

    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    const isPremium = userData?.subscription?.plan === 'premium';

    console.log('Is Premium:', isPremium);

    if (!isPremium) {
      console.log('User is not premium. Achievement sync only works for premium users.');
      return;
    }

    // Manually trigger achievement sync
    const { achievementManager } = await import('@/utils/achievementManager');

    // Create test achievement data
    const testAchievements = {
      unlocked: ['test-achievement-1', 'test-achievement-2'],
      totalPoints: 100,
      totalXp: 500,
      currentLevel: 'intermediate',
      lessonsCompleted: 10,
      lastUpdated: Date.now(),
      statistics: {
        percentageComplete: 25,
        byCategory: {
          progress: 5,
          streak: 3
        }
      }
    };

    const testActivities = {
      dates: {
        '2025-01-15': true,
        '2025-01-14': true,
        '2025-01-13': true
      },
      currentStreak: 3,
      bestStreak: 5,
      lastActivity: Date.now()
    };

    console.log('Saving test achievements...');
    await achievementManager.saveAchievements(userId, testAchievements, true);

    console.log('Saving test activities...');
    await achievementManager.saveActivities(userId, testActivities, true);

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check Firebase
    const achievementDoc = await getDoc(doc(db, 'users', userId, 'achievements', 'data'));
    const activityDoc = await getDoc(doc(db, 'users', userId, 'achievements', 'activities'));

    console.log('Firebase achievement data:', achievementDoc.exists() ? achievementDoc.data() : 'Not found');
    console.log('Firebase activity data:', activityDoc.exists() ? activityDoc.data() : 'Not found');

    if (achievementDoc.exists() && activityDoc.exists()) {
      console.log('✅ SUCCESS! Achievements synced to Firebase!');
    } else {
      console.log('❌ FAILED! Achievements not found in Firebase.');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Instructions:
console.log('To test achievement sync:');
console.log('1. Make sure you are logged in as a premium user');
console.log('2. Open browser console');
console.log('3. Copy and paste the testAchievementSync function');
console.log('4. Run: testAchievementSync()');