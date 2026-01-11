const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkCharacters() {
  console.log('\n📋 Saved Characters:\n');

  const chars = await db.collection('saved_characters').get();

  if (chars.empty) {
    console.log('No characters found');
  } else {
    chars.forEach(doc => {
      const data = doc.data();
      console.log(`${doc.id}:`);
      console.log(`  Name: ${data.name} (${data.nameJa})`);
      console.log(`  Role: ${data.role}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkCharacters();
