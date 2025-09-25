/**
 * Test Script: Verify Flashcard Deck Storage for Premium Users
 *
 * This script tests that premium users can save flashcard decks to Firebase
 * and free users cannot.
 *
 * Usage: npx tsx scripts/test-flashcard-storage.ts
 */

import * as admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, '../moshimoshi-service-account.json')
console.log(`📁 Loading service account from: ${serviceAccountPath}`)

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    })
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error)
  process.exit(1)
}

const db = admin.firestore()

async function checkUserFlashcards(userId: string) {
  try {
    console.log(`\n🔍 Checking user: ${userId}`)

    // 1. Check user subscription status
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      console.log(`❌ User not found`)
      return
    }

    const userData = userDoc.data()
    const subscription = userData?.subscription
    const isPremium = subscription?.status === 'active' &&
                     (subscription?.plan === 'premium_monthly' ||
                      subscription?.plan === 'premium_yearly')

    console.log(`📋 User details:`)
    console.log(`   Name: ${userData?.displayName || 'Unknown'}`)
    console.log(`   Plan: ${subscription?.plan || 'free'}`)
    console.log(`   Status: ${subscription?.status || 'inactive'}`)
    console.log(`   Is Premium: ${isPremium ? '✅ Yes' : '❌ No'}`)

    // 2. Check flashcard decks in Firebase
    const decksSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('flashcardDecks')
      .get()

    console.log(`\n🎴 Flashcard Decks in Firebase:`)
    console.log(`   Count: ${decksSnapshot.size}`)

    if (decksSnapshot.size > 0) {
      console.log(`   Decks:`)
      decksSnapshot.docs.forEach(doc => {
        const deck = doc.data()
        console.log(`   - ${deck.name} (${deck.stats?.totalCards || 0} cards)`)
      })
    }

    // 3. Verify storage rules
    if (isPremium) {
      if (decksSnapshot.size === 0) {
        console.log(`\n⚠️  Premium user but no decks found in Firebase`)
        console.log(`   This could mean:`)
        console.log(`   1. User hasn't created any decks yet`)
        console.log(`   2. Decks might be stuck in local storage`)
      } else {
        console.log(`\n✅ Premium user with decks correctly stored in Firebase`)
      }
    } else {
      if (decksSnapshot.size > 0) {
        console.log(`\n❌ WARNING: Free user has decks in Firebase!`)
        console.log(`   This violates dual storage rules`)
      } else {
        console.log(`\n✅ Free user correctly has no decks in Firebase`)
        console.log(`   (Decks should be in local IndexedDB)`)
      }
    }

  } catch (error) {
    console.error(`❌ Error checking user ${userId}:`, error)
  }
}

async function testFlashcardStorage() {
  console.log('🚀 Flashcard Storage Test')
  console.log('=========================\n')

  // Get all users
  const usersSnapshot = await db.collection('users').limit(20).get()
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  console.log(`Found ${users.length} users to check`)

  // Separate users by subscription status
  const premiumUsers = users.filter(u =>
    u.subscription?.status === 'active' &&
    (u.subscription?.plan === 'premium_monthly' ||
     u.subscription?.plan === 'premium_yearly')
  )
  const freeUsers = users.filter(u => !premiumUsers.includes(u))

  console.log(`\n📊 User Breakdown:`)
  console.log(`   Premium users: ${premiumUsers.length}`)
  console.log(`   Free users: ${freeUsers.length}`)

  // Check a few of each type
  console.log('\n' + '='.repeat(50))
  console.log('CHECKING PREMIUM USERS')
  console.log('='.repeat(50))

  for (const user of premiumUsers.slice(0, 3)) {
    await checkUserFlashcards(user.id)
  }

  console.log('\n' + '='.repeat(50))
  console.log('CHECKING FREE USERS')
  console.log('='.repeat(50))

  for (const user of freeUsers.slice(0, 3)) {
    await checkUserFlashcards(user.id)
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 STORAGE VERIFICATION SUMMARY')
  console.log('='.repeat(50))

  // Count decks by user type
  let premiumDecksCount = 0
  let freeDecksCount = 0

  for (const user of premiumUsers) {
    const decks = await db.collection('users').doc(user.id).collection('flashcardDecks').get()
    premiumDecksCount += decks.size
  }

  for (const user of freeUsers) {
    const decks = await db.collection('users').doc(user.id).collection('flashcardDecks').get()
    freeDecksCount += decks.size
  }

  console.log(`\nPremium Users:`)
  console.log(`   Total decks in Firebase: ${premiumDecksCount}`)
  console.log(`   Average per user: ${(premiumDecksCount / premiumUsers.length).toFixed(1)}`)

  console.log(`\nFree Users:`)
  console.log(`   Total decks in Firebase: ${freeDecksCount}`)
  if (freeDecksCount > 0) {
    console.log(`   ❌ ERROR: Free users should have 0 decks in Firebase!`)
  } else {
    console.log(`   ✅ Correct: No Firebase storage for free users`)
  }
}

// Run the test
testFlashcardStorage()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })