const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEp11() {
  const query = await db.collection('comics')
    .where('episodeNumber', '==', 11)
    .get();

  if (!query.empty) {
    const data = query.docs[0].data();
    console.log('\n📖 Episode 11 Details:\n');
    console.log('Title:', data.title);
    console.log('Theme:', data.theme);
    console.log('Location:', data.location);
    console.log('Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
    console.log('\nFirst 3 panels:');
    if (data.panels) {
      data.panels.slice(0, 3).forEach((panel, idx) => {
        const num = idx + 1;
        console.log(`\nPanel ${num}:`);
        console.log('  Characters:', panel.characters || 'not specified');
        if (panel.dialogues) {
          panel.dialogues.forEach(d => {
            console.log(`  - ${d.characterName}: ${d.textJa}`);
          });
        }
      });
    }
  } else {
    console.log('Episode 11 not found');
  }

  process.exit(0);
}

checkEp11();
