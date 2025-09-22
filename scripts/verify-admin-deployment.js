#!/usr/bin/env node

/**
 * Admin Deployment Verification Script
 *
 * This script verifies that the admin access system is properly configured
 * before deploying to production.
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`,
  });
}

const db = admin.firestore();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function verifyAdminSetup() {
  console.log(`${colors.blue}🔍 Admin Deployment Verification${colors.reset}\n`);

  const checks = {
    firebaseConfig: false,
    adminUser: false,
    apiEndpoints: false,
    envVars: false,
  };

  // 1. Check Firebase configuration
  console.log('1. Checking Firebase configuration...');
  try {
    if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
      console.log(`${colors.green}✓ Firebase Admin SDK configured${colors.reset}`);
      checks.firebaseConfig = true;
    } else {
      console.log(`${colors.red}✗ Firebase Admin SDK not properly configured${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Error checking Firebase config: ${error.message}${colors.reset}`);
  }

  // 2. Check admin user configuration
  console.log('\n2. Checking admin user configuration...');
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    console.log(`${colors.yellow}⚠ ADMIN_EMAIL not set in environment${colors.reset}`);
  } else {
    try {
      // Find user by email
      const usersSnapshot = await db.collection('users')
        .where('email', '==', adminEmail)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        const userId = usersSnapshot.docs[0].id;

        console.log(`${colors.blue}Found user: ${adminEmail} (${userId})${colors.reset}`);

        if (userData.isAdmin === true) {
          console.log(`${colors.green}✓ User has isAdmin field set to true${colors.reset}`);
          checks.adminUser = true;
        } else {
          console.log(`${colors.yellow}⚠ User exists but isAdmin field is not true${colors.reset}`);

          // Offer to set it
          if (process.argv.includes('--fix')) {
            console.log('Fixing: Setting isAdmin to true...');
            await db.collection('users').doc(userId).update({ isAdmin: true });
            console.log(`${colors.green}✓ isAdmin field has been set to true${colors.reset}`);
            checks.adminUser = true;
          } else {
            console.log(`Run with --fix flag to automatically set isAdmin field`);
          }
        }
      } else {
        console.log(`${colors.red}✗ Admin user not found in Firestore${colors.reset}`);
        console.log(`  Make sure ${adminEmail} has signed up first`);
      }
    } catch (error) {
      console.log(`${colors.red}✗ Error checking admin user: ${error.message}${colors.reset}`);
    }
  }

  // 3. Check API endpoints
  console.log('\n3. Checking API endpoint configuration...');
  const requiredEndpoints = [
    '/api/user/profile',
    '/api/auth/session',
    '/api/admin/subscriptions/list',
  ];

  const endpointFiles = {
    '/api/user/profile': '../src/app/api/user/profile/route.ts',
    '/api/auth/session': '../src/app/api/auth/session/route.ts',
    '/api/admin/subscriptions/list': '../src/app/api/admin/subscriptions/list/route.ts',
  };

  let allEndpointsExist = true;
  for (const endpoint of requiredEndpoints) {
    const fs = require('fs');
    const filePath = path.join(__dirname, endpointFiles[endpoint]);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('isAdmin')) {
        console.log(`${colors.green}✓ ${endpoint} includes isAdmin field${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ ${endpoint} might not include isAdmin field${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}✗ ${endpoint} file not found${colors.reset}`);
      allEndpointsExist = false;
    }
  }
  checks.apiEndpoints = allEndpointsExist;

  // 4. Check environment variables
  console.log('\n4. Checking environment variables...');

  // Check if old ADMIN_UID is still being used
  if (process.env.NEXT_PUBLIC_ADMIN_UID) {
    console.log(`${colors.yellow}⚠ NEXT_PUBLIC_ADMIN_UID is still set (deprecated)${colors.reset}`);
    console.log(`  This should be removed in favor of Firebase isAdmin field`);
  }

  // Check required environment variables
  const requiredEnvVars = [
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
  ];

  let allEnvVarsSet = true;
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`${colors.green}✓ ${envVar} is set${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ ${envVar} is not set${colors.reset}`);
      allEnvVarsSet = false;
    }
  }
  checks.envVars = allEnvVarsSet;

  // Summary
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Verification Summary:${colors.reset}\n`);

  const allChecksPassed = Object.values(checks).every(check => check);

  for (const [checkName, passed] of Object.entries(checks)) {
    const status = passed
      ? `${colors.green}✓ PASSED${colors.reset}`
      : `${colors.red}✗ FAILED${colors.reset}`;
    console.log(`${checkName}: ${status}`);
  }

  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  if (allChecksPassed) {
    console.log(`\n${colors.green}✅ All checks passed! Ready for deployment.${colors.reset}`);
    console.log(`\nNext steps:`);
    console.log(`1. Run: npm run build`);
    console.log(`2. Deploy to Vercel: vercel --prod`);
    console.log(`3. Test admin menu visibility after deployment`);
  } else {
    console.log(`\n${colors.yellow}⚠️  Some checks failed. Please fix issues before deploying.${colors.reset}`);
    if (!checks.adminUser) {
      console.log(`\nTo fix admin user, run: node scripts/verify-admin-deployment.js --fix`);
    }
  }

  process.exit(allChecksPassed ? 0 : 1);
}

// Run verification
verifyAdminSetup().catch(error => {
  console.error(`${colors.red}Error during verification: ${error.message}${colors.reset}`);
  process.exit(1);
});