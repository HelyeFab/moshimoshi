import type { OverrideReadingType } from '@/data/kanjiVocabularyOverrides'

export interface ProposedVocabularyValidation {
  level: 'N3' | 'N2' | 'N1'
  kanji: string
  reading: string
  readingType: OverrideReadingType
  proposedWord: string
  proposedWordReading: string
  proposedMeaning: string
  reason: string
}

export const proposedVocabularyValidations: ProposedVocabularyValidation[] = [
  {
    level: 'N3',
    kanji: '術',
    reading: 'じゅつ',
    readingType: 'onyomi',
    proposedWord: '技術',
    proposedWordReading: 'ぎじゅつ',
    proposedMeaning: 'technology; technique',
    reason: 'Tests whether the heuristic drifts toward surgery/arts vocabulary instead of the broad modern teaching pick.',
  },
  {
    level: 'N3',
    kanji: '費',
    reading: 'ひ',
    readingType: 'onyomi',
    proposedWord: '費用',
    proposedWordReading: 'ひよう',
    proposedMeaning: 'cost; expense',
    reason: 'Tests whether business-jargon compounds outrank the more transparent practical word.',
  },
  {
    level: 'N2',
    kanji: '乳',
    reading: 'にゅう',
    readingType: 'onyomi',
    proposedWord: '牛乳',
    proposedWordReading: 'ぎゅうにゅう',
    proposedMeaning: "(cow's) milk",
    reason: 'Tests whether the heuristic still surfaces anatomical terms before the clear everyday word.',
  },
  {
    level: 'N2',
    kanji: '準',
    reading: 'じゅん',
    readingType: 'onyomi',
    proposedWord: '準備',
    proposedWordReading: 'じゅんび',
    proposedMeaning: 'preparation',
    reason: 'Tests whether formal alternatives outrank the most practical high-frequency word.',
  },
  {
    level: 'N2',
    kanji: '複',
    reading: 'ふく',
    readingType: 'onyomi',
    proposedWord: '複雑',
    proposedWordReading: 'ふくざつ',
    proposedMeaning: 'complex; complicated',
    reason: 'Tests whether the heuristic already picks the everyday adjective or drifts toward technical compounds.',
  },
  {
    level: 'N1',
    kanji: '乳',
    reading: 'にゅう',
    readingType: 'onyomi',
    proposedWord: '牛乳',
    proposedWordReading: 'ぎゅうにゅう',
    proposedMeaning: "(cow's) milk",
    reason: 'N1 inherits the same concern as N2 and should only override if the heuristic still misfires.',
  },
]

export function getProposalValidationsForLevel(level: 'N3' | 'N2' | 'N1') {
  return proposedVocabularyValidations.filter(item => item.level === level)
}
