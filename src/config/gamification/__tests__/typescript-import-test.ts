// TypeScript import validation test
// This file verifies that all config files can be imported correctly in TypeScript

import xpConfig from '../xp.json'
import streakConfig from '../streak.json'
import achievementsConfig from '../achievements.json'
import levelsConfig from '../levels.json'

// Test that configs can be imported and accessed
const baseXP = xpConfig.baseXP
const minXP = streakConfig.minXPForStreak
const achievements = achievementsConfig.achievements
const xpPerLevel = levelsConfig.xpPerLevel

console.log('✓ All configs import successfully')
console.log(`✓ Base XP: ${baseXP}`)
console.log(`✓ Min XP for streak: ${minXP}`)
console.log(`✓ Number of achievements: ${achievements.length}`)
console.log(`✓ XP per level: ${xpPerLevel}`)

export {}
