/**
 * Create sample lists for testing
 * Usage: node scripts/create-sample-lists.js <userId>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const userId = process.argv[2];
if (!userId) {
  console.error('❌ Error: Please provide a userId');
  console.log('Usage: node scripts/create-sample-lists.js <userId>');
  process.exit(1);
}

// Sample data for each list type
const wordListItems = [
  { content: '雨', metadata: { reading: 'あめ', meaning: 'rain', jlptLevel: 5 } },
  { content: '風', metadata: { reading: 'かぜ', meaning: 'wind', jlptLevel: 5 } },
  { content: '空', metadata: { reading: 'そら', meaning: 'sky', jlptLevel: 5 } },
  { content: '海', metadata: { reading: 'うみ', meaning: 'sea', jlptLevel: 5 } },
  { content: '山', metadata: { reading: 'やま', meaning: 'mountain', jlptLevel: 5 } },
  { content: '川', metadata: { reading: 'かわ', meaning: 'river', jlptLevel: 5 } },
  { content: '木', metadata: { reading: 'き', meaning: 'tree', jlptLevel: 5 } },
  { content: '花', metadata: { reading: 'はな', meaning: 'flower', jlptLevel: 5 } },
  { content: '星', metadata: { reading: 'ほし', meaning: 'star', jlptLevel: 5 } },
  { content: '月', metadata: { reading: 'つき', meaning: 'moon', jlptLevel: 5 } },
  { content: '太陽', metadata: { reading: 'たいよう', meaning: 'sun', jlptLevel: 5 } },
  { content: '水', metadata: { reading: 'みず', meaning: 'water', jlptLevel: 5 } },
];

const verbAdjListItems = [
  { content: '食べる', metadata: { reading: 'たべる', meaning: 'to eat', jlptLevel: 5 } },
  { content: '飲む', metadata: { reading: 'のむ', meaning: 'to drink', jlptLevel: 5 } },
  { content: '見る', metadata: { reading: 'みる', meaning: 'to see', jlptLevel: 5 } },
  { content: '聞く', metadata: { reading: 'きく', meaning: 'to hear/listen', jlptLevel: 5 } },
  { content: '話す', metadata: { reading: 'はなす', meaning: 'to speak', jlptLevel: 5 } },
  { content: '読む', metadata: { reading: 'よむ', meaning: 'to read', jlptLevel: 5 } },
  { content: '書く', metadata: { reading: 'かく', meaning: 'to write', jlptLevel: 5 } },
  { content: '行く', metadata: { reading: 'いく', meaning: 'to go', jlptLevel: 5 } },
  { content: '来る', metadata: { reading: 'くる', meaning: 'to come', jlptLevel: 4 } },
  { content: '大きい', metadata: { reading: 'おおきい', meaning: 'big', jlptLevel: 5 } },
  { content: '小さい', metadata: { reading: 'ちいさい', meaning: 'small', jlptLevel: 5 } },
  { content: '新しい', metadata: { reading: 'あたらしい', meaning: 'new', jlptLevel: 5 } },
];

const sentenceListItems = [
  { content: '今日はいい天気ですね。', metadata: { reading: 'きょうはいいてんきですね', meaning: 'It\'s nice weather today, isn\'t it?', jlptLevel: 5 } },
  { content: '私は学生です。', metadata: { reading: 'わたしはがくせいです', meaning: 'I am a student.', jlptLevel: 5 } },
  { content: '日本語を勉強しています。', metadata: { reading: 'にほんごをべんきょうしています', meaning: 'I am studying Japanese.', jlptLevel: 5 } },
  { content: '毎日図書館に行きます。', metadata: { reading: 'まいにちとしょかんにいきます', meaning: 'I go to the library every day.', jlptLevel: 5 } },
  { content: '昨日映画を見ました。', metadata: { reading: 'きのうえいがをみました', meaning: 'I watched a movie yesterday.', jlptLevel: 5 } },
  { content: 'これは私の本です。', metadata: { reading: 'これはわたしのほんです', meaning: 'This is my book.', jlptLevel: 5 } },
  { content: 'あなたの名前は何ですか。', metadata: { reading: 'あなたのなまえはなんですか', meaning: 'What is your name?', jlptLevel: 5 } },
  { content: '明日友達と会います。', metadata: { reading: 'あしたともだちとあいます', meaning: 'I will meet my friend tomorrow.', jlptLevel: 5 } },
  { content: 'ここは静かです。', metadata: { reading: 'ここはしずかです', meaning: 'It is quiet here.', jlptLevel: 5 } },
  { content: '日本料理が好きです。', metadata: { reading: 'にほんりょうりがすきです', meaning: 'I like Japanese food.', jlptLevel: 5 } },
  { content: '駅はどこですか。', metadata: { reading: 'えきはどこですか', meaning: 'Where is the station?', jlptLevel: 5 } },
  { content: '明日雨が降るでしょう。', metadata: { reading: 'あしたあめがふるでしょう', meaning: 'It will probably rain tomorrow.', jlptLevel: 4 } },
];

async function createList(userId, name, type, emoji, color, items) {
  console.log(`\n📝 Creating ${type} list: "${name}"...`);

  const listId = db.collection('users').doc(userId).collection('lists').doc().id;
  const now = admin.firestore.Timestamp.now();

  const listData = {
    id: listId,
    name,
    type,
    emoji,
    color,
    items: items.map((item, index) => ({
      id: `item_${Date.now()}_${index}`,
      content: item.content,
      metadata: item.metadata,
      createdAt: now,
    })),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(userId).collection('lists').doc(listId).set(listData);

  console.log(`✅ Created list "${name}" with ${items.length} items (ID: ${listId})`);
  return listId;
}

async function main() {
  console.log(`\n🚀 Creating sample lists for user: ${userId}\n`);

  try {
    // Create word list
    await createList(
      userId,
      'Nature Words',
      'word',
      '🌸',
      'pink',
      wordListItems
    );

    // Create verb/adjective list
    await createList(
      userId,
      'Common Verbs & Adjectives',
      'verbAdj',
      '⚡',
      'yellow',
      verbAdjListItems
    );

    // Create sentence list
    await createList(
      userId,
      'Daily Conversations',
      'sentence',
      '💬',
      'blue',
      sentenceListItems
    );

    console.log('\n✅ All lists created successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating lists:', error);
    process.exit(1);
  }
}

main();
