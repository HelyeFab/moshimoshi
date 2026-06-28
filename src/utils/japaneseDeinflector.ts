/**
 * Japanese Deinflector
 *
 * Dictionaries (JMDict included) only store *dictionary / base* forms.
 * A learner searching a conjugated form such as 乗った (past of 乗る) or
 * 食べたい (want-to-eat of 食べる) will get zero results from a naive
 * substring match, because 乗る does not contain 乗った.
 *
 * This module reverses the most common inflections to produce a list of
 * *candidate* dictionary forms. Candidates are deliberately over-generated:
 * a wrong guess (e.g. 乗う, 乗つ) simply won't match any real entry, while
 * the correct guess (乗る) will. The dictionary itself is the validator.
 *
 * This mirrors the approach used by Jisho / Yomichan deinflectors, kept
 * intentionally compact and dependency-free.
 */

interface DeinflectionRule {
  /** Suffix as it appears on the conjugated form. */
  from: string
  /** Possible dictionary-form endings the stem could take. */
  to: string[]
}

/**
 * Rules are ordered roughly longest-suffix first. Every rule whose `from`
 * matches the end of the term contributes candidates, so overlapping rules
 * are fine — non-matching candidates are filtered out by the dictionary.
 */
const RULES: DeinflectionRule[] = [
  // ---- Polite (ます) chains, longest first --------------------------------
  { from: 'ませんでした', to: ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'する', 'くる'] },
  { from: 'ましょう', to: ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'する', 'くる'] },
  { from: 'ました', to: ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'する', 'くる'] },
  { from: 'ません', to: ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'する', 'くる'] },
  { from: 'ます', to: ['る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'する', 'くる'] },
  // ます attaches to the i-row stem of godan verbs, so strip the i-row too:
  { from: 'います', to: ['う'] },
  { from: 'きます', to: ['く', 'くる'] },
  { from: 'ぎます', to: ['ぐ'] },
  { from: 'します', to: ['す', 'する'] },
  { from: 'ちます', to: ['つ'] },
  { from: 'にます', to: ['ぬ'] },
  { from: 'びます', to: ['ぶ'] },
  { from: 'みます', to: ['む'] },
  { from: 'リます', to: ['る'] },
  { from: 'ります', to: ['る'] },

  // ---- Past plain (た / だ) ----------------------------------------------
  { from: 'った', to: ['う', 'つ', 'る'] },   // 買った/待った/乗った
  { from: 'いた', to: ['く'] },                // 書いた
  { from: 'いだ', to: ['ぐ'] },                // 泳いだ
  { from: 'した', to: ['す', 'する', ''] },     // 話した(→話す) / 勉強した(→勉強)
  { from: 'んだ', to: ['む', 'ぶ', 'ぬ'] },    // 読んだ/遊んだ/死んだ
  { from: 'きた', to: ['くる'] },              // 来た
  { from: 'た', to: ['る'] },                  // 食べた (ichidan)

  // ---- Te-form (て / で) --------------------------------------------------
  { from: 'って', to: ['う', 'つ', 'る'] },
  { from: 'いて', to: ['く'] },
  { from: 'いで', to: ['ぐ'] },
  { from: 'して', to: ['す', 'する', ''] },
  { from: 'んで', to: ['む', 'ぶ', 'ぬ'] },
  { from: 'きて', to: ['くる'] },
  { from: 'て', to: ['る'] },                  // 食べて (ichidan)

  // ---- Negative (ない) and negative-past (なかった) ----------------------
  { from: 'わなかった', to: ['う'] },
  { from: 'かなかった', to: ['く'] },
  { from: 'がなかった', to: ['ぐ'] },
  { from: 'さなかった', to: ['す'] },
  { from: 'たなかった', to: ['つ'] },
  { from: 'ななかった', to: ['ぬ'] },
  { from: 'ばなかった', to: ['ぶ'] },
  { from: 'まなかった', to: ['む'] },
  { from: 'らなかった', to: ['る'] },
  { from: 'なかった', to: ['る'] },            // ichidan / fallback
  { from: 'わない', to: ['う'] },
  { from: 'かない', to: ['く'] },
  { from: 'がない', to: ['ぐ'] },
  { from: 'さない', to: ['す'] },
  { from: 'たない', to: ['つ'] },
  { from: 'なない', to: ['ぬ'] },
  { from: 'ばない', to: ['ぶ'] },
  { from: 'まない', to: ['む'] },
  { from: 'らない', to: ['る'] },
  { from: 'しない', to: ['する', ''] },
  { from: 'こない', to: ['くる'] },
  { from: 'ない', to: ['る'] },                // 食べない (ichidan)

  // ---- Potential / passive / conditional / volitional (godan e-row + る) --
  { from: 'える', to: ['う', 'える'] },        // 買える / (ichidan 教える stays)
  { from: 'ける', to: ['く', 'ける'] },        // 行ける / 開ける
  { from: 'げる', to: ['ぐ', 'げる'] },
  { from: 'せる', to: ['す', 'せる'] },
  { from: 'てる', to: ['つ', 'てる'] },
  { from: 'ねる', to: ['ぬ', 'ねる'] },
  { from: 'べる', to: ['ぶ', 'べる'] },
  { from: 'める', to: ['む', 'める'] },
  { from: 'れる', to: ['る', 'れる'] },        // 乗れる→乗る / 食べられる handled below
  { from: 'られる', to: ['る'] },              // 食べられる→食べる (ichidan potential/passive)
  { from: 'えば', to: ['う'] },                // conditional ば
  { from: 'けば', to: ['く'] },
  { from: 'げば', to: ['ぐ'] },
  { from: 'せば', to: ['す'] },
  { from: 'てば', to: ['つ'] },
  { from: 'ねば', to: ['ぬ'] },
  { from: 'べば', to: ['ぶ'] },
  { from: 'めば', to: ['む'] },
  { from: 'れば', to: ['る'] },
  { from: 'おう', to: ['う'] },                // volitional 買おう
  { from: 'こう', to: ['く'] },
  { from: 'ごう', to: ['ぐ'] },
  { from: 'そう', to: ['す'] },
  { from: 'とう', to: ['つ'] },
  { from: 'のう', to: ['ぬ'] },
  { from: 'ぼう', to: ['ぶ'] },
  { from: 'もう', to: ['む'] },
  { from: 'ろう', to: ['る'] },
  { from: 'よう', to: ['る'] },                // 食べよう (ichidan)

  // ---- Tara / desire (たい) ----------------------------------------------
  { from: 'ったら', to: ['う', 'つ', 'る'] },
  { from: 'たら', to: ['る'] },
  { from: 'たい', to: ['る'] },                // 食べたい (ichidan)
  { from: 'いたい', to: ['く'] },
  { from: 'りたい', to: ['る'] },
  { from: 'みたい', to: ['む'] },

  // ---- i-adjective inflections -------------------------------------------
  { from: 'かった', to: ['い'] },              // 高かった→高い
  { from: 'くない', to: ['い'] },              // 高くない→高い
  { from: 'くなかった', to: ['い'] },
  { from: 'くて', to: ['い'] },                // 高くて→高い
  { from: 'く', to: ['い'] },                  // 高く→高い (adverbial)
  { from: 'ければ', to: ['い'] },              // 高ければ→高い
]

// Polite (ます) forms attach to the *i-row* stem of godan verbs
// (行き+ました, 飲み+ません), so map each i-row mora + polite suffix back to its
// dictionary ending. Generated rather than hand-listed to stay exhaustive.
const IROW_TO_DICT: Record<string, string> = {
  'い': 'う', 'き': 'く', 'ぎ': 'ぐ', 'し': 'す', 'ち': 'つ',
  'に': 'ぬ', 'び': 'ぶ', 'み': 'む', 'り': 'る',
}
const POLITE_SUFFIXES = ['ます', 'ました', 'ません', 'ませんでした', 'ましょう']
for (const [iMora, dictEnding] of Object.entries(IROW_TO_DICT)) {
  for (const suffix of POLITE_SUFFIXES) {
    RULES.push({ from: iMora + suffix, to: [dictEnding] })
  }
}
for (const suffix of POLITE_SUFFIXES) {
  // する-verbs are stored under the bare noun (勉強, tagged vs), so strip the
  // whole し+suffix ('' ending) in addition to forming 〜する.
  RULES.push({ from: 'し' + suffix, to: ['する', ''] }) // 勉強しました→勉強 / する
  RULES.push({ from: 'き' + suffix, to: ['くる'] })      // 来ました→くる
  RULES.push({ from: suffix, to: ['る'] })              // ichidan: 食べました→食べる
}

const HAS_JAPANESE = /[぀-ヿ一-龯]/

/**
 * Return candidate dictionary forms for a (possibly conjugated) term.
 * The original term is always included first. Results are de-duplicated and
 * capped. Non-Japanese / very short input is returned unchanged.
 */
export function deinflect(term: string, maxCandidates = 40): string[] {
  const trimmed = term.trim()
  const candidates: string[] = [trimmed]

  if (trimmed.length < 2 || !HAS_JAPANESE.test(trimmed)) {
    return candidates
  }

  const seen = new Set<string>([trimmed])

  for (const rule of RULES) {
    if (!trimmed.endsWith(rule.from)) continue
    const stem = trimmed.slice(0, trimmed.length - rule.from.length)
    // Need a real stem (at least one character before the ending).
    if (stem.length === 0) continue

    for (const ending of rule.to) {
      const candidate = stem + ending
      if (!seen.has(candidate)) {
        seen.add(candidate)
        candidates.push(candidate)
        if (candidates.length >= maxCandidates) return candidates
      }
    }
  }

  return candidates
}

/**
 * Whether a term looks like it could be an inflected form worth deinflecting.
 * (Cheap pre-check so callers can skip the work for romaji / English input.)
 */
export function looksInflected(term: string): boolean {
  const t = term.trim()
  return t.length >= 2 && HAS_JAPANESE.test(t)
}
