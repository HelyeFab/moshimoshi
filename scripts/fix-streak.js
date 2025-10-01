const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixStreak() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';
  
  console.log('Fixing streak for user:', userId);
  
  const userStatsRef = db.collection('user_stats').doc(userId);
  
  // Set proper streak data with dates
  await userStatsRef.update({
    'streak.current': 1,
    'streak.best': 1,
    'streak.dates': {
      '2025-10-01': true  // Today
    },
    'streak.lastActivityDate': '2025-10-01',
    'streak.isActiveToday': true,
    'streak.streakAtRisk': false
  });
  
  console.log('✅ Streak fixed! Set to 1 day with today as active date');
  console.log('If you want a longer streak, manually add more dates to the dates object');
  
  process.exit(0);
}

fixStreak().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
