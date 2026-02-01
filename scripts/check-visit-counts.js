const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();

async function checkVisitCounts() {
  console.log('='.repeat(80));
  console.log('📊 CHECKING PAGE VISITS DATA STRUCTURE');
  console.log('='.repeat(80));
  
  // Check page_visits structure
  console.log('\n1️⃣ page_visits collection sample:');
  const pageVisits = await db.collection('page_visits').limit(3).get();
  pageVisits.forEach(doc => {
    console.log('\nDoc ID: ' + doc.id);
    const data = doc.data();
    console.log(JSON.stringify(data, null, 2));
  });
  
  // Check analytics collection
  console.log('\n2️⃣ analytics collection sample:');
  const analytics = await db.collection('analytics').limit(3).get();
  analytics.forEach(doc => {
    console.log('\nDoc ID: ' + doc.id);
    const data = doc.data();
    console.log(JSON.stringify(data, null, 2));
  });
  
  // Check if page_visits has userId field and count by user
  console.log('\n3️⃣ Checking if we can count visits per user...');
  
  // Get a returning user to check their visits
  const testEmail = 'edward.wornar@gmail.com'; // Most engaged user
  const userSnapshot = await db.collection('users').where('email', '==', testEmail).limit(1).get();
  
  if (!userSnapshot.empty) {
    const userId = userSnapshot.docs[0].id;
    console.log('\nChecking visits for ' + testEmail + ' (UID: ' + userId + ')');
    
    // Check page_visits for this user
    const userVisits = await db.collection('page_visits').where('userId', '==', userId).get();
    console.log('Page visits found: ' + userVisits.size);
    
    if (userVisits.size > 0) {
      // Group by date
      const visitsByDate = {};
      userVisits.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp?.toDate?.()?.toISOString?.()?.split('T')[0] || 'unknown';
        if (!visitsByDate[date]) visitsByDate[date] = 0;
        visitsByDate[date]++;
      });
      console.log('Visits by date:');
      Object.entries(visitsByDate).sort().forEach(([date, count]) => {
        console.log('  ' + date + ': ' + count + ' page views');
      });
    }
  }

  process.exit(0);
}

checkVisitCounts().catch(e => { console.error(e); process.exit(1); });
