const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkTodos() {
  const email = process.argv[2] || 'emmanuelfabiani23@gmail.com';

  console.log('Checking todos for user:', email);
  console.log('');

  // Get user UID from email
  let uid;
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    uid = userRecord.uid;
    console.log('✅ Found user:', userRecord.uid);
    console.log('');
  } catch (error) {
    console.error('❌ User not found:', email);
    process.exit(1);
  }

  // Check for todos in users/{uid}/todos subcollection
  console.log('📋 Checking users/{uid}/todos subcollection...');
  const todosSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('todos')
    .get();

  if (todosSnapshot.empty) {
    console.log('  No todos found in subcollection');
  } else {
    console.log(`  Found ${todosSnapshot.size} todo document(s):`);
    todosSnapshot.forEach(doc => {
      console.log(`\n  📝 Todo ID: ${doc.id}`);
      console.log('  Data:', JSON.stringify(doc.data(), null, 2));
    });
  }

  console.log('');

  // Check for a todos field in the main user document
  console.log('📋 Checking users/{uid} document for todos field...');
  const userDoc = await db.collection('users').doc(uid).get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData.todos) {
      console.log('  Found todos field in user document:');
      console.log('  ', JSON.stringify(userData.todos, null, 2));
    } else {
      console.log('  No todos field in user document');
    }
  }

  console.log('');

  // Check for a top-level todos collection
  console.log('📋 Checking top-level todos collection...');
  const topLevelTodosSnapshot = await db
    .collection('todos')
    .where('userId', '==', uid)
    .get();

  if (topLevelTodosSnapshot.empty) {
    console.log('  No todos found in top-level collection');
  } else {
    console.log(`  Found ${topLevelTodosSnapshot.size} todo(s):`);
    topLevelTodosSnapshot.forEach(doc => {
      console.log(`\n  📝 Todo ID: ${doc.id}`);
      console.log('  Data:', JSON.stringify(doc.data(), null, 2));
    });
  }

  console.log('');
  console.log('✅ Check complete!');
}

checkTodos()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
