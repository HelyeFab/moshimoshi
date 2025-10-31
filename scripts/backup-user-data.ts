#!/usr/bin/env tsx
/**
 * Backup User Data Script
 *
 * Exports all user data before migration to new schema.
 * Run: npx tsx scripts/backup-user-data.ts <userId>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Firebase Admin with service account
const serviceAccount = require('../firebase-admin-key.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()

interface BackupData {
  timestamp: string
  userId: string
  gamification: any
  drillSessions: any[]
  reviewSessions: any[]
  userStats: any
}

async function backupUserData(userId: string): Promise<BackupData> {
  console.log(`\n📦 Starting backup for user: ${userId}`)

  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    userId,
    gamification: null,
    drillSessions: [],
    reviewSessions: [],
    userStats: null
  }

  // 1. Backup user_stats document
  console.log('  Fetching user_stats...')
  const userStatsDoc = await db.collection('user_stats').doc(userId).get()
  if (userStatsDoc.exists) {
    backup.userStats = userStatsDoc.data()
    console.log(`  ✅ user_stats found:`, {
      xp: backup.userStats?.xp?.total || 0,
      streak: backup.userStats?.streak?.current || 0,
      sessions: backup.userStats?.sessions?.totalSessions || 0
    })
  } else {
    console.log('  ⚠️  No user_stats document found')
  }

  // 2. Backup drill_sessions
  console.log('  Fetching drill_sessions...')
  const drillSnapshot = await db.collection('drill_sessions')
    .where('userId', '==', userId)
    .get()

  backup.drillSessions = drillSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  console.log(`  ✅ Found ${backup.drillSessions.length} drill sessions`)

  // 3. Backup review_sessions (if any)
  console.log('  Fetching review_sessions...')
  const reviewSnapshot = await db.collection('review_sessions')
    .where('userId', '==', userId)
    .get()

  backup.reviewSessions = reviewSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  console.log(`  ✅ Found ${backup.reviewSessions.length} review sessions`)

  // 4. Extract gamification summary
  if (backup.userStats) {
    backup.gamification = {
      totalXP: backup.userStats.xp?.total || 0,
      currentLevel: backup.userStats.xp?.level || 1,
      currentStreak: backup.userStats.streak?.current || 0,
      bestStreak: backup.userStats.streak?.best || 0,
      lastActivityDate: backup.userStats.dates?.lastActivityDate || null,
      freezesRemaining: backup.userStats.streak?.freezesRemaining || 3,
      unlockedAchievements: backup.userStats.achievements?.unlockedIds || [],
      achievementProgress: backup.userStats.achievements?.progress || {},
      sessionCount: backup.userStats.sessions?.totalSessions || 0,
      version: backup.userStats.streak?.version || 0
    }
  }

  return backup
}

async function saveBackup(backup: BackupData) {
  const backupDir = path.join(__dirname, '..', 'backups')

  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const date = new Date().toISOString().split('T')[0]
  const filename = `${date}-user-data.json`
  const filepath = path.join(backupDir, filename)

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2))

  console.log(`\n✅ Backup saved to: ${filepath}`)
  console.log(`📊 Backup size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`)
}

async function verifyBackup(filepath: string) {
  console.log(`\n🔍 Verifying backup...`)

  const backup: BackupData = JSON.parse(fs.readFileSync(filepath, 'utf-8'))

  console.log(`\n📈 Backup Summary:`)
  console.log(`  User ID: ${backup.userId}`)
  console.log(`  Timestamp: ${backup.timestamp}`)
  console.log(`\n  Gamification:`)
  console.log(`    Total XP: ${backup.gamification?.totalXP || 0}`)
  console.log(`    Level: ${backup.gamification?.currentLevel || 1}`)
  console.log(`    Current Streak: ${backup.gamification?.currentStreak || 0}`)
  console.log(`    Best Streak: ${backup.gamification?.bestStreak || 0}`)
  console.log(`    Last Activity: ${backup.gamification?.lastActivityDate || 'N/A'}`)
  console.log(`    Achievements: ${backup.gamification?.unlockedAchievements?.length || 0}`)
  console.log(`    Total Sessions: ${backup.gamification?.sessionCount || 0}`)
  console.log(`\n  Collections:`)
  console.log(`    Drill Sessions: ${backup.drillSessions?.length || 0}`)
  console.log(`    Review Sessions: ${backup.reviewSessions?.length || 0}`)

  // Validate data
  let hasIssues = false

  if (backup.gamification?.currentStreak > backup.gamification?.bestStreak) {
    console.log(`\n  ⚠️  Issue: Current streak (${backup.gamification.currentStreak}) > Best streak (${backup.gamification.bestStreak})`)
    hasIssues = true
  }

  if (backup.gamification?.totalXP < 0) {
    console.log(`\n  ⚠️  Issue: Negative XP (${backup.gamification.totalXP})`)
    hasIssues = true
  }

  if (!hasIssues) {
    console.log(`\n  ✅ All data looks valid!`)
  }

  return backup
}

async function main() {
  const userId = process.argv[2]

  if (!userId) {
    console.error('❌ Error: User ID required')
    console.log('Usage: npx tsx scripts/backup-user-data.ts <userId>')
    process.exit(1)
  }

  try {
    // 1. Backup data
    const backup = await backupUserData(userId)

    // 2. Save to file
    await saveBackup(backup)

    // 3. Verify backup
    const date = new Date().toISOString().split('T')[0]
    const filepath = path.join(__dirname, '..', 'backups', `${date}-user-data.json`)
    await verifyBackup(filepath)

    console.log(`\n✨ Backup complete!\n`)
    process.exit(0)
  } catch (error) {
    console.error('❌ Backup failed:', error)
    process.exit(1)
  }
}

main()
