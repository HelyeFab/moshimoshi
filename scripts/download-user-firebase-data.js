#!/usr/bin/env node

/**
 * Download Complete User Firebase Record
 *
 * Downloads all data for a specific user from all collections
 * and saves it locally for analysis
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function downloadUserData(userId) {
  const outputDir = path.join(__dirname, '..', 'firebase-user-data', userId);

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  console.log('=====================================');
  console.log(`📥 Downloading Firebase Data for User: ${userId}`);
  console.log(`📁 Output Directory: ${outputDir}`);
  console.log('=====================================\n');

  const userData = {
    userId,
    downloadDate: new Date().toISOString(),
    collections: {}
  };

  // 1. Get all root collections where user might have data
  console.log('🔍 Scanning root collections...\n');

  const rootCollections = [
    'users',
    'leaderboard_stats',
    'user_stats',
    'userPreferences',
    'pokemon',
    'usage',
    'drill_sessions',
    'logs',
    'leaderboard_optouts'
  ];

  for (const collectionName of rootCollections) {
    try {
      const doc = await db.collection(collectionName).doc(userId).get();

      if (doc.exists) {
        console.log(`✅ Found data in: ${collectionName}`);
        userData.collections[collectionName] = doc.data();

        // Check for subcollections
        const subcollections = await doc.ref.listCollections();
        if (subcollections.length > 0) {
          userData.collections[collectionName]._subcollections = {};

          for (const subcol of subcollections) {
            console.log(`   📂 Subcollection: ${collectionName}/${userId}/${subcol.id}`);
            const subdocs = await subcol.get();

            userData.collections[collectionName]._subcollections[subcol.id] = {};
            subdocs.forEach(subdoc => {
              userData.collections[collectionName]._subcollections[subcol.id][subdoc.id] = subdoc.data();
            });
          }
        }
      } else {
        console.log(`❌ No data in: ${collectionName}`);
      }
    } catch (error) {
      console.log(`⚠️  Error checking ${collectionName}: ${error.message}`);
    }
  }

  // 2. Search for documents where userId is a field
  console.log('\n🔍 Searching for documents with userId field...\n');

  const searchCollections = [
    'drill_sessions',
    'logs',
    'review_sessions',
    'study_sessions'
  ];

  for (const collectionName of searchCollections) {
    try {
      const query = await db.collection(collectionName)
        .where('userId', '==', userId)
        .limit(100)
        .get();

      if (!query.empty) {
        console.log(`✅ Found ${query.size} documents in: ${collectionName}`);
        userData.collections[`${collectionName}_by_userId`] = {};

        query.forEach(doc => {
          userData.collections[`${collectionName}_by_userId`][doc.id] = doc.data();
        });
      }
    } catch (error) {
      // Collection might not exist or no index
    }
  }

  // 3. Save data to files
  console.log('\n💾 Saving data to files...\n');

  // Save main JSON file
  const mainFile = path.join(outputDir, 'complete-firebase-data.json');
  await fs.writeFile(mainFile, JSON.stringify(userData, null, 2));
  console.log(`✅ Saved complete data to: complete-firebase-data.json`);

  // Save individual collection files
  for (const [collectionName, data] of Object.entries(userData.collections)) {
    const fileName = `${collectionName}.json`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ Saved: ${fileName}`);
  }

  // 4. Generate analysis report
  console.log('\n📊 Generating analysis report...\n');

  const report = {
    summary: {
      userId,
      totalCollections: Object.keys(userData.collections).length,
      downloadDate: userData.downloadDate
    },
    collections: {},
    duplicateData: [],
    recommendations: []
  };

  // Analyze each collection
  for (const [name, data] of Object.entries(userData.collections)) {
    const size = JSON.stringify(data).length;
    const hasSubcollections = data._subcollections ? Object.keys(data._subcollections).length : 0;

    report.collections[name] = {
      size: `${(size / 1024).toFixed(2)} KB`,
      fields: data._subcollections ? Object.keys(data).filter(k => k !== '_subcollections').length : Object.keys(data).length,
      subcollections: hasSubcollections
    };
  }

  // Identify duplicate data
  console.log('🔍 Identifying duplicate/redundant data...\n');

  // Check streak data duplication
  const streakSources = [];
  if (userData.collections.leaderboard_stats?.currentStreak !== undefined) {
    streakSources.push('leaderboard_stats');
  }
  if (userData.collections.users?._subcollections?.achievements?.activities?.currentStreak !== undefined) {
    streakSources.push('users/achievements/activities');
  }
  if (userData.collections.user_stats?.streak) {
    streakSources.push('user_stats (NEW UNIFIED)');
  }

  if (streakSources.length > 1) {
    report.duplicateData.push({
      type: 'streak',
      sources: streakSources,
      recommendation: 'Migrate to user_stats only'
    });
  }

  // Check XP data duplication
  const xpSources = [];
  if (userData.collections.leaderboard_stats?.totalXP !== undefined) {
    xpSources.push('leaderboard_stats');
  }
  if (userData.collections.users?._subcollections?.achievements?.data?.totalXp !== undefined) {
    xpSources.push('users/achievements/data');
  }
  if (userData.collections.user_stats?.xp) {
    xpSources.push('user_stats (NEW UNIFIED)');
  }

  if (xpSources.length > 1) {
    report.duplicateData.push({
      type: 'xp',
      sources: xpSources,
      recommendation: 'Migrate to user_stats only'
    });
  }

  // Check achievements duplication
  const achievementSources = [];
  if (userData.collections.leaderboard_stats?.achievementPoints !== undefined) {
    achievementSources.push('leaderboard_stats');
  }
  if (userData.collections.users?._subcollections?.achievements?.data) {
    achievementSources.push('users/achievements/data');
  }
  if (userData.collections.user_stats?.achievements) {
    achievementSources.push('user_stats (NEW UNIFIED)');
  }

  if (achievementSources.length > 1) {
    report.duplicateData.push({
      type: 'achievements',
      sources: achievementSources,
      recommendation: 'Migrate to user_stats only'
    });
  }

  // Generate recommendations
  if (userData.collections.user_stats) {
    report.recommendations.push('✅ user_stats collection exists - ready for migration');

    if (userData.collections.leaderboard_stats) {
      report.recommendations.push('🗑️ Can remove leaderboard_stats after migration');
    }

    if (userData.collections.users?._subcollections?.achievements) {
      report.recommendations.push('🗑️ Can remove users/achievements subcollection after migration');
    }

    if (userData.collections.users?._subcollections?.statistics) {
      report.recommendations.push('🗑️ Can remove users/statistics subcollection after migration');
    }
  } else {
    report.recommendations.push('❌ user_stats collection missing - needs migration');
  }

  // Save report
  const reportFile = path.join(outputDir, 'analysis-report.json');
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log('✅ Saved analysis report\n');

  // Print summary
  console.log('=====================================');
  console.log('📊 Analysis Summary');
  console.log('=====================================\n');
  console.log(`Total Collections: ${report.summary.totalCollections}`);
  console.log(`Duplicate Data Types: ${report.duplicateData.length}`);

  if (report.duplicateData.length > 0) {
    console.log('\n🔄 Duplicate Data Found:');
    report.duplicateData.forEach(dup => {
      console.log(`  - ${dup.type}: ${dup.sources.join(', ')}`);
    });
  }

  console.log('\n💡 Recommendations:');
  report.recommendations.forEach(rec => {
    console.log(`  ${rec}`);
  });

  console.log('\n✅ Download complete!');
  console.log(`📁 All data saved to: ${outputDir}`);

  return userData;
}

// Run
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
downloadUserData(userId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });