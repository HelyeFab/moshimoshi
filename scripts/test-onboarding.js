/**
 * Test the onboarding starter lists creation
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const userId = process.argv[2];
if (!userId) {
  console.error('❌ Error: Please provide a userId');
  console.log('Usage: node scripts/test-onboarding.js <userId>');
  process.exit(1);
}

// Import the onboarding logic (rebuild functions first)
const { createStarterLists } = require('../functions/lib/onboarding');

console.log(`\n🧪 Testing onboarding for user: ${userId}\n`);

createStarterLists(userId)
  .then(() => {
    console.log('\n✅ Test completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
