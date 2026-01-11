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
    .where('episodeNumber', '==', 13)
    .get();

  if (!query.empty) {
    const data = query.docs[0].data();

    console.log('\n📊 Episode 13 Quality Check:\n');
    console.log('Title:', data.title);
    console.log('Theme:', data.theme);
    console.log('Location:', data.location);

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

    console.log('\nCharacters that appeared:', [...charactersSeen].join(', '));

    const unexpectedChars = [...charactersSeen].filter(c =>
      !expectedChars.some(exp => c.includes(exp))
    );

    if (unexpectedChars.length > 0) {
      console.log('⚠️  UNEXPECTED CHARACTERS:', unexpectedChars.join(', '));
    } else {
      console.log('✅ All characters are from the character sheet');
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

    if (allDialogues.length > 0 && uniqueDialogues.size < allDialogues.length * 0.5) {
      console.log('⚠️  Low dialogue variety - may have repetitive phrases');
    } else {
      console.log('✅ Good dialogue variety');
    }

    console.log('\nAll dialogues:');
    allDialogues.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d}`);
    });

    console.log('\nGeneration time:',
      data.publishedAt && data.createdAt
        ? ((data.publishedAt.toMillis() - data.createdAt.toMillis()) / 1000).toFixed(1) + 's'
        : 'unknown'
    );

  } else {
    console.log('Episode 13 not found');
  }

  process.exit(0);
}

checkQuality();
