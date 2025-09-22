// Semantic Radicals Database
// Groups kanji by their semantic radicals with sub-themes

export interface SemanticRadical {
  id: string;
  radical: string;
  meaning: string;
  meaningJa: string;
  category: 'water' | 'body' | 'nature' | 'action' | 'objects' | 'abstract' | 'animals' | 'people';
  icon: string;
  color: string;
  subThemes?: {
    id: string;
    name: string;
    keywords: string[];
  }[];
  strokeCount: number;
  position?: 'left' | 'right' | 'top' | 'bottom' | 'surround' | 'any';
}

export interface RadicalKanji {
  kanji: string;
  meanings: string[];
  readings: {
    kun: string[];
    on: string[];
  };
  jlpt?: number;
  grade?: number;
  frequency?: number;
  subTheme?: string;
}

// Main semantic radicals with their characteristics
export const SEMANTIC_RADICALS: Record<string, SemanticRadical> = {
  water: {
    id: 'water',
    radical: '氵',
    meaning: 'Water',
    meaningJa: 'さんずい',
    category: 'water',
    icon: '💧',
    color: '#3B82F6',
    subThemes: [
      { id: 'liquids', name: 'Liquids & Fluids', keywords: ['liquid', 'fluid', 'juice', 'oil'] },
      { id: 'water_bodies', name: 'Bodies of Water', keywords: ['ocean', 'river', 'lake', 'sea', 'pond'] },
      { id: 'water_actions', name: 'Water Actions', keywords: ['wash', 'flow', 'swim', 'sink', 'float'] },
      { id: 'weather', name: 'Weather & Climate', keywords: ['rain', 'wet', 'humid', 'damp'] },
      { id: 'cleaning', name: 'Cleaning & Purity', keywords: ['clean', 'pure', 'clear', 'wash'] }
    ],
    strokeCount: 3,
    position: 'left'
  },
  
  hand: {
    id: 'hand',
    radical: '扌',
    meaning: 'Hand',
    meaningJa: 'てへん',
    category: 'action',
    icon: '✋',
    color: '#F59E0B',
    subThemes: [
      { id: 'manipulation', name: 'Manipulation', keywords: ['hold', 'grasp', 'carry', 'take'] },
      { id: 'creation', name: 'Creation & Craft', keywords: ['make', 'build', 'create', 'construct'] },
      { id: 'movement', name: 'Hand Movements', keywords: ['throw', 'push', 'pull', 'wave'] },
      { id: 'interaction', name: 'Interaction', keywords: ['touch', 'hit', 'knock', 'tap'] }
    ],
    strokeCount: 3,
    position: 'left'
  },
  
  speech: {
    id: 'speech',
    radical: '言',
    meaning: 'Speech',
    meaningJa: 'ごんべん',
    category: 'abstract',
    icon: '💬',
    color: '#8B5CF6',
    subThemes: [
      { id: 'communication', name: 'Communication', keywords: ['speak', 'say', 'tell', 'talk'] },
      { id: 'language', name: 'Language & Writing', keywords: ['word', 'language', 'read', 'write'] },
      { id: 'expression', name: 'Expression', keywords: ['express', 'explain', 'describe', 'discuss'] },
      { id: 'judgment', name: 'Judgment & Opinion', keywords: ['judge', 'evaluate', 'criticize', 'praise'] }
    ],
    strokeCount: 7,
    position: 'left'
  },
  
  person: {
    id: 'person',
    radical: '亻',
    meaning: 'Person',
    meaningJa: 'にんべん',
    category: 'people',
    icon: '👤',
    color: '#EC4899',
    subThemes: [
      { id: 'roles', name: 'Roles & Occupations', keywords: ['work', 'job', 'profession', 'duty'] },
      { id: 'relationships', name: 'Relationships', keywords: ['friend', 'companion', 'partner', 'colleague'] },
      { id: 'actions', name: 'Human Actions', keywords: ['do', 'make', 'use', 'serve'] },
      { id: 'qualities', name: 'Human Qualities', keywords: ['virtue', 'character', 'behavior', 'manner'] }
    ],
    strokeCount: 2,
    position: 'left'
  },
  
  heart: {
    id: 'heart',
    radical: '忄',
    meaning: 'Heart/Mind',
    meaningJa: 'りっしんべん',
    category: 'abstract',
    icon: '❤️',
    color: '#EF4444',
    subThemes: [
      { id: 'emotions', name: 'Emotions', keywords: ['feel', 'emotion', 'love', 'hate', 'fear'] },
      { id: 'mental_states', name: 'Mental States', keywords: ['think', 'worry', 'anxious', 'calm'] },
      { id: 'desires', name: 'Desires & Will', keywords: ['want', 'wish', 'hope', 'desire'] },
      { id: 'character', name: 'Character Traits', keywords: ['kind', 'cruel', 'brave', 'gentle'] }
    ],
    strokeCount: 3,
    position: 'left'
  },
  
  tree: {
    id: 'tree',
    radical: '木',
    meaning: 'Tree/Wood',
    meaningJa: 'きへん',
    category: 'nature',
    icon: '🌳',
    color: '#10B981',
    subThemes: [
      { id: 'trees', name: 'Trees & Plants', keywords: ['tree', 'forest', 'branch', 'root'] },
      { id: 'wood_products', name: 'Wood Products', keywords: ['desk', 'chair', 'board', 'pole'] },
      { id: 'construction', name: 'Construction', keywords: ['build', 'frame', 'structure', 'beam'] },
      { id: 'nature', name: 'Nature', keywords: ['forest', 'grove', 'natural', 'wild'] }
    ],
    strokeCount: 4,
    position: 'left'
  },
  
  fire: {
    id: 'fire',
    radical: '火',
    meaning: 'Fire',
    meaningJa: 'ひへん',
    category: 'nature',
    icon: '🔥',
    color: '#F97316',
    subThemes: [
      { id: 'heat', name: 'Heat & Temperature', keywords: ['hot', 'warm', 'heat', 'burn'] },
      { id: 'cooking', name: 'Cooking', keywords: ['cook', 'bake', 'roast', 'boil'] },
      { id: 'light', name: 'Light & Brightness', keywords: ['light', 'bright', 'shine', 'glow'] },
      { id: 'destruction', name: 'Destruction', keywords: ['burn', 'destroy', 'ash', 'smoke'] }
    ],
    strokeCount: 4,
    position: 'left'
  },
  
  earth: {
    id: 'earth',
    radical: '土',
    meaning: 'Earth/Soil',
    meaningJa: 'つちへん',
    category: 'nature',
    icon: '🌍',
    color: '#A16207',
    subThemes: [
      { id: 'land', name: 'Land & Territory', keywords: ['land', 'ground', 'place', 'area'] },
      { id: 'construction', name: 'Construction', keywords: ['wall', 'tower', 'castle', 'foundation'] },
      { id: 'geography', name: 'Geography', keywords: ['hill', 'valley', 'field', 'plain'] },
      { id: 'materials', name: 'Materials', keywords: ['clay', 'dust', 'sand', 'mud'] }
    ],
    strokeCount: 3,
    position: 'left'
  },
  
  metal: {
    id: 'metal',
    radical: '金',
    meaning: 'Metal/Gold',
    meaningJa: 'かねへん',
    category: 'objects',
    icon: '⚙️',
    color: '#6B7280',
    subThemes: [
      { id: 'metals', name: 'Metals', keywords: ['gold', 'silver', 'iron', 'copper'] },
      { id: 'tools', name: 'Tools & Weapons', keywords: ['sword', 'needle', 'hammer', 'blade'] },
      { id: 'money', name: 'Money & Value', keywords: ['money', 'coin', 'price', 'value'] },
      { id: 'processing', name: 'Metal Processing', keywords: ['forge', 'cast', 'polish', 'sharpen'] }
    ],
    strokeCount: 8,
    position: 'left'
  },
  
  plant: {
    id: 'plant',
    radical: '艹',
    meaning: 'Grass/Plant',
    meaningJa: 'くさかんむり',
    category: 'nature',
    icon: '🌿',
    color: '#84CC16',
    subThemes: [
      { id: 'plants', name: 'Plants & Flowers', keywords: ['flower', 'grass', 'leaf', 'stem'] },
      { id: 'vegetables', name: 'Vegetables', keywords: ['vegetable', 'herb', 'crop', 'harvest'] },
      { id: 'medicine', name: 'Medicine', keywords: ['medicine', 'drug', 'herb', 'cure'] },
      { id: 'growth', name: 'Growth', keywords: ['grow', 'bloom', 'sprout', 'wither'] }
    ],
    strokeCount: 3,
    position: 'top'
  },
  
  animal: {
    id: 'animal',
    radical: '犭',
    meaning: 'Animal',
    meaningJa: 'けものへん',
    category: 'animals',
    icon: '🐾',
    color: '#7C3AED',
    subThemes: [
      { id: 'wild', name: 'Wild Animals', keywords: ['wolf', 'fox', 'beast', 'wild'] },
      { id: 'behavior', name: 'Animal Behavior', keywords: ['hunt', 'prowl', 'fierce', 'tame'] },
      { id: 'characteristics', name: 'Characteristics', keywords: ['fierce', 'cunning', 'loyal', 'savage'] }
    ],
    strokeCount: 3,
    position: 'left'
  },
  
  mouth: {
    id: 'mouth',
    radical: '口',
    meaning: 'Mouth',
    meaningJa: 'くちへん',
    category: 'body',
    icon: '👄',
    color: '#DC2626',
    subThemes: [
      { id: 'eating', name: 'Eating & Drinking', keywords: ['eat', 'drink', 'taste', 'swallow'] },
      { id: 'speaking', name: 'Speaking & Sounds', keywords: ['call', 'shout', 'sing', 'cry'] },
      { id: 'openings', name: 'Openings', keywords: ['door', 'entrance', 'hole', 'opening'] },
      { id: 'containers', name: 'Containers', keywords: ['vessel', 'container', 'box', 'holder'] }
    ],
    strokeCount: 3,
    position: 'left'
  },
  
  eye: {
    id: 'eye',
    radical: '目',
    meaning: 'Eye',
    meaningJa: 'めへん',
    category: 'body',
    icon: '👁️',
    color: '#0891B2',
    subThemes: [
      { id: 'vision', name: 'Vision', keywords: ['see', 'look', 'watch', 'observe'] },
      { id: 'appearance', name: 'Appearance', keywords: ['appear', 'show', 'display', 'visible'] },
      { id: 'perception', name: 'Perception', keywords: ['notice', 'recognize', 'distinguish', 'blind'] }
    ],
    strokeCount: 5,
    position: 'left'
  },
  
  foot: {
    id: 'foot',
    radical: '足',
    meaning: 'Foot/Leg',
    meaningJa: 'あしへん',
    category: 'body',
    icon: '🦶',
    color: '#059669',
    subThemes: [
      { id: 'movement', name: 'Movement', keywords: ['walk', 'run', 'jump', 'step'] },
      { id: 'position', name: 'Position', keywords: ['stand', 'kneel', 'squat', 'sit'] },
      { id: 'travel', name: 'Travel', keywords: ['journey', 'distance', 'path', 'track'] }
    ],
    strokeCount: 7,
    position: 'left'
  },
  
  cloth: {
    id: 'cloth',
    radical: '衤',
    meaning: 'Cloth/Clothing',
    meaningJa: 'ころもへん',
    category: 'objects',
    icon: '👔',
    color: '#BE185D',
    subThemes: [
      { id: 'clothing', name: 'Clothing', keywords: ['clothes', 'garment', 'wear', 'dress'] },
      { id: 'fabric', name: 'Fabric & Materials', keywords: ['cloth', 'silk', 'cotton', 'fabric'] },
      { id: 'covering', name: 'Covering', keywords: ['cover', 'wrap', 'fold', 'layer'] }
    ],
    strokeCount: 5,
    position: 'left'
  },
  
  sun: {
    id: 'sun',
    radical: '日',
    meaning: 'Sun/Day',
    meaningJa: 'ひへん',
    category: 'nature',
    icon: '☀️',
    color: '#FCD34D',
    subThemes: [
      { id: 'time', name: 'Time', keywords: ['day', 'time', 'hour', 'morning', 'evening'] },
      { id: 'light', name: 'Light & Brightness', keywords: ['bright', 'clear', 'shine', 'dark'] },
      { id: 'weather', name: 'Weather', keywords: ['sunny', 'clear', 'weather', 'season'] }
    ],
    strokeCount: 4,
    position: 'left'
  },
  
  moon: {
    id: 'moon',
    radical: '月',
    meaning: 'Moon/Meat',
    meaningJa: 'つきへん',
    category: 'nature',
    icon: '🌙',
    color: '#C084FC',
    subThemes: [
      { id: 'body_parts', name: 'Body Parts', keywords: ['organ', 'flesh', 'body', 'part'] },
      { id: 'time', name: 'Time Periods', keywords: ['month', 'period', 'cycle', 'phase'] },
      { id: 'meat', name: 'Meat & Flesh', keywords: ['meat', 'flesh', 'muscle', 'fat'] }
    ],
    strokeCount: 4,
    position: 'left'
  },
  
  rice: {
    id: 'rice',
    radical: '米',
    meaning: 'Rice',
    meaningJa: 'こめへん',
    category: 'objects',
    icon: '🌾',
    color: '#FDE047',
    subThemes: [
      { id: 'grains', name: 'Grains & Cereals', keywords: ['rice', 'grain', 'wheat', 'cereal'] },
      { id: 'food', name: 'Food Products', keywords: ['flour', 'powder', 'paste', 'meal'] },
      { id: 'measurement', name: 'Measurement', keywords: ['measure', 'portion', 'amount', 'grain'] }
    ],
    strokeCount: 6,
    position: 'left'
  },
  
  thread: {
    id: 'thread',
    radical: '糸',
    meaning: 'Thread/Silk',
    meaningJa: 'いとへん',
    category: 'objects',
    icon: '🧵',
    color: '#A78BFA',
    subThemes: [
      { id: 'textiles', name: 'Textiles', keywords: ['thread', 'silk', 'string', 'rope'] },
      { id: 'connections', name: 'Connections', keywords: ['tie', 'bind', 'connect', 'link'] },
      { id: 'continuity', name: 'Continuity', keywords: ['continue', 'inherit', 'line', 'series'] },
      { id: 'fineness', name: 'Fineness', keywords: ['fine', 'delicate', 'thin', 'detail'] }
    ],
    strokeCount: 6,
    position: 'left'
  },
  
  vehicle: {
    id: 'vehicle',
    radical: '車',
    meaning: 'Vehicle',
    meaningJa: 'くるまへん',
    category: 'objects',
    icon: '🚗',
    color: '#0EA5E9',
    subThemes: [
      { id: 'vehicles', name: 'Vehicles', keywords: ['car', 'wheel', 'cart', 'carriage'] },
      { id: 'transportation', name: 'Transportation', keywords: ['transport', 'carry', 'load', 'freight'] },
      { id: 'rotation', name: 'Rotation', keywords: ['turn', 'rotate', 'spin', 'roll'] }
    ],
    strokeCount: 7,
    position: 'left'
  }
};

// Helper function to get radicals by category
export function getRadicalsByCategory() {
  const categories: Record<string, SemanticRadical[]> = {};
  
  Object.values(SEMANTIC_RADICALS).forEach(radical => {
    if (!categories[radical.category]) {
      categories[radical.category] = [];
    }
    categories[radical.category].push(radical);
  });
  
  return categories;
}

// Helper function to identify sub-theme based on kanji meanings
export function identifySubTheme(meanings: string[], radical: SemanticRadical): string | undefined {
  if (!radical.subThemes) return undefined;
  
  const meaningText = meanings.join(' ').toLowerCase();
  let bestMatch: { theme: string; score: number } | null = null;
  
  for (const theme of radical.subThemes) {
    let score = 0;
    for (const keyword of theme.keywords) {
      if (meaningText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { theme: theme.id, score };
    }
  }
  
  return bestMatch?.theme;
}

// Category metadata
export const RADICAL_CATEGORIES = {
  water: { label: 'Water & Liquids', icon: '💧', color: '#3B82F6' },
  body: { label: 'Body Parts', icon: '👤', color: '#EC4899' },
  nature: { label: 'Nature', icon: '🌿', color: '#10B981' },
  action: { label: 'Actions', icon: '✋', color: '#F59E0B' },
  objects: { label: 'Objects & Tools', icon: '🔧', color: '#6B7280' },
  abstract: { label: 'Abstract Concepts', icon: '💭', color: '#8B5CF6' },
  animals: { label: 'Animals', icon: '🐾', color: '#7C3AED' },
  people: { label: 'People & Society', icon: '👥', color: '#EC4899' }
};