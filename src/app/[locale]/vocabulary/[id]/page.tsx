'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, Tag, ScrollText, Info, Loader2, ArrowLeft } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { LoadingOverlay } from '@/components/ui/Loading'
import AudioButton from '@/components/ui/AudioButton'
import AddToListButton from '@/components/lists/AddToListButton'
import { ConjugationDisplay } from '@/components/conjugation/ConjugationDisplay'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import FuriganaText from '@/components/grammar/FuriganaText'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'
import { useFeature } from '@/hooks/useFeature'
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { getWordDetail } from '@/utils/dictionaryClient'
import { searchTatoebaExamples, type ExampleSentence } from '@/utils/tatoebaSearch'
import type { DictionaryEntryDetail, JapaneseWord } from '@/types/vocabulary'
import type { FeatureId } from '@/types/FeatureId'

const FEATURE_ID = 'word_lookup' as FeatureId

// Friendly labels for the most common JMdict part-of-speech codes.
const POS_LABELS: Record<string, string> = {
  n: 'Noun', 'n-suf': 'Noun (suffix)', 'n-pref': 'Noun (prefix)', 'n-adv': 'Adverbial noun',
  pn: 'Pronoun', adv: 'Adverb', 'adv-to': 'Adverb (to)',
  'adj-i': 'I-adjective', 'adj-na': 'Na-adjective', 'adj-no': 'No-adjective', 'adj-f': 'Pre-noun adjectival',
  v1: 'Ichidan verb', 'v1-s': 'Ichidan verb (kureru)',
  v5u: 'Godan verb (u)', v5k: 'Godan verb (ku)', 'v5k-s': 'Godan verb (iku/yuku)',
  v5g: 'Godan verb (gu)', v5s: 'Godan verb (su)', v5t: 'Godan verb (tsu)', v5n: 'Godan verb (nu)',
  v5b: 'Godan verb (bu)', v5m: 'Godan verb (mu)', v5r: 'Godan verb (ru)', 'v5r-i': 'Godan verb (ru, irregular)', v5aru: 'Godan verb (aru)',
  vs: 'Suru verb', 'vs-i': 'Suru verb (included)', 'vs-s': 'Suru verb (special)', vk: 'Kuru verb', vz: 'Ichidan verb (zuru)',
  vt: 'Transitive', vi: 'Intransitive', 'aux-v': 'Auxiliary verb', aux: 'Auxiliary',
  exp: 'Expression', int: 'Interjection', conj: 'Conjunction', prt: 'Particle',
  ctr: 'Counter', pref: 'Prefix', suf: 'Suffix', num: 'Numeric',
}
const posLabel = (code: string) => POS_LABELS[code] || code

function VocabularyWordContent() {
  const params = useParams()
  const router = useRouter()
  const id = decodeURIComponent((params.id as string) || '')
  const locale = (params.locale as string) || 'en'
  const { strings, t } = useI18n()

  const { play, preload, loading: ttsLoading, playing: ttsPlaying, currentText } = useTTS({ cacheFirst: true })
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()

  const [entry, setEntry] = useState<DictionaryEntryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'conjugations'>('details')
  const [examples, setExamples] = useState<ExampleSentence[]>([])
  const [loadingExamples, setLoadingExamples] = useState(false)

  // Entitlement gating (same word_lookup feature the modal used)
  const { checkAndTrack } = useFeature(FEATURE_ID)
  const [isAllowed, setIsAllowed] = useState(false)
  const [isCheckingEntitlement, setIsCheckingEntitlement] = useState(true)
  const checkInProgressRef = useRef(false)

  // Build a JapaneseWord view for the conjugation engine / add-to-list / type detection.
  const word: JapaneseWord | null = useMemo(() => {
    if (!entry) return null
    return {
      id: entry.id,
      kanji: entry.primaryKanji || undefined,
      kana: entry.primaryKana,
      romaji: '',
      meaning: entry.senses[0]?.glosses.join(', ') || '',
      type: entry.type,
      jlpt: entry.jlpt,
      partsOfSpeech: entry.partsOfSpeech,
    }
  }, [entry])

  const isConjugatable = useMemo(() => (word ? enhanceWordWithType(word).isConjugatable : false), [word])

  // Entitlement check on mount / id change
  useEffect(() => {
    if (!id) return
    if (checkInProgressRef.current) return
    const run = async () => {
      checkInProgressRef.current = true
      setIsCheckingEntitlement(true)
      try {
        const allowed = await checkAndTrack({ showUI: true })
        setIsAllowed(allowed)
      } catch (e) {
        console.error('[VocabularyWord] entitlement check failed:', e)
        setIsAllowed(true) // fail open for UX (mirrors the old modal)
      } finally {
        setIsCheckingEntitlement(false)
        checkInProgressRef.current = false
      }
    }
    run()
  }, [id, checkAndTrack])

  // Fetch the entry once allowed
  useEffect(() => {
    if (!id || !isAllowed) return
    let active = true
    setLoading(true)
    getWordDetail(id)
      .then(data => {
        if (!active) return
        if (!data) { setNotFound(true); return }
        setEntry(data)
        const texts = [data.primaryKanji, data.primaryKana].filter(Boolean)
        if (texts.length) preload(texts, { voice: '23', speed: 0.85 })
      })
      .catch(e => { if (active) { console.error('Word detail failed:', e); setNotFound(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isAllowed, preload])

  // Load example sentences for the headword
  useEffect(() => {
    if (!entry) return
    let active = true
    setLoadingExamples(true)
    const terms = [entry.primaryKanji, entry.primaryKana].filter(Boolean)
    ;(async () => {
      const found: ExampleSentence[] = []
      const seen = new Set<string>()
      for (const term of terms) {
        if (found.length >= 5) break
        const results = await searchTatoebaExamples(term, 5 - found.length)
        for (const ex of results) {
          if (!seen.has(ex.id)) { found.push(ex); seen.add(ex.id) }
        }
      }
      if (active) {
        setExamples(found)
        const texts = found.map(e => e.japanese).filter(Boolean).slice(0, 5)
        if (texts.length) preload(texts, { voice: '23', speed: 0.85 })
      }
    })().catch(() => { if (active) setExamples([]) })
      .finally(() => { if (active) setLoadingExamples(false) })
    return () => { active = false }
  }, [entry, preload])

  const handleSpeak = async (text: string) => {
    try {
      await play(text, { voice: '23', speed: 0.85 })
    } catch {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'ja-JP'; u.rate = 0.9
        window.speechSynthesis.speak(u)
      }
    }
  }

  if (isCheckingEntitlement) {
    return <LoadingOverlay isLoading message={t('common.loading') || 'Loading…'} showDoshi fullScreen />
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-gray-700 dark:text-gray-300">
          {"You've reached today's lookup limit."}
        </p>
        <button onClick={() => router.push(`/${locale}/vocabulary`)} className="px-4 py-2 bg-primary-500 text-white rounded-lg">
          {strings.common?.back || 'Back to search'}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block"><Navbar showUserMenu /></div>
      <PageHeader
        title={strings.vocabulary?.title || 'Vocabulary'}
        description={strings.vocabulary?.description || 'Dictionary entry'}
        backHref={`/${locale}/vocabulary`}
      />

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : notFound || !entry || !word ? (
          <div className="text-center py-24 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{'Word not found.'}</p>
            <button onClick={() => router.push(`/${locale}/vocabulary`)} className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400">
              <ArrowLeft className="w-4 h-4" /> {strings.common?.back || 'Back to search'}
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Headword card */}
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-end flex-wrap gap-4">
                    {entry.primaryKanji && (
                      <span className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: '"Noto Sans JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif' }}>
                        {entry.primaryKanji.split('').map((char, idx) => {
                          const isKanji = /[一-龯]/.test(char)
                          return isKanji ? (
                            <span key={idx} className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-block hover:scale-110" onClick={() => openKanjiDetails(char)} title={`View ${char}`}>{char}</span>
                          ) : <span key={idx}>{char}</span>
                        })}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-2xl text-gray-700 dark:text-gray-300">{entry.primaryKana}</span>
                      <AudioButton size="sm" onPlay={() => handleSpeak(entry.primaryKana)} loading={ttsLoading && currentText === entry.primaryKana} playing={ttsPlaying && currentText === entry.primaryKana} />
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {entry.common && <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Common</span>}
                    {entry.jlpt && <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{entry.jlpt}</span>}
                    {entry.freqBand && <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Freq band {entry.freqBand}</span>}
                  </div>

                  {/* Variant writings */}
                  {(entry.kanji.length > 1 || entry.kana.length > 1) && (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      {'Other forms'}:{' '}
                      {[...entry.kanji.slice(entry.primaryKanji ? 1 : 0), ...entry.kana.slice(1)]
                        .map(v => v.text).filter(Boolean).join('、')}
                    </div>
                  )}
                </div>

                <AddToListButton
                  content={entry.primaryKanji || entry.primaryKana}
                  type={isConjugatable ? 'verbAdj' : 'word'}
                  metadata={{ reading: entry.primaryKana, meaning: word.meaning, jlptLevel: entry.jlpt ? parseInt(entry.jlpt.replace('N', '')) : undefined }}
                  variant="bookmark"
                  size="medium"
                />
              </div>
            </div>

            {/* Tabs */}
            {isConjugatable && (
              <div className="flex border-b border-gray-200 dark:border-dark-700">
                <button onClick={() => setActiveTab('details')} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
                  <Info className="w-4 h-4" /> {t('vocabulary.tabs.details') || 'Details'}
                </button>
                <button onClick={() => setActiveTab('conjugations')} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'conjugations' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
                  <ScrollText className="w-4 h-4" /> {t('vocabulary.tabs.conjugations') || 'Conjugations'}
                </button>
              </div>
            )}

            {activeTab === 'conjugations' && isConjugatable ? (
              <ConjugationDisplay word={word} showFurigana />
            ) : (
              <>
                {/* Meanings — numbered, grouped by part of speech */}
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{'Meanings'}</h2>
                  <ol className="space-y-3">
                    {(() => {
                      let lastPos = ''
                      return entry.senses.map((sense, i) => {
                        const posKey = sense.partsOfSpeech.join(',')
                        const showPos = posKey !== lastPos
                        lastPos = posKey
                        return (
                          <li key={i}>
                            {showPos && sense.partsOfSpeech.length > 0 && (
                              <div className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-400 font-semibold mt-3 mb-1">
                                {sense.partsOfSpeech.map(posLabel).join(' · ')}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <span className="text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}.</span>
                              <div className="flex-1">
                                <span className="text-gray-800 dark:text-gray-200">{sense.glosses.join('; ')}</span>
                                {(sense.field?.length || sense.misc?.length) && (
                                  <span className="ml-2 inline-flex gap-1">
                                    {[...(sense.field || []), ...(sense.misc || [])].map((tg, k) => (
                                      <span key={k} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400">{tg}</span>
                                    ))}
                                  </span>
                                )}
                                {sense.info?.length ? <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{sense.info.join('; ')}</div> : null}
                              </div>
                            </div>
                          </li>
                        )
                      })
                    })()}
                  </ol>
                </div>

                {/* Example sentences (Tatoeba) */}
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> {'Example Sentences'}
                  </h2>
                  {loadingExamples ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">{strings.common?.loading || 'Loading…'}</span>
                    </div>
                  ) : examples.length ? (
                    <div className="space-y-3">
                      {examples.map((ex, i) => (
                        <div key={ex.id || i} className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg flex items-start gap-2">
                          <div className="flex-1">
                            <FuriganaText text={ex.japanese} showFurigana as="div" className="text-gray-900 dark:text-gray-100 font-medium mb-1" />
                            {ex.english && <p className="text-gray-600 dark:text-gray-400 text-sm">{ex.english}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <AddToListButton content={ex.japanese} type="sentence" metadata={{ meaning: ex.english || '', notes: `Example for ${entry.primaryKanji || entry.primaryKana}` }} variant="bookmark" size="small" />
                            <AudioButton size="sm" onPlay={() => handleSpeak(ex.japanese)} loading={ttsLoading && currentText === ex.japanese} playing={ttsPlaying && currentText === ex.japanese} />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Examples from Tatoeba</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">{'No examples found for this word.'}</p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      <KanjiDetailsModal kanji={modalKanji} isOpen={!!modalKanji} onClose={closeKanjiDetails} />
      <MobileNavSpacer />
    </div>
  )
}

export default function VocabularyWordPage() {
  return (
    <Suspense fallback={<LoadingOverlay isLoading message="Loading…" showDoshi fullScreen />}>
      <VocabularyWordContent />
    </Suspense>
  )
}
