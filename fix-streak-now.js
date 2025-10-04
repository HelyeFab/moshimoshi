#!/usr/bin/env node

// Quick fix for the duplicate streak issue
// This will manually set the correct streak values via the API

const PORT = process.env.PORT || 3000

async function fixStreak() {
  console.log('Fixing streak data...\n')

  const correctData = {
    dates: {
      "2025-09-15": true,
      "2025-09-16": true
    },
    currentStreak: 2,
    bestStreak: 2,
    lastActivity: Date.now()
  }

  try {
    const response = await fetch(`http://localhost:${PORT}/api/achievements/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.COOKIE || ''
      },
      credentials: 'include',
      body: JSON.stringify(correctData)
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Successfully updated streak data!')
      console.log('Result:', result)
    } else {
      console.log('❌ Failed:', await response.text())
      console.log('\nTo fix this:')
      console.log('1. Make sure you are logged in to the app')
      console.log('2. Get your cookie from browser DevTools (Network tab > any API request > Cookie header)')
      console.log('3. Run: COOKIE="your-session-cookie" node fix-streak-now.js')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

console.log('=== STREAK FIX SCRIPT ===')
console.log('This will set your streak to the correct value (2)')
console.log('\nNOTE: You need to be logged in.')
console.log('Get your session cookie from the browser and run:')
console.log('COOKIE="your-cookie-here" node fix-streak-now.js\n')

fixStreak()