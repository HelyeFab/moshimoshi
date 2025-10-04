#!/usr/bin/env node

const PORT = process.env.PORT || 3000

// Test script to verify streak API is working
async function testStreakAPI() {
  console.log('=== Testing Streak API ===\n')

  try {
    // Test 1: Check session endpoint
    console.log('1. Testing session endpoint...')
    const sessionResponse = await fetch(`http://localhost:${PORT}/api/auth/session`, {
      credentials: 'include',
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    })
    const sessionData = await sessionResponse.json()
    console.log('Session response:', {
      status: sessionResponse.status,
      authenticated: sessionData.authenticated,
      user: sessionData.user?.email
    })

    if (!sessionData.authenticated) {
      console.log('\n❌ Not authenticated. Please log in to the app first and set TEST_COOKIE environment variable')
      console.log('To get cookie: Open browser dev tools > Network > find /api/auth/session request > copy Cookie header')
      return
    }

    // Test 2: Check activities endpoint
    console.log('\n2. Testing activities endpoint...')
    const activitiesResponse = await fetch(`http://localhost:${PORT}/api/achievements/activities`, {
      credentials: 'include',
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    })

    console.log('Activities response status:', activitiesResponse.status)

    if (activitiesResponse.ok) {
      const activitiesData = await activitiesResponse.json()
      console.log('Activities data:', JSON.stringify(activitiesData, null, 2))

      // Verify streak data
      if (activitiesData.currentStreak !== undefined) {
        console.log('\n✅ Streak data found:')
        console.log('  - Current Streak:', activitiesData.currentStreak)
        console.log('  - Best Streak:', activitiesData.bestStreak)
        console.log('  - Last Activity:', new Date(activitiesData.lastActivity).toLocaleString())
        console.log('  - Active Dates:', Object.keys(activitiesData.dates || {}).join(', '))
      } else {
        console.log('\n⚠️  No streak data in response')
      }
    } else {
      const errorText = await activitiesResponse.text()
      console.log('❌ Failed to fetch activities:', errorText)
    }

    // Test 3: Check subscription endpoint
    console.log('\n3. Testing subscription endpoint...')
    const subResponse = await fetch(`http://localhost:${PORT}/api/user/subscription`, {
      credentials: 'include',
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    })

    if (subResponse.ok) {
      const subData = await subResponse.json()
      console.log('Subscription data:', {
        tier: subData.subscription?.tier,
        isPremium: subData.isPremium,
        status: subData.subscription?.status
      })
    }

  } catch (error) {
    console.error('Error during testing:', error)
  }
}

// Instructions
console.log('===========================================')
console.log('STREAK API TEST SCRIPT')
console.log('===========================================')
console.log('\nUsage:')
console.log('1. Make sure your dev server is running on port', PORT)
console.log('2. Log in to the app in your browser')
console.log('3. Get your session cookie from browser dev tools:')
console.log('   - Open Network tab')
console.log('   - Find any /api request')
console.log('   - Copy the Cookie header value')
console.log('4. Run: TEST_COOKIE="your-cookie-here" node test-streak-api.js')
console.log('\nOr for quick test without auth:')
console.log('   node test-streak-api.js')
console.log('===========================================\n')

testStreakAPI()