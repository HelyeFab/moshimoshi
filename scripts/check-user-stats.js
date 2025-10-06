/**
 * Check user_stats document structure
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
  });
}

const db = admin.firestore();

async function checkUserStats(userId) {
  console.log(`\n📊 Checking user_stats for: ${userId}\n`);

  try {
    const userStatsDoc = await db.collection('user_stats').doc(userId).get();

    if (!userStatsDoc.exists) {
      console.log('❌ No user_stats document found');
      return;
    }

    const data = userStatsDoc.data();

    console.log('='.repeat(60));
    console.log('📈 XP DATA');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data.xp, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('🔥 STREAK DATA');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data.streak, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📅 DATES DATA');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data.dates, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('🎮 SESSIONS DATA');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data.sessions, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('🏆 ACHIEVEMENTS DATA');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data.achievements, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('🔧 METADATA');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data.metadata, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ VALIDATION CHECKS');
    console.log('='.repeat(60));

    // Check for issues
    const issues = [];

    if (data.streak?.dates) {
      issues.push('❌ Legacy streak.dates field still exists!');
    }

    if (!data.xp?.xpGainedToday && data.xp?.xpGainedToday !== 0) {
      issues.push('⚠️  Missing xp.xpGainedToday field');
    }

    if (!data.xp?.weeklyXP && data.xp?.weeklyXP !== 0) {
      issues.push('⚠️  Missing xp.weeklyXP field');
    }

    if (!data.xp?.monthlyXP && data.xp?.monthlyXP !== 0) {
      issues.push('⚠️  Missing xp.monthlyXP field');
    }

    if (!data.sessions?.todaySessions && data.sessions?.todaySessions !== 0) {
      issues.push('⚠️  Missing sessions.todaySessions field');
    }

    if (!data.sessions?.weekSessions && data.sessions?.weekSessions !== 0) {
      issues.push('⚠️  Missing sessions.weekSessions field');
    }

    if (!data.sessions?.monthSessions && data.sessions?.monthSessions !== 0) {
      issues.push('⚠️  Missing sessions.monthSessions field');
    }

    if (issues.length === 0) {
      console.log('✅ Document structure is correct!');
    } else {
      console.log('Found issues:');
      issues.forEach(issue => console.log('  ' + issue));
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Main
const userId = process.argv[2] || '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
checkUserStats(userId).then(() => {
  console.log('✅ Check complete\n');
  process.exit(0);
});
