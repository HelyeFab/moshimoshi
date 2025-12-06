#!/usr/bin/env node

/**
 * Quick script to apply s6 scenario without interactive prompts
 * s6 = 7-day streak, 2 days ago, 200 XP
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237',
  })
}

const db = admin.firestore()
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2'

function getDateString(daysOffset = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysOffset)
  return date.toISOString().split('T')[0]
}

async function applyS6Scenario() {
  console.log('\n' + '='.repeat(70))
  console.log('APPLYING S6 SCENARIO: Perfect save test')
  console.log('='.repeat(70))

  const userStatsRef = db.collection('user_stats').doc(userId)
  const twoDaysAgo = getDateString(-2)
  const now = new Date().toISOString()

  // Apply all changes in one update
  await userStatsRef.update({
    // Set streak to 7 (will be auto-broken by the app)
    'streak.current': 7,
    'streak.best': 9, // Keep best as 9
    'streak.brokenAt': null, // Clear brokenAt so auto-break can set it
    'streak.version': admin.firestore.FieldValue.increment(1),

    // Set last activity to 2 days ago (beyond grace period)
    'dates.lastActivityDate': twoDaysAgo,
    'dates.isActiveToday': false,

    // Set XP to 200 (enough to pay 50 XP cost)
    'xp.total': 200,
    'xp.level': 1,
    'xp.xpGainedToday': 0,
    'xp.lastXPDate': null,

    // Update metadata
    'metadata.lastUpdated': now,
  })

  console.log('\n✅ S6 Scenario Applied:')
  console.log(`   Streak: 7 days (will auto-break on dashboard load)`)
  console.log(`   Best: 9 days`)
  console.log(`   Last Activity: ${twoDaysAgo} (2 days ago)`)
  console.log(`   XP: 200`)
  console.log(`   brokenAt: cleared (will be set by auto-break)`)
  console.log()
  console.log('📋 NEXT STEPS:')
  console.log('   1. Clear localStorage in browser:')
  console.log('      localStorage.removeItem("moshimoshi_streak_save_prompt_date")')
  console.log('   2. Open dashboard: http://localhost:3000/dashboard')
  console.log('   3. Watch for XP Save Modal to appear!')
  console.log('   4. Modal should show cost: 50 XP (25 × 2 days)')
  console.log('='.repeat(70))

  process.exit(0)
}

applyS6Scenario().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
