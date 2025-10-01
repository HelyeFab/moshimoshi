const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkRealCounts() {
  console.log('📊 Checking real stats counts in Firebase...\n');

  // Count user_stats documents
  const userStatsSnapshot = await db.collection('user_stats').get();
  const userStatsCount = userStatsSnapshot.size;

  // Count leaderboard_stats documents
  const leaderboardStatsSnapshot = await db.collection('leaderboard_stats').get();
  const leaderboardStatsCount = leaderboardStatsSnapshot.size;

  // Count users with user_stats but not in leaderboard_stats
  const userStatsIds = new Set(userStatsSnapshot.docs.map(doc => doc.id));
  const leaderboardStatsIds = new Set(leaderboardStatsSnapshot.docs.map(doc => doc.id));

  const missingFromLeaderboard = [...userStatsIds].filter(id => !leaderboardStatsIds.has(id));
  const extraInLeaderboard = [...leaderboardStatsIds].filter(id => !userStatsIds.has(id));

  console.log('📈 Real Counts:');
  console.log(`   user_stats documents: ${userStatsCount}`);
  console.log(`   leaderboard_stats documents: ${leaderboardStatsCount}`);
  console.log(`   Missing from leaderboard: ${missingFromLeaderboard.length}`);
  console.log(`   Extra in leaderboard: ${extraInLeaderboard.length}`);

  if (missingFromLeaderboard.length > 0) {
    console.log('\n⚠️  Users in user_stats but not leaderboard_stats:');
    missingFromLeaderboard.forEach(id => console.log(`   - ${id}`));
  }

  if (extraInLeaderboard.length > 0) {
    console.log('\n⚠️  Users in leaderboard_stats but not user_stats:');
    extraInLeaderboard.forEach(id => console.log(`   - ${id}`));
  }

  const consistentCount = userStatsCount - missingFromLeaderboard.length;
  console.log(`\n✅ Consistent users: ${consistentCount}`);
  console.log(`❌ Inconsistent users: ${missingFromLeaderboard.length + extraInLeaderboard.length}`);

  process.exit(0);
}

checkRealCounts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
