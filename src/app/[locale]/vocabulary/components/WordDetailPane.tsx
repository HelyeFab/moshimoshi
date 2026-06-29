'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ScrollText, Info, Loader2, ArrowLeft } from 'lucide-react'
import AudioButton from '@/components/ui/AudioButton'
import AddToListButton from '@/components/lists/AddToListButton'
import ConjugationGrid from '@/components/conjugation/ConjugationGrid'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import FuriganaText from '@/components/grammar/FuriganaText'
import { useTTS } from '@/hooks/useTTS'
import { useFeature } from '@/hooks/useFeature'
import { useKanjiDetails } from '@/hooks/useKanjiDetails'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { getWordDetail } from '@/utils/dictionaryClient'
import { searchTatoebaExamples, type ExampleSentence } from '@/utils/tatoebaSearch'
import type { DictionaryEntryDetail, JapaneseWord } from '@/types/vocabulary'
import type { FeatureId } from '@/types/FeatureId'

const FEATURE_ID = 'word_lookup' as FeatureId

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
const posLabel = (c: string) => POS_LABELS[c] || c

export default function WordDetailPane({ wordId, onBack }: { wordId: string | null; onBack?: () => void }) {
  const { play, preload, loading: ttsLoading, playing: ttsPlaying, currentText } = useTTS({ cacheFirst: true })
  const { modalKanji, openKanjiDetails, closeKanjiDetails } = useKanjiDetails()
  const { checkAndTrack } = useFeature(FEATURE_ID)

  const [entry, setEntry] = useState<DictionaryEntryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [denied, setDenied] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'conjugations'>('details')
  const [examples, setExamples] = useState<ExampleSentence[]>([])
  const [loadingExamples, setLoadingExamples] = useState(false)
  const checkedRef = useRef<Set<string>>(new Set())

  const word: JapaneseWord | null = useMemo(() => {
    if (!entry) return null
    return {
      id: entry.id, kanji: entry.primaryKanji || undefined, kana: entry.primaryKana,
      romaji: '', meaning: entry.senses[0]?.glosses.join(', ') || '',
      type: entry.type, jlpt: entry.jlpt, partsOfSpeech: entry.partsOfSpeech,
    }
  }, [entry])
  const isConjugatable = useMemo(() => (word ? enhanceWordWithType(word).isConjugatable : false), [word])

  // Reset to details tab whenever the selected word changes
  useEffect(() => { setActiveTab('details') }, [wordId])

  // Gate (per word) + fetch
  useEffect(() => {
    if (!wordId) { setEntry(null); setNotFound(false); setDenied(false); return }
    let active = true
    setLoading(true); setNotFound(false); setDenied(false); setEntry(null); setExamples([])

    const run = async () => {
      // Entitlement: track once per word (dedupe across reselects)
      if (!checkedRef.current.has(wordId)) {
        try {
          const allowed = await checkAndTrack({ showUI: true })
          if (!allowed) { if (active) { setDenied(true); setLoading(false) } return }
          checkedRef.current.add(wordId)
        } catch {
          checkedRef.current.add(wordId) // fail open
        }
      }
      try {
        const data = await getWordDetail(wordId)
        if (!active) return
        if (!data) { setNotFound(true); return }
        setEntry(data)
        const texts = [data.primaryKanji, data.primaryKana].filter(Boolean)
        if (texts.length) preload(texts, { voice: '23', speed: 0.85 })
      } catch (e) {
        console.error('Word detail failed:', e)
        if (active) setNotFound(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [wordId, checkAndTrack, preload])

  // Examples
  useEffect(() => {
    if (!entry) return
    let active = true
    setLoadingExamples(true)
    const terms = [entry.primaryKanji, entry.primaryKana].filter(Boolean)
    ;(async () => {
      const found: ExampleSentence[] = []; const seen = new Set<string>()
      for (const term of terms) {
        if (found.length >= 5) break
        const results = await searchTatoebaExamples(term, 5 - found.length)
        for (const ex of results) if (!seen.has(ex.id)) { found.push(ex); seen.add(ex.id) }
      }
      if (active) {
        setExamples(found)
        const texts = found.map(e => e.japanese).filter(Boolean).slice(0, 5)
        if (texts.length) preload(texts, { voice: '23', speed: 0.85 })
      }
    })().catch(() => { if (active) setExamples([]) }).finally(() => { if (active) setLoadingExamples(false) })
    return () => { active = false }
  }, [entry, preload])

  const speak = async (text: string) => {
    try { await play(text, { voice: '23', speed: 0.85 }) }
    catch {
      if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 0.9; window.speechSynthesis.speak(u) }
    }
  }

  const BackBtn = onBack ? (
    <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 mb-3">
      <ArrowLeft className="w-4 h-4" /> Results
    </button>
  ) : null

  if (!wordId) {
    return (
      <div className="hidden lg:flex items-center justify-center h-full min-h-[300px] text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-dark-700 rounded-xl">
        Select a word to see its details
      </div>
    )
  }
  if (denied) {
    return <div className="p-6">{BackBtn}<p className="text-gray-700 dark:text-gray-300">You've reached today's lookup limit.</p></div>
  }
  if (loading) {
    return <div className="flex items-center justify-center py-24">{BackBtn}<Loader2 className="w-7 h-7 animate-spin text-primary-500" /></div>
  }
  if (notFound || !entry || !word) {
    return <div className="p-6">{BackBtn}<p className="text-gray-600 dark:text-gray-400">Word not found.</p></div>
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {BackBtn}

      {/* Headword */}
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-end flex-wrap gap-3">
              {entry.primaryKanji && (
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: '"Noto Sans JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif' }}>
                  {entry.primaryKanji.split('').map((ch, i) => /[一-龯]/.test(ch)
                    ? <span key={i} className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 inline-block hover:scale-110 transition" onClick={() => openKanjiDetails(ch)} title={`View ${ch}`}>{ch}</span>
                    : <span key={i}>{ch}</span>)}
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xl text-gray-700 dark:text-gray-300">{entry.primaryKana}</span>
                <AudioButton size="sm" onPlay={() => speak(entry.primaryKana)} loading={ttsLoading && currentText === entry.primaryKana} playing={ttsPlaying && currentText === entry.primaryKana} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {entry.common && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Common</span>}
              {entry.jlpt && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{entry.jlpt}</span>}
              {entry.freqBand && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Freq {entry.freqBand}</span>}
            </div>
            {(entry.kanji.length > 1 || entry.kana.length > 1) && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Other forms: {[...entry.kanji.slice(entry.primaryKanji ? 1 : 0), ...entry.kana.slice(1)].map(v => v.text).filter(Boolean).join('、')}
              </div>
            )}
          </div>
          <AddToListButton
            content={entry.primaryKanji || entry.primaryKana}
            type={isConjugatable ? 'verbAdj' : 'word'}
            metadata={{ reading: entry.primaryKana, meaning: word.meaning, jlptLevel: entry.jlpt ? parseInt(entry.jlpt.replace('N', '')) : undefined }}
            variant="bookmark" size="medium"
          />
        </div>
      </div>

      {/* Tabs */}
      {isConjugatable && (
        <div className="flex border-b border-gray-200 dark:border-dark-700">
          <button onClick={() => setActiveTab('details')} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'details' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
            <Info className="w-4 h-4" /> Meanings
          </button>
          <button onClick={() => setActiveTab('conjugations')} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'conjugations' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
            <ScrollText className="w-4 h-4" /> Conjugations
          </button>
        </div>
      )}

      {activeTab === 'conjugations' && isConjugatable ? (
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-5">
          <ConjugationGrid word={word} showFurigana />
        </div>
      ) : (
        <>
          {/* Meanings — numbered, grouped by POS */}
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-5">
            <ol className="space-y-2">
              {(() => {
                let lastPos = ''
                return entry.senses.map((s, i) => {
                  const posKey = s.partsOfSpeech.join(',')
                  const showPos = posKey !== lastPos; lastPos = posKey
                  return (
                    <li key={i}>
                      {showPos && s.partsOfSpeech.length > 0 && (
                        <div className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-400 font-semibold mt-3 mb-1">{s.partsOfSpeech.map(posLabel).join(' · ')}</div>
                      )}
                      <div className="flex gap-3">
                        <span className="text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}.</span>
                        <div className="flex-1">
                          <span className="text-gray-800 dark:text-gray-200">{s.glosses.join('; ')}</span>
                          {(s.field?.length || s.misc?.length) ? (
                            <span className="ml-2 inline-flex gap-1 flex-wrap">
                              {[...(s.field || []), ...(s.misc || [])].map((tg, k) => (
                                <span key={k} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400">{tg}</span>
                              ))}
                            </span>
                          ) : null}
                          {s.info?.length ? <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{s.info.join('; ')}</div> : null}
                        </div>
                      </div>
                    </li>
                  )
                })
              })()}
            </ol>
          </div>

          {/* Examples */}
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Example Sentences</h3>
            {loadingExamples ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading…</span></div>
            ) : examples.length ? (
              <div className="space-y-2">
                {examples.map((ex, i) => (
                  <div key={ex.id || i} className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg flex items-start gap-2">
                    <div className="flex-1">
                      <FuriganaText text={ex.japanese} showFurigana as="div" className="text-gray-900 dark:text-gray-100 font-medium mb-1" />
                      {ex.english && <p className="text-gray-600 dark:text-gray-400 text-sm">{ex.english}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <AddToListButton content={ex.japanese} type="sentence" metadata={{ meaning: ex.english || '', notes: `Example for ${entry.primaryKanji || entry.primaryKana}` }} variant="bookmark" size="small" />
                      <AudioButton size="sm" onPlay={() => speak(ex.japanese)} loading={ttsLoading && currentText === ex.japanese} playing={ttsPlaying && currentText === ex.japanese} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Examples from Tatoeba</p>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">No examples found for this word.</p>
            )}
          </div>
        </>
      )}

      <KanjiDetailsModal kanji={modalKanji} isOpen={!!modalKanji} onClose={closeKanjiDetails} />
    </motion.div>
  )
}
