#!/usr/bin/env node

/**
 * Diagnostic script to analyze YouTube stats for a specific user
 * Checks userPracticeHistory and userYouTubeHistory collections
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// User ID to check
const USER_ID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function diagnoseYouTubeStats() {
  console.log('📊 YouTube Stats Diagnostic Report');
  console.log('═'.repeat(80));
  console.log(`User ID: ${USER_ID}\n`);

  try {
    // 1. Check user subscription status
    console.log('1️⃣  USER SUBSCRIPTION STATUS');
    console.log('─'.repeat(80));
    const userDoc = await db.collection('users').doc(USER_ID).get();
    const userData = userDoc.data();
    const isPremium = userData?.subscription?.status === 'active';
    const plan = isPremium ? userData?.subscription?.plan || 'premium' : 'free';

    console.log(`   Plan: ${plan}`);
    console.log(`   Is Premium: ${isPremium}`);
    if (userData?.subscription) {
      console.log(`   Subscription Status: ${userData.subscription.status}`);
      console.log(`   Subscription Plan: ${userData.subscription.plan}`);
    }
    console.log('');

    // 2. Query userPracticeHistory
    console.log('2️⃣  USER PRACTICE HISTORY (userPracticeHistory)');
    console.log('─'.repeat(80));

    const practiceSnapshot = await db
      .collection('userPracticeHistory')
      .where('userId', '==', USER_ID)
      .where('contentType', '==', 'youtube')
      .get();

    console.log(`   Total YouTube videos in practice history: ${practiceSnapshot.size}`);

    // Calculate totals
    let totalPracticeTime = 0;
    let todayCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

    const videos = [];

    practiceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalPracticeTime += data.totalPracticeTime || 0;

      // Check if accessed today
      if (data.firstAccessed && data.firstAccessed.seconds >= todayTimestamp.seconds) {
        todayCount++;
      }

      videos.push({
        docId: doc.id,
        videoId: data.videoId,
        firstAccessed: data.firstAccessed?.toDate(),
        firstPracticed: data.firstPracticed?.toDate(),
        lastPracticed: data.lastPracticed?.toDate(),
        practiceCount: data.practiceCount || 0,
        totalPracticeTime: data.totalPracticeTime || 0
      });
    });

    console.log(`   Total practice time: ${totalPracticeTime} seconds (${Math.round(totalPracticeTime / 60)} minutes)`);
    console.log(`   Videos accessed today: ${todayCount}`);
    console.log('');

    // 3. Calculate quota
    console.log('3️⃣  QUOTA CALCULATION');
    console.log('─'.repeat(80));

    const quotaLimits = {
      'guest': 0,
      'free': 3,
      'premium': 20,
      'premium_monthly': 20,
      'premium_yearly': 20
    };

    const quotaLimit = quotaLimits[plan] || 0;
    const quotaUsed = todayCount;
    const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

    console.log(`   Quota Limit: ${quotaLimit}`);
    console.log(`   Quota Used: ${quotaUsed}`);
    console.log(`   Quota Remaining: ${quotaRemaining}`);
    console.log('');

    // 4. Expected dashboard values
    console.log('4️⃣  EXPECTED DASHBOARD VALUES');
    console.log('─'.repeat(80));
    console.log(`   Videos Practiced: ${practiceSnapshot.size}`);
    console.log(`   Videos Remaining: ${quotaRemaining}`);
    console.log(`   Watch Time: ${Math.round(totalPracticeTime / 60)} min (${totalPracticeTime} sec)`);
    console.log('');

    // 5. Video details
    console.log('5️⃣  VIDEO DETAILS (All Practice History)');
    console.log('─'.repeat(80));

    if (videos.length === 0) {
      console.log('   ⚠️  No videos found in practice history!');
    } else {
      // Sort by firstAccessed (most recent first)
      videos.sort((a, b) => {
        if (!a.firstAccessed) return 1;
        if (!b.firstAccessed) return -1;
        return b.firstAccessed.getTime() - a.firstAccessed.getTime();
      });

      videos.forEach((video, index) => {
        console.log(`\n   ${index + 1}. ${video.videoId}`);
        console.log(`      Doc ID: ${video.docId}`);
        console.log(`      First Accessed: ${video.firstAccessed || 'Not set'}`);
        console.log(`      First Practiced: ${video.firstPracticed || 'Not set'}`);
        console.log(`      Last Practiced: ${video.lastPracticed || 'Not set'}`);
        console.log(`      Practice Count: ${video.practiceCount}`);
        console.log(`      Total Practice Time: ${video.totalPracticeTime} seconds`);

        // Check if accessed today
        const isToday = video.firstAccessed &&
          video.firstAccessed >= today;
        if (isToday) {
          console.log(`      ✅ COUNTED IN TODAY'S QUOTA`);
        }
      });
    }
    console.log('');

    // 6. Check userYouTubeHistory (premium only)
    if (isPremium) {
      console.log('6️⃣  USER YOUTUBE HISTORY (userYouTubeHistory - Premium)');
      console.log('─'.repeat(80));

      const youtubeHistorySnapshot = await db
        .collection('userYouTubeHistory')
        .where('userId', '==', USER_ID)
        .get();

      console.log(`   Total videos in YouTube history: ${youtubeHistorySnapshot.size}`);

      if (youtubeHistorySnapshot.size > 0) {
        console.log('\n   Videos:');
        youtubeHistorySnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`\n   ${index + 1}. ${data.videoId}`);
          console.log(`      Title: ${data.videoTitle}`);
          console.log(`      Watch Count: ${data.watchCount || 0}`);
          console.log(`      Total Watch Time: ${data.totalWatchTime || 0} seconds`);
          console.log(`      Last Watched: ${data.lastWatched?.toDate() || 'Never'}`);
        });
      }
      console.log('');
    }

    // 7. Data consistency check
    console.log('7️⃣  DATA CONSISTENCY CHECK');
    console.log('─'.repeat(80));

    const issues = [];

    videos.forEach(video => {
      // Check for missing firstAccessed
      if (!video.firstAccessed) {
        issues.push(`❌ ${video.videoId}: Missing firstAccessed (quota won't count)`);
      }

      // Check for practice without first access
      if (video.practiceCount > 0 && !video.firstPracticed) {
        issues.push(`⚠️  ${video.videoId}: Has practice count but no firstPracticed`);
      }

      // Check for first practiced before first accessed
      if (video.firstAccessed && video.firstPracticed &&
          video.firstPracticed < video.firstAccessed) {
        issues.push(`⚠️  ${video.videoId}: firstPracticed before firstAccessed (data inconsistency)`);
      }
    });

    if (issues.length === 0) {
      console.log('   ✅ No data consistency issues found!');
    } else {
      console.log(`   Found ${issues.length} issue(s):\n`);
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    console.log('');

    // 8. Summary
    console.log('8️⃣  SUMMARY');
    console.log('─'.repeat(80));
    console.log(`   • User Plan: ${plan}`);
    console.log(`   • Total Videos Practiced: ${practiceSnapshot.size}`);
    console.log(`   • Total Watch Time: ${Math.round(totalPracticeTime / 60)} minutes`);
    console.log(`   • Today's Quota Used: ${quotaUsed}/${quotaLimit}`);
    console.log(`   • Videos Remaining Today: ${quotaRemaining}`);
    console.log(`   • Data Consistency: ${issues.length === 0 ? '✅ Good' : `⚠️  ${issues.length} issues`}`);
    console.log('');

    console.log('═'.repeat(80));
    console.log('✅ Diagnostic complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    process.exit(1);
  }
}

// Run the diagnostic
diagnoseYouTubeStats();
