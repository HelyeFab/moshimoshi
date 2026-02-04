import type { CreateDeckRequest } from '@/types/flashcards'

const starterImage = (category: 'greetings' | 'numbers' | 'colors', index: number) =>
  `/flashcards/starter/${category}/${category}-${String(index).padStart(2, '0')}.jpg`

export const STARTER_DECKS: CreateDeckRequest[] = [
  {
    id: 'starter-v1-greetings',
    name: 'Japanese Greetings',
    description: 'Essential greetings for everyday Japanese conversations.',
    emoji: '👋',
    color: 'sunset',
    cardStyle: 'minimal',
    source: 'user',
    isStarter: true,
    initialCards: [
      {
        front: {
          text: 'こんにちは',
          subtext: 'Konnichiwa',
          media: { type: 'image', url: starterImage('greetings', 1), alt: 'Hello greeting' }
        },
        back: 'Hello'
      },
      {
        front: {
          text: 'おはよう',
          subtext: 'Ohayou',
          media: { type: 'image', url: starterImage('greetings', 2), alt: 'Good morning casual' }
        },
        back: 'Good morning (casual)'
      },
      {
        front: {
          text: 'おはようございます',
          subtext: 'Ohayou gozaimasu',
          media: { type: 'image', url: starterImage('greetings', 3), alt: 'Good morning polite' }
        },
        back: 'Good morning (polite)'
      },
      {
        front: {
          text: 'こんばんは',
          subtext: 'Konbanwa',
          media: { type: 'image', url: starterImage('greetings', 4), alt: 'Good evening' }
        },
        back: 'Good evening'
      },
      {
        front: {
          text: 'さようなら',
          subtext: 'Sayounara',
          media: { type: 'image', url: starterImage('greetings', 5), alt: 'Goodbye' }
        },
        back: 'Goodbye'
      },
      {
        front: {
          text: 'またね',
          subtext: 'Mata ne',
          media: { type: 'image', url: starterImage('greetings', 6), alt: 'See you soon' }
        },
        back: 'See you (casual)'
      },
      {
        front: {
          text: 'ありがとう',
          subtext: 'Arigatou',
          media: { type: 'image', url: starterImage('greetings', 7), alt: 'Thank you casual' }
        },
        back: 'Thank you (casual)'
      },
      {
        front: {
          text: 'ありがとうございます',
          subtext: 'Arigatou gozaimasu',
          media: { type: 'image', url: starterImage('greetings', 8), alt: 'Thank you polite' }
        },
        back: 'Thank you (polite)'
      },
      {
        front: {
          text: 'すみません',
          subtext: 'Sumimasen',
          media: { type: 'image', url: starterImage('greetings', 9), alt: 'Excuse me / sorry' }
        },
        back: 'Excuse me / Sorry'
      },
      {
        front: {
          text: 'はじめまして',
          subtext: 'Hajimemashite',
          media: { type: 'image', url: starterImage('greetings', 10), alt: 'Nice to meet you' }
        },
        back: 'Nice to meet you'
      },
    ],
  },
  {
    id: 'starter-v1-numbers',
    name: 'Numbers 1–10',
    description: 'Learn the basic numbers in Japanese.',
    emoji: '🔢',
    color: 'ocean',
    cardStyle: 'minimal',
    source: 'user',
    isStarter: true,
    initialCards: [
      {
        front: {
          text: '一',
          subtext: 'いち (ichi)',
          media: { type: 'image', url: starterImage('numbers', 1), alt: 'Number one' }
        },
        back: 'One'
      },
      {
        front: {
          text: '二',
          subtext: 'に (ni)',
          media: { type: 'image', url: starterImage('numbers', 2), alt: 'Number two' }
        },
        back: 'Two'
      },
      {
        front: {
          text: '三',
          subtext: 'さん (san)',
          media: { type: 'image', url: starterImage('numbers', 3), alt: 'Number three' }
        },
        back: 'Three'
      },
      {
        front: {
          text: '四',
          subtext: 'よん / し (yon / shi)',
          media: { type: 'image', url: starterImage('numbers', 4), alt: 'Number four' }
        },
        back: 'Four'
      },
      {
        front: {
          text: '五',
          subtext: 'ご (go)',
          media: { type: 'image', url: starterImage('numbers', 5), alt: 'Number five' }
        },
        back: 'Five'
      },
      {
        front: {
          text: '六',
          subtext: 'ろく (roku)',
          media: { type: 'image', url: starterImage('numbers', 6), alt: 'Number six' }
        },
        back: 'Six'
      },
      {
        front: {
          text: '七',
          subtext: 'なな / しち (nana / shichi)',
          media: { type: 'image', url: starterImage('numbers', 7), alt: 'Number seven' }
        },
        back: 'Seven'
      },
      {
        front: {
          text: '八',
          subtext: 'はち (hachi)',
          media: { type: 'image', url: starterImage('numbers', 8), alt: 'Number eight' }
        },
        back: 'Eight'
      },
      {
        front: {
          text: '九',
          subtext: 'きゅう (kyuu)',
          media: { type: 'image', url: starterImage('numbers', 9), alt: 'Number nine' }
        },
        back: 'Nine'
      },
      {
        front: {
          text: '十',
          subtext: 'じゅう (juu)',
          media: { type: 'image', url: starterImage('numbers', 10), alt: 'Number ten' }
        },
        back: 'Ten'
      },
    ],
  },
  {
    id: 'starter-v1-colors',
    name: 'Basic Colors',
    description: 'Common colors used in daily life.',
    emoji: '🎨',
    color: 'lavender',
    cardStyle: 'minimal',
    source: 'user',
    isStarter: true,
    initialCards: [
      {
        front: {
          text: '赤',
          subtext: 'あか (aka)',
          media: { type: 'image', url: starterImage('colors', 1), alt: 'Red color' }
        },
        back: 'Red'
      },
      {
        front: {
          text: '青',
          subtext: 'あお (ao)',
          media: { type: 'image', url: starterImage('colors', 2), alt: 'Blue color' }
        },
        back: 'Blue'
      },
      {
        front: {
          text: '緑',
          subtext: 'みどり (midori)',
          media: { type: 'image', url: starterImage('colors', 3), alt: 'Green color' }
        },
        back: 'Green'
      },
      {
        front: {
          text: '黄',
          subtext: 'き (ki)',
          media: { type: 'image', url: starterImage('colors', 4), alt: 'Yellow color' }
        },
        back: 'Yellow'
      },
      {
        front: {
          text: '黒',
          subtext: 'くろ (kuro)',
          media: { type: 'image', url: starterImage('colors', 5), alt: 'Black color' }
        },
        back: 'Black'
      },
      {
        front: {
          text: '白',
          subtext: 'しろ (shiro)',
          media: { type: 'image', url: starterImage('colors', 6), alt: 'White color' }
        },
        back: 'White'
      },
      {
        front: {
          text: '茶色',
          subtext: 'ちゃいろ (chairo)',
          media: { type: 'image', url: starterImage('colors', 7), alt: 'Brown color' }
        },
        back: 'Brown'
      },
      {
        front: {
          text: '紫',
          subtext: 'むらさき (murasaki)',
          media: { type: 'image', url: starterImage('colors', 8), alt: 'Purple color' }
        },
        back: 'Purple'
      },
      {
        front: {
          text: 'ピンク',
          subtext: 'pinku',
          media: { type: 'image', url: starterImage('colors', 9), alt: 'Pink color' }
        },
        back: 'Pink'
      },
      {
        front: {
          text: 'オレンジ',
          subtext: 'orenji',
          media: { type: 'image', url: starterImage('colors', 10), alt: 'Orange color' }
        },
        back: 'Orange'
      },
    ],
  },
]

export const STARTER_DECK_IDS = new Set(STARTER_DECKS.map(deck => deck.id).filter(Boolean) as string[])
