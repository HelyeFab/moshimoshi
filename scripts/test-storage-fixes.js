#!/usr/bin/env node

/**
 * Test script to verify dual storage implementation fixes
 * Tests that free users don't write to Firebase and premium users do
 */

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3006'

// Test credentials (you'll need to update these)
const FREE_USER_TOKEN = process.env.FREE_USER_TOKEN || ''
const PREMIUM_USER_TOKEN = process.env.PREMIUM_USER_TOKEN || ''

async function testTodoCreation(token, userType) {
  console.log(`\n🧪 Testing TODO creation for ${userType} user...`)

  try {
    const response = await fetch(`${BASE_URL}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${token}`
      },
      body: JSON.stringify({
        title: `Test todo - ${userType} - ${Date.now()}`,
        description: 'Testing dual storage implementation',
        priority: 'medium'
      })
    })

    const data = await response.json()

    if (data.storage) {
      console.log(`✅ Storage location: ${data.storage.location}`)
      console.log(`   Sync enabled: ${data.storage.syncEnabled}`)
      console.log(`   Plan: ${data.storage.plan}`)

      // Validate correct storage behavior
      if (userType === 'FREE' && data.storage.location !== 'local') {
        console.error('❌ ERROR: Free user should have local storage only!')
        return false
      }
      if (userType === 'PREMIUM' && data.storage.location !== 'both') {
        console.error('❌ ERROR: Premium user should have both storage!')
        return false
      }
      console.log(`✅ ${userType} user storage correctly configured`)
      return true
    } else {
      console.error('❌ No storage information in response')
      console.log('Response:', data)
      return false
    }
  } catch (error) {
    console.error(`❌ Error testing ${userType} user:`, error.message)
    return false
  }
}

async function testXPTracking(token, userType) {
  console.log(`\n🧪 Testing XP tracking for ${userType} user...`)

  try {
    const response = await fetch(`${BASE_URL}/api/xp/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${token}`
      },
      body: JSON.stringify({
        eventType: 'review_completed',
        amount: 10,
        source: 'test-script',
        metadata: {
          idempotencyKey: `test-${userType}-${Date.now()}`
        }
      })
    })

    const data = await response.json()

    if (data.storage) {
      console.log(`✅ Storage location: ${data.storage.location}`)
      console.log(`   XP gained: ${data.data?.xpGained || 0}`)

      // Validate correct storage behavior
      if (userType === 'FREE' && data.storage.location !== 'local') {
        console.error('❌ ERROR: Free user XP should be local only!')
        return false
      }
      if (userType === 'PREMIUM' && data.storage.location !== 'both') {
        console.error('❌ ERROR: Premium user XP should sync to cloud!')
        return false
      }
      console.log(`✅ ${userType} user XP storage correctly configured`)
      return true
    } else {
      console.error('❌ No storage information in XP response')
      console.log('Response:', data)
      return false
    }
  } catch (error) {
    console.error(`❌ Error testing XP for ${userType} user:`, error.message)
    return false
  }
}

async function checkMonitoringData() {
  console.log('\n📊 Checking monitoring data...')

  try {
    // This requires admin access
    const response = await fetch(`${BASE_URL}/api/admin/monitoring/firebase-usage`, {
      headers: {
        'Cookie': `session=${PREMIUM_USER_TOKEN}` // Assuming premium user is admin
      }
    })

    if (response.status === 403) {
      console.log('⚠️  Cannot access monitoring (not admin)')
      return
    }

    const data = await response.json()

    if (data.success) {
      console.log('\n📈 Firebase Usage Summary:')
      console.log(`   Total operations: ${data.data.summary.totalOperations}`)
      console.log(`   Free user ops: ${data.data.summary.freeUserOperations}`)
      console.log(`   Premium user ops: ${data.data.summary.premiumUserOperations}`)
      console.log(`   🚨 Violations: ${data.data.summary.violations}`)

      if (data.data.summary.violations > 0) {
        console.error('\n❌ CRITICAL: Free users are still accessing Firebase!')
        console.log('Recent violations:', data.data.violations.recent.slice(0, 3))
      } else {
        console.log('✅ No violations detected - free users are not accessing Firebase')
      }

      console.log('\n💰 Cost Estimates:')
      console.log(`   Current cost: $${data.data.costEstimates.total.cost}`)
      console.log(`   Monthly projection: $${data.data.costEstimates.total.monthlyProjection}`)
      console.log(`   Potential savings: $${data.data.costEstimates.savings.monthlyPotential}/month`)
    }
  } catch (error) {
    console.error('❌ Error fetching monitoring data:', error.message)
  }
}

async function runTests() {
  console.log('🚀 Starting dual storage implementation tests...')
  console.log('=' .repeat(60))

  if (!FREE_USER_TOKEN || !PREMIUM_USER_TOKEN) {
    console.log('\n⚠️  Warning: No test tokens provided')
    console.log('Set FREE_USER_TOKEN and PREMIUM_USER_TOKEN environment variables')
    console.log('You can get these by logging in and checking browser cookies')
    console.log('\nExample:')
    console.log('FREE_USER_TOKEN="your-free-user-session" PREMIUM_USER_TOKEN="your-premium-session" node scripts/test-storage-fixes.js')
    return
  }

  let allTestsPassed = true

  // Test free user
  if (FREE_USER_TOKEN) {
    const todoTest = await testTodoCreation(FREE_USER_TOKEN, 'FREE')
    const xpTest = await testXPTracking(FREE_USER_TOKEN, 'FREE')
    allTestsPassed = allTestsPassed && todoTest && xpTest
  }

  // Test premium user
  if (PREMIUM_USER_TOKEN) {
    const todoTest = await testTodoCreation(PREMIUM_USER_TOKEN, 'PREMIUM')
    const xpTest = await testXPTracking(PREMIUM_USER_TOKEN, 'PREMIUM')
    allTestsPassed = allTestsPassed && todoTest && xpTest
  }

  // Check monitoring
  await checkMonitoringData()

  console.log('\n' + '=' .repeat(60))
  if (allTestsPassed) {
    console.log('✅ All tests passed! Dual storage is working correctly.')
  } else {
    console.log('❌ Some tests failed. Check the implementation.')
  }
}

// Run the tests
runTests().catch(console.error)