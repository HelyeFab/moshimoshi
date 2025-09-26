#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function rebuildLeaderboard() {
  console.log('\n=====================================');
  console.log('🔨 Rebuilding Leaderboard Snapshots');
  console.log('=====================================\n');

  try {
    // Get all users from user_stats
    const statsSnapshot = await db.collection('user_stats')
      .orderBy('xp.total', 'desc')
      .get();

    console.log(`Found ${statsSnapshot.size} users in user_stats`);

    // Check for opt-outs
    const optOutsSnapshot = await db.collection('leaderboard_optouts').get();
    const optedOutUsers = new Set(optOutsSnapshot.docs.map(doc => doc.id));
    console.log(`Users opted out: ${optedOutUsers.size}`);

    // Build leaderboard entries with scores
    const scoredEntries = [];

    for (const doc of statsSnapshot.docs) {
      const userId = doc.id;
      if (optedOutUsers.has(userId)) continue;

      const data = doc.data();

      // Calculate achievement rarity distribution
      const achievementCount = data.achievements?.unlockedCount || 0;
      const rarityCount = {
        legendary: Math.floor(achievementCount * 0.02),
        epic: Math.floor(achievementCount * 0.08),
        rare: Math.floor(achievementCount * 0.2),
        uncommon: Math.floor(achievementCount * 0.3),
        common: Math.floor(achievementCount * 0.4)
      };

      // Calculate score for All Time leaderboard
      const totalPoints = data.achievements?.totalPoints || 0;
      const totalXP = data.xp?.total || 0;
      const bestStreak = data.streak?.best || 0;
      const score = totalPoints + totalXP + (bestStreak * 3);

      console.log(`Score for ${data.displayName}: ${totalPoints} + ${totalXP} + ${bestStreak}*3 = ${score}`);

      scoredEntries.push({
        score,
        entry: {
          rank: 0, // Will be set after sorting
          userId,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL,
          totalPoints: totalPoints,
          totalXP: totalXP,
          currentLevel: data.xp?.level || 1,
          currentStreak: data.streak?.current || 0,
          bestStreak: bestStreak,
          achievementCount: achievementCount,
          achievementRarity: rarityCount,
          lastActive: data.streak?.lastActivityDate ?
            new Date(data.streak.lastActivityDate).getTime() : Date.now(),
          subscription: data.tier === 'premium' ? 'premium' : 'free',
          isPublic: true,
          isAnonymous: false,
          totalScore: score // Add the calculated score
        }
      });
    }

    // Sort by score (descending)
    scoredEntries.sort((a, b) => b.score - a.score);

    // Assign ranks and extract entries
    const entries = scoredEntries.map((item, index) => {
      item.entry.rank = index + 1;
      return item.entry;
    });

    console.log(`\nBuilt ${entries.length} leaderboard entries`);

    // Create snapshots for all timeframes
    const now = Date.now();
    const snapshots = ['daily', 'weekly', 'monthly', 'allTime'].map(timeframe => ({
      id: `${timeframe}-${now}`,
      timeframe,
      timestamp: now,
      entries: entries.slice(0, 100), // Top 100
      totalPlayers: entries.length,
      lastUpdated: now
    }));

    // Save snapshots
    const batch = db.batch();
    for (const snapshot of snapshots) {
      batch.set(
        db.collection('leaderboard_snapshots').doc(`${snapshot.timeframe}-latest`),
        snapshot
      );
    }
    await batch.commit();

    console.log('✅ Successfully saved all leaderboard snapshots');

    // Show top 5 players
    console.log('\n📊 Top 5 Players:');
    entries.slice(0, 5).forEach(entry => {
      console.log(`${entry.rank}. ${entry.displayName} - XP: ${entry.totalXP}, Achievements: ${entry.achievementCount}, Streak: ${entry.currentStreak}`);
    });

    // Check if specific user is in leaderboard
    const targetUser = entries.find(e => e.userId === 'r7r6at83BUPIjD69XatI4EGIECr1');
    if (targetUser) {
      console.log(`\n✅ Your rank: #${targetUser.rank}`);
      console.log(`   XP: ${targetUser.totalXP}, Achievements: ${targetUser.achievementCount}`);
    }

  } catch (error) {
    console.error('Error rebuilding leaderboard:', error);
  }
}

rebuildLeaderboard()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
