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
  const featureKey = `youtube_shadowing_${today}`;
  
  console.log(`Resetting usage for user: ${userId}`);
  console.log(`Feature key: ${featureKey}`);
  
  try {
    const usageRef = db.collection('usage').doc(userId);
    
    // Delete the field to reset to 0
    await usageRef.update({
      [featureKey]: admin.firestore.FieldValue.delete()
    });
    
    console.log('✅ Usage reset successfully!');
    
    // Read back to verify
    const doc = await usageRef.get();
    const data = doc.data();
    console.log(`\nCurrent usage for ${featureKey}:`, data?.[featureKey] || 0);
    console.log('\nUser now has 3 videos remaining (0/3 used)');
    
  } catch (error) {
    console.error('❌ Error resetting usage:', error);
  }
  
  process.exit(0);
}

resetYouTubeUsage();
