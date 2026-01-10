/**
 * Seed QA Test Data
 * Creates realistic Q&A interactions for manual testing
 * Users: dan, liza, xavier, maggy
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mock user data (you'll need to replace with actual UIDs from Firebase Auth)
const users = {
  dan: {
    uid: null, // Will be fetched from Firestore
    name: 'Dan',
    email: 'dan@example.com',
    avatar: null
  },
  liza: {
    uid: null,
    name: 'Liza',
    email: 'liza@example.com',
    avatar: null
  },
  xavier: {
    uid: null,
    name: 'Xavier',
    email: 'xavier@example.com',
    avatar: null
  },
  maggy: {
    uid: null,
    name: 'Maggy',
    email: 'maggy@example.com',
    avatar: null
  }
};

async function fetchUserData() {
  console.log('\n🔍 Fetching user data from Firestore...\n');

  const usersSnapshot = await db.collection('users').get();

  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    const name = userData.displayName || userData.name || '';
    const nameLower = name.toLowerCase();

    if (nameLower.includes('dan') && !users.dan.uid) {
      users.dan.uid = doc.id;
      users.dan.name = userData.displayName || 'Dan';
      users.dan.email = userData.email;
      users.dan.avatar = userData.photoURL;
      console.log(`✅ Found Dan: ${doc.id}`);
    }
    if (nameLower.includes('liza') && !users.liza.uid) {
      users.liza.uid = doc.id;
      users.liza.name = userData.displayName || 'Liza';
      users.liza.email = userData.email;
      users.liza.avatar = userData.photoURL;
      console.log(`✅ Found Liza: ${doc.id}`);
    }
    if (nameLower.includes('xavier') && !users.xavier.uid) {
      users.xavier.uid = doc.id;
      users.xavier.name = userData.displayName || 'Xavier';
      users.xavier.email = userData.email;
      users.xavier.avatar = userData.photoURL;
      console.log(`✅ Found Xavier: ${doc.id}`);
    }
    if (nameLower.includes('maggy') && !users.maggy.uid) {
      users.maggy.uid = doc.id;
      users.maggy.name = userData.displayName || 'Maggy';
      users.maggy.email = userData.email;
      users.maggy.avatar = userData.photoURL;
      console.log(`✅ Found Maggy: ${doc.id}`);
    }
  });

  console.log('\n');

  // Verify all users found
  const missingUsers = Object.keys(users).filter(key => !users[key].uid);
  if (missingUsers.length > 0) {
    throw new Error(`Could not find users: ${missingUsers.join(', ')}`);
  }
}

async function clearExistingTestData() {
  console.log('🧹 Clearing existing test data...\n');

  // Delete all questions (cascade handled by deletion logic)
  const questionsSnapshot = await db.collection('qa_questions').get();
  const questionIds = questionsSnapshot.docs.map(doc => doc.id);

  for (const questionId of questionIds) {
    // Delete answers
    const answersSnapshot = await db.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get();

    for (const answerDoc of answersSnapshot.docs) {
      // Delete answer votes
      const answerVotesSnapshot = await db.collection('qa_answer_votes')
        .where('answerId', '==', answerDoc.id)
        .get();

      for (const voteDoc of answerVotesSnapshot.docs) {
        await voteDoc.ref.delete();
      }

      await answerDoc.ref.delete();
    }

    // Delete question votes
    const questionVotesSnapshot = await db.collection('qa_question_votes')
      .where('questionId', '==', questionId)
      .get();

    for (const voteDoc of questionVotesSnapshot.docs) {
      await voteDoc.ref.delete();
    }

    // Delete question
    await db.collection('qa_questions').doc(questionId).delete();
  }

  console.log(`✅ Deleted ${questionIds.length} questions with all related data\n`);
}

async function createQuestion(author, title, content, tags, difficulty) {
  const questionRef = await db.collection('qa_questions').add({
    title,
    content,
    tags,
    difficulty,
    author: {
      uid: author.uid,
      name: author.name,
      email: author.email,
      avatar: author.avatar || null
    },
    upvotes: 0,
    downvotes: 0,
    answerCount: 0,
    viewCount: Math.floor(Math.random() * 50) + 5, // Random views 5-55
    hasAcceptedAnswer: false,
    moderationStatus: 'approved', // Auto-approve for testing
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  });

  return questionRef.id;
}

async function createAnswer(questionId, author, content, moderationStatus = 'approved', accepted = false) {
  const answerRef = await db.collection('qa_answers').add({
    questionId,
    content,
    author: {
      uid: author.uid,
      name: author.name,
      email: author.email,
      avatar: author.avatar || null
    },
    upvotes: 0,
    downvotes: 0,
    accepted,
    moderationStatus,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  });

  // Update question answer count
  await db.collection('qa_questions').doc(questionId).update({
    answerCount: admin.firestore.FieldValue.increment(1)
  });

  return answerRef.id;
}

async function voteOnQuestion(questionId, userId, voteType) {
  const voteId = `${userId}_${questionId}`;

  await db.collection('qa_question_votes').doc(voteId).set({
    questionId,
    userId,
    voteType, // 'upvote' or 'downvote'
    createdAt: admin.firestore.Timestamp.now()
  });

  const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
  await db.collection('qa_questions').doc(questionId).update({
    [field]: admin.firestore.FieldValue.increment(1)
  });
}

async function voteOnAnswer(answerId, userId, voteType) {
  const voteId = `${userId}_${answerId}`;

  await db.collection('qa_answer_votes').doc(voteId).set({
    answerId,
    userId,
    voteType,
    createdAt: admin.firestore.Timestamp.now()
  });

  const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
  await db.collection('qa_answers').doc(answerId).update({
    [field]: admin.firestore.FieldValue.increment(1)
  });
}

async function acceptAnswer(questionId, answerId) {
  await db.collection('qa_answers').doc(answerId).update({
    accepted: true,
    updatedAt: admin.firestore.Timestamp.now()
  });

  await db.collection('qa_questions').doc(questionId).update({
    hasAcceptedAnswer: true,
    acceptedAnswerId: answerId,
    updatedAt: admin.firestore.Timestamp.now()
  });
}

async function seedData() {
  console.log('🌱 Seeding QA test data...\n');

  // Scenario 1: Dan asks about particle は vs が (has approved answers from others - CANNOT DELETE)
  console.log('Creating Scenario 1: Question with approved answers from others...');
  const q1 = await createQuestion(
    users.dan,
    'When should I use は (wa) vs が (ga)?',
    'I keep getting confused about when to use the topic marker は versus the subject marker が. Can someone explain the difference with examples?',
    ['grammar', 'particles'],
    'beginner'
  );
  const a1_1 = await createAnswer(q1, users.liza,
    'は marks the topic of the sentence (what you\'re talking about), while が marks the subject (who/what is doing the action). For example: 私は学生です (I am a student) vs 誰が来ますか (Who is coming?)',
    'approved'
  );
  const a1_2 = await createAnswer(q1, users.xavier,
    'Think of は as "speaking of X..." and が as highlighting new information. は is for known topics, が introduces new info or contrasts.',
    'approved'
  );
  await acceptAnswer(q1, a1_1);
  await voteOnQuestion(q1, users.liza.uid, 'upvote');
  await voteOnQuestion(q1, users.xavier.uid, 'upvote');
  await voteOnQuestion(q1, users.maggy.uid, 'upvote');
  await voteOnAnswer(a1_1, users.dan.uid, 'upvote');
  await voteOnAnswer(a1_1, users.xavier.uid, 'upvote');
  await voteOnAnswer(a1_2, users.dan.uid, 'upvote');
  console.log(`✅ Question ${q1} - CANNOT DELETE (has approved answers from others)\n`);

  // Scenario 2: Liza asks about kanji (has REJECTED answers - CAN DELETE)
  console.log('Creating Scenario 2: Question with rejected answers (THE BUG SCENARIO)...');
  const q2 = await createQuestion(
    users.liza,
    'How many kanji do I need to know for JLPT N5?',
    'I\'m preparing for JLPT N5 and wondering how many kanji characters I should study. Any recommendations?',
    ['kanji', 'jlpt'],
    'beginner'
  );
  const a2_1 = await createAnswer(q2, users.dan,
    'SPAM: Click here for free kanji lessons!!!',
    'rejected' // This is spam/rejected
  );
  const a2_2 = await createAnswer(q2, users.xavier,
    'Just learn all 2000 jouyou kanji, it\'s easy.',
    'rejected' // This is unhelpful/rejected
  );
  await voteOnQuestion(q2, users.dan.uid, 'upvote');
  await voteOnQuestion(q2, users.maggy.uid, 'upvote');
  console.log(`✅ Question ${q2} - CAN DELETE (only rejected answers)\n`);

  // Scenario 3: Xavier asks about verb conjugation (has pending answers - CAN DELETE)
  console.log('Creating Scenario 3: Question with pending answers...');
  const q3 = await createQuestion(
    users.xavier,
    'What\'s the difference between 食べる and 食べます?',
    'I see both forms in textbooks. When should I use the dictionary form vs the polite form?',
    ['grammar', 'verbs'],
    'beginner'
  );
  const a3_1 = await createAnswer(q3, users.maggy,
    '食べる is casual/dictionary form, 食べます is polite. Use polite form with strangers, teachers, etc.',
    'pending' // Still under moderation
  );
  await voteOnQuestion(q3, users.liza.uid, 'upvote');
  console.log(`✅ Question ${q3} - CAN DELETE (only pending answers)\n`);

  // Scenario 4: Maggy asks about reading practice (no answers - CAN DELETE)
  console.log('Creating Scenario 4: Question with no answers...');
  const q4 = await createQuestion(
    users.maggy,
    'Best resources for reading practice at intermediate level?',
    'I\'ve finished Genki 1&2 and looking for interesting reading materials. What do you recommend?',
    ['reading', 'resources'],
    'intermediate'
  );
  await voteOnQuestion(q4, users.liza.uid, 'upvote');
  console.log(`✅ Question ${q4} - CAN DELETE (no answers)\n`);

  // Scenario 5: Dan asks another question (has own approved answer + others' rejected - CAN DELETE)
  console.log('Creating Scenario 5: Question with own approved answer + others rejected...');
  const q5 = await createQuestion(
    users.dan,
    'How to remember the difference between 日 and 曰?',
    'These two kanji look almost identical! 日 (sun/day) and 曰 (to say). Any tips to tell them apart?',
    ['kanji'],
    'beginner'
  );
  const a5_1 = await createAnswer(q5, users.dan,
    'Update: I found that 曰 is slightly wider. Looking at the stroke order also helps!',
    'approved' // Dan answering his own question
  );
  const a5_2 = await createAnswer(q5, users.liza,
    'Buy my kanji course for $999',
    'rejected' // Spam
  );
  await voteOnAnswer(a5_1, users.xavier.uid, 'upvote');
  console.log(`✅ Question ${q5} - CAN DELETE (own approved + others rejected)\n`);

  // Scenario 6: Liza asks about pitch accent (active discussion)
  console.log('Creating Scenario 6: Active question with multiple approved answers...');
  const q6 = await createQuestion(
    users.liza,
    'Is pitch accent important for beginners?',
    'I\'ve heard some people say pitch accent is crucial, others say focus on it later. What\'s your experience?',
    ['pronunciation', 'pitch-accent'],
    'beginner'
  );
  const a6_1 = await createAnswer(q6, users.xavier,
    'I think it\'s good to be aware of it early, but don\'t stress too much. Focus on getting comfortable with speaking first.',
    'approved'
  );
  const a6_2 = await createAnswer(q6, users.maggy,
    'Pitch accent is super important! Native speakers notice when it\'s off. I recommend studying it alongside vocabulary.',
    'approved'
  );
  const a6_3 = await createAnswer(q6, users.dan,
    'Personally I ignored it for 2 years and regret it. Harder to fix later. Start early but don\'t obsess.',
    'approved'
  );
  await voteOnQuestion(q6, users.dan.uid, 'upvote');
  await voteOnQuestion(q6, users.xavier.uid, 'upvote');
  await voteOnQuestion(q6, users.maggy.uid, 'upvote');
  await voteOnAnswer(a6_1, users.liza.uid, 'upvote');
  await voteOnAnswer(a6_2, users.liza.uid, 'upvote');
  await voteOnAnswer(a6_3, users.liza.uid, 'upvote');
  await voteOnAnswer(a6_2, users.dan.uid, 'upvote');
  await acceptAnswer(q6, a6_3);
  console.log(`✅ Question ${q6} - CANNOT DELETE (approved answers from others)\n`);

  // Scenario 7: Xavier asks about keigo (mixed answers)
  console.log('Creating Scenario 7: Question with mix of statuses...');
  const q7 = await createQuestion(
    users.xavier,
    'When do I need to use keigo (敬語)?',
    'I know there\'s different levels of politeness but when exactly should I use honorific language?',
    ['grammar', 'keigo'],
    'intermediate'
  );
  const a7_1 = await createAnswer(q7, users.maggy,
    'Use it with customers, superiors, strangers. There are 3 types: sonkeigo (respectful), kenjougo (humble), and teineigo (polite).',
    'approved'
  );
  const a7_2 = await createAnswer(q7, users.liza,
    'Check out this video: [broken link]',
    'rejected' // Broken/low quality
  );
  const a7_3 = await createAnswer(q7, users.dan,
    'It depends on the situation - workplace, meeting elders, formal settings all require keigo.',
    'pending'
  );
  await voteOnQuestion(q7, users.liza.uid, 'upvote');
  await voteOnAnswer(a7_1, users.xavier.uid, 'upvote');
  await acceptAnswer(q7, a7_1);
  console.log(`✅ Question ${q7} - CANNOT DELETE (has approved answer from other)\n`);

  // Scenario 8: Maggy asks about counters
  console.log('Creating Scenario 8: Unanswered question with votes...');
  const q8 = await createQuestion(
    users.maggy,
    'How do I know which counter to use for objects?',
    'Japanese has so many counters (本、個、枚、etc). Is there a system or do I just have to memorize them all?',
    ['grammar', 'counters'],
    'beginner'
  );
  await voteOnQuestion(q8, users.dan.uid, 'upvote');
  await voteOnQuestion(q8, users.liza.uid, 'upvote');
  console.log(`✅ Question ${q8} - CAN DELETE (no answers)\n`);

  // Scenario 9: Dan asks about mnemonics (helpful community)
  console.log('Creating Scenario 9: Popular question with accepted answer...');
  const q9 = await createQuestion(
    users.dan,
    'Best mnemonics for remembering hiragana?',
    'I keep mixing up similar-looking characters like ぬ and め, or は and ほ. Any memory tricks?',
    ['hiragana', 'mnemonics'],
    'beginner'
  );
  const a9_1 = await createAnswer(q9, users.liza,
    'For ぬ vs め: ぬ has a "loop" (noodle), め has "eye" shape. For は vs ほ: ほ has an extra stroke (more = mo/ho).',
    'approved'
  );
  const a9_2 = await createAnswer(q9, users.maggy,
    'I use stories! Like ぬ is a "noodle" you\'re slurping, め is an "eye" looking at you.',
    'approved'
  );
  await acceptAnswer(q9, a9_1);
  await voteOnQuestion(q9, users.liza.uid, 'upvote');
  await voteOnQuestion(q9, users.xavier.uid, 'upvote');
  await voteOnQuestion(q9, users.maggy.uid, 'upvote');
  await voteOnAnswer(a9_1, users.dan.uid, 'upvote');
  await voteOnAnswer(a9_1, users.xavier.uid, 'upvote');
  await voteOnAnswer(a9_2, users.dan.uid, 'upvote');
  console.log(`✅ Question ${q9} - CANNOT DELETE (approved answers from others)\n`);

  // Scenario 10: Liza asks advanced question (fewer interactions)
  console.log('Creating Scenario 10: Advanced question with one answer...');
  const q10 = await createQuestion(
    users.liza,
    'Difference between ～たら、～ば、～と、～なら conditionals?',
    'I understand the basic meaning but struggle to know which conditional to use in different situations. Are there clear rules?',
    ['grammar', 'conditionals'],
    'advanced'
  );
  const a10_1 = await createAnswer(q10, users.xavier,
    'たら is most common (after/when), ば is hypothetical, と is natural consequence, なら is topic-conditional. Each has nuances though.',
    'approved'
  );
  await voteOnQuestion(q10, users.dan.uid, 'upvote');
  await voteOnAnswer(a10_1, users.liza.uid, 'upvote');
  console.log(`✅ Question ${q10} - CANNOT DELETE (approved answer from other)\n`);

  // Scenario 11: Xavier shares experience (self-answered)
  console.log('Creating Scenario 11: Self-answered question...');
  const q11 = await createQuestion(
    users.xavier,
    'How long does it take to read NHK Easy News comfortably?',
    'For those who can read NHK Easy News without too much dictionary use, how long did it take you to get there?',
    ['reading', 'progress'],
    'intermediate'
  );
  const a11_1 = await createAnswer(q11, users.xavier,
    'Answering my own question: After 18 months of daily study, I can now read most articles with ~5 lookups. YMMV!',
    'approved'
  );
  await voteOnQuestion(q11, users.liza.uid, 'upvote');
  await voteOnAnswer(a11_1, users.maggy.uid, 'upvote');
  console.log(`✅ Question ${q11} - CAN DELETE (only own approved answer)\n`);

  // Scenario 12: Maggy asks about anime (popular topic)
  console.log('Creating Scenario 12: Popular question with debate...');
  const q12 = await createQuestion(
    users.maggy,
    'Is watching anime without subtitles good for learning?',
    'I\'m around N4 level. Should I watch with Japanese subs, English subs, or try no subs? What helped you most?',
    ['listening', 'resources', 'anime'],
    'intermediate'
  );
  const a12_1 = await createAnswer(q12, users.dan,
    'Japanese subs are best IMO. You can look up words and match what you hear. English subs = passive watching.',
    'approved'
  );
  const a12_2 = await createAnswer(q12, users.liza,
    'I disagree - start with English subs to understand story, then rewatch with Japanese subs. Build confidence first!',
    'approved'
  );
  const a12_3 = await createAnswer(q12, users.xavier,
    'No subs is only useful if you\'re already advanced. At N4, use Japanese subs with pause button.',
    'approved'
  );
  await voteOnQuestion(q12, users.dan.uid, 'upvote');
  await voteOnQuestion(q12, users.liza.uid, 'upvote');
  await voteOnQuestion(q12, users.xavier.uid, 'upvote');
  await voteOnAnswer(a12_1, users.maggy.uid, 'upvote');
  await voteOnAnswer(a12_1, users.xavier.uid, 'upvote');
  await voteOnAnswer(a12_2, users.maggy.uid, 'upvote');
  await voteOnAnswer(a12_3, users.maggy.uid, 'upvote');
  await voteOnAnswer(a12_3, users.dan.uid, 'upvote');
  await acceptAnswer(q12, a12_1);
  console.log(`✅ Question ${q12} - CANNOT DELETE (approved answers from others)\n`);

  console.log('\n✅ Seeding complete!\n');
}

async function printSummary() {
  console.log('📊 SUMMARY OF TEST DATA:\n');
  console.log('=' .repeat(80));

  const questionsSnapshot = await db.collection('qa_questions').get();

  for (const questionDoc of questionsSnapshot.docs) {
    const question = questionDoc.data();
    const questionId = questionDoc.id;

    const answersSnapshot = await db.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get();

    const answers = answersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const approvedFromOthers = answers.filter(a =>
      a.moderationStatus === 'approved' && a.author.uid !== question.author.uid
    );

    const canDelete = approvedFromOthers.length === 0;

    console.log(`\nQuestion: "${question.title}"`);
    console.log(`  Author: ${question.author.name}`);
    console.log(`  Tags: ${question.tags.join(', ')}`);
    console.log(`  Upvotes: ${question.upvotes} | Answers: ${answers.length}`);
    console.log(`  Answers breakdown:`);

    const approved = answers.filter(a => a.moderationStatus === 'approved').length;
    const rejected = answers.filter(a => a.moderationStatus === 'rejected').length;
    const pending = answers.filter(a => a.moderationStatus === 'pending').length;

    console.log(`    - Approved: ${approved} (${approvedFromOthers.length} from others)`);
    console.log(`    - Rejected: ${rejected}`);
    console.log(`    - Pending: ${pending}`);
    console.log(`  ${canDelete ? '✅ CAN DELETE' : '❌ CANNOT DELETE'} (${canDelete ? 'no approved from others' : 'has approved from others'})`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 KEY SCENARIOS:');
  console.log('  1. Questions with approved answers from others → CANNOT DELETE');
  console.log('  2. Questions with only rejected answers → CAN DELETE (bug scenario!)');
  console.log('  3. Questions with only pending answers → CAN DELETE');
  console.log('  4. Questions with no answers → CAN DELETE');
  console.log('  5. Questions with own approved answers only → CAN DELETE');
  console.log('\n✨ Ready for manual testing!\n');
}

async function main() {
  try {
    await fetchUserData();
    await clearExistingTestData();
    await seedData();
    await printSummary();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
