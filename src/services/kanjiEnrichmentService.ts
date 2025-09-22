/**
 * Service for enriching kanji with vocabulary examples and sentences
 * Uses JMDict for vocabulary and Tatoeba for example sentences
 */

import fs from 'fs'
import path from 'path'
import { KanjiWithExamples } from '@/app/tools/kanji-mastery/learn/LearnContent'

interface JMDictEntry {
  word?: string
  reading?: string
  sense?: Array<{
    gloss: Array<{ text: string }>
  }>
}

interface TatoebaSentence {
  japanese: string
  english: string
}

class KanjiEnrichmentService {
  private jmdictData: JMDictEntry[] | null = null
  private tatoebaData: TatoebaSentence[] | null = null
  private loaded = false

  /**
   * Load JMDict data (vocabulary)
   */
  private loadJMDict(): JMDictEntry[] {
    if (this.jmdictData) return this.jmdictData

    try {
      const dictPath = path.join(process.cwd(), 'src/data/dictionary/jmdict-eng-common.json')
      const content = fs.readFileSync(dictPath, 'utf8')
      this.jmdictData = JSON.parse(content).words || []
      console.log(`Loaded ${this.jmdictData.length} JMDict entries`)
    } catch (error) {
      console.error('Failed to load JMDict:', error)
      this.jmdictData = []
    }

    return this.jmdictData
  }

  /**
   * Load Tatoeba sentences
   */
  private loadTatoeba(): TatoebaSentence[] {
    if (this.tatoebaData) return this.tatoebaData

    this.tatoebaData = []

    try {
      const tatoebaDir = path.join(process.cwd(), 'src/data/sentences/tatoeba')
      // Load just first few files for performance in development
      const files = fs.readdirSync(tatoebaDir)
        .filter(f => f.startsWith('examples-') && f.endsWith('.json'))
        .slice(0, 20) // Limit to first 20 files

      for (const file of files) {
        try {
          const filePath = path.join(tatoebaDir, file)
          const content = fs.readFileSync(filePath, 'utf8')
          const data = JSON.parse(content)

          if (Array.isArray(data)) {
            data.forEach(item => {
              if (item.japanese && item.english) {
                this.tatoebaData!.push({
                  japanese: item.japanese,
                  english: item.english
                })
              }
            })
          }
        } catch (err) {
          // Skip failed files
        }
      }

      console.log(`Loaded ${this.tatoebaData.length} Tatoeba sentences`)
    } catch (error) {
      console.error('Failed to load Tatoeba:', error)
    }

    return this.tatoebaData
  }

  /**
   * Find vocabulary words containing a specific kanji
   */
  private findVocabularyForKanji(kanji: string, limit = 3): Array<{
    word: string
    reading: string
    meaning: string
  }> {
    const jmdict = this.loadJMDict()
    const results: Array<{ word: string; reading: string; meaning: string }> = []

    for (const entry of jmdict) {
      if (entry.word && entry.word.includes(kanji)) {
        const meaning = entry.sense?.[0]?.gloss?.[0]?.text || 'No meaning available'
        results.push({
          word: entry.word,
          reading: entry.reading || '',
          meaning
        })

        if (results.length >= limit) break
      }
    }

    return results
  }

  /**
   * Find example sentences containing a specific kanji
   */
  private findSentencesForKanji(kanji: string, meaning: string, limit = 2): Array<{
    japanese: string
    english: string
  }> {
    const sentences = this.loadTatoeba()
    const results: Array<{ japanese: string; english: string }> = []

    // First try to find sentences with the kanji
    for (const sentence of sentences) {
      if (sentence.japanese.includes(kanji)) {
        results.push(sentence)
        if (results.length >= limit) break
      }
    }

    // If not enough, try to find sentences with the meaning
    if (results.length < limit) {
      const meaningLower = meaning.toLowerCase()
      for (const sentence of sentences) {
        if (sentence.english.toLowerCase().includes(meaningLower) &&
            !results.some(r => r.japanese === sentence.japanese)) {
          results.push(sentence)
          if (results.length >= limit) break
        }
      }
    }

    return results
  }

  /**
   * Enrich a list of kanji with vocabulary and sentences
   */
  async enrichKanjiList(kanjiList: KanjiWithExamples[]): Promise<KanjiWithExamples[]> {
    return kanjiList.map(kanji => {
      // Get vocabulary examples
      const vocabulary = this.findVocabularyForKanji(kanji.kanji)

      // Get example sentences
      const sentences = this.findSentencesForKanji(kanji.kanji, kanji.meaning)

      return {
        ...kanji,
        examples: vocabulary.length > 0 ? vocabulary : [
          {
            word: kanji.kanji + '語',
            reading: 'example',
            meaning: `Example with ${kanji.meaning}`
          }
        ],
        sentences: sentences.length > 0 ? sentences : [
          {
            japanese: `これは${kanji.kanji}の例文です。`,
            english: `This is an example sentence with ${kanji.kanji}.`
          }
        ]
      }
    })
  }
}

// Export singleton instance
export const kanjiEnrichmentService = new KanjiEnrichmentService()