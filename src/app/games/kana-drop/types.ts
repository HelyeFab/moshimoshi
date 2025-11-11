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
  activeRomaji: string | null;
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

// Distractor images list - using proven working paths from doshi-sensei
export const DISTRACTOR_IMAGES = [
  // Pokemon-themed PNG files
  '/ui/flat-icons/188915-pokemon-go/png/star.png',
  '/ui/flat-icons/188915-pokemon-go/png/map.png',
  '/ui/flat-icons/188915-pokemon-go/png/smartphone.png',
  '/ui/flat-icons/188915-pokemon-go/png/pokedex.png',
  '/ui/flat-icons/188915-pokemon-go/png/pokeball.png',

  // Farm Animals
  '/ui/flat-icons/4193242-animals/svg/002-buffalo.svg',
  '/ui/flat-icons/4193242-animals/svg/003-flamingo.svg',
  '/ui/flat-icons/4193242-animals/svg/004-sheep.svg',
  '/ui/flat-icons/4193242-animals/svg/005-horse.svg',
  '/ui/flat-icons/4193242-animals/svg/006-cow.svg',
  '/ui/flat-icons/4193242-animals/svg/007-pig.svg',
  '/ui/flat-icons/4193242-animals/svg/008-hedgehog.svg',
  '/ui/flat-icons/4193242-animals/svg/010-rabbit.svg',
  '/ui/flat-icons/4193242-animals/svg/015-alpaca.svg',
  '/ui/flat-icons/4193242-animals/svg/019-llama.svg',
  '/ui/flat-icons/4193242-animals/svg/020-goat.svg',
  '/ui/flat-icons/4193242-animals/svg/026-squirrel.svg',

  // Wild Animals
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/001-raccoon.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/002-zebra.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/003-bear.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/004-cheetah.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/005-fox.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/006-leopard.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/007-giraffe.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/008-koala.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/009-panda-bear.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/010-tiger.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/012-sloth.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/013-hippopotamus.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/014-rhinoceros.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/015-monkey.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/016-deer.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/019-lion.svg',
  '/ui/flat-icons/8376275-wild-animals-flat-1-of-1/svg/020-elephant.svg',

  // Emotions
  '/ui/flat-icons/17517790-summer-watermelon/svg/001-happy.svg',
  '/ui/flat-icons/17517790-summer-watermelon/svg/002-love.svg',
  '/ui/flat-icons/17517790-summer-watermelon/svg/011-laugh-emoji.svg',
  '/ui/flat-icons/17517790-summer-watermelon/svg/013-wow.svg',
  '/ui/flat-icons/17517790-summer-watermelon/svg/014-angel.svg',
  '/ui/flat-icons/17517790-summer-watermelon/svg/018-valentin-day.svg',
  '/ui/flat-icons/17517790-summer-watermelon/svg/020-ok.svg',
];

// Game constants
export const GAME_CONSTANTS = {
  INITIAL_FALL_DURATION: 4000, // 4 seconds - slower for better gameplay
  MIN_FALL_DURATION: 1000, // 1 second minimum (4x speed)
  SPEED_INCREMENT_INTERVAL: 20, // Increase speed every 20 points as per design
  SPEED_INCREMENT_RATE: 0.1, // 10% faster each time as per design
  SPAWN_RATE_MIN: 500, // minimum time between spawns (0.5 seconds) as per design
  SPAWN_RATE_MAX: 1000, // maximum time between spawns (1 second) as per design
  KANA_SPAWN_CHANCE: 0.3, // 30% chance to spawn kana as per design (30% target, 70% distractors)
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