// Types for Kana Drop Game

export interface KanaChar {
  id: string;
  kana: string;
  romaji: string;
  type: 'hiragana' | 'katakana';
}

export interface FallingObject {
  id: string;
  type: 'kana' | 'wrong-kana' | 'distractor';
  content: string; // kana character or image path
  kanaData?: KanaChar; // only for kana and wrong-kana types
  x: number; // horizontal position (0-100%)
  y: number; // vertical position (0-100%)
  speed: number; // falling speed multiplier
}

export interface GameState {
  score: number;
  selectedKana: KanaChar[];
  fallingObjects: FallingObject[];
  gameSpeed: number;
  isPlaying: boolean;
  isPaused: boolean;
  startTime: number;
  clicks: {
    correct: number;
    wrong: number;
    distractor: number;
  };
}

export interface GameStats {
  finalScore: number;
  timeTaken: number; // in seconds
  accuracy: number; // percentage
  totalClicks: number;
  correctClicks: number;
}

// Distractor images list
export const DISTRACTOR_IMAGES = [
  // Animals
  '/ui/flat-icons/animals/001-raccoon.svg',
  '/ui/flat-icons/animals/002-zebra.svg',
  '/ui/flat-icons/animals/003-bear.svg',
  '/ui/flat-icons/animals/004-cheetah.svg',
  '/ui/flat-icons/animals/005-fox.svg',
  '/ui/flat-icons/animals/006-leopard.svg',
  '/ui/flat-icons/animals/007-giraffe.svg',
  '/ui/flat-icons/animals/008-koala.svg',
  '/ui/flat-icons/animals/009-panda-bear.svg',
  '/ui/flat-icons/animals/010-tiger.svg',

  // Emoji style icons
  '/ui/flat-icons/emoji/001-happy.svg',
  '/ui/flat-icons/emoji/002-love.svg',
  '/ui/flat-icons/emoji/003-laugh.svg',
  '/ui/flat-icons/emoji/004-wow.svg',
  '/ui/flat-icons/emoji/005-angel.svg',

  // Numbers
  '/ui/flat-icons/numbers/001-one.svg',
  '/ui/flat-icons/numbers/002-two.svg',
  '/ui/flat-icons/numbers/003-three.svg',
  '/ui/flat-icons/numbers/004-four.svg',
  '/ui/flat-icons/numbers/005-five.svg',
  '/ui/flat-icons/numbers/006-six.svg',
  '/ui/flat-icons/numbers/007-seven.svg',
  '/ui/flat-icons/numbers/008-eight.svg',
  '/ui/flat-icons/numbers/009-nine.svg',
  '/ui/flat-icons/numbers/010-zero.svg',
];

// Game constants
export const GAME_CONSTANTS = {
  INITIAL_FALL_DURATION: 4000, // 4 seconds - slower for better gameplay
  MIN_FALL_DURATION: 1000, // 1 second minimum (4x speed)
  SPEED_INCREMENT_INTERVAL: 20, // Increase speed every 20 points
  SPEED_INCREMENT_RATE: 0.1, // 10% faster each time
  SPAWN_RATE_MIN: 500, // minimum time between spawns (0.5 seconds)
  SPAWN_RATE_MAX: 1000, // maximum time between spawns (1 second)
  KANA_SPAWN_CHANCE: 0.3, // 30% chance to spawn kana
  WINNING_SCORE: 100,
  POINTS_CORRECT: 5,
  POINTS_MISSED: -10,
  POINTS_DISTRACTOR: -5,
  POINTS_WRONG_KANA: -10,
  GAME_WIDTH: 100, // percentage based positioning
  GAME_HEIGHT: 100,
  OBJECT_SIZE: 48, // pixels
  COUNTDOWN_DURATION: 3, // seconds
  FALL_SPEED: 0.5 // pixels per frame for falling objects
};