#!/usr/bin/env node

/**
 * Development script to enable Time Machine for testing
 * Run this in the browser console to enable admin mode
 */

console.log('🕐 Time Machine Admin Mode Enabler')
console.log('==================================')

// Enable admin flag
localStorage.setItem('isAdmin', 'true')
console.log('✅ Admin mode enabled')

// Enable virtual clock
localStorage.setItem('virtualClock', JSON.stringify({
  offsetMs: 0,
  frozenTime: null,
  isEnabled: true,
  history: []
}))
console.log('✅ Virtual clock enabled')

console.log('')
console.log('🎉 Time Machine is now available!')
console.log('Look for the purple beaker button in the bottom-right corner.')
console.log('')
console.log('To disable admin mode, run:')
console.log("  localStorage.removeItem('isAdmin')")
console.log("  localStorage.removeItem('virtualClock')")
console.log('')
console.log('⚠️  Remember: This is for development testing only!')
console.log('All time-based features (Review Engine, Achievements) will use virtual time.')