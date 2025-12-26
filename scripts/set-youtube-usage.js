const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setYouTubeUsage() {
  const userId = '7banGXGgYMawoaHZs8ejmV3v2wb2'; // seanconnery23@gmail.com
  
  // Get today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().split('T')[0];
  const featureKey = `youtube_shadowing_${today}`;
  
  console.log(`Setting usage for user: ${userId}`);
  console.log(`Feature key: ${featureKey}`);
  
  try {
    const usageRef = db.collection('usage').doc(userId);
    
    // Set the usage count to 2 (meaning 2 used, 1 remaining out of 3)
    await usageRef.set({
      [featureKey]: 2,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Usage set successfully!');
    
    // Read back to verify
    const doc = await usageRef.get();
    const data = doc.data();
    console.log(`\nCurrent usage for ${featureKey}:`, data?.[featureKey] || 0);
    console.log('\nUser now has 1 video remaining (2/3 used)');
    
  } catch (error) {
    console.error('❌ Error setting usage:', error);
  }
  
  process.exit(0);
}

setYouTubeUsage();
