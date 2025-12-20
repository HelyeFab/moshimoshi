import { BaseContentAdapter } from './base.adapter'
import type { ReviewableContent, ReviewMode } from '../core/interfaces'
import type { UserList, ListItem, ListItemSRSData } from '@/types/userLists'
import { createInitialSRSData } from '@/types/userLists'

/**
 * Smart distractor generation result with priority info
 */
interface DistractorCandidate {
  item: ListItem
  priority: number
  reason: string
}

/**
 * Japanese character analysis result
 */
interface JapaneseCharacterAnalysis {
  kanji: string[]
  hiragana: string[]
  katakana: string[]
  hasKanji: boolean
  hasKana: boolean
  kanjiCount: number
  totalLength: number
}

export class UserListAdapter extends BaseContentAdapter {
  private list: UserList
  private currentItems: ListItem[]

  // ============================================================================
  // STATIC DATA: Semantic Categories for meaning-based matching
  // ============================================================================

  /** Semantic categories for grouping similar meanings (English and Japanese keywords) */
  private static readonly MEANING_CATEGORIES: Record<string, string[]> = {
    // Nature & Elements
    nature: [
      'water',
      'fire',
      'earth',
      'wind',
      'tree',
      'mountain',
      'river',
      'sea',
      'rain',
      'snow',
      'sun',
      'moon',
      'sky',
      'star',
      'flower',
      'forest',
      '水',
      '火',
      '土',
      '風',
      '木',
      '山',
      '川',
      '海',
      '雨',
      '雪',
      '日',
      '月',
      '空',
      '星',
      '花',
      '森',
    ],

    // Time & Calendar
    time: [
      'day',
      'month',
      'year',
      'week',
      'hour',
      'minute',
      'morning',
      'evening',
      'night',
      'today',
      'tomorrow',
      'yesterday',
      'time',
      'season',
      '日',
      '月',
      '年',
      '週',
      '時',
      '分',
      '朝',
      '夕',
      '夜',
      '今日',
      '明日',
      '昨日',
      '時間',
      '季節',
    ],

    // People & Relationships
    people: [
      'person',
      'man',
      'woman',
      'child',
      'friend',
      'family',
      'parent',
      'mother',
      'father',
      'teacher',
      'student',
      'people',
      '人',
      '男',
      '女',
      '子',
      '友',
      '家族',
      '親',
      '母',
      '父',
      '先生',
      '生徒',
      '人々',
    ],

    // Body & Health
    body: [
      'hand',
      'foot',
      'eye',
      'ear',
      'mouth',
      'head',
      'heart',
      'body',
      'face',
      'hair',
      'arm',
      'leg',
      '手',
      '足',
      '目',
      '耳',
      '口',
      '頭',
      '心',
      '体',
      '顔',
      '髪',
      '腕',
    ],

    // Actions & Movement
    action: [
      'go',
      'come',
      'walk',
      'run',
      'stop',
      'move',
      'turn',
      'enter',
      'exit',
      'rise',
      'fall',
      'open',
      'close',
      'start',
      'end',
      '行',
      '来',
      '歩',
      '走',
      '止',
      '動',
      '回',
      '入',
      '出',
      '上',
      '下',
      '開',
      '閉',
      '始',
      '終',
    ],

    // Communication
    communication: [
      'say',
      'speak',
      'talk',
      'tell',
      'ask',
      'answer',
      'read',
      'write',
      'hear',
      'listen',
      'call',
      '言',
      '話',
      '聞',
      '読',
      '書',
      '答',
      '呼',
    ],

    // Emotions & States
    emotion: [
      'happy',
      'sad',
      'angry',
      'love',
      'like',
      'hate',
      'fear',
      'hope',
      'glad',
      'sorry',
      'worry',
      '嬉',
      '悲',
      '怒',
      '愛',
      '好',
      '嫌',
      '怖',
      '望',
      '楽',
      '心配',
    ],

    // Places & Locations
    place: [
      'house',
      'home',
      'school',
      'station',
      'store',
      'shop',
      'office',
      'hospital',
      'restaurant',
      'room',
      'building',
      '家',
      '学校',
      '駅',
      '店',
      '会社',
      '病院',
      'レストラン',
      '部屋',
      '建物',
    ],

    // Food & Drink
    food: [
      'eat',
      'drink',
      'food',
      'meal',
      'rice',
      'water',
      'tea',
      'meat',
      'fish',
      'vegetable',
      'fruit',
      '食',
      '飲',
      '料理',
      'ご飯',
      '水',
      'お茶',
      '肉',
      '魚',
      '野菜',
      '果物',
    ],

    // Numbers & Quantities
    number: [
      'one',
      'two',
      'three',
      'many',
      'few',
      'all',
      'some',
      'number',
      'first',
      'last',
      '一',
      '二',
      '三',
      '多',
      '少',
      '全',
      '数',
      '最初',
      '最後',
    ],

    // Size & Appearance
    appearance: [
      'big',
      'small',
      'large',
      'little',
      'long',
      'short',
      'high',
      'low',
      'wide',
      'narrow',
      'new',
      'old',
      '大',
      '小',
      '長',
      '短',
      '高',
      '低',
      '広',
      '狭',
      '新',
      '古',
    ],

    // Colors
    color: [
      'red',
      'blue',
      'green',
      'yellow',
      'white',
      'black',
      'color',
      '赤',
      '青',
      '緑',
      '黄',
      '白',
      '黒',
      '色',
    ],

    // Work & Study
    work: [
      'work',
      'job',
      'study',
      'learn',
      'teach',
      'make',
      'create',
      'use',
      'buy',
      'sell',
      '働',
      '仕事',
      '勉強',
      '学',
      '教',
      '作',
      '使',
      '買',
      '売',
    ],

    // Weather
    weather: [
      'weather',
      'hot',
      'cold',
      'warm',
      'cool',
      'rain',
      'snow',
      'wind',
      'cloud',
      'sunny',
      '天気',
      '暑',
      '寒',
      '暖',
      '涼',
      '雨',
      '雪',
      '風',
      '雲',
      '晴',
    ],
  }

  /** Common verb endings for detecting verb groups */
  private static readonly VERB_PATTERNS = {
    ichidan: [
      'る',
      'いる',
      'える',
      'きる',
      'ぎる',
      'しる',
      'じる',
      'ちる',
      'にる',
      'ひる',
      'びる',
      'みる',
      'りる',
    ],
    godan_u: ['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る'],
    irregular: ['する', 'くる', '来る'],
  }

  /** Common adjective endings */
  private static readonly ADJECTIVE_PATTERNS = {
    i_adj: ['い', 'しい', 'かい', 'たい', 'ない', 'よい', 'わるい'],
    na_adj_endings: ['な', 'だ'],
  }

  /** Japanese-appropriate fallback options by type and JLPT level */
  private static readonly FALLBACK_OPTIONS: Record<string, Record<string, string[]>> = {
    word: {
      N5: [
        '水 (water)',
        '火 (fire)',
        '山 (mountain)',
        '川 (river)',
        '人 (person)',
        '日 (day)',
        '月 (month)',
        '年 (year)',
      ],
      N4: [
        '空 (sky)',
        '海 (sea)',
        '森 (forest)',
        '道 (road)',
        '町 (town)',
        '国 (country)',
        '世界 (world)',
      ],
      N3: [
        '自然 (nature)',
        '環境 (environment)',
        '社会 (society)',
        '文化 (culture)',
        '歴史 (history)',
      ],
      default: [
        'word',
        'meaning',
        'reading',
        'kanji',
        'vocabulary',
        'grammar',
        'sentence',
        'phrase',
      ],
    },
    sentence: {
      N5: [
        'これは本です。',
        'あれは何ですか？',
        '今日は暑いです。',
        '明日学校に行きます。',
        'ご飯を食べます。',
      ],
      N4: [
        '電車で会社に行きます。',
        '昨日映画を見ました。',
        '来週旅行に行く予定です。',
        '日本語を勉強しています。',
      ],
      N3: ['最近忙しくて大変です。', 'この問題について考えています。', '将来のことが心配です。'],
      default: [
        'This is a sentence.',
        'Please answer the question.',
        'I study every day.',
        'The weather is nice.',
      ],
    },
    verbAdj: {
      N5: [
        '食べる (to eat)',
        '飲む (to drink)',
        '行く (to go)',
        '来る (to come)',
        '見る (to see)',
        '大きい (big)',
        '小さい (small)',
        '新しい (new)',
      ],
      N4: [
        '始める (to begin)',
        '終わる (to end)',
        '変わる (to change)',
        '続ける (to continue)',
        '難しい (difficult)',
        '簡単 (simple)',
      ],
      N3: [
        '考える (to think)',
        '感じる (to feel)',
        '信じる (to believe)',
        '必要 (necessary)',
        '重要 (important)',
      ],
      default: ['to do', 'to make', 'to become', 'to have', 'good', 'bad', 'easy', 'hard'],
    },
  }

  constructor(list: UserList) {
    super()
    this.list = list
    this.currentItems = [...list.items] // Copy to avoid mutations
  }

  transform(item: ListItem): ReviewableContent {
    // Determine the best review mode based on list type
    const supportedModes = this.getSupportedModesForList()
    const preferredMode = supportedModes[0] // Default to first supported mode

    // For all list types with meanings: show English meaning as question, Japanese as answer
    // This enables proper multiple-choice where user picks the correct Japanese content
    const hasMeaning = !!item.metadata?.meaning

    // Determine display and answer based on whether we have a meaning
    let primaryDisplay: string
    let primaryAnswer: string
    let tertiaryDisplay: string

    if (hasMeaning) {
      // Show English meaning as question, pick Japanese content
      primaryDisplay = item.metadata!.meaning! // English meaning as question
      primaryAnswer = item.content // Japanese content is what they pick
      tertiaryDisplay = '' // Don't show the answer in the card
    } else {
      // No meaning available: Show content as both question and answer
      primaryDisplay = item.content
      primaryAnswer = item.content
      tertiaryDisplay = ''
    }

    return {
      id: item.id,
      contentType: 'custom',

      // Display fields
      primaryDisplay,
      secondaryDisplay: item.metadata?.reading || '', // Reading if available
      tertiaryDisplay,

      // Answer fields
      primaryAnswer,
      alternativeAnswers: item.metadata?.reading ? [item.metadata.reading] : [],

      // Media (could be extended later for audio)
      audioUrl: undefined,
      imageUrl: undefined,

      // Metadata
      difficulty: this.calculateDifficulty(item),
      tags: [...(item.metadata?.tags || []), this.list.type, `list:${this.list.name}`],
      source: `list:${this.list.id}`,

      // Review settings
      supportedModes,
      preferredMode,

      // Additional context
      metadata: {
        listName: this.list.name,
        listId: this.list.id,
        listType: this.list.type,
        itemContent: item.content, // Store original content in metadata
        itemNotes: item.metadata?.notes,
        jlptLevel: item.metadata?.jlptLevel,
        addedAt: item.metadata?.addedAt,
        meaning: item.metadata?.meaning, // Keep meaning accessible
        // Include SRS data for tracking
        srsData: item.srsData || createInitialSRSData(),
      },
    }
  }

  // ============================================================================
  // SMART DISTRACTOR GENERATION: Multi-priority system
  // ============================================================================

  /**
   * Generate smart distractors using multi-priority strategy
   * Based on list type, uses different strategies for optimal learning
   */
  generateOptions(
    content: ReviewableContent,
    pool: ListItem[],
    count: number = 4
  ): ReviewableContent[] {
    const usedIds = new Set<string>([content.id])
    const candidates: DistractorCandidate[] = []

    // Get the source item from metadata
    const sourceItem = this.currentItems.find(i => i.id === content.id)
    if (!sourceItem) {
      // Fallback to random selection
      return this.getRandomDistractors(pool, usedIds, count - 1)
    }

    // Apply type-specific strategy
    switch (this.list.type) {
      case 'word':
        this.generateWordDistractors(sourceItem, pool, candidates, usedIds)
        break
      case 'sentence':
        this.generateSentenceDistractors(sourceItem, pool, candidates, usedIds)
        break
      case 'verbAdj':
        this.generateVerbAdjDistractors(sourceItem, pool, candidates, usedIds)
        break
      default:
        this.generateGenericDistractors(sourceItem, pool, candidates, usedIds)
    }

    // Sort by priority (lower = better) and take top candidates
    candidates.sort((a, b) => a.priority - b.priority)

    const selected: ListItem[] = []
    for (const candidate of candidates) {
      if (selected.length >= count - 1) break
      if (!usedIds.has(candidate.item.id)) {
        selected.push(candidate.item)
        usedIds.add(candidate.item.id)
      }
    }

    // Fill remaining with random items
    if (selected.length < count - 1) {
      const remaining = pool.filter(i => !usedIds.has(i.id))
      const shuffled = [...remaining].sort(() => Math.random() - 0.5)
      for (const item of shuffled) {
        if (selected.length >= count - 1) break
        selected.push(item)
        usedIds.add(item.id)
      }
    }

    // If still not enough, use fallbacks
    if (selected.length < count - 1) {
      const fallbackItems = this.getFallbackItems(sourceItem, count - 1 - selected.length, usedIds)
      selected.push(...fallbackItems)
    }

    return selected.map(item => this.transform(item))
  }

  /**
   * Word-specific distractor generation (multi-priority)
   */
  private generateWordDistractors(
    sourceItem: ListItem,
    pool: ListItem[],
    candidates: DistractorCandidate[],
    usedIds: Set<string>
  ): void {
    const sourceAnalysis = this.analyzeJapaneseCharacters(sourceItem.content)
    const sourceMeaning = sourceItem.metadata?.meaning?.toLowerCase() || ''
    const sourceJlpt = sourceItem.metadata?.jlptLevel
    const sourceCategories = this.getMeaningCategories(sourceMeaning)

    for (const item of pool) {
      if (usedIds.has(item.id)) continue

      const itemAnalysis = this.analyzeJapaneseCharacters(item.content)
      const itemMeaning = item.metadata?.meaning?.toLowerCase() || ''
      const itemJlpt = item.metadata?.jlptLevel
      const itemCategories = this.getMeaningCategories(itemMeaning)

      // Priority 1: Same JLPT level (highest priority for appropriate difficulty)
      if (sourceJlpt && itemJlpt && sourceJlpt === itemJlpt) {
        candidates.push({ item, priority: 1, reason: 'same-jlpt' })
        continue
      }

      // Priority 2: Semantic similarity (same meaning category)
      const sharedCategories = sourceCategories.filter(c => itemCategories.includes(c))
      if (sharedCategories.length > 0) {
        candidates.push({ item, priority: 2, reason: `semantic-${sharedCategories[0]}` })
        continue
      }

      // Priority 3: Structural similarity (shared kanji)
      if (sourceAnalysis.hasKanji && itemAnalysis.hasKanji) {
        const sharedKanji = sourceAnalysis.kanji.filter(k => itemAnalysis.kanji.includes(k))
        if (sharedKanji.length > 0) {
          candidates.push({ item, priority: 3, reason: 'shared-kanji' })
          continue
        }
      }

      // Priority 4: Similar character count (±2)
      if (Math.abs(sourceAnalysis.totalLength - itemAnalysis.totalLength) <= 2) {
        candidates.push({ item, priority: 4, reason: 'similar-length' })
        continue
      }

      // Priority 5: Similar meaning string (Levenshtein)
      if (sourceMeaning && itemMeaning) {
        const similarity = this.calculateStringSimilarity(sourceMeaning, itemMeaning)
        if (similarity > 0.3 && similarity < 0.9) {
          // Not too similar (would be confusing) but related
          candidates.push({ item, priority: 5, reason: 'meaning-similarity' })
          continue
        }
      }

      // Priority 6: Adjacent JLPT level
      if (sourceJlpt && itemJlpt && Math.abs(sourceJlpt - itemJlpt) === 1) {
        candidates.push({ item, priority: 6, reason: 'adjacent-jlpt' })
        continue
      }

      // Priority 7: Generic fallback (add all remaining with low priority)
      candidates.push({ item, priority: 10, reason: 'generic' })
    }
  }

  /**
   * Sentence-specific distractor generation
   */
  private generateSentenceDistractors(
    sourceItem: ListItem,
    pool: ListItem[],
    candidates: DistractorCandidate[],
    usedIds: Set<string>
  ): void {
    const sourceComplexity = this.analyzeSentenceComplexity(sourceItem.content)
    const sourceLength = sourceItem.content.length
    const sourceJlpt = sourceItem.metadata?.jlptLevel

    for (const item of pool) {
      if (usedIds.has(item.id)) continue

      const itemComplexity = this.analyzeSentenceComplexity(item.content)
      const itemLength = item.content.length
      const itemJlpt = item.metadata?.jlptLevel

      // Priority 1: Similar length (within 20%)
      const lengthRatio = Math.min(sourceLength, itemLength) / Math.max(sourceLength, itemLength)
      if (lengthRatio >= 0.8) {
        candidates.push({ item, priority: 1, reason: 'similar-length' })
        continue
      }

      // Priority 2: Similar complexity (particle count ±2)
      if (Math.abs(sourceComplexity.particleCount - itemComplexity.particleCount) <= 2) {
        candidates.push({ item, priority: 2, reason: 'similar-complexity' })
        continue
      }

      // Priority 3: Same JLPT level
      if (sourceJlpt && itemJlpt && sourceJlpt === itemJlpt) {
        candidates.push({ item, priority: 3, reason: 'same-jlpt' })
        continue
      }

      // Priority 4: Similar grammar patterns (verb forms)
      if (
        sourceComplexity.hasTeForm === itemComplexity.hasTeForm ||
        sourceComplexity.hasPastTense === itemComplexity.hasPastTense
      ) {
        candidates.push({ item, priority: 4, reason: 'similar-grammar' })
        continue
      }

      // Priority 5: Moderate length difference (within 50%)
      if (lengthRatio >= 0.5) {
        candidates.push({ item, priority: 5, reason: 'moderate-length' })
        continue
      }

      // Lower priority for others
      candidates.push({ item, priority: 10, reason: 'generic' })
    }
  }

  /**
   * Verb/Adjective-specific distractor generation
   */
  private generateVerbAdjDistractors(
    sourceItem: ListItem,
    pool: ListItem[],
    candidates: DistractorCandidate[],
    usedIds: Set<string>
  ): void {
    const sourceVerbGroup = this.detectVerbGroup(sourceItem.content)
    const sourceAdjType = this.detectAdjectiveType(sourceItem.content)
    const sourceMeaning = sourceItem.metadata?.meaning?.toLowerCase() || ''
    const sourceCategories = this.getMeaningCategories(sourceMeaning)
    const sourceJlpt = sourceItem.metadata?.jlptLevel

    for (const item of pool) {
      if (usedIds.has(item.id)) continue

      const itemVerbGroup = this.detectVerbGroup(item.content)
      const itemAdjType = this.detectAdjectiveType(item.content)
      const itemMeaning = item.metadata?.meaning?.toLowerCase() || ''
      const itemCategories = this.getMeaningCategories(itemMeaning)
      const itemJlpt = item.metadata?.jlptLevel

      // Priority 1: Same conjugation group (verbs)
      if (sourceVerbGroup && itemVerbGroup && sourceVerbGroup === itemVerbGroup) {
        candidates.push({ item, priority: 1, reason: `same-verb-group-${sourceVerbGroup}` })
        continue
      }

      // Priority 1b: Same adjective type
      if (sourceAdjType && itemAdjType && sourceAdjType === itemAdjType) {
        candidates.push({ item, priority: 1, reason: `same-adj-type-${sourceAdjType}` })
        continue
      }

      // Priority 2: Semantic similarity (action verbs together, state verbs together)
      const sharedCategories = sourceCategories.filter(c => itemCategories.includes(c))
      if (sharedCategories.length > 0) {
        candidates.push({ item, priority: 2, reason: `semantic-${sharedCategories[0]}` })
        continue
      }

      // Priority 3: Same JLPT level
      if (sourceJlpt && itemJlpt && sourceJlpt === itemJlpt) {
        candidates.push({ item, priority: 3, reason: 'same-jlpt' })
        continue
      }

      // Priority 4: Similar ending pattern
      const sourceEnding = sourceItem.content.slice(-2)
      const itemEnding = item.content.slice(-2)
      if (sourceEnding === itemEnding) {
        candidates.push({ item, priority: 4, reason: 'same-ending' })
        continue
      }

      // Priority 5: Both are verbs or both are adjectives
      if ((sourceVerbGroup && itemVerbGroup) || (sourceAdjType && itemAdjType)) {
        candidates.push({ item, priority: 5, reason: 'same-word-class' })
        continue
      }

      // Lower priority for others
      candidates.push({ item, priority: 10, reason: 'generic' })
    }
  }

  /**
   * Generic distractor generation for unknown types
   */
  private generateGenericDistractors(
    sourceItem: ListItem,
    pool: ListItem[],
    candidates: DistractorCandidate[],
    usedIds: Set<string>
  ): void {
    const sourceLength = sourceItem.content.length
    const sourceJlpt = sourceItem.metadata?.jlptLevel

    for (const item of pool) {
      if (usedIds.has(item.id)) continue

      const itemJlpt = item.metadata?.jlptLevel

      // Priority 1: Same JLPT level
      if (sourceJlpt && itemJlpt && sourceJlpt === itemJlpt) {
        candidates.push({ item, priority: 1, reason: 'same-jlpt' })
        continue
      }

      // Priority 2: Similar length
      if (Math.abs(sourceLength - item.content.length) <= 3) {
        candidates.push({ item, priority: 2, reason: 'similar-length' })
        continue
      }

      // Generic fallback
      candidates.push({ item, priority: 10, reason: 'generic' })
    }
  }

  /**
   * Get random distractors as fallback
   */
  private getRandomDistractors(
    pool: ListItem[],
    usedIds: Set<string>,
    count: number
  ): ReviewableContent[] {
    const available = pool.filter(i => !usedIds.has(i.id))
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map(item => this.transform(item))
  }

  /**
   * Get Japanese-appropriate fallback items when pool is exhausted
   */
  private getFallbackItems(sourceItem: ListItem, count: number, usedIds: Set<string>): ListItem[] {
    const jlptLevel = sourceItem.metadata?.jlptLevel
    const levelKey = jlptLevel ? `N${jlptLevel}` : 'default'
    const typeKey = this.list.type || 'word'

    const fallbacks =
      UserListAdapter.FALLBACK_OPTIONS[typeKey]?.[levelKey] ||
      UserListAdapter.FALLBACK_OPTIONS[typeKey]?.['default'] ||
      UserListAdapter.FALLBACK_OPTIONS['word']['default']

    // Shuffle and create pseudo-items
    const shuffled = [...fallbacks].sort(() => Math.random() - 0.5)
    const result: ListItem[] = []

    for (const fallback of shuffled) {
      if (result.length >= count) break
      if (usedIds.has(fallback)) continue

      // Create a pseudo-item for the fallback
      result.push({
        id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: fallback,
        type: this.list.type,
        metadata: {
          addedAt: Date.now(),
        },
      })
      usedIds.add(fallback)
    }

    return result
  }

  // ============================================================================
  // HELPER METHODS: Japanese Character Analysis
  // ============================================================================

  /**
   * Analyze Japanese characters in content
   */
  private analyzeJapaneseCharacters(content: string): JapaneseCharacterAnalysis {
    const kanji = content.match(/[\u4e00-\u9faf]/g) || []
    const hiragana = content.match(/[\u3040-\u309f]/g) || []
    const katakana = content.match(/[\u30a0-\u30ff]/g) || []

    return {
      kanji,
      hiragana,
      katakana,
      hasKanji: kanji.length > 0,
      hasKana: hiragana.length > 0 || katakana.length > 0,
      kanjiCount: kanji.length,
      totalLength: content.length,
    }
  }

  /**
   * Analyze sentence complexity
   */
  private analyzeSentenceComplexity(sentence: string): {
    particleCount: number
    verbCount: number
    hasTeForm: boolean
    hasPastTense: boolean
    hasPoliteForm: boolean
  } {
    // Count common particles
    const particles = sentence.match(/[はがをにでへとからまでより]/g) || []

    // Detect grammar patterns
    const hasTeForm = /て|で/.test(sentence)
    const hasPastTense = /た|だ|ました|でした/.test(sentence)
    const hasPoliteForm = /です|ます|ました|ません/.test(sentence)

    // Estimate verb count (rough heuristic)
    const verbEndings = sentence.match(/[るうくすつぬぶむぐ]|ます|です|た|だ/g) || []

    return {
      particleCount: particles.length,
      verbCount: Math.ceil(verbEndings.length / 2), // Rough estimate
      hasTeForm,
      hasPastTense,
      hasPoliteForm,
    }
  }

  /**
   * Detect verb conjugation group
   */
  private detectVerbGroup(content: string): 'ichidan' | 'godan' | 'irregular' | null {
    // Check for irregular verbs first
    for (const pattern of UserListAdapter.VERB_PATTERNS.irregular) {
      if (content.includes(pattern)) {
        return 'irregular'
      }
    }

    // Check for ichidan (る-verbs)
    for (const pattern of UserListAdapter.VERB_PATTERNS.ichidan) {
      if (content.endsWith(pattern)) {
        return 'ichidan'
      }
    }

    // Check for godan (う-verbs)
    for (const pattern of UserListAdapter.VERB_PATTERNS.godan_u) {
      if (content.endsWith(pattern)) {
        return 'godan'
      }
    }

    return null
  }

  /**
   * Detect adjective type
   */
  private detectAdjectiveType(content: string): 'i-adj' | 'na-adj' | null {
    // Check for い-adjectives
    for (const pattern of UserListAdapter.ADJECTIVE_PATTERNS.i_adj) {
      if (content.endsWith(pattern)) {
        // Exclude いい (good) special case
        if (content === 'いい' || content === '良い') {
          return 'i-adj'
        }
        return 'i-adj'
      }
    }

    // Check for な-adjectives (harder to detect without dictionary)
    // Usually indicated by な ending in attributive form
    for (const pattern of UserListAdapter.ADJECTIVE_PATTERNS.na_adj_endings) {
      if (content.endsWith(pattern)) {
        return 'na-adj'
      }
    }

    return null
  }

  /**
   * Get semantic categories for a meaning string
   */
  private getMeaningCategories(meaning: string): string[] {
    const categories: string[] = []
    const lower = meaning.toLowerCase()

    for (const [category, keywords] of Object.entries(UserListAdapter.MEANING_CATEGORIES)) {
      if (keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
        categories.push(category)
      }
    }

    return categories
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2)
    const maxLength = Math.max(str1.length, str2.length)
    return maxLength === 0 ? 1 : 1 - distance / maxLength
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length

    // Create distance matrix
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0))

    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost // substitution
        )
      }
    }

    return dp[m][n]
  }

  // ============================================================================
  // LEGACY METHOD: Keep for backward compatibility
  // ============================================================================

  /**
   * @deprecated Use generateOptions instead. Kept for backward compatibility.
   */
  private generateStringOptions(item: ListItem, count: number = 4): string[] {
    // Convert to new format and extract strings
    const content = this.transform(item)
    const options = this.generateOptions(content, this.currentItems, count)

    return [
      item.metadata?.meaning || item.content,
      ...options.map(opt => opt.metadata?.itemContent || opt.primaryDisplay),
    ].filter((v, i, a) => a.indexOf(v) === i) // Dedupe
  }

  /**
   * @deprecated Use FALLBACK_OPTIONS instead. Kept for backward compatibility.
   */
  private getDefaultOptions(listType: string): string[] {
    const fallbacks =
      UserListAdapter.FALLBACK_OPTIONS[listType]?.['default'] ||
      UserListAdapter.FALLBACK_OPTIONS['word']['default']
    return fallbacks
  }

  calculateDifficulty(item: ListItem): number {
    let difficulty = 0.5 // Base difficulty

    // Adjust based on content length
    const contentLength = item.content.length
    if (contentLength > 20) difficulty += 0.2
    if (contentLength > 40) difficulty += 0.1

    // Adjust based on JLPT level if available
    if (item.metadata?.jlptLevel) {
      // JLPT N5 = easiest (1), N1 = hardest (5)
      difficulty = (6 - item.metadata.jlptLevel) * 0.2
    }

    // Adjust based on list type
    if (this.list.type === 'sentence') {
      difficulty += 0.1 // Sentences are generally harder
    } else if (this.list.type === 'verbAdj') {
      difficulty += 0.05 // Conjugatable items are slightly harder
    }

    return Math.min(1, Math.max(0, difficulty))
  }

  private getHintsForItem(item: ListItem): string[] {
    const hints: string[] = []

    // Add notes as a hint if available
    if (item.metadata?.notes) {
      hints.push(item.metadata.notes)
    }

    // Add partial meaning if available
    if (item.metadata?.meaning) {
      const words = item.metadata.meaning.split(' ')
      if (words.length > 1) {
        hints.push(`It means something related to "${words[0]}..."`)
      }
    }

    // Add reading hint if available
    if (item.metadata?.reading) {
      const reading = item.metadata.reading
      hints.push(`Pronunciation starts with "${reading[0]}"`)
      if (reading.length > 3) {
        hints.push(`It has ${reading.length} syllables`)
      }
    }

    // Add content length hint
    hints.push(`It has ${item.content.length} characters`)

    // Add JLPT level hint if available
    if (item.metadata?.jlptLevel) {
      hints.push(`This is a JLPT N${item.metadata.jlptLevel} item`)
    }

    return hints
  }

  private prepareItemForMode(item: ListItem, mode: ReviewMode): ReviewableContent {
    const base = this.transform(item)

    switch (mode) {
      case 'recognition':
        // Show the content, user selects meaning
        base.primaryDisplay = item.content
        base.primaryAnswer = item.metadata?.meaning || item.content
        break

      case 'recall':
        // Show the meaning, user types the content
        base.primaryDisplay = item.metadata?.meaning || 'Recall this item'
        base.primaryAnswer = item.content
        break

      case 'listening':
        // For listening mode, hide the text initially
        base.primaryDisplay = '🔊 Listen carefully'
        base.audioUrl = undefined // Would need TTS integration
        base.primaryAnswer = item.content
        break

      case 'writing':
        // For writing mode, show meaning and let user write
        base.primaryDisplay = item.metadata?.meaning || 'Write this item'
        base.primaryAnswer = item.content
        break

      default:
        // Default mode
        break
    }

    return base
  }

  private getSupportedModesForList(): ReviewMode[] {
    // Determine supported modes based on list type and available metadata
    const modes: ReviewMode[] = []

    // All lists support recognition if they have meanings
    if (this.list.items.some(item => item.metadata?.meaning)) {
      modes.push('recognition')
    }

    // All lists support recall
    modes.push('recall')

    // Sentences and words with readings can support listening
    if (this.list.type === 'sentence' || this.list.items.some(item => item.metadata?.reading)) {
      modes.push('listening')
    }

    // Single words/kanji support writing mode
    if (this.list.type === 'word' || this.list.items.some(item => item.content.length <= 4)) {
      modes.push('writing')
    }

    // Default to recognition if no modes determined
    if (modes.length === 0) {
      modes.push('recognition')
    }

    return modes
  }

  // Get all items as ReviewableContent for the review session
  getAllItems(): ReviewableContent[] {
    return this.currentItems.map(item => this.transform(item))
  }

  // Get items for a specific review mode
  getItemsForMode(mode: ReviewMode): ReviewableContent[] {
    return this.currentItems.map(item => this.prepareItemForMode(item, mode))
  }

  /**
   * Calculate updated SRS data after a review
   * Uses SM-2 algorithm (same as DrillProgressManager)
   * @param currentSRS Current SRS data for the item
   * @param correct Whether the answer was correct
   * @returns Updated SRS data
   */
  static calculateUpdatedSRS(currentSRS: ListItemSRSData, correct: boolean): ListItemSRSData {
    const newSRS = { ...currentSRS }
    const now = new Date()

    // Update review counts
    newSRS.reviewCount++
    if (correct) {
      newSRS.correctCount++
    }

    if (correct) {
      // Correct answer: Progress through SM-2 states
      if (newSRS.status === 'new') {
        newSRS.status = 'learning'
        newSRS.interval = 1
        newSRS.repetitions = 1
      } else if (newSRS.status === 'learning') {
        newSRS.repetitions++
        if (newSRS.repetitions >= 2) {
          newSRS.status = 'review'
          newSRS.interval = 3
        } else {
          newSRS.interval = 1
        }
      } else {
        // Review or mastered status
        newSRS.repetitions++
        newSRS.interval = Math.round(newSRS.interval * newSRS.easeFactor)

        // Check for mastery (21+ days with good accuracy)
        if (newSRS.interval >= 21 && newSRS.repetitions >= 5) {
          newSRS.status = 'mastered'
        }
      }

      // Increase ease factor slightly on correct (max 2.5)
      newSRS.easeFactor = Math.min(2.5, newSRS.easeFactor + 0.1)
    } else {
      // Incorrect answer: Reset progress
      newSRS.lapses++
      newSRS.repetitions = 0
      newSRS.interval = 1
      newSRS.easeFactor = Math.max(1.3, newSRS.easeFactor - 0.2)

      // Demote status
      if (newSRS.status === 'mastered') {
        newSRS.status = 'review'
      } else if (newSRS.status === 'review') {
        newSRS.status = 'learning'
      }
    }

    // Calculate next review date
    newSRS.lastReviewedAt = now.toISOString()
    const nextReview = new Date(now.getTime() + newSRS.interval * 24 * 60 * 60 * 1000)
    newSRS.nextReviewAt = nextReview.toISOString()

    return newSRS
  }

  /**
   * Get items that are due for review based on SRS data
   * @param includeLearning Include items still in learning phase
   * @returns Items due for review, sorted by overdue priority
   */
  getDueItems(includeLearning: boolean = true): ListItem[] {
    const now = new Date()

    return this.currentItems
      .filter(item => {
        if (!item.srsData) return true // New items are always due

        const nextReview = new Date(item.srsData.nextReviewAt)
        const isDue = nextReview <= now

        if (includeLearning && item.srsData.status === 'learning') {
          return true // Always include learning items
        }

        return isDue
      })
      .sort((a, b) => {
        // Sort by: new items first, then by how overdue
        if (!a.srsData) return -1
        if (!b.srsData) return 1

        const aOverdue = now.getTime() - new Date(a.srsData.nextReviewAt).getTime()
        const bOverdue = now.getTime() - new Date(b.srsData.nextReviewAt).getTime()

        return bOverdue - aOverdue // Most overdue first
      })
  }

  /**
   * Get SRS statistics for the list
   */
  getSRSStats(): {
    total: number
    new: number
    learning: number
    review: number
    mastered: number
    dueToday: number
  } {
    const now = new Date()
    const stats = {
      total: this.currentItems.length,
      new: 0,
      learning: 0,
      review: 0,
      mastered: 0,
      dueToday: 0,
    }

    for (const item of this.currentItems) {
      if (!item.srsData) {
        stats.new++
        stats.dueToday++
        continue
      }

      // Count by status
      switch (item.srsData.status) {
        case 'new':
          stats.new++
          break
        case 'learning':
          stats.learning++
          break
        case 'review':
          stats.review++
          break
        case 'mastered':
          stats.mastered++
          break
      }

      // Count due items
      const nextReview = new Date(item.srsData.nextReviewAt)
      if (nextReview <= now) {
        stats.dueToday++
      }
    }

    return stats
  }
}
