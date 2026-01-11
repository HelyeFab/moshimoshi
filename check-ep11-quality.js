const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkQuality() {
  const query = await db.collection('comics')
    .where('episodeNumber', '==', 11)
    .get();

  if (!query.empty) {
    const data = query.docs[0].data();

    console.log('\n📊 Episode 11 Quality Check:\n');

    const expectedChars = ['moshi', 'koa', 'yuki', 'sensei'];
    const charactersSeen = new Set();

    if (data.panels) {
      data.panels.forEach(panel => {
        if (panel.dialogues) {
          panel.dialogues.forEach(d => {
            const charId = (d.characterId || d.characterName || '').toLowerCase();
            charactersSeen.add(charId);
          });
        }
      });
    }

    console.log('Characters that appeared:', [...charactersSeen].join(', '));

    const unexpectedChars = [...charactersSeen].filter(c =>
      !expectedChars.some(exp => c.includes(exp))
    );

    if (unexpectedChars.length > 0) {
      console.log('⚠️  UNEXPECTED CHARACTERS:', unexpectedChars.join(', '));
    } else {
      console.log('✓ All characters are from the character sheet');
    }

    const allDialogues = [];
    if (data.panels) {
      data.panels.forEach(panel => {
        if (panel.dialogues) {
          panel.dialogues.forEach(d => {
            if (d.textJa) allDialogues.push(d.textJa);
          });
        }
      });
    }

    const uniqueDialogues = new Set(allDialogues);
    console.log(`\nDialogue variety: ${uniqueDialogues.size} unique out of ${allDialogues.length} total`);

    console.log('\nAll dialogues:');
    allDialogues.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d}`);
    });

    console.log('\nTimestamps:');
    console.log('  createdAt:', data.createdAt ? data.createdAt.toDate() : 'none');
    console.log('  publishedAt:', data.publishedAt ? data.publishedAt.toDate() : 'none');

    console.log('\nCharacter IDs in detail:');
    if (data.panels) {
      data.panels.forEach((panel, idx) => {
        console.log(`Panel ${idx + 1}:`);
        if (panel.dialogues) {
          panel.dialogues.forEach(d => {
            console.log(`  ${d.characterName} (ID: ${d.characterId})`);
          });
        }
      });
    }

  } else {
    console.log('Episode 11 not found');
  }

  process.exit(0);
}

checkQuality();
