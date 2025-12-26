const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkYouTubeUsage() {
  const userId = '7banGXGgYMawoaHZs8ejmV3v2wb2'; // seanconnery23@gmail.com
  
  console.log(`Checking usage for user: ${userId}\n`);
  
  try {
    const usageRef = db.collection('usage').doc(userId);
    const doc = await usageRef.get();
    
    if (!doc.exists) {
      console.log('❌ No usage document found');
      process.exit(0);
    }
    
    const data = doc.data();
    console.log('Full usage document:');
    console.log(JSON.stringify(data, null, 2));
    
    // Look for youtube_shadowing keys
    const youtubeKeys = Object.keys(data || {}).filter(k => k.startsWith('youtube_shadowing'));
    
    console.log(`\n📊 YouTube Shadowing Usage:`);
    if (youtubeKeys.length === 0) {
      console.log('  No youtube_shadowing usage found (0/3 used)');
    } else {
      youtubeKeys.forEach(key => {
        console.log(`  ${key}: ${data[key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking usage:', error);
  }
  
  process.exit(0);
}

checkYouTubeUsage();
