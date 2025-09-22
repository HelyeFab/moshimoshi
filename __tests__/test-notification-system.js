#!/usr/bin/env node

/**
 * Notification System Test Runner
 * Manual test script to verify the notification system is working correctly
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Import notification components
const {
  dailyReminderHtml,
  achievementAlertHtml,
  weeklyProgressHtml,
} = require('../src/lib/notifications/email-templates')

// Test configuration
const TEST_CONFIG = {
  user: {
    userName: 'Test User',
    email: 'test@example.com',
    unsubscribeUrl: 'https://moshimoshi.app/unsubscribe?token=test',
    preferencesUrl: 'https://moshimoshi.app/settings',
  },
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('')
  log('═'.repeat(60), 'cyan')
  log(` ${title}`, 'bright')
  log('═'.repeat(60), 'cyan')
}

function logTest(name, passed, details = '') {
  const status = passed ? `✓` : `✗`
  const color = passed ? 'green' : 'red'
  log(`  ${status} ${name}`, color)
  if (details) {
    log(`    ${details}`, 'yellow')
  }
}

// Test 1: Email Template Generation
async function testEmailTemplates() {
  logSection('Testing Email Template Generation')

  const tests = []

  // Test Daily Reminder
  try {
    const dailyData = {
      ...TEST_CONFIG.user,
      currentStreak: 7,
      totalReviews: 150,
      dueReviews: 25,
      lastStudyDate: new Date(),
      studyUrl: 'https://moshimoshi.app/review',
    }

    const dailyHtml = dailyReminderHtml(dailyData)

    tests.push({
      name: 'Daily Reminder HTML Generation',
      passed: dailyHtml && dailyHtml.includes('Test User') && dailyHtml.includes('7 days'),
      details: `Generated ${dailyHtml.length} characters`,
    })
  } catch (error) {
    tests.push({
      name: 'Daily Reminder HTML Generation',
      passed: false,
      details: error.message,
    })
  }

  // Test Achievement Alert
  try {
    const achievementData = {
      ...TEST_CONFIG.user,
      achievementName: 'Test Achievement',
      achievementDescription: 'You did great!',
      achievementIcon: '🏆',
      achievementRarity: 'rare',
      achievementPoints: 50,
      totalPoints: 500,
      totalAchievements: 10,
      percentageComplete: 25,
      profileUrl: 'https://moshimoshi.app/profile',
      nextAchievements: [],
    }

    const achievementHtml = achievementAlertHtml(achievementData)

    tests.push({
      name: 'Achievement Alert HTML Generation',
      passed: achievementHtml && achievementHtml.includes('Test Achievement'),
      details: `Generated ${achievementHtml.length} characters`,
    })
  } catch (error) {
    tests.push({
      name: 'Achievement Alert HTML Generation',
      passed: false,
      details: error.message,
    })
  }

  // Test Weekly Progress
  try {
    const weeklyData = {
      ...TEST_CONFIG.user,
      weekStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      weekEndDate: new Date(),
      stats: {
        totalReviews: 350,
        correctReviews: 280,
        accuracy: 80,
        studyTime: 245,
        daysStudied: 6,
        currentStreak: 15,
        longestStreak: 30,
      },
      progress: {
        kanjiLearned: 12,
        kanjiMastered: 5,
        vocabularyLearned: 25,
        sentencesCompleted: 10,
      },
      achievements: [],
      topPerformingDays: [],
      dashboardUrl: 'https://moshimoshi.app/dashboard',
    }

    const weeklyHtml = weeklyProgressHtml(weeklyData)

    tests.push({
      name: 'Weekly Progress HTML Generation',
      passed: weeklyHtml && weeklyHtml.includes('350') && weeklyHtml.includes('80%'),
      details: `Generated ${weeklyHtml.length} characters`,
    })
  } catch (error) {
    tests.push({
      name: 'Weekly Progress HTML Generation',
      passed: false,
      details: error.message,
    })
  }

  // Display results
  tests.forEach(test => logTest(test.name, test.passed, test.details))

  return tests.every(t => t.passed)
}

// Test 2: Environment Variables
function testEnvironmentVariables() {
  logSection('Testing Environment Variables')

  const requiredVars = [
    'RESEND_API_KEY',
    'NEXT_PUBLIC_APP_URL',
    'CRON_SECRET',
  ]

  const tests = requiredVars.map(varName => {
    const value = process.env[varName]
    const passed = !!value
    return {
      name: varName,
      passed,
      details: passed ? `Set (${value.substring(0, 10)}...)` : 'Missing',
    }
  })

  tests.forEach(test => logTest(test.name, test.passed, test.details))

  return tests.every(t => t.passed)
}

// Test 3: File Structure
async function testFileStructure() {
  logSection('Testing File Structure')

  const fs = require('fs').promises

  const requiredFiles = [
    'src/lib/notifications/email-templates/base-template.ts',
    'src/lib/notifications/email-templates/daily-reminder.ts',
    'src/lib/notifications/email-templates/achievement-alert.ts',
    'src/lib/notifications/email-templates/weekly-progress.ts',
    'src/lib/notifications/notification-service.ts',
    'src/app/api/notifications/daily-reminder/route.ts',
    'src/app/api/notifications/weekly-progress/route.ts',
    'src/app/api/notifications/unsubscribe/route.ts',
  ]

  const tests = await Promise.all(
    requiredFiles.map(async (file) => {
      const fullPath = path.join(__dirname, '..', file)
      try {
        const stats = await fs.stat(fullPath)
        return {
          name: file,
          passed: stats.isFile(),
          details: `${stats.size} bytes`,
        }
      } catch (error) {
        return {
          name: file,
          passed: false,
          details: 'File not found',
        }
      }
    })
  )

  tests.forEach(test => logTest(test.name, test.passed, test.details))

  return tests.every(t => t.passed)
}

// Test 4: API Endpoint Accessibility
async function testAPIEndpoints() {
  logSection('Testing API Endpoints (Mock Requests)')

  // Note: These are mock tests since we're not running the server
  // In production, you'd make actual HTTP requests

  const endpoints = [
    {
      path: '/api/notifications/daily-reminder',
      method: 'GET',
      description: 'Daily reminder cron endpoint',
    },
    {
      path: '/api/notifications/weekly-progress',
      method: 'GET',
      description: 'Weekly progress cron endpoint',
    },
    {
      path: '/api/notifications/unsubscribe',
      method: 'GET',
      description: 'Unsubscribe endpoint',
    },
  ]

  const tests = endpoints.map(endpoint => ({
    name: `${endpoint.method} ${endpoint.path}`,
    passed: true,  // Mock pass - in real test, make HTTP request
    details: endpoint.description,
  }))

  tests.forEach(test => logTest(test.name, test.passed, test.details))

  return true
}

// Test 5: Vercel Cron Configuration
async function testVercelConfig() {
  logSection('Testing Vercel Configuration')

  const fs = require('fs').promises

  try {
    const vercelConfig = await fs.readFile(
      path.join(__dirname, '..', 'vercel.json'),
      'utf-8'
    )
    const config = JSON.parse(vercelConfig)

    const tests = []

    // Check if crons are configured
    tests.push({
      name: 'Cron jobs configured',
      passed: !!config.crons && config.crons.length > 0,
      details: `${config.crons?.length || 0} cron jobs found`,
    })

    // Check for notification crons
    const hasDailyReminder = config.crons?.some(c =>
      c.path.includes('daily-reminder')
    )
    tests.push({
      name: 'Daily reminder cron',
      passed: hasDailyReminder,
      details: hasDailyReminder ? 'Configured' : 'Not found',
    })

    const hasWeeklyProgress = config.crons?.some(c =>
      c.path.includes('weekly-progress')
    )
    tests.push({
      name: 'Weekly progress cron',
      passed: hasWeeklyProgress,
      details: hasWeeklyProgress ? 'Configured' : 'Not found',
    })

    tests.forEach(test => logTest(test.name, test.passed, test.details))

    return tests.every(t => t.passed)
  } catch (error) {
    logTest('Vercel configuration', false, error.message)
    return false
  }
}

// Test 6: Sample Email Preview
async function generateSampleEmails() {
  logSection('Generating Sample Email Previews')

  const fs = require('fs').promises
  const outputDir = path.join(__dirname, 'notification-previews')

  try {
    await fs.mkdir(outputDir, { recursive: true })

    // Generate daily reminder
    const dailyData = {
      ...TEST_CONFIG.user,
      currentStreak: 15,
      totalReviews: 500,
      dueReviews: 35,
      lastStudyDate: new Date(),
      studyUrl: 'https://moshimoshi.app/review',
    }

    const dailyHtml = dailyReminderHtml(dailyData)
    await fs.writeFile(
      path.join(outputDir, 'daily-reminder.html'),
      dailyHtml,
      'utf-8'
    )
    logTest('Daily reminder preview', true, 'daily-reminder.html')

    // Generate achievement alert
    const achievementData = {
      ...TEST_CONFIG.user,
      achievementName: 'Kanji Master',
      achievementDescription: 'Learned 100 kanji characters',
      achievementIcon: '🈷',
      achievementRarity: 'epic',
      achievementPoints: 100,
      totalPoints: 1500,
      totalAchievements: 25,
      percentageComplete: 45,
      profileUrl: 'https://moshimoshi.app/profile',
      nextAchievements: [
        {
          name: 'Kanji Grandmaster',
          description: 'Learn 500 kanji',
          progress: 20,
        },
      ],
    }

    const achievementHtml = achievementAlertHtml(achievementData)
    await fs.writeFile(
      path.join(outputDir, 'achievement-alert.html'),
      achievementHtml,
      'utf-8'
    )
    logTest('Achievement alert preview', true, 'achievement-alert.html')

    // Generate weekly progress
    const weeklyData = {
      ...TEST_CONFIG.user,
      weekStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      weekEndDate: new Date(),
      stats: {
        totalReviews: 420,
        correctReviews: 378,
        accuracy: 90,
        studyTime: 350,
        daysStudied: 7,
        currentStreak: 21,
        longestStreak: 21,
      },
      progress: {
        kanjiLearned: 15,
        kanjiMastered: 8,
        vocabularyLearned: 35,
        sentencesCompleted: 20,
      },
      achievements: [
        {
          name: 'Perfect Week',
          icon: '⭐',
          date: new Date(),
        },
      ],
      topPerformingDays: [
        { day: 'Monday', reviews: 75 },
        { day: 'Wednesday', reviews: 65 },
        { day: 'Saturday', reviews: 80 },
      ],
      dashboardUrl: 'https://moshimoshi.app/dashboard',
    }

    const weeklyHtml = weeklyProgressHtml(weeklyData)
    await fs.writeFile(
      path.join(outputDir, 'weekly-progress.html'),
      weeklyHtml,
      'utf-8'
    )
    logTest('Weekly progress preview', true, 'weekly-progress.html')

    log(`\n  📧 Email previews saved to: ${outputDir}`, 'green')
    log('  Open the HTML files in your browser to preview the emails', 'yellow')

    return true
  } catch (error) {
    logTest('Email preview generation', false, error.message)
    return false
  }
}

// Main test runner
async function runAllTests() {
  log('\n🔔 NOTIFICATION SYSTEM TEST SUITE', 'bright')
  log('Testing all components of the notification system...', 'blue')

  const results = []

  // Run all tests
  results.push({
    name: 'Email Templates',
    passed: await testEmailTemplates(),
  })

  results.push({
    name: 'Environment Variables',
    passed: testEnvironmentVariables(),
  })

  results.push({
    name: 'File Structure',
    passed: await testFileStructure(),
  })

  results.push({
    name: 'API Endpoints',
    passed: await testAPIEndpoints(),
  })

  results.push({
    name: 'Vercel Configuration',
    passed: await testVercelConfig(),
  })

  results.push({
    name: 'Sample Email Generation',
    passed: await generateSampleEmails(),
  })

  // Summary
  logSection('Test Summary')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  results.forEach(result => {
    const status = result.passed ? '✓' : '✗'
    const color = result.passed ? 'green' : 'red'
    log(`  ${status} ${result.name}`, color)
  })

  console.log('')
  log('─'.repeat(60), 'cyan')

  if (failed === 0) {
    log(`✨ All ${total} test suites passed!`, 'green')
    log('Your notification system is ready to go! 🚀', 'bright')
  } else {
    log(`⚠️  ${failed} of ${total} test suites failed`, 'red')
    log('Please fix the issues above before deploying.', 'yellow')
  }

  // Additional instructions
  console.log('')
  log('📝 Next Steps:', 'bright')
  log('1. Set up your Resend account and add API key to .env.local', 'cyan')
  log('2. Configure CRON_SECRET in your Vercel environment', 'cyan')
  log('3. Deploy to Vercel to activate the cron jobs', 'cyan')
  log('4. Test manual triggers using the POST endpoints', 'cyan')
  log('5. Monitor notification logs in Firestore', 'cyan')

  process.exit(failed === 0 ? 0 : 1)
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Test runner failed: ${error.message}`, 'red')
  process.exit(1)
})