#!/usr/bin/env node

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

// Helper to get date string in UTC format (YYYY-MM-DD)
function getDateString(daysOffset = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysOffset)
  return date.toISOString().split('T')[0]
}

// Calculate days between dates
function daysBetween(date1String, date2String) {
  const d1 = new Date(date1String + 'T00:00:00.000Z')
  const d2 = new Date(date2String + 'T00:00:00.000Z')
  const diffMs = d2.getTime() - d1.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

async function checkStreakStatus() {
  const userStatsRef = db.collection('user_stats').doc(userId)
  const doc = await userStatsRef.get()

  if (!doc.exists) {
    console.log('User not found')
    process.exit(1)
  }

  const data = doc.data()
  const today = getDateString(0)
  const lastActivity = data.dates?.lastActivityDate || 'Never'
  const currentStreak = data.streak?.current || 0
  const bestStreak = data.streak?.best || 0
  const brokenAt = data.streak?.brokenAt
  const userXP = data.xp?.total || 0
  const xpGainedToday = data.xp?.xpGainedToday || 0
  const lastXPDate = data.xp?.lastXPDate || 'Never'

  const daysSinceActivity = lastActivity !== 'Never' ? daysBetween(lastActivity, today) : null

  console.log('\n' + '='.repeat(70))
  console.log('STREAK STATUS ANALYSIS')
  console.log('='.repeat(70))
  console.log(`User ID: ${userId}`)
  console.log(`Today (UTC): ${today}`)
  console.log()

  console.log('CURRENT DATA:')
  console.log(`  Current Streak: ${currentStreak} days`)
  console.log(`  Best Streak: ${bestStreak} days`)
  console.log(`  Total XP: ${userXP}`)
  console.log(`  XP Gained Today: ${xpGainedToday}`)
  console.log(`  Last XP Date: ${lastXPDate}`)
  console.log(`  Last Activity Date: ${lastActivity}`)
  console.log(`  Broken At: ${brokenAt || 'Not broken'}`)
  console.log()

  console.log('STREAK ANALYSIS:')
  if (lastActivity === 'Never') {
    console.log('  No activity recorded yet')
  } else {
    console.log(`  Days since last activity: ${daysSinceActivity} days`)

    // Grace period is 24 hours (within 1 day)
    const gracePeriodHours = 24
    const withinGrace = daysSinceActivity <= 1

    console.log(`  Within grace period (<=1 day): ${withinGrace ? 'YES' : 'NO'}`)

    if (daysSinceActivity > 1) {
      // Calculate when streak should have broken
      const breakDate = new Date(lastActivity + 'T00:00:00.000Z')
      breakDate.setUTCDate(breakDate.getUTCDate() + 2) // Grace period + 1 day
      console.log()
      console.log('  STREAK SHOULD HAVE BROKEN:')
      console.log(
        `    Streak break date: ${breakDate.toISOString().split('T')[0]} (grace period expired)`
      )
      console.log(`    Days overdue: ${daysSinceActivity - 1} days`)

      if (currentStreak > 0 && !brokenAt) {
        console.log()
        console.log('  WARNING: Streak is still > 0 but grace period has expired!')
        console.log('  Auto-break should trigger on next dashboard visit.')
      }
    } else if (daysSinceActivity === 1) {
      console.log()
      console.log('  Streak is within grace period')
      console.log('  User has until end of today to maintain streak')
    } else {
      console.log()
      console.log('  User was active today - streak is safe')
    }
  }

  // Check save window eligibility (if broken)
  if (brokenAt || (currentStreak === 0 && bestStreak > 0 && daysSinceActivity > 1)) {
    console.log()
    console.log('SAVE WINDOW ANALYSIS:')
    const daysSinceBreak = brokenAt ? daysBetween(brokenAt.split('T')[0], today) : 0
    const withinSaveWindow = daysSinceActivity >= 1 && daysSinceActivity <= 3
    const cost = withinSaveWindow ? 25 * daysSinceActivity : null

    console.log(`  Days since activity (for cost): ${daysSinceActivity}`)
    if (brokenAt) {
      console.log(`  Days since break: ${daysSinceBreak}`)
    }
    console.log(`  Within save window (1-3 days): ${withinSaveWindow ? 'YES' : 'NO'}`)
    if (withinSaveWindow) {
      console.log(`  Save cost: ${cost} XP (25 x ${daysSinceActivity} days)`)
      console.log(`  Can afford: ${userXP >= cost ? 'YES' : 'NO'} (have ${userXP} XP)`)
    } else if (daysSinceActivity > 3) {
      console.log(`  Too late to save - beyond 3-day window`)
    }
  }

  console.log('='.repeat(70))

  process.exit(0)
}

checkStreakStatus().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
