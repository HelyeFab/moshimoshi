#!/usr/bin/env node

/**
 * Validation Script for Unified Stats Migration
 *
 * Checks that the unified stats system is working correctly
 * and that data is consistent across all sources.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function validateUserStats(userId) {
  console.log('\n=====================================');
  console.log(`🔍 Validating Stats for User: ${userId}`);
  console.log('=====================================\n');

  const results = {
    userId,
    timestamp: new Date().toISOString(),
    checks: [],
    errors: [],
    warnings: []
  };

  try {
    // 1. Check if user_stats exists
    console.log('✅ Checking user_stats collection...');
    const userStatsDoc = await db.collection('user_stats').doc(userId).get();

    if (userStatsDoc.exists) {
      results.checks.push('user_stats exists');
      const stats = userStatsDoc.data();

      console.log('  ✅ user_stats document found');
      console.log(`  📊 Current Streak: ${stats.streak?.current || 0}`);
      console.log(`  ⭐ Total XP: ${stats.xp?.total || 0}`);
      console.log(`  🏆 Achievements: ${stats.achievements?.unlockedCount || 0}`);
    } else {
      results.errors.push('user_stats document missing');
      console.log('  ❌ user_stats document NOT found');
    }

    // 2. Check for old collections
    console.log('\n🔍 Checking for old collections...');
    const oldCollections = [
      { name: 'leaderboard_stats', path: ['leaderboard_stats', userId] },
      { name: 'achievements/data', path: ['users', userId, 'achievements', 'data'] },
      { name: 'achievements/activities', path: ['users', userId, 'achievements', 'activities'] },
      { name: 'statistics/overall', path: ['users', userId, 'statistics', 'overall'] }
    ];

    for (const col of oldCollections) {
      let docRef = db;
      for (let i = 0; i < col.path.length - 1; i += 2) {
        docRef = docRef.collection(col.path[i]).doc(col.path[i + 1]);
      }
      if (col.path.length % 2 === 1) {
        docRef = docRef.collection(col.path[col.path.length - 1]);
      }

      const doc = await (col.path.length % 2 === 0 ? docRef.get() : docRef.limit(1).get());
      const exists = col.path.length % 2 === 0 ? doc.exists : !doc.empty;

      if (exists) {
        results.warnings.push(`Old collection still exists: ${col.name}`);
        console.log(`  ⚠️  ${col.name} - Still exists (should be migrated)`);
      } else {
        results.checks.push(`${col.name} removed`);
        console.log(`  ✅ ${col.name} - Removed or empty`);
      }
    }

    // 3. Data consistency checks
    if (userStatsDoc.exists) {
      console.log('\n🔍 Checking data consistency...');
      const stats = userStatsDoc.data();

      // Check streak consistency
      if (stats.streak) {
        const dateCount = Object.keys(stats.streak.dates || {}).length;
        if (stats.streak.current > dateCount) {
          results.errors.push('Streak count inconsistent with dates');
          console.log(`  ❌ Streak inconsistency: current=${stats.streak.current}, dates=${dateCount}`);
        } else {
          results.checks.push('Streak data consistent');
          console.log(`  ✅ Streak data consistent`);
        }
      }

      // Check schema version
      if (stats.metadata?.schemaVersion === 2) {
        results.checks.push('Schema version correct');
        console.log(`  ✅ Schema version: 2 (latest)`);
      } else {
        results.warnings.push('Schema version outdated');
        console.log(`  ⚠️  Schema version: ${stats.metadata?.schemaVersion || 'unknown'}`);
      }

      // Check data health
      if (stats.metadata?.dataHealth === 'healthy') {
        results.checks.push('Data health good');
        console.log(`  ✅ Data health: healthy`);
      } else {
        results.warnings.push(`Data health: ${stats.metadata?.dataHealth}`);
        console.log(`  ⚠️  Data health: ${stats.metadata?.dataHealth || 'unknown'}`);
      }
    }

    // 4. Test API endpoint
    console.log('\n🔍 Testing API endpoint...');
    console.log('  ℹ️  API test requires running server');

    // 5. Summary
    console.log('\n=====================================');
    console.log('📊 Validation Summary');
    console.log('=====================================\n');
    console.log(`✅ Passed Checks: ${results.checks.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors found:');
      results.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      results.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    // Determine overall status
    if (results.errors.length === 0 && results.warnings.length === 0) {
      console.log('\n✅ VALIDATION PASSED - User fully migrated!');
    } else if (results.errors.length === 0) {
      console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS - Migration complete but old data remains');
    } else {
      console.log('\n❌ VALIDATION FAILED - Issues need to be resolved');
    }

  } catch (error) {
    console.error('\n❌ Validation error:', error);
    results.errors.push(`Validation error: ${error.message}`);
  }

  return results;
}

// Run validation
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
validateUserStats(userId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });