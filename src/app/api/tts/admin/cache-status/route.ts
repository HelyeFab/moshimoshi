import { NextRequest, NextResponse } from 'next/server'
import { ttsService } from '@/lib/tts/service'
import * as fs from 'fs'
import * as path from 'path'

interface VocabularyItem {
  id: string
  japanese: string
  reading: string
  meaning: string
  jlptLevel?: string
  partOfSpeech?: string[]
  examples?: Array<{
    japanese?: string
    reading?: string
    english?: string
  }>
  tags?: string[]
  lesson?: number
  chapter?: number
  textbook?: string
}

interface TextbookInfo {
  title: string
  cardCount: number
}

interface CacheStatusResponse {
  timestamp: string
  totalCacheEntries: number
  totalStorageBytes: number
  byTextbook: Record<
    string,
    {
      total: number
      cached: number
      coverage: number
    }
  >
}

/**
 * Load textbook index
 */
function loadTextbookIndex(): Record<string, TextbookInfo> {
  const indexPath = path.join(process.cwd(), 'src/data/textbooks/index.json')
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

  return {
    ...indexData.textbooks,
    ...indexData.vocabularySources,
  }
}

/**
 * Load vocabulary data for a specific textbook
 */
function loadTextbookVocabulary(textbookId: string): VocabularyItem[] {
  const vocabPath = path.join(process.cwd(), `src/data/textbooks/${textbookId}/all.json`)

  if (!fs.existsSync(vocabPath)) {
    return []
  }

  return JSON.parse(fs.readFileSync(vocabPath, 'utf-8'))
}

/**
 * Extract unique texts that need TTS from vocabulary item
 */
function extractTextsToSynthesize(item: VocabularyItem): Set<string> {
  const texts = new Set<string>()

  // Always include japanese text
  if (item.japanese && item.japanese.trim().length > 0) {
    texts.add(item.japanese.trim())
  }

  // Include reading if different from japanese
  if (
    item.reading &&
    item.reading.trim().length > 0 &&
    item.reading.trim() !== item.japanese.trim()
  ) {
    texts.add(item.reading.trim())
  }

  // Include example sentences (filter out trivial examples)
  if (item.examples && Array.isArray(item.examples)) {
    item.examples.forEach(example => {
      if (example.japanese && example.japanese.trim().length > 1) {
        texts.add(example.japanese.trim())
      }
    })
  }

  return texts
}

/**
 * Calculate expected texts for a textbook
 */
function calculateExpectedTexts(vocabulary: VocabularyItem[]): Set<string> {
  const allTexts = new Set<string>()

  vocabulary.forEach(item => {
    const texts = extractTextsToSynthesize(item)
    texts.forEach(text => allTexts.add(text))
  })

  return allTexts
}

/**
 * Count how many of the expected texts are cached
 */
async function countCachedTexts(expectedTexts: Set<string>): Promise<number> {
  let cachedCount = 0

  // Note: This is a simplified implementation
  // For production, consider batching or using a more efficient query
  const textsArray = Array.from(expectedTexts)

  // Check cache in batches to avoid overwhelming the system
  const batchSize = 100
  for (let i = 0; i < textsArray.length; i += batchSize) {
    const batch = textsArray.slice(i, i + batchSize)

    const results = await Promise.all(
      batch.map(async text => {
        try {
          const isCached = await ttsService.isCached(text, {
            voice: '23',
            speed: 0.85,
          })
          return isCached
        } catch (error) {
          return false
        }
      })
    )

    cachedCount += results.filter(Boolean).length
  }

  return cachedCount
}

export async function GET(request: NextRequest) {
  try {
    // Get overall cache stats
    const cacheStats = await ttsService.getCacheStats()

    // Load textbook index
    const textbooks = loadTextbookIndex()
    const textbookIds = Object.keys(textbooks)

    // Calculate coverage by textbook
    const byTextbook: Record<string, { total: number; cached: number; coverage: number }> = {}

    for (const textbookId of textbookIds) {
      try {
        const vocabulary = loadTextbookVocabulary(textbookId)

        if (vocabulary.length === 0) {
          byTextbook[textbookId] = {
            total: 0,
            cached: 0,
            coverage: 0,
          }
          continue
        }

        const expectedTexts = calculateExpectedTexts(vocabulary)
        const cachedCount = await countCachedTexts(expectedTexts)

        byTextbook[textbookId] = {
          total: expectedTexts.size,
          cached: cachedCount,
          coverage: expectedTexts.size > 0 ? (cachedCount / expectedTexts.size) * 100 : 0,
        }
      } catch (error) {
        console.error(`Failed to process textbook ${textbookId}:`, error)
        byTextbook[textbookId] = {
          total: 0,
          cached: 0,
          coverage: 0,
        }
      }
    }

    const response: CacheStatusResponse = {
      timestamp: new Date().toISOString(),
      totalCacheEntries: cacheStats.totalEntries,
      totalStorageBytes: cacheStats.totalSize,
      byTextbook,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Cache status error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve cache status',
        },
      },
      { status: 500 }
    )
  }
}
