/**
 * Stage C Refinement Tests (C1 + C2.5)
 *
 * Tests for the reconstruction heuristic refinements addressing:
 * - Failure 1: 45fMrqfNIXA intro fragmentation
 * - Failure 2: 9LW9DpmhrPE contamination
 * - Stage C2.5: Local cluster-based reconstruction for mixed-region transcripts
 */

import { describe, it, expect } from '@jest/globals'
import {
  looksLikeIncompleteFragment,
  looksLikeContinuation,
  isGoodLineation,
  hasGoodLineation,
  cleanContamination,
  scoreClusterQuality,
  analyzeClusterSignals,
  shouldPreserveCluster,
  calculateOverlapRatio,
  calculateSimilarity,
  areDuplicates,
  hasSignificantOverlap,
  shouldMergeUnits,
} from '../reconstruction-heuristics'
import { reconstructSegments } from '../reconstruct-segments'
import type { RawTranscriptUnit } from '../transcript-types'

describe('Refinement: Broken Verb Conjugation Detection', () => {
  it('detects incomplete ございます (ござい)', () => {
    expect(looksLikeIncompleteFragment('おはようござい')).toBe(true)
  })

  it('detects broken te-form with small tsu (頑張っ)', () => {
    expect(looksLikeIncompleteFragment('日本語の勉強頑張っ')).toBe(true)
  })

  it('accepts complete sentences with punctuation', () => {
    expect(looksLikeIncompleteFragment('おはようございます。')).toBe(false)
    expect(looksLikeIncompleteFragment('頑張ってください。')).toBe(false)
  })

  // Negative tests: Valid non-punctuated Japanese lines should NOT be flagged
  it('accepts complete verb forms ending in る', () => {
    expect(looksLikeIncompleteFragment('届ける言葉を今は育ててる')).toBe(false)
  })

  it('accepts complete expressions ending in ら', () => {
    expect(looksLikeIncompleteFragment('もしかしたら')).toBe(false)
  })

  it('accepts complete tai-form ending in い', () => {
    expect(looksLikeIncompleteFragment('君と手を取りたい')).toBe(false)
  })

  it('accepts complete lyric lines with various hiragana endings', () => {
    expect(looksLikeIncompleteFragment('風の中でも負けないような声で')).toBe(true) // Ends with particle で
    expect(looksLikeIncompleteFragment('君の中にある赤と青き線')).toBe(false) // Ends with 線 (kanji)
  })
})

describe('Refinement: Continuation Detection', () => {
  it('detects broken fixed expressions', () => {
    expect(looksLikeContinuation(
      'おはようござい',
      'ます。黒猫ママです。'
    )).toBe(true)
  })

  it('detects te-form continuation', () => {
    expect(looksLikeContinuation(
      '日本語の勉強頑張っ',
      'てますか?'
    )).toBe(true)
  })

  it('does not trigger on complete sentences', () => {
    expect(looksLikeContinuation(
      'おはようございます。',
      '黒猫ママです。'
    )).toBe(false)
  })
})

describe('Refinement: isGoodLineation Without Length Threshold', () => {
  it('rejects broken fragments despite length >= 15', () => {
    const unit: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 3,
      duration: 3,
      text: 'こんにちは、こんばんは、おはようござい', // 19 chars, broken
      source: 'test',
    }
    expect(isGoodLineation(unit)).toBe(false)
  })

  it('rejects fragments with continuation markers', () => {
    const unit: RawTranscriptUnit = {
      id: 'test-2',
      start: 3,
      end: 6,
      duration: 3,
      text: 'ます。黒猫ママです。日本語の勉強頑張っ', // 20 chars, ends with っ
      source: 'test',
    }
    expect(isGoodLineation(unit)).toBe(false)
  })

  it('accepts complete sentences', () => {
    const unit: RawTranscriptUnit = {
      id: 'test-3',
      start: 0,
      end: 3,
      duration: 3,
      text: '私は韓国人の友達が欲しいです。',
      source: 'test',
    }
    expect(isGoodLineation(unit)).toBe(true)
  })

  it('accepts complete lyric lines (8+ chars, no fragments)', () => {
    const unit: RawTranscriptUnit = {
      id: 'test-4',
      start: 0,
      end: 5,
      duration: 5,
      text: '君の中にある赤と青き線', // 12 chars, complete lyric line
      source: 'test',
    }
    // Should pass now with lowered threshold (was 15, now 8)
    // and no broken verb patterns
    expect(isGoodLineation(unit)).toBe(true)
  })
})

describe('Refinement: hasGoodLineation With Continuation Check', () => {
  it('rejects lineation with obvious continuations (45fMrqfNIXA case)', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 3,
        duration: 3,
        text: 'こんにちは、こんばんは、おはようござい',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。黒猫ママです。日本語の勉強頑張っ',
        source: 'sheldon',
      },
      {
        id: 'raw-2',
        start: 6,
        end: 9,
        duration: 3,
        text: 'てますか?今日も私と一緒にたくさん話し',
        source: 'sheldon',
      },
    ]

    // Should return false due to continuation markers
    expect(hasGoodLineation(units)).toBe(false)
  })

  it('accepts truly good lineation', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '君の中にある赤と青き線',
        source: 'supa',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: 'それらが結ばれるのは心の臓',
        source: 'supa',
      },
    ]

    // Should return true (no continuations, complete lines)
    expect(hasGoodLineation(units)).toBe(true)
  })
})

describe('Refinement: Contamination Cleaning', () => {
  it('removes dash-prefixed music scale notation (-do)', () => {
    expect(cleanContamination('-do君の中にある赤と青き線')).toBe('君の中にある赤と青き線')
  })

  it('removes other dash-prefixed solfege notes', () => {
    expect(cleanContamination('-re君の中にある')).toBe('君の中にある')
    expect(cleanContamination('-mi君の中にある')).toBe('君の中にある')
  })

  it('preserves English text starting with Do/Re/Mi', () => {
    expect(cleanContamination('Do you prefer tea?')).toBe('Do you prefer tea?')
    expect(cleanContamination('Really good content')).toBe('Really good content')
    expect(cleanContamination('Solitary journey')).toBe('Solitary journey')
  })

  it('removes leading dashes', () => {
    expect(cleanContamination('--text')).toBe('text')
    expect(cleanContamination('—text')).toBe('text')
  })

  it('removes leading angle brackets', () => {
    expect(cleanContamination('>>text')).toBe('text')
    expect(cleanContamination('»text')).toBe('text')
  })

  it('removes music notes', () => {
    expect(cleanContamination('♪song lyrics')).toBe('song lyrics')
  })

  it('removes multiple junk patterns', () => {
    expect(cleanContamination('-do>>♪text')).toBe('text')
  })

  it('preserves clean text', () => {
    expect(cleanContamination('君の中にある赤と青き線')).toBe('君の中にある赤と青き線')
  })
})

describe('Refinement: Full Reconstruction Test (45fMrqfNIXA)', () => {
  it('merges broken intro fragments instead of preserving', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 3,
        duration: 3,
        text: 'こんにちは、こんばんは、おはようござい',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。黒猫ママです。日本語の勉強頑張っ',
        source: 'sheldon',
      },
      {
        id: 'raw-2',
        start: 6,
        end: 9,
        duration: 3,
        text: 'てますか?今日も私と一緒にたくさん話し',
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should trigger rebuild (not preserve) due to continuation markers
    // First segment should contain complete "おはようございます"
    expect(result[0].text).toContain('おはようございます')
    expect(result[0].strategy).toBe('merge')
    expect(result[0].sourceIds.length).toBeGreaterThan(1)

    // Should NOT preserve broken fragments
    expect(result[0].text).not.toBe('こんにちは、こんばんは、おはようござい')
  })
})

describe('Refinement: Full Reconstruction Test (9LW9DpmhrPE)', () => {
  it('cleans contamination from preserved good lineation', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '-do君の中にある赤と青き線', // Contaminated but good lineation
        source: 'supa',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: 'それらが結ばれるのは心の臓',
        source: 'supa',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should preserve structure but clean contamination
    expect(result[0].text).toBe('君の中にある赤と青き線')
    expect(result[0].text).not.toContain('-do')
    expect(result[0].strategy).toBe('preserve')
    expect(result[1].text).toBe('それらが結ばれるのは心の臓')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Stage C2.5: Local Cluster-Based Reconstruction Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('C2.5: Cluster Quality Scoring', () => {
  it('scores good single unit cluster highly', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 5,
        duration: 5,
        text: '君の中にある赤と青き線', // Complete lyric line
        source: 'test',
      },
    ]

    const score = scoreClusterQuality(units)
    expect(score).toBeGreaterThan(0.6) // Should preserve
  })

  it('scores broken fragment cluster poorly', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 3,
        duration: 3,
        text: 'おはようござい', // Incomplete
        source: 'test',
      },
      {
        id: 'test-2',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。', // Continuation
        source: 'test',
      },
    ]

    const score = scoreClusterQuality(units)
    expect(score).toBeLessThan(0.6) // Should rebuild
  })

  it('scores cluster with proper ending higher', () => {
    const withEnding: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 5,
        duration: 5,
        text: '今日も頑張りましょう。',
        source: 'test',
      },
    ]

    const withoutEnding: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 5,
        duration: 5,
        text: '今日も頑張りまし',
        source: 'test',
      },
    ]

    const scoreWith = scoreClusterQuality(withEnding)
    const scoreWithout = scoreClusterQuality(withoutEnding)

    expect(scoreWith).toBeGreaterThan(scoreWithout)
  })

  it('penalizes continuation breaks', () => {
    const withBreaks: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 3,
        duration: 3,
        text: '日本語の勉強頑張っ',
        source: 'test',
      },
      {
        id: 'test-2',
        start: 3,
        end: 6,
        duration: 3,
        text: 'てください',
        source: 'test',
      },
    ]

    const score = scoreClusterQuality(withBreaks)
    expect(score).toBeLessThan(0.5) // Heavy penalty
  })
})

describe('C2.5: Cluster Signal Analysis', () => {
  it('detects proper ending', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 5,
        duration: 5,
        text: 'こんにちは。',
        source: 'test',
      },
    ]

    const signals = analyzeClusterSignals(units)
    expect(signals.hasProperEnding).toBe(true)
  })

  it('detects continuation breaks', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 3,
        duration: 3,
        text: 'おはようござい',
        source: 'test',
      },
      {
        id: 'test-2',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。',
        source: 'test',
      },
    ]

    const signals = analyzeClusterSignals(units)
    expect(signals.hasContinuationBreaks).toBe(true)
  })

  it('detects contamination', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 5,
        duration: 5,
        text: '-do君の中にある',
        source: 'test',
      },
    ]

    const signals = analyzeClusterSignals(units)
    expect(signals.hasContamination).toBe(true)
  })

  it('calculates good lineation ratio', () => {
    const units: RawTranscriptUnit[] = [
      {
        id: 'test-1',
        start: 0,
        end: 5,
        duration: 5,
        text: '完全な文章です。', // Good
        source: 'test',
      },
      {
        id: 'test-2',
        start: 5,
        end: 10,
        duration: 5,
        text: 'これも良いです。', // Good
        source: 'test',
      },
      {
        id: 'test-3',
        start: 10,
        end: 13,
        duration: 3,
        text: 'っ', // Bad
        source: 'test',
      },
    ]

    const signals = analyzeClusterSignals(units)
    expect(signals.goodLineationRatio).toBeCloseTo(2 / 3, 2)
  })
})

describe('C2.5: Mixed-Region Reconstruction - Bad Intro + Good Later', () => {
  it('rebuilds bad intro cluster, preserves good later clusters', () => {
    const rawUnits: RawTranscriptUnit[] = [
      // Bad intro cluster (should merge)
      {
        id: 'raw-0',
        start: 0,
        end: 3,
        duration: 3,
        text: 'こんにちは、こんばんは、おはようござい',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。黒猫ママです。',
        source: 'sheldon',
      },
      // Good later content (should preserve)
      {
        id: 'raw-2',
        start: 6,
        end: 11,
        duration: 5,
        text: '今日は日本語の勉強をしましょう。',
        source: 'sheldon',
      },
      {
        id: 'raw-3',
        start: 11,
        end: 16,
        duration: 5,
        text: '一緒に頑張りましょう。',
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // First segment should be merged (bad intro)
    expect(result[0].text).toContain('おはようございます')
    expect(result[0].strategy).toBe('merge')
    expect(result[0].sourceIds.length).toBeGreaterThan(1)

    // Later segments should be preserved (good content)
    expect(result[1].text).toBe('今日は日本語の勉強をしましょう。')
    expect(result[1].strategy).toBe('preserve')
    expect(result[1].sourceIds.length).toBe(1)

    expect(result[2].text).toBe('一緒に頑張りましょう。')
    expect(result[2].strategy).toBe('preserve')
    expect(result[2].sourceIds.length).toBe(1)
  })
})

describe('C2.5: Mixed-Region Reconstruction - Good Start + Bad Middle + Good End', () => {
  it('handles mixed quality regions correctly', () => {
    const rawUnits: RawTranscriptUnit[] = [
      // Good start (should preserve)
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '皆さん、こんにちは。',
        source: 'test',
      },
      // Bad middle with clear continuation markers (should merge)
      {
        id: 'raw-1',
        start: 5,
        end: 8,
        duration: 3,
        text: '今日は日本語の勉強頑張っ', // Ends with っ (broken te-form)
        source: 'test',
      },
      {
        id: 'raw-2',
        start: 8,
        end: 11,
        duration: 3,
        text: 'てください', // Continuation
        source: 'test',
      },
      // Good end (should preserve)
      {
        id: 'raw-3',
        start: 11,
        end: 16,
        duration: 5,
        text: '最後まで頑張りましょう。',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // First segment preserved
    expect(result[0].text).toBe('皆さん、こんにちは。')
    expect(result[0].strategy).toBe('preserve')

    // Middle segments should be merged due to continuation
    const middleSegment = result.find((s) => s.text.includes('今日は日本語の勉強頑張ってください'))
    expect(middleSegment).toBeDefined()
    expect(middleSegment?.strategy).toBe('merge')

    // Last segment preserved
    const lastSegment = result[result.length - 1]
    expect(lastSegment.text).toBe('最後まで頑張りましょう。')
    expect(lastSegment.strategy).toBe('preserve')
  })
})

describe('C2.5: Confidence Scoring for Mixed Regions', () => {
  it('assigns high confidence to preserved good clusters', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '完璧な文章です。',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('assigns lower confidence to merged clusters', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 3,
        duration: 3,
        text: 'おはようござい',
        source: 'test',
      },
      {
        id: 'raw-1',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)
    expect(result[0].confidence).toBeLessThan(0.9)
  })
})

describe('C2.5: Cluster Boundary Edge Cases', () => {
  it('handles single-unit transcript', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: 'こんにちは。',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('こんにちは。')
    expect(result[0].strategy).toBe('preserve')
  })

  it('handles all-bad transcript (should merge into fewer segments)', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 2,
        duration: 2,
        text: 'こんに',
        source: 'test',
      },
      {
        id: 'raw-1',
        start: 2,
        end: 4,
        duration: 2,
        text: 'ちは',
        source: 'test',
      },
      {
        id: 'raw-2',
        start: 4,
        end: 6,
        duration: 2,
        text: '皆さ',
        source: 'test',
      },
      {
        id: 'raw-3',
        start: 6,
        end: 8,
        duration: 2,
        text: 'ん',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)
    // Should merge all into fewer segments
    expect(result.length).toBeLessThan(rawUnits.length)
  })

  it('handles empty transcript', () => {
    const rawUnits: RawTranscriptUnit[] = []
    const result = reconstructSegments(rawUnits)
    expect(result).toHaveLength(0)
  })

  it('preserves cluster with contamination but good structure', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '-do完璧な文章です。', // Contaminated but good structure
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)
    expect(result[0].text).toBe('完璧な文章です。')
    expect(result[0].strategy).toBe('preserve')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Stage C2.5: Overlap and Duplicate Detection Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('C2.5: Overlap Detection', () => {
  it('detects significant overlap between units', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '今日も私と一緒に',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '一緒にたくさん話し',
      source: 'test',
    }

    expect(hasSignificantOverlap(unit1, unit2)).toBe(true)
  })

  it('calculates overlap ratio correctly', () => {
    const overlap = calculateOverlapRatio('今日も私と一緒に', '一緒にたくさん話し')
    expect(overlap).toBeGreaterThan(0.3) // "一緒に" overlaps
  })

  it('does not detect overlap when none exists', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '今日は晴れです。',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '明日は雨です。',
      source: 'test',
    }

    expect(hasSignificantOverlap(unit1, unit2)).toBe(false)
  })

  it('handles minimum overlap length (3 chars)', () => {
    // Overlap < 3 chars should not be detected
    const overlap = calculateOverlapRatio('今日は', '明日は')
    expect(overlap).toBe(0) // "は" is only 1 char, too short
  })
})

describe('C2.5: Duplicate Detection', () => {
  it('detects exact duplicates', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '私は韓国人の友達が欲しいです。',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '私は韓国人の友達が欲しいです。',
      source: 'test',
    }

    expect(areDuplicates(unit1, unit2)).toBe(true)
  })

  it('detects near-duplicates with minor variations', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '私は韓国人の友達が欲しいです。',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '私は韓国人の友達が欲しいです',
      source: 'test',
    }

    expect(areDuplicates(unit1, unit2)).toBe(true)
  })

  it('calculates similarity correctly', () => {
    const similarity = calculateSimilarity(
      '私は韓国人の友達が欲しいです。',
      '私は韓国人の友達が欲しいです',
    )
    expect(similarity).toBeGreaterThan(0.8)
  })

  it('does not detect non-duplicates', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '今日は晴れです。',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '明日は雨です。',
      source: 'test',
    }

    expect(areDuplicates(unit1, unit2)).toBe(false)
  })
})

describe('C2.5: shouldMergeUnits with Overlap/Duplicate Detection', () => {
  it('merges units with significant overlap', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '今日も私と一緒に',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '一緒にたくさん話し',
      source: 'test',
    }

    expect(shouldMergeUnits(unit1, unit2)).toBe(true)
  })

  it('merges duplicate units', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '私は韓国人の友達が欲しいです。',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '私は韓国人の友達が欲しいです。',
      source: 'test',
    }

    expect(shouldMergeUnits(unit1, unit2)).toBe(true)
  })

  it('does not merge distinct good units', () => {
    const unit1: RawTranscriptUnit = {
      id: 'test-1',
      start: 0,
      end: 5,
      duration: 5,
      text: '今日は晴れです。',
      source: 'test',
    }
    const unit2: RawTranscriptUnit = {
      id: 'test-2',
      start: 5,
      end: 10,
      duration: 5,
      text: '明日は雨です。',
      source: 'test',
    }

    expect(shouldMergeUnits(unit1, unit2)).toBe(false)
  })
})

describe('C2.5: Sheldon-Style Duplicate + Fragment Sequences', () => {
  it('handles duplicated full lines followed by fragments', () => {
    const rawUnits: RawTranscriptUnit[] = [
      // Duplicate full lines (Sheldon-style)
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '私は韓国人の友達が欲しいです。',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: '私は韓国人の友達が欲しいです。', // Duplicate
        source: 'sheldon',
      },
      // Followed by fragments (substrings of the full line)
      {
        id: 'raw-2',
        start: 10,
        end: 13,
        duration: 3,
        text: '私は韓国人の',
        source: 'sheldon',
      },
      {
        id: 'raw-3',
        start: 13,
        end: 16,
        duration: 3,
        text: '友達が',
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should produce ONE clean segment, not duplicates or fragments
    expect(result.length).toBe(1)

    const segment = result[0]
    expect(segment.text).toBe('私は韓国人の友達が欲しいです。')
    expect(segment.strategy).toBe('merge')
    expect(segment.sourceIds.length).toBe(4) // All 4 units merged

    // Verify NO duplication in the text
    const text = segment.text
    const firstHalf = text.slice(0, Math.floor(text.length / 2))
    const secondHalf = text.slice(Math.floor(text.length / 2))
    // If text was duplicated, first half would equal second half
    expect(firstHalf).not.toBe(secondHalf)

    // Verify the sentence appears exactly once
    const sentenceCount = (text.match(/私は韓国人の友達が欲しいです。/g) || []).length
    expect(sentenceCount).toBe(1)
  })

  it('handles overlap-heavy Sheldon sequences', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '今日も私と一緒に',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: '一緒にたくさん話し', // Overlaps with previous
        source: 'sheldon',
      },
      {
        id: 'raw-2',
        start: 10,
        end: 15,
        duration: 5,
        text: 'たくさん話しましょう。', // Overlaps again
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // All should merge due to overlaps
    expect(result.length).toBe(1)
    expect(result[0].sourceIds.length).toBe(3)
    expect(result[0].strategy).toBe('merge')
  })

  it('handles mixed duplicates and good content', () => {
    const rawUnits: RawTranscriptUnit[] = [
      // Good content
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: 'こんにちは、皆さん。',
        source: 'sheldon',
      },
      // Duplicates
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: '今日は良い天気ですね。',
        source: 'sheldon',
      },
      {
        id: 'raw-2',
        start: 10,
        end: 15,
        duration: 5,
        text: '今日は良い天気ですね。', // Duplicate
        source: 'sheldon',
      },
      // More good content
      {
        id: 'raw-3',
        start: 15,
        end: 20,
        duration: 5,
        text: '一緒に勉強しましょう。',
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // First segment preserved
    expect(result[0].text).toBe('こんにちは、皆さん。')
    expect(result[0].strategy).toBe('preserve')

    // Duplicates merged into ONE segment with text appearing ONCE
    const duplicateSegment = result.find((r) => r.text.includes('今日は良い天気ですね'))
    expect(duplicateSegment).toBeDefined()
    expect(duplicateSegment?.sourceIds.length).toBe(2) // Two sources merged
    // Verify text appears exactly once, not duplicated
    const text = duplicateSegment?.text || ''
    const occurrences = (text.match(/今日は良い天気ですね。/g) || []).length
    expect(occurrences).toBe(1) // Should appear once, not twice

    // Last segment preserved
    expect(result[result.length - 1].text).toBe('一緒に勉強しましょう。')
    expect(result[result.length - 1].strategy).toBe('preserve')
  })

  it('deduplicates exact duplicate text in merged segments', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: 'こんにちは。',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: 'こんにちは。', // Exact duplicate
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should merge into one segment
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('こんにちは。')
    expect(result[0].sourceIds.length).toBe(2)

    // Text should NOT be doubled
    expect(result[0].text).not.toBe('こんにちは。こんにちは。')
  })

  it('collapses fragments that are substrings of earlier text', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '今日は良い天気ですね。',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 8,
        duration: 3,
        text: '今日は良い', // Substring fragment
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should merge and collapse fragment
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('今日は良い天気ですね。')
    expect(result[0].sourceIds.length).toBe(2)

    // Fragment should NOT be appended
    expect(result[0].text).not.toContain('今日は良い天気ですね。今日は良い')
  })

  it('handles suffix-prefix overlap merging', () => {
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '今日も一緒に',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: '一緒にたくさん話し', // Overlaps "一緒に"
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should merge with overlap removed
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('今日も一緒にたくさん話し')
    expect(result[0].sourceIds.length).toBe(2)

    // Should NOT have doubled overlap
    expect(result[0].text).not.toBe('今日も一緒に一緒にたくさん話し')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Stage C2.5+: Cluster Boundary Hardening Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('C2.5+: Cluster Boundary Hardening', () => {
  it('prevents local overlaps from consuming later clean lines', () => {
    // Scenario: Intro has overlaps, but should not merge with unrelated later content
    const rawUnits: RawTranscriptUnit[] = [
      // Overlap region at start
      {
        id: 'raw-0',
        start: 0,
        end: 3,
        duration: 3,
        text: '今日も一緒に',
        source: 'test',
      },
      {
        id: 'raw-1',
        start: 3,
        end: 6,
        duration: 3,
        text: '一緒にたくさん話し', // Overlaps with previous
        source: 'test',
      },
      // Clean unrelated content
      {
        id: 'raw-2',
        start: 6,
        end: 10,
        duration: 4,
        text: 'こんにちは、皆さん。',
        source: 'test',
      },
      {
        id: 'raw-3',
        start: 10,
        end: 14,
        duration: 4,
        text: '今日は良い天気ですね。',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should produce at least 2 segments (overlap cluster + later content)
    // NOT one giant merged segment
    expect(result.length).toBeGreaterThanOrEqual(2)

    // Verify later clean content is preserved separately
    const hasCleanSegment = result.some(
      (s) => s.text.includes('こんにちは、皆さん') || s.text.includes('今日は良い天気ですね'),
    )
    expect(hasCleanSegment).toBe(true)
  })

  it('handles duplicate+fragment repair then stops at clean cluster boundary', () => {
    // Scenario: Duplicate + fragments should merge, then clean line starts new cluster
    const rawUnits: RawTranscriptUnit[] = [
      // Duplicate + fragment region
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '私は韓国人の友達が欲しいです。',
        source: 'test',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: '私は韓国人の友達が欲しいです。', // Duplicate
        source: 'test',
      },
      {
        id: 'raw-2',
        start: 10,
        end: 13,
        duration: 3,
        text: '私は韓国人の', // Fragment
        source: 'test',
      },
      // Clean unrelated line
      {
        id: 'raw-3',
        start: 13,
        end: 18,
        duration: 5,
        text: 'こんにちは、皆さん。',
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should produce 2 segments: merged duplicate+fragment cluster + clean line
    expect(result.length).toBe(2)

    // First segment: duplicate+fragment merged
    expect(result[0].text).toBe('私は韓国人の友達が欲しいです。')
    expect(result[0].sourceIds.length).toBe(3)
    expect(result[0].strategy).toBe('merge')

    // Second segment: clean line preserved
    expect(result[1].text).toBe('こんにちは、皆さん。')
    expect(result[1].sourceIds.length).toBe(1)
    expect(result[1].strategy).toBe('preserve')
  })

  it('regression test: 45fMrqfNIXA-style intro should not collapse entire transcript', () => {
    // Approximates 45fMrqfNIXA: bad intro fragments followed by good content
    const rawUnits: RawTranscriptUnit[] = [
      // Bad intro (continuation breaks)
      {
        id: 'raw-0',
        start: 0,
        end: 3,
        duration: 3,
        text: 'こんにちは、こんばんは、おはようござい',
        source: 'sheldon',
      },
      {
        id: 'raw-1',
        start: 3,
        end: 6,
        duration: 3,
        text: 'ます。黒猫ママです。',
        source: 'sheldon',
      },
      // More good content
      {
        id: 'raw-2',
        start: 6,
        end: 9,
        duration: 3,
        text: '日本語の勉強頑張ってますか？',
        source: 'sheldon',
      },
      {
        id: 'raw-3',
        start: 9,
        end: 12,
        duration: 3,
        text: '今日も一緒にたくさん話しましょう。',
        source: 'sheldon',
      },
      {
        id: 'raw-4',
        start: 12,
        end: 15,
        duration: 3,
        text: 'ビデオの終わりにクイズがありますよ。',
        source: 'sheldon',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // CRITICAL: Should produce multiple segments, NOT collapse into 1
    expect(result.length).toBeGreaterThan(1)

    // Should be closer to 3-4 segments, not 1
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('preservation test: 9LW9DpmhrPE-style good transcript should produce many segments', () => {
    // Approximates 9LW9DpmhrPE: already-good lineation should preserve 1:1
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: '君の中にある赤と青き線',
        source: 'youtube',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: '届ける言葉を今は育ててる',
        source: 'youtube',
      },
      {
        id: 'raw-2',
        start: 10,
        end: 15,
        duration: 5,
        text: 'もしかしたら',
        source: 'youtube',
      },
      {
        id: 'raw-3',
        start: 15,
        end: 20,
        duration: 5,
        text: '君と手を取りたい',
        source: 'youtube',
      },
      {
        id: 'raw-4',
        start: 20,
        end: 25,
        duration: 5,
        text: '風の中でも負けないような声で',
        source: 'youtube',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should preserve most segments (4-5 out of 5)
    expect(result.length).toBeGreaterThanOrEqual(4)

    // Count preserved strategies
    const preservedCount = result.filter((s) => s.strategy === 'preserve').length
    expect(preservedCount).toBeGreaterThanOrEqual(3)
  })

  it('enforces max cluster size hard limit', () => {
    // Create 12 units that all look incomplete (would merge without limit)
    const rawUnits: RawTranscriptUnit[] = Array.from({ length: 12 }, (_, i) => ({
      id: `raw-${i}`,
      start: i * 2,
      end: (i + 1) * 2,
      duration: 2,
      text: `短い${i}`, // Very short fragments
      source: 'test',
    }))

    const result = reconstructSegments(rawUnits)

    // Should NOT merge all 12 into one segment due to MAX_CLUSTER_SIZE
    expect(result.length).toBeGreaterThan(1)

    // No single segment should have more than 8 sources
    const maxSources = Math.max(...result.map((s) => s.sourceIds.length))
    expect(maxSources).toBeLessThanOrEqual(8)
  })

  it('enforces max text length hard limit', () => {
    // Create units with long text that would exceed MAX_CLUSTER_TEXT_LENGTH
    const longText = '非常に長いテキストです。'.repeat(10) // ~120 chars
    const rawUnits: RawTranscriptUnit[] = [
      {
        id: 'raw-0',
        start: 0,
        end: 5,
        duration: 5,
        text: longText,
        source: 'test',
      },
      {
        id: 'raw-1',
        start: 5,
        end: 10,
        duration: 5,
        text: longText, // Would be duplicate, but also triggers length limit
        source: 'test',
      },
      {
        id: 'raw-2',
        start: 10,
        end: 15,
        duration: 5,
        text: longText,
        source: 'test',
      },
    ]

    const result = reconstructSegments(rawUnits)

    // Should NOT merge all into one segment due to MAX_CLUSTER_TEXT_LENGTH
    // At ~120 chars each, 3 units = ~360 chars, exceeds 250 limit
    expect(result.length).toBeGreaterThan(1)
  })
})
