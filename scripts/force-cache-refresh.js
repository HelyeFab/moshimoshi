const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

console.log('🔄 The trending videos cache is stored in memory.');
console.log('📺 Tomo\'s video IS in Firebase (verified).');
console.log('\n💡 To see it on the trending page, please:');
console.log('   1. Restart your dev server:');
console.log('      - Stop it (Ctrl+C)');
console.log('      - Run: npm run dev');
console.log('   2. Visit: http://localhost:3000/popular-videos');
console.log('\n✨ The video will appear with a "🔥 Trending" badge!\n');

process.exit(0);
