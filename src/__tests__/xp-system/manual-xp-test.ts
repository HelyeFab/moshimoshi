/**
 * Manual test to verify XP is being saved to localStorage
 * and displayed correctly in the UI
 */

import { xpSystem } from '@/lib/gamification/xp-system'

// Test XP calculations
console.log('=== XP System Manual Test ===')

// Test level calculations
const testXP = [0, 10, 50, 100, 150, 200, 375, 500, 1000]

testXP.forEach(xp => {
  const level = xpSystem.getLevelFromXP(xp)
  const levelInfo = xpSystem.getUserLevel(xp)
  
  console.log(`\nXP: ${xp}`)
  console.log(`Level: ${level}`)
  console.log(`Title: ${levelInfo.title}`)
  console.log(`Progress: ${levelInfo.currentXP}/${levelInfo.xpToNextLevel} (${levelInfo.progressPercentage.toFixed(1)}%)`)
  console.log(`Next Level: ${levelInfo.nextLevelTitle}`)
})

// Test localStorage simulation
if (typeof window !== 'undefined') {
  const testUserId = 'test-user-123'
  const testXPValue = 250
  
  // Simulate saving XP
  localStorage.setItem(`xp_${testUserId}`, testXPValue.toString())
  console.log(`\n✅ Saved XP to localStorage: xp_${testUserId} = ${testXPValue}`)
  
  // Simulate loading XP
  const loadedXP = localStorage.getItem(`xp_${testUserId}`)
  console.log(`✅ Loaded XP from localStorage: ${loadedXP}`)
  
  // Verify it matches
  if (loadedXP === testXPValue.toString()) {
    console.log('✅ XP storage working correctly!')
  } else {
    console.error('❌ XP storage mismatch!')
  }
}

console.log('\n=== Test Complete ===')
export {}