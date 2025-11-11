/**
 * Kanji Families Configuration
 * Groups kanji by shared components/radicals for enhanced learning
 */

export type KanjiFamilyCategory = 'elements' | 'nature' | 'human' | 'tools' | 'abstract' | 'movement' | 'society';

export interface KanjiFamily {
  id: string;
  label: string;
  labelJa: string;
  category: KanjiFamilyCategory;
  components: string[];
  color: string; // For visual distinction
  icon: string; // Emoji or character representing the family
  note: string;
  noteJa: string;
  relatedFamilies?: string[]; // IDs of related families
  learningTips?: string;
  commonPatterns?: {
    readings?: string[];
    meanings?: string[];
  };
}

export const KANJI_FAMILIES: Record<string, KanjiFamily> = {
  // === ELEMENTS ===
  water: {
    id: 'water',
    label: 'Water Family',
    labelJa: '水の仲間',
    category: 'elements',
    components: ['氵', '水', '氷', '汁'],
    color: '#0EA5E9', // sky-500
    icon: '💧',
    note: 'Characters related to water, liquids, seas, rivers, washing, and flow',
    noteJa: '水、液体、海、川、洗浄、流れに関する漢字',
    relatedFamilies: ['ice', 'rain'],
    learningTips: 'The three-dot water radical (氵) appears on the left side and indicates liquid-related meanings',
    commonPatterns: {
      readings: ['すい', 'みず'],
      meanings: ['water', 'liquid', 'flow', 'wash']
    }
  },
  
  ice: {
    id: 'ice',
    label: 'Ice & Cold',
    labelJa: '氷・冷たさ',
    category: 'elements',
    components: ['冫', '冖'],
    color: '#E0F2FE', // sky-100
    icon: '🧊',
    note: 'Characters signaling cold, frozen, or winter concepts',
    noteJa: '寒さ、凍結、冬の概念を表す漢字',
    relatedFamilies: ['water', 'weather'],
    learningTips: 'The ice radical (冫) looks like two icicles hanging down'
  },

  fire: {
    id: 'fire',
    label: 'Fire & Heat',
    labelJa: '火・熱',
    category: 'elements',
    components: ['火', '灬', '炎'],
    color: '#F97316', // orange-500
    icon: '🔥',
    note: 'Characters related to fire, heat, cooking, burning, and energy',
    noteJa: '火、熱、調理、燃焼、エネルギーに関する漢字',
    relatedFamilies: ['cooking', 'light'],
    learningTips: 'The four-dot fire radical (灬) at the bottom represents flames',
    commonPatterns: {
      readings: ['か', 'ひ'],
      meanings: ['fire', 'heat', 'burn', 'cook']
    }
  },

  earth: {
    id: 'earth',
    label: 'Earth & Soil',
    labelJa: '土・大地',
    category: 'elements',
    components: ['土', '⼟'],
    color: '#92400E', // brown-800
    icon: '🌍',
    note: 'Characters about ground, land, territory, and earth',
    noteJa: '地面、土地、領土、地球に関する漢字',
    relatedFamilies: ['mountain', 'stone', 'field']
  },

  metal: {
    id: 'metal',
    label: 'Metal & Gold',
    labelJa: '金属',
    category: 'elements',
    components: ['金', '釒', '钅'],
    color: '#FCD34D', // yellow-300
    icon: '⚙️',
    note: 'Characters for metals, money, and metallic objects',
    noteJa: '金属、お金、金属製品に関する漢字',
    relatedFamilies: ['money', 'tools', 'weapons'],
    commonPatterns: {
      readings: ['きん', 'かね'],
      meanings: ['metal', 'gold', 'money']
    }
  },

  // === NATURE ===
  tree: {
    id: 'tree',
    label: 'Tree & Wood',
    labelJa: '木・森',
    category: 'nature',
    components: ['木', '⽊'],
    color: '#16A34A', // green-600
    icon: '🌳',
    note: 'Characters about trees, wood, forests, and wooden items',
    noteJa: '木、森林、木製品に関する漢字',
    relatedFamilies: ['plant', 'bamboo'],
    learningTips: 'The tree radical (木) looks like a tree with branches',
    commonPatterns: {
      readings: ['き', 'もく'],
      meanings: ['tree', 'wood', 'forest']
    }
  },

  plant: {
    id: 'plant',
    label: 'Plants & Grass',
    labelJa: '草・植物',
    category: 'nature',
    components: ['艹', '⺾', '艸'],
    color: '#65A30D', // lime-600
    icon: '🌿',
    note: 'Characters for plants, grass, flowers, and vegetation',
    noteJa: '植物、草、花、植生に関する漢字',
    relatedFamilies: ['tree', 'flower', 'rice']
  },

  mountain: {
    id: 'mountain',
    label: 'Mountain & Hills',
    labelJa: '山・丘',
    category: 'nature',
    components: ['山', '⼭'],
    color: '#6B7280', // gray-500
    icon: '⛰️',
    note: 'Characters about mountains, peaks, hills, and highlands',
    noteJa: '山、峰、丘、高地に関する漢字',
    relatedFamilies: ['stone', 'earth', 'valley']
  },

  sun: {
    id: 'sun',
    label: 'Sun & Day',
    labelJa: '日・太陽',
    category: 'nature',
    components: ['日', '⽇'],
    color: '#FBBF24', // yellow-400
    icon: '☀️',
    note: 'Characters for sun, day, time, and brightness',
    noteJa: '太陽、日、時間、明るさに関する漢字',
    relatedFamilies: ['moon', 'light', 'time'],
    commonPatterns: {
      readings: ['にち', 'ひ', 'じつ'],
      meanings: ['sun', 'day', 'time']
    }
  },

  moon: {
    id: 'moon',
    label: 'Moon & Month',
    labelJa: '月・月光',
    category: 'nature',
    components: ['月', '⽉'],
    color: '#C084FC', // purple-400
    icon: '🌙',
    note: 'Characters for moon, month, night, and body parts',
    noteJa: '月、月光、夜、体の部分に関する漢字',
    relatedFamilies: ['sun', 'night', 'body'],
    learningTips: 'When 月 means body part, it comes from 肉 (meat/flesh)'
  },

  rain: {
    id: 'rain',
    label: 'Rain & Weather',
    labelJa: '雨・天気',
    category: 'nature',
    components: ['雨', '⾬'],
    color: '#60A5FA', // blue-400
    icon: '🌧️',
    note: 'Characters for rain, snow, clouds, and weather phenomena',
    noteJa: '雨、雪、雲、天気現象に関する漢字',
    relatedFamilies: ['water', 'cloud', 'wind']
  },

  stone: {
    id: 'stone',
    label: 'Stone & Rock',
    labelJa: '石・岩',
    category: 'nature',
    components: ['石', '⽯'],
    color: '#9CA3AF', // gray-400
    icon: '🪨',
    note: 'Characters for stones, rocks, minerals, and hardness',
    noteJa: '石、岩、鉱物、硬さに関する漢字',
    relatedFamilies: ['mountain', 'earth', 'metal']
  },

  // === HUMAN ===
  person: {
    id: 'person',
    label: 'Person & People',
    labelJa: '人・人々',
    category: 'human',
    components: ['人', '亻', '⺅'],
    color: '#3B82F6', // blue-500
    icon: '👤',
    note: 'Characters about people, human actions, and relationships',
    noteJa: '人、人間の行動、関係に関する漢字',
    relatedFamilies: ['woman', 'child', 'elder'],
    learningTips: 'The person radical (亻) on the left represents a standing person',
    commonPatterns: {
      readings: ['じん', 'にん', 'ひと'],
      meanings: ['person', 'human', 'people']
    }
  },

  woman: {
    id: 'woman',
    label: 'Woman & Female',
    labelJa: '女性',
    category: 'human',
    components: ['女', '⼥'],
    color: '#EC4899', // pink-500
    icon: '👩',
    note: 'Characters related to women, femininity, and female family members',
    noteJa: '女性、女性らしさ、女性の家族に関する漢字',
    relatedFamilies: ['person', 'child', 'family']
  },

  child: {
    id: 'child',
    label: 'Child & Small',
    labelJa: '子供・小',
    category: 'human',
    components: ['子', '⼦', '小', '⺌'],
    color: '#A78BFA', // violet-400
    icon: '👶',
    note: 'Characters about children, youth, small things',
    noteJa: '子供、若さ、小さいものに関する漢字',
    relatedFamilies: ['person', 'family', 'education']
  },

  hand: {
    id: 'hand',
    label: 'Hand & Actions',
    labelJa: '手・動作',
    category: 'human',
    components: ['手', '扌', '⺘'],
    color: '#F59E0B', // amber-500
    icon: '✋',
    note: 'Characters for hand actions, manipulation, and skills',
    noteJa: '手の動作、操作、技能に関する漢字',
    relatedFamilies: ['work', 'craft', 'power'],
    learningTips: 'The hand radical (扌) shows three fingers',
    commonPatterns: {
      readings: ['しゅ', 'て'],
      meanings: ['hand', 'hold', 'make', 'throw']
    }
  },

  mouth: {
    id: 'mouth',
    label: 'Mouth & Speech',
    labelJa: '口・言葉',
    category: 'human',
    components: ['口', '⼝'],
    color: '#EF4444', // red-500
    icon: '👄',
    note: 'Characters for mouth, speaking, eating, and openings',
    noteJa: '口、話す、食べる、開口部に関する漢字',
    relatedFamilies: ['speech', 'food', 'voice']
  },

  heart: {
    id: 'heart',
    label: 'Heart & Emotions',
    labelJa: '心・感情',
    category: 'human',
    components: ['心', '忄', '⺗'],
    color: '#BE185D', // pink-700
    icon: '❤️',
    note: 'Characters about emotions, feelings, and mental states',
    noteJa: '感情、気持ち、精神状態に関する漢字',
    relatedFamilies: ['spirit', 'think', 'fear'],
    learningTips: 'The heart radical (忄) on the left represents emotional/mental aspects',
    commonPatterns: {
      readings: ['しん', 'こころ'],
      meanings: ['heart', 'mind', 'feeling', 'emotion']
    }
  },

  eye: {
    id: 'eye',
    label: 'Eye & Vision',
    labelJa: '目・視覚',
    category: 'human',
    components: ['目', '⽬', '見'],
    color: '#06B6D4', // cyan-500
    icon: '👁️',
    note: 'Characters about eyes, seeing, vision, and observation',
    noteJa: '目、見る、視覚、観察に関する漢字',
    relatedFamilies: ['face', 'look', 'color']
  },

  ear: {
    id: 'ear',
    label: 'Ear & Hearing',
    labelJa: '耳・聴覚',
    category: 'human',
    components: ['耳', '⽿'],
    color: '#8B5CF6', // violet-500
    icon: '👂',
    note: 'Characters about ears, hearing, and listening',
    noteJa: '耳、聞く、聴くに関する漢字',
    relatedFamilies: ['sound', 'voice', 'music']
  },

  foot: {
    id: 'foot',
    label: 'Foot & Walking',
    labelJa: '足・歩行',
    category: 'human',
    components: ['足', '⾜', '止', '⽌'],
    color: '#059669', // emerald-600
    icon: '👣',
    note: 'Characters about feet, legs, walking, and stopping',
    noteJa: '足、脚、歩く、止まるに関する漢字',
    relatedFamilies: ['movement', 'road', 'run']
  },

  body: {
    id: 'body',
    label: 'Body & Flesh',
    labelJa: '体・肉体',
    category: 'human',
    components: ['肉', '⺼', '身'],
    color: '#DC2626', // red-600
    icon: '🫀',
    note: 'Characters for body parts, flesh, and physical aspects',
    noteJa: '体の部分、肉、身体的側面に関する漢字',
    relatedFamilies: ['moon', 'bone', 'blood'],
    learningTips: 'Many body parts use 月 which comes from 肉 (flesh)'
  },

  // === TOOLS & OBJECTS ===
  blade: {
    id: 'blade',
    label: 'Blade & Cutting',
    labelJa: '刃・切断',
    category: 'tools',
    components: ['刀', '刂', '⺉'],
    color: '#64748B', // slate-500
    icon: '🔪',
    note: 'Characters about blades, cutting, dividing, and sharpness',
    noteJa: '刃、切る、分ける、鋭さに関する漢字',
    relatedFamilies: ['metal', 'weapon', 'divide']
  },

  thread: {
    id: 'thread',
    label: 'Thread & Fabric',
    labelJa: '糸・布',
    category: 'tools',
    components: ['糸', '⺯'],
    color: '#F472B6', // pink-400
    icon: '🧵',
    note: 'Characters for thread, silk, fabric, and connections',
    noteJa: '糸、絹、布、つながりに関する漢字',
    relatedFamilies: ['clothes', 'tie', 'weave']
  },

  container: {
    id: 'container',
    label: 'Container & Vessel',
    labelJa: '容器・器',
    category: 'tools',
    components: ['皿', '⽫', '缶'],
    color: '#FB923C', // orange-400
    icon: '🏺',
    note: 'Characters for containers, dishes, vessels, and storage',
    noteJa: '容器、皿、器、貯蔵に関する漢字',
    relatedFamilies: ['food', 'drink', 'pottery']
  },

  clothes: {
    id: 'clothes',
    label: 'Clothes & Garment',
    labelJa: '衣服',
    category: 'tools',
    components: ['衣', '衤', '⻂'],
    color: '#C026D3', // fuchsia-600
    icon: '👔',
    note: 'Characters about clothing, garments, and fabric',
    noteJa: '衣服、服装、布地に関する漢字',
    relatedFamilies: ['thread', 'cover', 'wear']
  },

  rice: {
    id: 'rice',
    label: 'Rice & Grain',
    labelJa: '米・穀物',
    category: 'tools',
    components: ['米', '⽶', '禾'],
    color: '#EAB308', // yellow-600
    icon: '🌾',
    note: 'Characters for rice, grain, harvest, and food staples',
    noteJa: '米、穀物、収穫、主食に関する漢字',
    relatedFamilies: ['field', 'food', 'plant']
  },

  money: {
    id: 'money',
    label: 'Money & Shell',
    labelJa: '貝・お金',
    category: 'tools',
    components: ['貝', '⾙'],
    color: '#84CC16', // lime-500
    icon: '💰',
    note: 'Characters for money, value, trade (shells were ancient currency)',
    noteJa: 'お金、価値、貿易に関する漢字（貝は古代の通貨）',
    relatedFamilies: ['metal', 'buy', 'sell']
  },

  door: {
    id: 'door',
    label: 'Door & Gate',
    labelJa: '戸・門',
    category: 'tools',
    components: ['戸', '⼾', '門', '⾨'],
    color: '#7C3AED', // violet-600
    icon: '🚪',
    note: 'Characters for doors, gates, entrances, and openings',
    noteJa: '戸、門、入口、開口部に関する漢字',
    relatedFamilies: ['house', 'open', 'close']
  },

  // === MOVEMENT & LOCATION ===
  movement: {
    id: 'movement',
    label: 'Movement & Road',
    labelJa: '動き・道',
    category: 'movement',
    components: ['辶', '⻌', '辵'],
    color: '#0891B2', // cyan-600
    icon: '🚶',
    note: 'Characters for movement, paths, and progression',
    noteJa: '動き、道、進行に関する漢字',
    relatedFamilies: ['road', 'walk', 'advance'],
    learningTips: 'The movement radical (辶) represents walking or a road',
    commonPatterns: {
      meanings: ['go', 'advance', 'follow', 'reach']
    }
  },

  vehicle: {
    id: 'vehicle',
    label: 'Vehicle & Transport',
    labelJa: '車・交通',
    category: 'movement',
    components: ['車', '⾞'],
    color: '#EA580C', // orange-600
    icon: '🚗',
    note: 'Characters for vehicles, wheels, and transportation',
    noteJa: '車、車輪、交通に関する漢字',
    relatedFamilies: ['movement', 'metal', 'road']
  },

  boat: {
    id: 'boat',
    label: 'Boat & Ship',
    labelJa: '舟・船',
    category: 'movement',
    components: ['舟', '⾈'],
    color: '#0EA5E9', // sky-500
    icon: '⛵',
    note: 'Characters for boats, ships, and water transportation',
    noteJa: '舟、船、水上交通に関する漢字',
    relatedFamilies: ['water', 'transport', 'sea']
  },

  wings: {
    id: 'wings',
    label: 'Wings & Flight',
    labelJa: '羽・飛行',
    category: 'movement',
    components: ['羽', '⽻', '飛'],
    color: '#14B8A6', // teal-500
    icon: '🦅',
    note: 'Characters for wings, feathers, flying, and birds',
    noteJa: '羽、羽根、飛ぶ、鳥に関する漢字',
    relatedFamilies: ['bird', 'fly', 'air']
  },

  place: {
    id: 'place',
    label: 'Place & Location',
    labelJa: '場所・位置',
    category: 'movement',
    components: ['阝', '⻖', '⻏'],
    color: '#10B981', // emerald-500
    icon: '📍',
    note: 'Characters for places, locations, cities, and geography',
    noteJa: '場所、位置、都市、地理に関する漢字',
    relatedFamilies: ['earth', 'city', 'country'],
    learningTips: 'Left 阝(⻖) = hill/mound, Right 阝(⻏) = city/town'
  },

  // === ABSTRACT CONCEPTS ===
  speech: {
    id: 'speech',
    label: 'Speech & Language',
    labelJa: '言葉・言語',
    category: 'abstract',
    components: ['言', '⾔', '訁'],
    color: '#8B5CF6', // violet-500
    icon: '💬',
    note: 'Characters for speaking, language, words, and communication',
    noteJa: '話す、言語、言葉、コミュニケーションに関する漢字',
    relatedFamilies: ['mouth', 'write', 'teach'],
    commonPatterns: {
      readings: ['げん', 'ごん', 'い'],
      meanings: ['say', 'speak', 'word', 'language']
    }
  },

  power: {
    id: 'power',
    label: 'Power & Strength',
    labelJa: '力・強さ',
    category: 'abstract',
    components: ['力', '⼒'],
    color: '#DC2626', // red-600
    icon: '💪',
    note: 'Characters about strength, power, effort, and force',
    noteJa: '強さ、力、努力、力に関する漢字',
    relatedFamilies: ['work', 'male', 'muscle']
  },

  spirit: {
    id: 'spirit',
    label: 'Spirit & Soul',
    labelJa: '霊・魂',
    category: 'abstract',
    components: ['示', '礻', '⺬'],
    color: '#7C2D12', // orange-900
    icon: '🎭',
    note: 'Characters for spirits, gods, rituals, and religious concepts',
    noteJa: '霊、神、儀式、宗教的概念に関する漢字',
    relatedFamilies: ['heaven', 'prayer', 'fortune']
  },

  king: {
    id: 'king',
    label: 'King & Jade',
    labelJa: '王・玉',
    category: 'abstract',
    components: ['王', '⺩', '玉'],
    color: '#FBBF24', // yellow-400
    icon: '👑',
    note: 'Characters for royalty, jade, precious things, and perfection',
    noteJa: '王族、玉、貴重品、完璧に関する漢字',
    relatedFamilies: ['jewel', 'treasure', 'noble']
  },

  big: {
    id: 'big',
    label: 'Big & Large',
    labelJa: '大・大きい',
    category: 'abstract',
    components: ['大', '⼤'],
    color: '#1E40AF', // blue-800
    icon: '🗻',
    note: 'Characters expressing size, greatness, and importance',
    noteJa: '大きさ、偉大さ、重要性を表す漢字',
    relatedFamilies: ['small', 'tall', 'wide']
  },

  small: {
    id: 'small',
    label: 'Small & Little',
    labelJa: '小・小さい',
    category: 'abstract',
    components: ['小', '⺌', '少'],
    color: '#4338CA', // indigo-700
    icon: '🐜',
    note: 'Characters for small size, little amounts, and reduction',
    noteJa: '小さいサイズ、少量、減少に関する漢字',
    relatedFamilies: ['big', 'child', 'few']
  },

  one: {
    id: 'one',
    label: 'One & Unity',
    labelJa: '一・統一',
    category: 'abstract',
    components: ['一', '⼀'],
    color: '#1F2937', // gray-800
    icon: '1️⃣',
    note: 'Characters representing unity, singularity, and beginning',
    noteJa: '統一、単一性、始まりを表す漢字',
    relatedFamilies: ['two', 'number', 'first']
  },

  ten: {
    id: 'ten',
    label: 'Ten & Cross',
    labelJa: '十・交差',
    category: 'abstract',
    components: ['十', '⼗'],
    color: '#4B5563', // gray-600
    icon: '➕',
    note: 'Characters with cross shape, representing ten and intersection',
    noteJa: '十字形、十と交差を表す漢字',
    relatedFamilies: ['number', 'cross', 'center']
  },

  enclosure: {
    id: 'enclosure',
    label: 'Enclosure & Box',
    labelJa: '囲い・箱',
    category: 'abstract',
    components: ['囗', '⼞', '口'],
    color: '#7C3AED', // violet-600
    icon: '⬜',
    note: 'Characters representing enclosures, boundaries, and countries',
    noteJa: '囲い、境界、国を表す漢字',
    relatedFamilies: ['country', 'border', 'inside']
  },

  cover: {
    id: 'cover',
    label: 'Cover & Roof',
    labelJa: '覆い・屋根',
    category: 'abstract',
    components: ['宀', '⼧', '冖'],
    color: '#0F766E', // teal-700
    icon: '🏠',
    note: 'Characters with roof/cover radicals, representing shelter and protection',
    noteJa: '屋根・覆いの部首を持つ、避難所と保護を表す漢字',
    relatedFamilies: ['house', 'roof', 'protect']
  }
};

// Helper functions for working with families

/**
 * Get all families in a specific category
 */
export function getFamiliesByCategory(category: KanjiFamilyCategory): KanjiFamily[] {
  return Object.values(KANJI_FAMILIES).filter(f => f.category === category);
}

/**
 * Get families that share components
 */
export function getRelatedFamiliesByComponent(familyId: string): KanjiFamily[] {
  const family = KANJI_FAMILIES[familyId];
  if (!family) return [];
  
  return Object.values(KANJI_FAMILIES).filter(f => {
    if (f.id === familyId) return false;
    return f.components.some(c => family.components.includes(c));
  });
}

/**
 * Find which families a kanji belongs to based on its components
 */
export function findKanjiFamilies(kanji: string, kanjiComponents: string[]): string[] {
  const families: string[] = [];
  
  for (const [id, family] of Object.entries(KANJI_FAMILIES)) {
    const hasComponent = family.components.some(component => 
      kanjiComponents.includes(component) || kanji.includes(component)
    );
    if (hasComponent) {
      families.push(id);
    }
  }
  
  return families;
}

/**
 * Get suggested learning path through families
 */
export function getSuggestedFamilyPath(): string[] {
  // Start with fundamental concepts and build complexity
  return [
    'one', 'big', 'small',           // Basic concepts
    'person', 'woman', 'child',      // People
    'sun', 'moon', 'water',          // Nature basics
    'tree', 'mountain', 'earth',     // More nature
    'fire', 'metal',                 // Elements
    'hand', 'mouth', 'eye',          // Body parts
    'heart', 'speech',               // Communication
    'movement', 'place',             // Location
    'rice', 'money',                 // Daily life
    'power', 'king'                  // Abstract
  ];
}

/**
 * Get all unique components across all families
 */
export function getAllComponents(): string[] {
  const components = new Set<string>();
  Object.values(KANJI_FAMILIES).forEach(family => {
    family.components.forEach(c => components.add(c));
  });
  return Array.from(components).sort();
}

/**
 * Get families organized by category
 */
export function getFamiliesByCategories(): Record<KanjiFamilyCategory, KanjiFamily[]> {
  const result: Record<KanjiFamilyCategory, KanjiFamily[]> = {
    elements: [],
    nature: [],
    human: [],
    tools: [],
    abstract: [],
    movement: [],
    society: []
  };
  
  Object.values(KANJI_FAMILIES).forEach(family => {
    result[family.category].push(family);
  });
  
  return result;
}