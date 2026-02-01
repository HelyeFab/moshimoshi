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

async function checkSessionTracking() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING FOR SESSION/LOGIN TRACKING DATA');
  console.log('='.repeat(80));
  
  // Check what collections exist
  const collections = await db.listCollections();
  console.log('\n📁 Available collections:');
  collections.forEach(col => console.log('  - ' + col.id));
  
  // Check for auth_events or sessions collection
  const potentialCollections = ['auth_events', 'sessions', 'user_sessions', 'login_events', 'authEvents'];
  
  for (const colName of potentialCollections) {
    try {
      const snapshot = await db.collection(colName).limit(3).get();
      if (!snapshot.empty) {
        console.log('\n✅ Found ' + colName + ' collection with ' + snapshot.size + ' sample docs:');
        snapshot.forEach(doc => {
          console.log('  Doc ID: ' + doc.id);
          console.log('  Data: ' + JSON.stringify(doc.data(), null, 4).substring(0, 500));
        });
      }
    } catch (e) {
      // Collection doesn't exist
    }
  }
  
  // Check a specific user's subcollections for session data
  const testUser = '0Gbyd3GCe5gyuNQVO70Z6qvn0Oi2'; // One of today's users
  console.log('\n📂 Checking subcollections for user: ' + testUser);
  
  try {
    const userRef = db.collection('users').doc(testUser);
    const subcollections = await userRef.listCollections();
    console.log('User subcollections:');
    for (const subcol of subcollections) {
      const count = await subcol.count().get();
      console.log('  - ' + subcol.id + ': ' + count.data().count + ' documents');
      
      // Sample first doc
      const sample = await subcol.limit(1).get();
      if (!sample.empty) {
        console.log('    Sample: ' + JSON.stringify(sample.docs[0].data(), null, 4).substring(0, 300));
      }
    }
  } catch (e) {
    console.log('Error checking user subcollections: ' + e.message);
  }

  // Check if we have activity tracking
  console.log('\n📊 Checking for activity/analytics collections...');
  const analyticsCollections = ['analytics', 'activity', 'page_views', 'user_activity', 'daily_activity'];
  
  for (const colName of analyticsCollections) {
    try {
      const snapshot = await db.collection(colName).limit(1).get();
      if (!snapshot.empty) {
        console.log('✅ Found ' + colName + ' collection');
      }
    } catch (e) {
      // Collection doesn't exist
    }
  }

  process.exit(0);
}

checkSessionTracking().catch(e => { console.error(e); process.exit(1); });
