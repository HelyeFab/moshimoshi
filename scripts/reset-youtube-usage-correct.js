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
  const userId = '7banGXGgYMawoaHZs8ejmV3v2wb2'; // seanconnery23@gmail.com
  
  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().split('T')[0];
  const bucketKey = `daily_${today}`;
  const featureId = 'youtube_shadowing';
  
  console.log(`Resetting usage for user: ${userId}`);
  console.log(`Bucket key: ${bucketKey}`);
  console.log(`Feature ID: ${featureId}`);
  
  try {
    // CORRECT PATH: users/{userId}/usage/{bucketKey}
    const usageRef = db.collection('users').doc(userId).collection('usage').doc(bucketKey);
    
    // Check current value first
    const usageDoc = await usageRef.get();
    const currentData = usageDoc.data() || {};
    console.log(`\nCurrent usage data:`, currentData);
    console.log(`Current ${featureId}:`, currentData[featureId] || 0);
    
    // Delete the field to reset to 0
    if (currentData[featureId]) {
      await usageRef.update({
        [featureId]: admin.firestore.FieldValue.delete()
      });
      console.log('\n✅ Usage reset successfully!');
    } else {
      console.log('\n✅ Already at 0, nothing to reset');
    }
    
    // Read back to verify
    const doc = await usageRef.get();
    const data = doc.data() || {};
    console.log(`\nNew usage for ${featureId}:`, data[featureId] || 0);
    console.log('User now has 3 videos remaining (0/3 used)');
    
  } catch (error) {
    console.error('❌ Error resetting usage:', error);
  }
  
  process.exit(0);
}

resetYouTubeUsage();
