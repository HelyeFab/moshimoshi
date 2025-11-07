/**
 * Script to create 4 custom word lists for user
 * Lists: Verbs, Adjectives, Mixed (Verbs + Adjectives), Kanji-only
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { UserList, ListItem } from '../src/types/userLists';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('/home/beano/DevProjects/next_js/moshimoshi/moshimoshi-service-account.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

const USER_ID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

// Helper function to create list item
function createListItem(
  content: string,
  type: 'verbAdj' | 'word',
  metadata?: {
    reading?: string;
    meaning?: string;
    notes?: string;
  }
): ListItem {
  const now = Date.now();
  return {
    id: uuidv4(),
    content,
    type,
    metadata: {
      ...metadata,
      addedAt: now
    }
  };
}

// 1. Verb List (10 common Japanese verbs)
const verbList: UserList = {
  id: uuidv4(),
  userId: USER_ID,
  name: 'Common Verbs Practice',
  type: 'verbAdj',
  emoji: '🏃',
  color: 'ocean',
  items: [
    createListItem('食べる', 'verbAdj', { reading: 'たべる', meaning: 'to eat' }),
    createListItem('飲む', 'verbAdj', { reading: 'のむ', meaning: 'to drink' }),
    createListItem('見る', 'verbAdj', { reading: 'みる', meaning: 'to see, to watch' }),
    createListItem('聞く', 'verbAdj', { reading: 'きく', meaning: 'to hear, to listen' }),
    createListItem('話す', 'verbAdj', { reading: 'はなす', meaning: 'to speak, to talk' }),
    createListItem('書く', 'verbAdj', { reading: 'かく', meaning: 'to write' }),
    createListItem('読む', 'verbAdj', { reading: 'よむ', meaning: 'to read' }),
    createListItem('行く', 'verbAdj', { reading: 'いく', meaning: 'to go' }),
    createListItem('来る', 'verbAdj', { reading: 'くる', meaning: 'to come' }),
    createListItem('する', 'verbAdj', { reading: 'する', meaning: 'to do' })
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  settings: {
    reviewEnabled: true,
    sortOrder: 'dateAdded'
  }
};

// 2. Adjective List (10 common Japanese adjectives)
const adjectiveList: UserList = {
  id: uuidv4(),
  userId: USER_ID,
  name: 'Essential Adjectives',
  type: 'verbAdj',
  emoji: '🎨',
  color: 'matcha',
  items: [
    createListItem('大きい', 'verbAdj', { reading: 'おおきい', meaning: 'big, large' }),
    createListItem('小さい', 'verbAdj', { reading: 'ちいさい', meaning: 'small, little' }),
    createListItem('新しい', 'verbAdj', { reading: 'あたらしい', meaning: 'new' }),
    createListItem('古い', 'verbAdj', { reading: 'ふるい', meaning: 'old (things)' }),
    createListItem('良い', 'verbAdj', { reading: 'よい', meaning: 'good' }),
    createListItem('悪い', 'verbAdj', { reading: 'わるい', meaning: 'bad' }),
    createListItem('高い', 'verbAdj', { reading: 'たかい', meaning: 'tall, expensive' }),
    createListItem('安い', 'verbAdj', { reading: 'やすい', meaning: 'cheap, inexpensive' }),
    createListItem('楽しい', 'verbAdj', { reading: 'たのしい', meaning: 'fun, enjoyable' }),
    createListItem('難しい', 'verbAdj', { reading: 'むずかしい', meaning: 'difficult' })
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  settings: {
    reviewEnabled: true,
    sortOrder: 'dateAdded'
  }
};

// 3. Mixed List (5 verbs + 5 adjectives)
const mixedList: UserList = {
  id: uuidv4(),
  userId: USER_ID,
  name: 'Mixed Practice (Verbs & Adjectives)',
  type: 'verbAdj',
  emoji: '🔀',
  color: 'sunset',
  items: [
    createListItem('買う', 'verbAdj', { reading: 'かう', meaning: 'to buy' }),
    createListItem('美しい', 'verbAdj', { reading: 'うつくしい', meaning: 'beautiful' }),
    createListItem('作る', 'verbAdj', { reading: 'つくる', meaning: 'to make' }),
    createListItem('面白い', 'verbAdj', { reading: 'おもしろい', meaning: 'interesting' }),
    createListItem('使う', 'verbAdj', { reading: 'つかう', meaning: 'to use' }),
    createListItem('寒い', 'verbAdj', { reading: 'さむい', meaning: 'cold (weather)' }),
    createListItem('教える', 'verbAdj', { reading: 'おしえる', meaning: 'to teach' }),
    createListItem('暑い', 'verbAdj', { reading: 'あつい', meaning: 'hot (weather)' }),
    createListItem('忘れる', 'verbAdj', { reading: 'わすれる', meaning: 'to forget' }),
    createListItem('若い', 'verbAdj', { reading: 'わかい', meaning: 'young' })
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  settings: {
    reviewEnabled: true,
    sortOrder: 'dateAdded'
  }
};

// 4. Kanji-only List (10 common kanji words)
const kanjiList: UserList = {
  id: uuidv4(),
  userId: USER_ID,
  name: 'Kanji Practice Words',
  type: 'word',
  emoji: '🈯',
  color: 'lavender',
  items: [
    createListItem('学校', 'word', { reading: 'がっこう', meaning: 'school' }),
    createListItem('先生', 'word', { reading: 'せんせい', meaning: 'teacher' }),
    createListItem('学生', 'word', { reading: 'がくせい', meaning: 'student' }),
    createListItem('図書館', 'word', { reading: 'としょかん', meaning: 'library' }),
    createListItem('電車', 'word', { reading: 'でんしゃ', meaning: 'train' }),
    createListItem('病院', 'word', { reading: 'びょういん', meaning: 'hospital' }),
    createListItem('銀行', 'word', { reading: 'ぎんこう', meaning: 'bank' }),
    createListItem('会社', 'word', { reading: 'かいしゃ', meaning: 'company' }),
    createListItem('家族', 'word', { reading: 'かぞく', meaning: 'family' }),
    createListItem('友達', 'word', { reading: 'ともだち', meaning: 'friend' })
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  settings: {
    reviewEnabled: true,
    sortOrder: 'dateAdded'
  }
};

// Save all lists to Firebase
async function saveLists() {
  try {
    console.log('🚀 Creating 4 custom lists for user:', USER_ID);
    console.log('');

    const lists = [verbList, adjectiveList, mixedList, kanjiList];
    const batch = db.batch();

    for (const list of lists) {
      const listRef = db.collection('users').doc(USER_ID).collection('lists').doc(list.id);
      batch.set(listRef, list);
      console.log(`✅ ${list.emoji} ${list.name} (${list.items.length} items)`);
    }

    await batch.commit();

    console.log('');
    console.log('✨ Successfully created all 4 lists!');
    console.log('');
    console.log('Lists created:');
    console.log('1. 🏃 Common Verbs Practice - 10 verbs');
    console.log('2. 🎨 Essential Adjectives - 10 adjectives');
    console.log('3. 🔀 Mixed Practice - 5 verbs + 5 adjectives');
    console.log('4. 🈯 Kanji Practice Words - 10 kanji words');
    console.log('');
    console.log('View your lists at: http://localhost:3000/lists');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating lists:', error);
    process.exit(1);
  }
}

// Run the script
saveLists();
