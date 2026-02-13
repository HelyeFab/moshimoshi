const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function resetYouTubeUsage() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/reset-youtube-usage-fixed.js <email>');
    process.exit(1);
  }
  const userRecord = await admin.auth().getUserByEmail(email);
  const userId = userRecord.uid;
  console.log(`Found user: ${email} → ${userId}`);
  const featureId = 'youtube_shadowing';
  
  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().split('T')[0];
  
  // Match the getBucketKey() logic: for daily features it's `${featureId}_${date}`
  const bucketKey = `${featureId}_${today}`;
  
  console.log(`Resetting usage for user: ${userId}`);
  console.log(`Bucket key: ${bucketKey}`);
  console.log(`Feature ID: ${featureId}`);
  
  try {
    // CORRECT PATH: users/{userId}/usage/{featureId}_{date}
    const usageRef = db.collection('users').doc(userId).collection('usage').doc(bucketKey);
    
    // Check current value first
    const usageDoc = await usageRef.get();
    const currentData = usageDoc.data() || {};
    console.log(`\nCurrent usage data in ${bucketKey}:`, currentData);
    console.log(`Current ${featureId}:`, currentData[featureId] || 0);
    
    // Delete the entire document to reset to 0
    if (usageDoc.exists) {
      await usageRef.delete();
      console.log('\n✅ Usage document deleted successfully!');
    } else {
      console.log('\n✅ No usage document found, already at 0');
    }
    
    // Verify
    const afterDoc = await usageRef.get();
    console.log(`\nDocument exists after delete:`, afterDoc.exists);
    console.log('User now has 3 videos remaining (0/3 used)');
    
  } catch (error) {
    console.error('❌ Error resetting usage:', error);
  }
  
  process.exit(0);
}

resetYouTubeUsage();
