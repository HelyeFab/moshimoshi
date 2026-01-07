/**
 * Starter Lists for New Users
 * Creates default lists in IndexedDB for first-time users
 */

import { listManager } from './ListManager';
import type { ListType } from '@/types/userLists';

interface StarterListTemplate {
  name: string;
  type: ListType;
  emoji: string;
  color: string;
  items: {
    content: string;
    reading: string;
    meaning: string;
    jlptLevel?: number;
  }[];
}

const STARTER_LISTS: StarterListTemplate[] = [
  {
    name: 'Nature Words',
    type: 'word',
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
    type: 'verbAdj',
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
    type: 'sentence',
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
 * Check if user has ever created or imported any lists
 */
export async function hasExistingLists(userId: string): Promise<boolean> {
  try {
    const lists = await listManager.getLists(userId, false); // false = free user
    return lists.length > 0;
  } catch (error) {
    console.error('[StarterLists] Error checking existing lists:', error);
    return false;
  }
}

/**
 * Create starter lists for a new user in IndexedDB
 * This runs client-side for both free and premium users
 */
export async function createStarterListsIfNeeded(userId: string, isPremium: boolean = false): Promise<void> {
  console.log('[StarterLists] Checking if starter lists needed for user:', userId);

  // Check if user already has lists
  const hasLists = await hasExistingLists(userId);
  if (hasLists) {
    console.log('[StarterLists] User already has lists, skipping starter lists');
    return;
  }

  console.log('[StarterLists] Creating starter lists...');

  try {
    // Create each starter list
    for (const template of STARTER_LISTS) {
      // Create the list with first item using correct CreateListRequest format
      const list = await listManager.createList(
        {
          name: template.name,
          type: template.type,
          emoji: template.emoji,
          color: template.color,
          firstItem: {
            content: template.items[0].content,
            metadata: {
              reading: template.items[0].reading,
              meaning: template.items[0].meaning,
              jlptLevel: template.items[0].jlptLevel,
              addedAt: Date.now()
            }
          }
        },
        userId,
        isPremium
      );

      if (!list) {
        console.error('[StarterLists] Failed to create list:', template.name);
        continue;
      }

      console.log('[StarterLists] Created list:', template.name);

      // Add remaining items
      for (let i = 1; i < template.items.length; i++) {
        const item = template.items[i];
        await listManager.addItemToList(
          list.id,
          item.content,
          {
            reading: item.reading,
            meaning: item.meaning,
            jlptLevel: item.jlptLevel,
          },
          userId,
          isPremium
        );
      }

      console.log('[StarterLists] Added', template.items.length - 1, 'additional items to', template.name);
    }

    console.log('[StarterLists] ✅ Successfully created', STARTER_LISTS.length, 'starter lists');
  } catch (error) {
    console.error('[StarterLists] Error creating starter lists:', error);
    // Don't throw - user can create their own lists manually
  }
}
