/**
 * SKIP (System of Kanji Indexing by Patterns) Visual Layout
 * Organizes kanji by their visual structure for pattern-based learning
 */

export type SkipPattern = 'left-right' | 'up-down' | 'enclosure' | 'solid';

export interface SkipCode {
  pattern: SkipPattern;
  leftStrokes?: number;
  rightStrokes?: number;
  topStrokes?: number;
  bottomStrokes?: number;
  outerStrokes?: number;
  innerStrokes?: number;
  totalStrokes?: number;
  code: string; // e.g., "1-3-8" for left-right with 3 left strokes and 8 right strokes
}

export interface SkipKanji {
  kanji: string;
  skip: SkipCode;
  meanings: string[];
  readings: {
    kun: string[];
    on: string[];
  };
  jlpt?: number;
  grade?: number;
  frequency?: number;
  strokeCount: number;
  radicals?: string[];
}

export interface SkipCategory {
  id: string;
  pattern: SkipPattern;
  name: string;
  nameJa: string;
  description: string;
  icon: string;
  color: string;
  examples: string[];
  subCategories?: SkipSubCategory[];
}

export interface SkipSubCategory {
  id: string;
  name: string;
  strokeRange: string; // e.g., "1-3", "4-6", "7+"
  description: string;
  examples: string[];
}

// SKIP Pattern Categories
export const SKIP_PATTERNS: Record<SkipPattern, SkipCategory> = {
  'left-right': {
    id: 'left-right',
    pattern: 'left-right',
    name: 'Left-Right Structure',
    nameJa: '左右型',
    description: 'Kanji divided vertically into left and right components',
    icon: '↔️',
    color: '#3B82F6',
    examples: ['明', '持', '時', '話', '語', '体', '休', '作'],
    subCategories: [
      {
        id: 'lr-balanced',
        name: 'Balanced (Similar strokes)',
        strokeRange: 'balanced',
        description: 'Left and right parts have similar stroke counts',
        examples: ['明', '林', '朋']
      },
      {
        id: 'lr-left-heavy',
        name: 'Left Heavy',
        strokeRange: 'left>right',
        description: 'Left part has more strokes than right',
        examples: ['語', '読', '調']
      },
      {
        id: 'lr-right-heavy',
        name: 'Right Heavy',
        strokeRange: 'left<right',
        description: 'Right part has more strokes than left',
        examples: ['刻', '到', '判']
      }
    ]
  },
  
  'up-down': {
    id: 'up-down',
    pattern: 'up-down',
    name: 'Up-Down Structure',
    nameJa: '上下型',
    description: 'Kanji divided horizontally into top and bottom components',
    icon: '↕️',
    color: '#10B981',
    examples: ['早', '雪', '思', '意', '忘', '草', '学', '空'],
    subCategories: [
      {
        id: 'ud-balanced',
        name: 'Balanced (Similar strokes)',
        strokeRange: 'balanced',
        description: 'Top and bottom parts have similar stroke counts',
        examples: ['早', '音', '昌']
      },
      {
        id: 'ud-top-heavy',
        name: 'Top Heavy',
        strokeRange: 'top>bottom',
        description: 'Top part has more strokes than bottom',
        examples: ['雪', '雲', '露']
      },
      {
        id: 'ud-bottom-heavy',
        name: 'Bottom Heavy',
        strokeRange: 'top<bottom',
        description: 'Bottom part has more strokes than top',
        examples: ['思', '想', '恩']
      }
    ]
  },
  
  'enclosure': {
    id: 'enclosure',
    pattern: 'enclosure',
    name: 'Enclosure Structure',
    nameJa: '囲み型',
    description: 'Kanji with one component enclosing another',
    icon: '⬜',
    color: '#F59E0B',
    examples: ['国', '園', '囲', '図', '回', '困', '団', '因'],
    subCategories: [
      {
        id: 'enc-full',
        name: 'Full Enclosure',
        strokeRange: 'full',
        description: 'Completely enclosed on all sides',
        examples: ['国', '回', '囲']
      },
      {
        id: 'enc-three-sides',
        name: 'Three Sides',
        strokeRange: '3-sides',
        description: 'Enclosed on three sides',
        examples: ['門', '問', '間']
      },
      {
        id: 'enc-two-sides',
        name: 'Two Sides',
        strokeRange: '2-sides',
        description: 'Enclosed on two sides (L-shape)',
        examples: ['区', '医', '匹']
      },
      {
        id: 'enc-top',
        name: 'Top Enclosure',
        strokeRange: 'top',
        description: 'Covered from the top',
        examples: ['向', '両', '内']
      }
    ]
  },
  
  'solid': {
    id: 'solid',
    pattern: 'solid',
    name: 'Solid Structure',
    nameJa: '単体型',
    description: 'Kanji that cannot be easily divided into components',
    icon: '⬛',
    color: '#EF4444',
    examples: ['大', '火', '水', '女', '子', '小', '山', '川'],
    subCategories: [
      {
        id: 'solid-simple',
        name: 'Simple (1-4 strokes)',
        strokeRange: '1-4',
        description: 'Very basic kanji with few strokes',
        examples: ['一', '人', '大', '小']
      },
      {
        id: 'solid-medium',
        name: 'Medium (5-8 strokes)',
        strokeRange: '5-8',
        description: 'Moderate complexity solid kanji',
        examples: ['永', '求', '良', '来']
      },
      {
        id: 'solid-complex',
        name: 'Complex (9+ strokes)',
        strokeRange: '9+',
        description: 'Complex solid kanji with many strokes',
        examples: ['飛', '龍', '鳥', '馬']
      }
    ]
  }
};

// Helper function to parse SKIP code
export function parseSkipCode(code: string): SkipCode | null {
  const parts = code.split('-');
  if (parts.length < 2) return null;
  
  const patternNum = parseInt(parts[0]);
  let pattern: SkipPattern;
  
  switch (patternNum) {
    case 1:
      pattern = 'left-right';
      if (parts.length === 3) {
        return {
          pattern,
          leftStrokes: parseInt(parts[1]),
          rightStrokes: parseInt(parts[2]),
          code
        };
      }
      break;
    case 2:
      pattern = 'up-down';
      if (parts.length === 3) {
        return {
          pattern,
          topStrokes: parseInt(parts[1]),
          bottomStrokes: parseInt(parts[2]),
          code
        };
      }
      break;
    case 3:
      pattern = 'enclosure';
      if (parts.length === 3) {
        return {
          pattern,
          outerStrokes: parseInt(parts[1]),
          innerStrokes: parseInt(parts[2]),
          code
        };
      }
      break;
    case 4:
      pattern = 'solid';
      if (parts.length >= 2) {
        return {
          pattern,
          totalStrokes: parseInt(parts[1]),
          code
        };
      }
      break;
  }
  
  return null;
}

// Helper function to generate SKIP code string
export function generateSkipCode(skip: SkipCode): string {
  switch (skip.pattern) {
    case 'left-right':
      return `1-${skip.leftStrokes || 0}-${skip.rightStrokes || 0}`;
    case 'up-down':
      return `2-${skip.topStrokes || 0}-${skip.bottomStrokes || 0}`;
    case 'enclosure':
      return `3-${skip.outerStrokes || 0}-${skip.innerStrokes || 0}`;
    case 'solid':
      return `4-${skip.totalStrokes || 0}`;
    default:
      return '';
  }
}

// Helper function to get pattern name in Japanese
export function getPatternNameJa(pattern: SkipPattern): string {
  return SKIP_PATTERNS[pattern]?.nameJa || '';
}

// Helper function to categorize kanji by SKIP pattern
export function categorizeBySkip(kanjiList: SkipKanji[]): Record<SkipPattern, SkipKanji[]> {
  const categorized: Record<SkipPattern, SkipKanji[]> = {
    'left-right': [],
    'up-down': [],
    'enclosure': [],
    'solid': []
  };
  
  kanjiList.forEach(kanji => {
    if (kanji.skip && kanji.skip.pattern) {
      categorized[kanji.skip.pattern].push(kanji);
    }
  });
  
  // Sort each category by stroke count and frequency
  Object.keys(categorized).forEach(pattern => {
    categorized[pattern as SkipPattern].sort((a, b) => {
      // First by JLPT level (if available)
      if (a.jlpt !== b.jlpt) {
        if (!a.jlpt) return 1;
        if (!b.jlpt) return -1;
        return a.jlpt - b.jlpt;
      }
      
      // Then by stroke count
      if (a.strokeCount !== b.strokeCount) {
        return a.strokeCount - b.strokeCount;
      }
      
      // Then by frequency
      if (a.frequency !== b.frequency) {
        if (!a.frequency) return 1;
        if (!b.frequency) return -1;
        return a.frequency - b.frequency;
      }
      
      return 0;
    });
  });
  
  return categorized;
}

// Helper function to get sub-category for a kanji
export function getSubCategory(kanji: SkipKanji): SkipSubCategory | undefined {
  const category = SKIP_PATTERNS[kanji.skip.pattern];
  if (!category || !category.subCategories) return undefined;
  
  switch (kanji.skip.pattern) {
    case 'left-right':
      const leftStrokes = kanji.skip.leftStrokes || 0;
      const rightStrokes = kanji.skip.rightStrokes || 0;
      if (Math.abs(leftStrokes - rightStrokes) <= 1) {
        return category.subCategories.find(sc => sc.id === 'lr-balanced');
      } else if (leftStrokes > rightStrokes) {
        return category.subCategories.find(sc => sc.id === 'lr-left-heavy');
      } else {
        return category.subCategories.find(sc => sc.id === 'lr-right-heavy');
      }
      
    case 'up-down':
      const topStrokes = kanji.skip.topStrokes || 0;
      const bottomStrokes = kanji.skip.bottomStrokes || 0;
      if (Math.abs(topStrokes - bottomStrokes) <= 1) {
        return category.subCategories.find(sc => sc.id === 'ud-balanced');
      } else if (topStrokes > bottomStrokes) {
        return category.subCategories.find(sc => sc.id === 'ud-top-heavy');
      } else {
        return category.subCategories.find(sc => sc.id === 'ud-bottom-heavy');
      }
      
    case 'enclosure':
      // This would need more detailed analysis of the enclosure type
      return category.subCategories[0]; // Default to full enclosure
      
    case 'solid':
      const strokes = kanji.strokeCount;
      if (strokes <= 4) {
        return category.subCategories.find(sc => sc.id === 'solid-simple');
      } else if (strokes <= 8) {
        return category.subCategories.find(sc => sc.id === 'solid-medium');
      } else {
        return category.subCategories.find(sc => sc.id === 'solid-complex');
      }
  }
  
  return undefined;
}

// Visual pattern recognition helpers
export const VISUAL_PATTERNS = {
  symmetrical: ['林', '朋', '品', '晶', '森', '轟'],
  repeated: ['森', '品', '晶', '轟', '姦', '犇'],
  stacked: ['早', '草', '雪', '雲', '電', '震'],
  nested: ['国', '園', '囲', '図', '回', '因'],
  branching: ['木', '林', '森', '枝', '根', '葉'],
  flowing: ['水', '川', '流', '海', '波', '泳']
};

// Helper to identify visual patterns
export function identifyVisualPatterns(kanji: string): string[] {
  const patterns: string[] = [];
  
  Object.entries(VISUAL_PATTERNS).forEach(([pattern, examples]) => {
    if (examples.includes(kanji)) {
      patterns.push(pattern);
    }
  });
  
  return patterns;
}