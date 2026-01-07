/**
 * User Onboarding Functions
 * Automatically provisions starter content for new users
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Sample data for starter lists
const STARTER_LISTS = [
  {
    name: 'Nature Words',
    type: 'word' as const,
    emoji: '🌸',
    color: 'pink',
    items: [
      { content: '雨', reading: 'あめ', meaning: 'rain', jlptLevel: 5 },
      { content: '風', reading: 'かぜ', meaning: 'wind', jlptLevel: 5 },
      { content: '空', reading: 'そら', meaning: 'sky', jlptLevel: 5 },
      { content: '海', reading: 'うみ', meaning: 'sea', jlptLevel: 5 },
      { content: '山', reading: 'やま', meaning: 'mountain', jlptLevel: 5 },
      { content: '川', reading: 'かわ', meaning: 'river', jlptLevel: 5 },
      { content: '木', reading: 'き', meaning: 'tree', jlptLevel: 5 },
      { content: '花', reading: 'はな', meaning: 'flower', jlptLevel: 5 },
      { content: '星', reading: 'ほし', meaning: 'star', jlptLevel: 5 },
      { content: '月', reading: 'つき', meaning: 'moon', jlptLevel: 5 },
      { content: '太陽', reading: 'たいよう', meaning: 'sun', jlptLevel: 5 },
      { content: '水', reading: 'みず', meaning: 'water', jlptLevel: 5 },
    ]
  },
  {
    name: 'Common Verbs & Adjectives',
    type: 'verbAdj' as const,
    emoji: '⚡',
    color: 'yellow',
    items: [
      { content: '食べる', reading: 'たべる', meaning: 'to eat', jlptLevel: 5 },
      { content: '飲む', reading: 'のむ', meaning: 'to drink', jlptLevel: 5 },
      { content: '見る', reading: 'みる', meaning: 'to see', jlptLevel: 5 },
      { content: '聞く', reading: 'きく', meaning: 'to hear/listen', jlptLevel: 5 },
      { content: '話す', reading: 'はなす', meaning: 'to speak', jlptLevel: 5 },
      { content: '読む', reading: 'よむ', meaning: 'to read', jlptLevel: 5 },
      { content: '書く', reading: 'かく', meaning: 'to write', jlptLevel: 5 },
      { content: '行く', reading: 'いく', meaning: 'to go', jlptLevel: 5 },
      { content: '来る', reading: 'くる', meaning: 'to come', jlptLevel: 4 },
      { content: '大きい', reading: 'おおきい', meaning: 'big', jlptLevel: 5 },
      { content: '小さい', reading: 'ちいさい', meaning: 'small', jlptLevel: 5 },
      { content: '新しい', reading: 'あたらしい', meaning: 'new', jlptLevel: 5 },
    ]
  },
  {
    name: 'Daily Conversations',
    type: 'sentence' as const,
    emoji: '💬',
    color: 'blue',
    items: [
      { content: '今日はいい天気ですね。', reading: 'きょうはいいてんきですね', meaning: 'It\'s nice weather today, isn\'t it?', jlptLevel: 5 },
      { content: '私は学生です。', reading: 'わたしはがくせいです', meaning: 'I am a student.', jlptLevel: 5 },
      { content: '日本語を勉強しています。', reading: 'にほんごをべんきょうしています', meaning: 'I am studying Japanese.', jlptLevel: 5 },
      { content: '毎日図書館に行きます。', reading: 'まいにちとしょかんにいきます', meaning: 'I go to the library every day.', jlptLevel: 5 },
      { content: '昨日映画を見ました。', reading: 'きのうえいがをみました', meaning: 'I watched a movie yesterday.', jlptLevel: 5 },
      { content: 'これは私の本です。', reading: 'これはわたしのほんです', meaning: 'This is my book.', jlptLevel: 5 },
      { content: 'あなたの名前は何ですか。', reading: 'あなたのなまえはなんですか', meaning: 'What is your name?', jlptLevel: 5 },
      { content: '明日友達と会います。', reading: 'あしたともだちとあいます', meaning: 'I will meet my friend tomorrow.', jlptLevel: 5 },
      { content: 'ここは静かです。', reading: 'ここはしずかです', meaning: 'It is quiet here.', jlptLevel: 5 },
      { content: '日本料理が好きです。', reading: 'にほんりょうりがすきです', meaning: 'I like Japanese food.', jlptLevel: 5 },
      { content: '駅はどこですか。', reading: 'えきはどこですか', meaning: 'Where is the station?', jlptLevel: 5 },
      { content: '明日雨が降るでしょう。', reading: 'あしたあめがふるでしょう', meaning: 'It will probably rain tomorrow.', jlptLevel: 4 },
    ]
  }
];

/**
 * Create starter lists for a new user
 * Called automatically when a user document is created
 */
export async function createStarterLists(userId: string): Promise<void> {
  console.log(`[Onboarding] Creating starter lists for user: ${userId}`);

  const db = admin.firestore();
  const now = Timestamp.now();

  try {
    const batch = db.batch();

    for (const listTemplate of STARTER_LISTS) {
      const listId = db.collection('users').doc(userId).collection('lists').doc().id;

      // Transform items to include timestamps and IDs
      const items = listTemplate.items.map((item, index) => ({
        id: `item_${Date.now()}_${index}`,
        content: item.content,
        metadata: {
          reading: item.reading,
          meaning: item.meaning,
          jlptLevel: item.jlptLevel,
        },
        createdAt: now,
      }));

      const listData = {
        id: listId,
        userId,
        name: listTemplate.name,
        type: listTemplate.type,
        emoji: listTemplate.emoji,
        color: listTemplate.color,
        items,
        createdAt: now,
        updatedAt: now,
        settings: {
          reviewEnabled: true,
          sortOrder: 'dateAdded'
        }
      };

      const listRef = db.collection('users').doc(userId).collection('lists').doc(listId);
      batch.set(listRef, listData);

      console.log(`[Onboarding] Queued starter list: ${listTemplate.name} (${listTemplate.type})`);
    }

    await batch.commit();
    console.log(`[Onboarding] ✅ Successfully created ${STARTER_LISTS.length} starter lists for user: ${userId}`);
  } catch (error) {
    console.error('[Onboarding] ❌ Error creating starter lists:', error);
    // Don't throw - we don't want to fail user creation if list creation fails
    // The user can create their own lists manually
  }
}
