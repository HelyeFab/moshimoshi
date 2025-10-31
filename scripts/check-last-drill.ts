#!/usr/bin/env tsx
/**
 * Check Last Drill Session
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = require('../firebase-admin-key.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()

async function getLastDrill(userId: string) {
  // Get all drill sessions (without orderBy to avoid index requirement)
  const drillSnapshot = await db.collection('drill_sessions')
    .where('userId', '==', userId)
    .get()

  if (drillSnapshot.empty) {
    console.log('No drill sessions found')
    return
  }

  // Sort manually
  const sessions = drillSnapshot.docs
    .map(doc => doc.data())
    .sort((a, b) => {
      const timeA = new Date(a.startedAt).getTime()
      const timeB = new Date(b.startedAt).getTime()
      return timeB - timeA // Descending
    })

  const lastDrill = sessions[0]

  console.log('\n🎯 Last Drill Session:')
  console.log('  Started:', lastDrill.startedAt)
  console.log('  Completed:', lastDrill.completedAt || 'Not completed')
  console.log('  Score:', lastDrill.score, '/', lastDrill.questions?.length || 0)

  const accuracy = lastDrill.accuracy
  if (accuracy !== undefined && accuracy !== null) {
    console.log('  Accuracy:', accuracy.toFixed(1) + '%')
  } else {
    console.log('  Accuracy: N/A')
  }

  console.log('  Mode:', lastDrill.mode)
  console.log('  Word Type:', lastDrill.wordTypeFilter || 'All')

  // Check if today
  const drillDate = new Date(lastDrill.startedAt)
  const today = new Date()
  const isToday = drillDate.toDateString() === today.toDateString()

  console.log('\n📅 Timing:')
  console.log('  Date:', drillDate.toLocaleString())
  console.log('  Was today:', isToday ? '✅ Yes' : '❌ No')

  // Time since last drill
  const hoursSince = Math.floor((today.getTime() - drillDate.getTime()) / (1000 * 60 * 60))
  const daysSince = Math.floor(hoursSince / 24)

  if (daysSince > 0) {
    console.log('  Time ago:', daysSince + ' day(s) ago')
  } else {
    console.log('  Time ago:', hoursSince + ' hour(s) ago')
  }

  console.log('\n📊 Total drill sessions:', sessions.length)
}

async function main() {
  const userId = process.argv[2] || '8onZzlQg3tQxkw8pinSF9ow4Q6j2'

  console.log(`\n🔍 Checking drill sessions for user: ${userId}`)

  try {
    await getLastDrill(userId)
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
