const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEp12() {
  const query = await db.collection('comics')
    .where('episodeNumber', '==', 12)
    .get();

  if (!query.empty) {
    const data = query.docs[0].data();
    console.log('\n📖 Episode 12 Details:\n');
    console.log('Title:', data.title);
    console.log('Theme:', data.theme);
    console.log('Location:', data.location);
    console.log('Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
    console.log('Characters specified:', data.characterIds || 'none');
    console.log('Number of panels:', data.panels ? data.panels.length : 0);

    console.log('\nCharacters appearing in dialogues:');
    const charactersSeen = new Set();
    if (data.panels) {
      data.panels.forEach((panel, idx) => {
        if (panel.dialogues) {
          panel.dialogues.forEach(d => {
            charactersSeen.add(d.characterName || d.characterId);
          });
        }
      });
    }
    console.log([...charactersSeen].join(', '));

    console.log('\nFirst 2 panels dialogue:');
    if (data.panels) {
      data.panels.slice(0, 2).forEach((panel, idx) => {
        const num = idx + 1;
        console.log(`\nPanel ${num}:`);
        if (panel.dialogues) {
          panel.dialogues.forEach(d => {
            console.log(`  ${d.characterName}: ${d.textJa}`);
          });
        }
      });
    }

    console.log('\nImage URLs present:');
    let imageCount = 0;
    if (data.panels) {
      data.panels.forEach((panel, idx) => {
        if (panel.imageUrl) {
          imageCount++;
          console.log(`  Panel ${idx + 1}: ✓`);
        } else {
          console.log(`  Panel ${idx + 1}: ✗`);
        }
      });
    }
    console.log(`Total images: ${imageCount}/${data.panels ? data.panels.length : 0}`);

  } else {
    console.log('Episode 12 not found');
  }

  process.exit(0);
}

checkEp12();
