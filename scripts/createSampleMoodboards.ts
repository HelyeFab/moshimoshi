import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { MoodBoard } from '../src/types/moodboard';

// Initialize Firebase (you'll need to add your config)
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample moodboard data
const sampleMoodboards: Omit<MoodBoard, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: "Family Members",
    emoji: "👨‍👩‍👧‍👦",
    description: "Learn kanji for family relationships",
    jlpt: "N5",
    background: "#FFB6C1",
    isActive: true,
    kanji: [
      {
        char: "父",
        meaning: "father",
        readings: { on: ["フ"], kun: ["ちち"] },
        jlpt: "N5",
        strokeCount: 4,
        examples: [
          { sentence: "父は会社に行きます。", translation: "Father goes to the company." }
        ]
      },
      {
        char: "母",
        meaning: "mother",
        readings: { on: ["ボ"], kun: ["はは"] },
        jlpt: "N5",
        strokeCount: 5,
        examples: [
          { sentence: "母は料理が上手です。", translation: "Mother is good at cooking." }
        ]
      },
      {
        char: "兄",
        meaning: "older brother",
        readings: { on: ["ケイ", "キョウ"], kun: ["あに"] },
        jlpt: "N4",
        strokeCount: 5,
        examples: [
          { sentence: "兄は大学生です。", translation: "My older brother is a university student." }
        ]
      },
      {
        char: "姉",
        meaning: "older sister",
        readings: { on: ["シ"], kun: ["あね"] },
        jlpt: "N4",
        strokeCount: 8,
        examples: [
          { sentence: "姉は東京に住んでいます。", translation: "My older sister lives in Tokyo." }
        ]
      },
      {
        char: "弟",
        meaning: "younger brother",
        readings: { on: ["テイ", "ダイ"], kun: ["おとうと"] },
        jlpt: "N4",
        strokeCount: 7,
        examples: [
          { sentence: "弟はサッカーが好きです。", translation: "My younger brother likes soccer." }
        ]
      },
      {
        char: "妹",
        meaning: "younger sister",
        readings: { on: ["マイ"], kun: ["いもうと"] },
        jlpt: "N4",
        strokeCount: 8,
        examples: [
          { sentence: "妹は高校生です。", translation: "My younger sister is a high school student." }
        ]
      },
      {
        char: "子",
        meaning: "child",
        readings: { on: ["シ", "ス"], kun: ["こ"] },
        jlpt: "N5",
        strokeCount: 3,
        examples: [
          { sentence: "子供が公園で遊んでいます。", translation: "Children are playing in the park." }
        ]
      },
      {
        char: "親",
        meaning: "parent",
        readings: { on: ["シン"], kun: ["おや"] },
        jlpt: "N4",
        strokeCount: 16,
        examples: [
          { sentence: "親と一緒に住んでいます。", translation: "I live with my parents." }
        ]
      }
    ]
  },
  {
    title: "Colors",
    emoji: "🌈",
    description: "Learn kanji for different colors",
    jlpt: "N5",
    background: "#87CEEB",
    isActive: true,
    kanji: [
      {
        char: "赤",
        meaning: "red",
        readings: { on: ["セキ"], kun: ["あか"] },
        jlpt: "N5",
        strokeCount: 7,
        examples: [
          { sentence: "赤い花が咲いています。", translation: "Red flowers are blooming." }
        ]
      },
      {
        char: "青",
        meaning: "blue",
        readings: { on: ["セイ"], kun: ["あお"] },
        jlpt: "N5",
        strokeCount: 8,
        examples: [
          { sentence: "空が青いです。", translation: "The sky is blue." }
        ]
      },
      {
        char: "白",
        meaning: "white",
        readings: { on: ["ハク", "ビャク"], kun: ["しろ"] },
        jlpt: "N5",
        strokeCount: 5,
        examples: [
          { sentence: "白い雲が浮かんでいます。", translation: "White clouds are floating." }
        ]
      },
      {
        char: "黒",
        meaning: "black",
        readings: { on: ["コク"], kun: ["くろ"] },
        jlpt: "N4",
        strokeCount: 11,
        examples: [
          { sentence: "黒い猫を飼っています。", translation: "I have a black cat." }
        ]
      },
      {
        char: "黄",
        meaning: "yellow",
        readings: { on: ["オウ", "コウ"], kun: ["き"] },
        jlpt: "N4",
        strokeCount: 11,
        examples: [
          { sentence: "黄色い花が好きです。", translation: "I like yellow flowers." }
        ]
      },
      {
        char: "緑",
        meaning: "green",
        readings: { on: ["リョク", "ロク"], kun: ["みどり"] },
        jlpt: "N3",
        strokeCount: 14,
        examples: [
          { sentence: "緑の葉が美しいです。", translation: "The green leaves are beautiful." }
        ]
      }
    ]
  },
  {
    title: "Nature",
    emoji: "🌳",
    description: "Learn kanji related to nature",
    jlpt: "N5",
    background: "#98D98E",
    isActive: true,
    kanji: [
      {
        char: "山",
        meaning: "mountain",
        readings: { on: ["サン"], kun: ["やま"] },
        jlpt: "N5",
        strokeCount: 3,
        examples: [
          { sentence: "富士山は日本一高い山です。", translation: "Mt. Fuji is Japan's highest mountain." }
        ]
      },
      {
        char: "川",
        meaning: "river",
        readings: { on: ["セン"], kun: ["かわ"] },
        jlpt: "N5",
        strokeCount: 3,
        examples: [
          { sentence: "川で魚を釣りました。", translation: "I caught fish in the river." }
        ]
      },
      {
        char: "木",
        meaning: "tree",
        readings: { on: ["ボク", "モク"], kun: ["き"] },
        jlpt: "N5",
        strokeCount: 4,
        examples: [
          { sentence: "大きな木の下で休みました。", translation: "I rested under a big tree." }
        ]
      },
      {
        char: "森",
        meaning: "forest",
        readings: { on: ["シン"], kun: ["もり"] },
        jlpt: "N4",
        strokeCount: 12,
        examples: [
          { sentence: "森の中を散歩しました。", translation: "I took a walk in the forest." }
        ]
      },
      {
        char: "海",
        meaning: "ocean/sea",
        readings: { on: ["カイ"], kun: ["うみ"] },
        jlpt: "N4",
        strokeCount: 9,
        examples: [
          { sentence: "夏は海に行きます。", translation: "I go to the sea in summer." }
        ]
      },
      {
        char: "空",
        meaning: "sky",
        readings: { on: ["クウ"], kun: ["そら"] },
        jlpt: "N4",
        strokeCount: 8,
        examples: [
          { sentence: "空に星が見えます。", translation: "I can see stars in the sky." }
        ]
      },
      {
        char: "花",
        meaning: "flower",
        readings: { on: ["カ"], kun: ["はな"] },
        jlpt: "N5",
        strokeCount: 7,
        examples: [
          { sentence: "春に花が咲きます。", translation: "Flowers bloom in spring." }
        ]
      },
      {
        char: "雨",
        meaning: "rain",
        readings: { on: ["ウ"], kun: ["あめ"] },
        jlpt: "N5",
        strokeCount: 8,
        examples: [
          { sentence: "雨が降っています。", translation: "It's raining." }
        ]
      },
      {
        char: "雪",
        meaning: "snow",
        readings: { on: ["セツ"], kun: ["ゆき"] },
        jlpt: "N3",
        strokeCount: 11,
        examples: [
          { sentence: "冬に雪が降ります。", translation: "It snows in winter." }
        ]
      },
      {
        char: "風",
        meaning: "wind",
        readings: { on: ["フウ", "フ"], kun: ["かぜ"] },
        jlpt: "N4",
        strokeCount: 9,
        examples: [
          { sentence: "強い風が吹いています。", translation: "A strong wind is blowing." }
        ]
      }
    ]
  }
];

async function createSampleMoodboards() {
  try {
    console.log('Creating sample moodboards...');

    for (const moodboard of sampleMoodboards) {
      const docRef = await addDoc(collection(db, 'moodboards'), {
        ...moodboard,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log(`Created moodboard: ${moodboard.title} (ID: ${docRef.id})`);
    }

    console.log('✅ Successfully created all sample moodboards!');
  } catch (error) {
    console.error('Error creating sample moodboards:', error);
  }
}

// Run the script
createSampleMoodboards();