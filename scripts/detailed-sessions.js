const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') return timestamp;
  return String(timestamp);
}

function getTimestamp(val) {
  if (!val) return 0;
  if (val._seconds) return val._seconds * 1000;
  if (val.toDate) return val.toDate().getTime();
  if (typeof val === 'string') return new Date(val).getTime();
  return 0;
}

async function getDetailedSessions() {
  console.log('=== DETAILED SESSION HISTORY ===\n');
  console.log('User:', userId);
  console.log('');

  const userDoc = db.collection('users').doc(userId);

  // 1. Study Sessions (Kana study, etc.)
  console.log('=== STUDY SESSIONS (Kana Learning) ===');
  const studySessions = await userDoc.collection('study_sessions').get();
  const studyData = [];
  studySessions.forEach(doc => {
    const d = doc.data();
    studyData.push({
      id: doc.id,
      type: d.sessionType,
      script: d.script,
      charCount: d.characters?.length || 0,
      startedAt: d.startedAt,
      completedAt: d.completedAt
    });
  });
  studyData.sort((a, b) => getTimestamp(b.completedAt) - getTimestamp(a.completedAt));
  studyData.slice(0, 15).forEach(s => {
    console.log(`  ${formatDate(s.completedAt) || formatDate(s.startedAt) || 'N/A'} | ${s.script} ${s.type} | ${s.charCount} chars`);
  });
  console.log(`  Total: ${studyData.length} study sessions\n`);

  // 2. Review Sessions (Kana review)
  console.log('=== REVIEW SESSIONS (Kana Review) ===');
  const reviewSessions = await userDoc.collection('review_sessions').get();
  const reviewData = [];
  reviewSessions.forEach(doc => {
    const d = doc.data();
    reviewData.push({
      id: doc.id,
      type: d.sessionType,
      script: d.script,
      charCount: d.characters?.length || 0,
      startedAt: d.startedAt,
      completedAt: d.completedAt
    });
  });
  reviewData.sort((a, b) => getTimestamp(b.completedAt) - getTimestamp(a.completedAt));
  reviewData.forEach(s => {
    console.log(`  ${formatDate(s.completedAt) || formatDate(s.startedAt) || 'N/A'} | ${s.script} ${s.type} | ${s.charCount} chars`);
  });
  console.log(`  Total: ${reviewData.length} review sessions\n`);

  // 3. Drill History (Conjugation drills)
  console.log('=== DRILL SESSIONS (Conjugation Practice) ===');
  const drillHistory = await userDoc.collection('drill_history').get();
  const drillData = [];
  drillHistory.forEach(doc => {
    const d = doc.data();
    drillData.push({
      id: doc.id,
      mode: d.mode,
      completedAt: d.completedAt,
      score: d.score,
      total: d.totalQuestions,
      accuracy: d.accuracy,
      perfect: d.perfectSession
    });
  });
  drillData.sort((a, b) => getTimestamp(b.completedAt) - getTimestamp(a.completedAt));
  drillData.slice(0, 15).forEach(s => {
    console.log(`  ${formatDate(s.completedAt)} | ${s.mode} mode | Score: ${s.score}/${s.total} (${Math.round(s.accuracy)}%) ${s.perfect ? '⭐' : ''}`);
  });
  console.log(`  Total: ${drillData.length} drill sessions\n`);

  // 4. Kanji Browse History
  console.log('=== KANJI BROWSE HISTORY ===');
  const kanjiBrowse = await userDoc.collection('kanji_browse_history').get();
  const kanjiData = [];
  kanjiBrowse.forEach(doc => {
    const d = doc.data();
    kanjiData.push({
      kanji: d.character,
      timestamp: formatDate(d.timestamp),
      source: d.source
    });
  });
  kanjiData.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  // Group by date
  const kanjiByDate = {};
  kanjiData.forEach(k => {
    const date = k.timestamp.split('T')[0];
    if (!kanjiByDate[date]) kanjiByDate[date] = [];
    kanjiByDate[date].push(k.kanji);
  });
  Object.entries(kanjiByDate).slice(0, 10).forEach(([date, chars]) => {
    console.log(`  ${date}: ${[...new Set(chars)].join(', ')}`);
  });
  console.log(`  Total: ${kanjiData.length} kanji browsed\n`);

  // 5. SRS Data summary
  console.log('=== SRS PROGRESS (Items being reviewed) ===');
  const srsData = await userDoc.collection('srs_data').get();
  const srsByType = { kana: 0, sentence: 0, other: 0 };
  const recentSrs = [];
  srsData.forEach(doc => {
    const d = doc.data();
    const type = d.contentType || 'other';
    if (srsByType[type] !== undefined) srsByType[type]++;
    else srsByType.other++;
    if (d.lastReviewedAt) {
      recentSrs.push({
        item: d.character || d.itemId,
        type: d.contentType,
        lastReviewed: d.lastReviewedAt,
        correctCount: d.correctCount,
        streak: d.streak
      });
    }
  });
  console.log(`  Kana items: ${srsByType.kana}`);
  console.log(`  Sentence items: ${srsByType.sentence}`);
  console.log(`  Other items: ${srsByType.other}`);
  recentSrs.sort((a, b) => b.lastReviewed.localeCompare(a.lastReviewed));
  console.log('\n  Recent SRS reviews:');
  recentSrs.slice(0, 10).forEach(s => {
    console.log(`    ${s.lastReviewed} | ${s.item} (${s.type}) | streak: ${s.streak}`);
  });
  console.log('');

  // 6. User stats summary
  console.log('=== OVERALL STATS ===');
  const statsDoc = await db.collection('user_stats').doc(userId).get();
  if (statsDoc.exists) {
    const stats = statsDoc.data();
    console.log(`  Total XP: ${stats.xp?.total || 0}`);
    console.log(`  Level: ${stats.xp?.level || 1}`);
    console.log(`  XP Today: ${stats.xp?.xpGainedToday || 0}`);
    console.log(`  Current Streak: ${stats.streak?.current || 0} days`);
    console.log(`  Best Streak: ${stats.streak?.best || 0} days`);
    console.log(`  Total Sessions: ${stats.sessions?.totalSessions || 0}`);
    console.log(`  Articles Read: ${stats.news?.articlesRead || 0}`);
    console.log(`  Last Activity: ${stats.dates?.lastActivityDate || 'N/A'}`);
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

getDetailedSessions().catch(console.error);
