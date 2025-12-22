const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function check() {
  const storyId = 'story_1765042854197_8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  const doc = await db.collection('stories').doc(storyId).get();

  if (!doc.exists) {
    console.log('Story not found');
    return;
  }

  const data = doc.data();
  console.log('Story:', data.titleJa || data.title);
  console.log('ID:', storyId);
  console.log('Created:', data.createdAt?.toDate?.()?.toISOString());
  console.log('Full audio URL:', data.fullAudioUrl ? 'Present' : 'MISSING');
  console.log('Audio status:', data.audioStatus || 'unknown');

  const pages = data.pages || [];
  const pagesWithAudio = pages.filter(p => !!p.audioUrl).length;
  console.log('Pages with audio:', pagesWithAudio + '/' + pages.length);

  // Check the date - is it within 7 days?
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 7);
  const createdAt = data.createdAt?.toDate?.();
  const isWithin7Days = createdAt && createdAt >= lookbackDate;
  console.log('\nWithin 7-day scope:', isWithin7Days ? 'YES' : 'NO');

  // Check integrity checker logic
  const hasFullAudio = !!data.fullAudioUrl;
  const audioStatus = data.audioStatus;
  const hasFailed = audioStatus === 'failed' || audioStatus === 'partial';

  console.log('\nIntegrity checker would flag as missing audio:', (!hasFullAudio || hasFailed) ? 'YES' : 'NO');
  console.log('  - Has full audio:', hasFullAudio);
  console.log('  - Audio status is failed/partial:', hasFailed);
}

check().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
