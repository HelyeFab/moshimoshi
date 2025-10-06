/**
 * Test Script: Verify Time-Based Sync Logic
 *
 * Simulates a gamification sync to test that time-based metrics
 * are calculated correctly.
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

async function testSync(userId) {
  console.log(`\n🧪 Testing sync logic for user: ${userId}\n`);

  try {
    // Get current state
    const userStatsRef = db.collection('user_stats').doc(userId);
    const beforeDoc = await userStatsRef.get();

    if (!beforeDoc.exists) {
      console.log('❌ No user_stats document found');
      return;
    }

    const beforeData = beforeDoc.data();

    console.log('📊 BEFORE SYNC:');
    console.log(`   Total XP: ${beforeData.xp?.total || 0}`);
    console.log(`   XP Today: ${beforeData.xp?.xpGainedToday || 0}`);
    console.log(`   Total Sessions: ${beforeData.sessions?.totalSessions || 0}`);
    console.log(`   Sessions Today: ${beforeData.sessions?.todaySessions || 0}`);

    // Simulate adding 50 XP and completing a session
    const newTotalXP = (beforeData.xp?.total || 0) + 50;
    const newSessionCount = (beforeData.sessions?.totalSessions || 0) + 1;

    console.log('\n🔄 SIMULATING SYNC:');
    console.log(`   Adding 50 XP (${beforeData.xp?.total} → ${newTotalXP})`);
    console.log(`   Completing 1 session (${beforeData.sessions?.totalSessions} → ${newSessionCount})`);

    // Calculate what the sync endpoint would do
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const lastUpdated = beforeData.metadata?.lastUpdated
      ? new Date(beforeData.metadata.lastUpdated)
      : new Date(0);

    const isSameDay = (
      lastUpdated.getDate() === now.getDate() &&
      lastUpdated.getMonth() === now.getMonth() &&
      lastUpdated.getFullYear() === now.getFullYear()
    );

    const isSameWeek = lastUpdated >= weekStart;
    const isSameMonth = lastUpdated.getMonth() === now.getMonth() &&
                        lastUpdated.getFullYear() === now.getFullYear();

    // Calculate new values
    const xpGainedThisSync = 50;
    const expectedXpToday = isSameDay ? (beforeData.xp?.xpGainedToday || 0) + xpGainedThisSync : xpGainedThisSync;
    const expectedWeeklyXP = isSameWeek ? (beforeData.xp?.weeklyXP || 0) + xpGainedThisSync : xpGainedThisSync;
    const expectedMonthlyXP = isSameMonth ? (beforeData.xp?.monthlyXP || 0) + xpGainedThisSync : xpGainedThisSync;

    const sessionIncrement = 1;
    const expectedTodaySessions = isSameDay ? (beforeData.sessions?.todaySessions || 0) + sessionIncrement : sessionIncrement;
    const expectedWeekSessions = isSameWeek ? (beforeData.sessions?.weekSessions || 0) + sessionIncrement : sessionIncrement;
    const expectedMonthSessions = isSameMonth ? (beforeData.sessions?.monthSessions || 0) + sessionIncrement : sessionIncrement;

    console.log('\n📈 EXPECTED CALCULATIONS:');
    console.log(`   Same day as last sync: ${isSameDay}`);
    console.log(`   Same week as last sync: ${isSameWeek}`);
    console.log(`   Same month as last sync: ${isSameMonth}`);
    console.log(`   Expected XP today: ${expectedXpToday}`);
    console.log(`   Expected sessions today: ${expectedTodaySessions}`);

    // Create the update object (mimicking the sync endpoint)
    const updateData = {
      xp: {
        total: newTotalXP,
        level: Math.max(1, Math.floor(newTotalXP / 1000)),
        levelTitle: getLevelTitle(Math.max(1, Math.floor(newTotalXP / 1000))),
        xpToNextLevel: 1000 - (newTotalXP % 1000),
        xpGainedToday: expectedXpToday,
        weeklyXP: expectedWeeklyXP,
        monthlyXP: expectedMonthlyXP
      },
      streak: {
        current: beforeData.streak?.current || 0,
        best: beforeData.streak?.best || 0
      },
      dates: {
        lastActivityDate: now.toISOString(),
        isActiveToday: true
      },
      sessions: {
        totalSessions: newSessionCount,
        todaySessions: expectedTodaySessions,
        weekSessions: expectedWeekSessions,
        monthSessions: expectedMonthSessions,
        averageAccuracy: beforeData.sessions?.averageAccuracy || 0,
        totalStudyTimeMinutes: beforeData.sessions?.totalStudyTimeMinutes || 0,
        totalItemsReviewed: beforeData.sessions?.totalItemsReviewed || 0
      },
      metadata: {
        lastUpdated: now.toISOString(),
        syncStatus: 'synced',
        dataHealth: 'healthy',
        schemaVersion: 2
      }
    };

    console.log('\n⚠️  DRY RUN - Not actually writing to database');
    console.log('To actually write, remove the dry-run guard in the script\n');

    // Uncomment to actually perform the update:
    // await userStatsRef.set(updateData, { merge: true });
    // console.log('✅ Update written to Firebase');

    console.log('📊 WOULD UPDATE TO:');
    console.log(JSON.stringify(updateData, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function getLevelTitle(level) {
  if (level < 5) return 'Beginner';
  if (level < 10) return 'Novice';
  if (level < 25) return 'Intermediate';
  if (level < 50) return 'Advanced';
  if (level < 75) return 'Expert';
  return 'Master';
}

// Main
const userId = process.argv[2] || '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
testSync(userId).then(() => {
  console.log('\n✅ Test complete\n');
  process.exit(0);
});
