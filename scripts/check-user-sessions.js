const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkUserData() {
  console.log('=== Checking user data for:', userId, '===\n');

  // 1. Check user_stats
  console.log('--- USER STATS ---');
  try {
    const statsDoc = await db.collection('user_stats').doc(userId).get();
    if (statsDoc.exists) {
      const data = statsDoc.data();
      console.log('XP:', JSON.stringify(data.xp, null, 2));
      console.log('Streak:', JSON.stringify(data.streak, null, 2));
      console.log('Dates:', JSON.stringify(data.dates, null, 2));
      if (data.news) console.log('News:', JSON.stringify(data.news, null, 2));
      if (data.sessions) console.log('Sessions:', JSON.stringify(data.sessions, null, 2));
    } else {
      console.log('No user_stats document found');
    }
  } catch (e) {
    console.log('Error fetching user_stats:', e.message);
  }

  // 2. Check review_sessions collection
  console.log('\n--- REVIEW SESSIONS ---');
  try {
    const sessionsSnap = await db.collection('review_sessions')
      .where('userId', '==', userId)
      .orderBy('completedAt', 'desc')
      .limit(20)
      .get();

    if (sessionsSnap.empty) {
      console.log('No review_sessions found');
    } else {
      sessionsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}:`, {
          completedAt: data.completedAt,
          type: data.type || data.sessionType,
          itemsReviewed: data.itemsReviewed,
          accuracy: data.accuracy,
          xpEarned: data.xpEarned
        });
      });
    }
  } catch (e) {
    console.log('Error or no review_sessions collection:', e.message);
  }

  // 3. Check session_history collection
  console.log('\n--- SESSION HISTORY ---');
  try {
    const historySnap = await db.collection('session_history')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (historySnap.empty) {
      console.log('No session_history found');
    } else {
      historySnap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}:`, data);
      });
    }
  } catch (e) {
    console.log('Error or no session_history collection:', e.message);
  }

  // 4. Check news_progress
  console.log('\n--- NEWS PROGRESS ---');
  try {
    const newsSnap = await db.collection('news_progress')
      .where('userId', '==', userId)
      .orderBy('completedAt', 'desc')
      .limit(10)
      .get();

    if (newsSnap.empty) {
      console.log('No news_progress found');
    } else {
      newsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}:`, {
          articleId: data.articleId,
          completedAt: data.completedAt,
          xpEarned: data.xpEarned,
          totalReadTimeMs: data.totalReadTimeMs
        });
      });
    }
  } catch (e) {
    console.log('Error or no news_progress:', e.message);
  }

  // 5. Check kanji_progress
  console.log('\n--- KANJI PROGRESS ---');
  try {
    const kanjiSnap = await db.collection('kanji_progress')
      .where('userId', '==', userId)
      .limit(20)
      .get();

    if (kanjiSnap.empty) {
      console.log('No kanji_progress found');
    } else {
      console.log(`Found ${kanjiSnap.size} kanji progress entries`);
      kanjiSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.kanji || doc.id}:`, {
          lastReviewed: data.lastReviewed || data.updatedAt,
          level: data.level,
          correctCount: data.correctCount
        });
      });
    }
  } catch (e) {
    console.log('Error or no kanji_progress:', e.message);
  }

  // 6. Check vocabulary_progress
  console.log('\n--- VOCABULARY PROGRESS ---');
  try {
    const vocabSnap = await db.collection('vocabulary_progress')
      .where('userId', '==', userId)
      .limit(20)
      .get();

    if (vocabSnap.empty) {
      console.log('No vocabulary_progress found');
    } else {
      console.log(`Found ${vocabSnap.size} vocabulary progress entries`);
    }
  } catch (e) {
    console.log('Error or no vocabulary_progress:', e.message);
  }

  // 7. List all subcollections under user document
  console.log('\n--- CHECKING USER DOCUMENT SUBCOLLECTIONS ---');
  try {
    const userDoc = db.collection('users').doc(userId);
    const collections = await userDoc.listCollections();
    console.log('Subcollections:', collections.map(c => c.id));

    for (const col of collections) {
      const snap = await col.orderBy('__name__').limit(5).get();
      console.log(`\n  ${col.id} (${snap.size} samples):`);
      snap.forEach(doc => {
        console.log(`    - ${doc.id}:`, JSON.stringify(doc.data()).substring(0, 200));
      });
    }
  } catch (e) {
    console.log('Error listing subcollections:', e.message);
  }

  // 8. Check gamification_events if exists
  console.log('\n--- GAMIFICATION EVENTS ---');
  try {
    const eventsSnap = await db.collection('gamification_events')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (eventsSnap.empty) {
      console.log('No gamification_events found');
    } else {
      eventsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}:`, {
          type: data.type,
          timestamp: data.timestamp,
          xp: data.xp || data.xpEarned
        });
      });
    }
  } catch (e) {
    console.log('Error or no gamification_events:', e.message);
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

checkUserData().catch(console.error);
