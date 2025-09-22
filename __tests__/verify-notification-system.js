#!/usr/bin/env node

/**
 * Notification System Verification Script
 * Verifies that all notification system files are in place and configured correctly
 */

const path = require('path')
const fs = require('fs').promises

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

// Test 1: Check Email Template Files
async function checkEmailTemplates() {
  logSection('Email Template Files')

  const templates = [
    'src/lib/notifications/email-templates/base-template.ts',
    'src/lib/notifications/email-templates/daily-reminder.ts',
    'src/lib/notifications/email-templates/achievement-alert.ts',
    'src/lib/notifications/email-templates/weekly-progress.ts',
    'src/lib/notifications/email-templates/index.ts',
  ]

  const results = []

  for (const template of templates) {
    const fullPath = path.join(__dirname, '..', template)
    try {
      const stats = await fs.stat(fullPath)
      const content = await fs.readFile(fullPath, 'utf-8')

      // Check for required exports
      const hasExports = content.includes('export')
      const hasHtmlFunction = content.includes('Html')
      const hasTextFunction = content.includes('Text') || content.includes('export *')

      results.push({
        name: path.basename(template),
        passed: stats.isFile() && hasExports && (hasHtmlFunction || hasTextFunction),
        details: `${stats.size} bytes, ${hasExports ? 'has exports' : 'missing exports'}`,
      })
    } catch (error) {
      results.push({
        name: path.basename(template),
        passed: false,
        details: 'File not found',
      })
    }
  }

  results.forEach(r => logTest(r.name, r.passed, r.details))
  return results.every(r => r.passed)
}

// Test 2: Check Notification Service
async function checkNotificationService() {
  logSection('Notification Service')

  const serviceFiles = [
    'src/lib/notifications/notification-service.ts',
    'src/lib/notifications/achievement-notification-hook.ts',
  ]

  const results = []

  for (const file of serviceFiles) {
    const fullPath = path.join(__dirname, '..', file)
    try {
      const stats = await fs.stat(fullPath)
      const content = await fs.readFile(fullPath, 'utf-8')

      // Check for key components based on file type
      const isHookFile = file.includes('hook')
      const checks = isHookFile ? {
        'AchievementNotificationHook class': content.includes('class AchievementNotificationHook'),
        'setupListeners method': content.includes('setupListeners'),
        'achievementUnlocked event': content.includes('achievementUnlocked'),
        'notificationService import': content.includes('notificationService'),
      } : {
        'NotificationService class': content.includes('class NotificationService'),
        'sendDailyReminder method': content.includes('sendDailyReminder'),
        'sendAchievementAlert method': content.includes('sendAchievementAlert'),
        'sendWeeklyProgressReport method': content.includes('sendWeeklyProgressReport'),
        'Resend integration': content.includes('Resend'),
      }

      const allChecks = Object.values(checks).every(v => v)
      const failedChecks = Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([name]) => name)

      results.push({
        name: path.basename(file),
        passed: stats.isFile() && allChecks,
        details: allChecks ? `All components present` : `Missing: ${failedChecks.join(', ')}`,
      })
    } catch (error) {
      results.push({
        name: path.basename(file),
        passed: false,
        details: 'File not found',
      })
    }
  }

  results.forEach(r => logTest(r.name, r.passed, r.details))
  return results.every(r => r.passed)
}

// Test 3: Check API Endpoints
async function checkAPIEndpoints() {
  logSection('API Endpoints')

  const endpoints = [
    {
      path: 'src/app/api/notifications/daily-reminder/route.ts',
      methods: ['GET', 'POST'],
    },
    {
      path: 'src/app/api/notifications/weekly-progress/route.ts',
      methods: ['GET', 'POST'],
    },
    {
      path: 'src/app/api/notifications/unsubscribe/route.ts',
      methods: ['GET', 'POST'],
    },
  ]

  const results = []

  for (const endpoint of endpoints) {
    const fullPath = path.join(__dirname, '..', endpoint.path)
    try {
      const stats = await fs.stat(fullPath)
      const content = await fs.readFile(fullPath, 'utf-8')

      // Check for HTTP method exports
      const foundMethods = endpoint.methods.filter(method =>
        content.includes(`export async function ${method}`) ||
        content.includes(`export function ${method}`)
      )

      const allMethodsPresent = foundMethods.length === endpoint.methods.length

      results.push({
        name: path.basename(path.dirname(fullPath)),
        passed: stats.isFile() && allMethodsPresent,
        details: allMethodsPresent
          ? `Methods: ${foundMethods.join(', ')}`
          : `Missing: ${endpoint.methods.filter(m => !foundMethods.includes(m)).join(', ')}`,
      })
    } catch (error) {
      results.push({
        name: path.basename(path.dirname(endpoint.path)),
        passed: false,
        details: 'Route file not found',
      })
    }
  }

  results.forEach(r => logTest(r.name, r.passed, r.details))
  return results.every(r => r.passed)
}

// Test 4: Check Vercel Configuration
async function checkVercelConfig() {
  logSection('Vercel Cron Configuration')

  const vercelPath = path.join(__dirname, '..', 'vercel.json')

  try {
    const content = await fs.readFile(vercelPath, 'utf-8')
    const config = JSON.parse(content)

    const results = []

    // Check for crons array
    results.push({
      name: 'Crons array exists',
      passed: Array.isArray(config.crons),
      details: config.crons ? `${config.crons.length} cron jobs` : 'No crons array',
    })

    // Check for notification crons
    if (config.crons) {
      const dailyReminder = config.crons.find(c => c.path.includes('daily-reminder'))
      results.push({
        name: 'Daily reminder cron',
        passed: !!dailyReminder,
        details: dailyReminder ? `Schedule: ${dailyReminder.schedule}` : 'Not configured',
      })

      const weeklyProgress = config.crons.find(c => c.path.includes('weekly-progress'))
      results.push({
        name: 'Weekly progress cron',
        passed: !!weeklyProgress,
        details: weeklyProgress ? `Schedule: ${weeklyProgress.schedule}` : 'Not configured',
      })
    }

    results.forEach(r => logTest(r.name, r.passed, r.details))
    return results.every(r => r.passed)
  } catch (error) {
    logTest('vercel.json', false, error.message)
    return false
  }
}

// Test 5: Check Test Files
async function checkTestFiles() {
  logSection('Test Files')

  const testFiles = [
    '__tests__/notifications/email-templates.test.ts',
    '__tests__/notifications/notification-service.test.ts',
    '__tests__/notifications/api-endpoints.test.ts',
    '__tests__/notifications/integration.test.ts',
  ]

  const results = []

  for (const testFile of testFiles) {
    const fullPath = path.join(__dirname, '..', testFile)
    try {
      const stats = await fs.stat(fullPath)
      const content = await fs.readFile(fullPath, 'utf-8')

      // Check for test structure
      const hasDescribe = content.includes('describe(')
      const hasIt = content.includes('it(') || content.includes('test(')
      const hasExpect = content.includes('expect(')

      results.push({
        name: path.basename(testFile),
        passed: stats.isFile() && hasDescribe && hasIt && hasExpect,
        details: `${stats.size} bytes, ${hasDescribe && hasIt ? 'valid test structure' : 'invalid structure'}`,
      })
    } catch (error) {
      results.push({
        name: path.basename(testFile),
        passed: false,
        details: 'Test file not found',
      })
    }
  }

  results.forEach(r => logTest(r.name, r.passed, r.details))
  return results.every(r => r.passed)
}

// Test 6: Check Documentation
async function checkDocumentation() {
  logSection('Documentation')

  const docPath = path.join(__dirname, '..', 'docs/NOTIFICATION_SYSTEM.md')

  try {
    const stats = await fs.stat(docPath)
    const content = await fs.readFile(docPath, 'utf-8')

    const sections = [
      'Overview',
      'Architecture',
      'Features',
      'Setup Instructions',
      'Testing',
      'API Reference',
    ]

    const results = sections.map(section => ({
      name: `${section} section`,
      passed: content.includes(`## ${section}`) || content.includes(`# ${section}`),
      details: '',
    }))

    results.push({
      name: 'Documentation file',
      passed: stats.isFile() && stats.size > 1000,
      details: `${stats.size} bytes`,
    })

    results.forEach(r => logTest(r.name, r.passed, r.details))
    return results.every(r => r.passed)
  } catch (error) {
    logTest('NOTIFICATION_SYSTEM.md', false, 'Documentation not found')
    return false
  }
}

// Test 7: Check Environment Variables Example
async function checkEnvExample() {
  logSection('Environment Configuration')

  const envExamplePath = path.join(__dirname, '..', '.env.notification.example')

  try {
    const content = await fs.readFile(envExamplePath, 'utf-8')

    const requiredVars = [
      'RESEND_API_KEY',
      'CRON_SECRET',
      'NEXT_PUBLIC_APP_URL',
    ]

    const results = requiredVars.map(varName => ({
      name: varName,
      passed: content.includes(varName),
      details: content.includes(varName) ? 'Documented' : 'Missing from example',
    }))

    results.forEach(r => logTest(r.name, r.passed, r.details))
    return results.every(r => r.passed)
  } catch (error) {
    logTest('.env.notification.example', false, 'Example file not found')
    return false
  }
}

// Main verification runner
async function runVerification() {
  log('\n🔔 NOTIFICATION SYSTEM VERIFICATION', 'bright')
  log('Checking all components are properly installed...', 'blue')

  const results = []

  // Run all checks
  results.push({
    name: 'Email Templates',
    passed: await checkEmailTemplates(),
  })

  results.push({
    name: 'Notification Service',
    passed: await checkNotificationService(),
  })

  results.push({
    name: 'API Endpoints',
    passed: await checkAPIEndpoints(),
  })

  results.push({
    name: 'Vercel Configuration',
    passed: await checkVercelConfig(),
  })

  results.push({
    name: 'Test Files',
    passed: await checkTestFiles(),
  })

  results.push({
    name: 'Documentation',
    passed: await checkDocumentation(),
  })

  results.push({
    name: 'Environment Example',
    passed: await checkEnvExample(),
  })

  // Summary
  logSection('Verification Summary')

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
    log(`✨ All ${total} components verified successfully!`, 'green')
    log('Your notification system is properly installed! 🚀', 'bright')

    console.log('')
    log('📧 File Structure:', 'bright')
    log('  ✓ Email templates created', 'green')
    log('  ✓ Notification service implemented', 'green')
    log('  ✓ API endpoints configured', 'green')
    log('  ✓ Cron jobs set up', 'green')
    log('  ✓ Test suites written', 'green')
    log('  ✓ Documentation complete', 'green')
  } else {
    log(`⚠️  ${failed} of ${total} components have issues`, 'red')
    log('Please check the failures above.', 'yellow')
  }

  // Setup instructions
  console.log('')
  log('📝 Setup Instructions:', 'bright')
  log('1. Copy .env.notification.example to .env.local', 'cyan')
  log('2. Add your Resend API key: RESEND_API_KEY=re_xxxxx', 'cyan')
  log('3. Generate a CRON_SECRET: openssl rand -base64 32', 'cyan')
  log('4. Deploy to Vercel to activate cron jobs', 'cyan')
  log('5. Test with: curl -X POST /api/notifications/daily-reminder', 'cyan')

  // Test commands
  console.log('')
  log('🧪 Testing Commands:', 'bright')
  log('Run unit tests:', 'yellow')
  log('  npm test -- __tests__/notifications/', 'cyan')
  log('', 'reset')
  log('Manual test for a specific user:', 'yellow')
  log('  curl -X POST http://localhost:3000/api/notifications/daily-reminder \\', 'cyan')
  log('    -H "Content-Type: application/json" \\', 'cyan')
  log('    -H "Authorization: Bearer YOUR_TOKEN" \\', 'cyan')
  log('    -d \'{"userId": "USER_ID"}\'', 'cyan')

  process.exit(failed === 0 ? 0 : 1)
}

// Run verification
runVerification().catch(error => {
  log(`\n❌ Verification failed: ${error.message}`, 'red')
  log(error.stack, 'yellow')
  process.exit(1)
})