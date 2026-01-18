import { Exercise, ExerciseResult } from './types'

export function validateAnswer(
  exercise: Exercise,
  userAnswer: string | string[]
): ExerciseResult {
  const normalizedVariants = normalizeAnswer(userAnswer)

  let correctAnswer = ''
  let comparisonAnswer = ''
  let acceptedVariations: string[] = []

  if (exercise.type === 'multiple-choice') {
    const match = exercise.options.find(
      option => option.id === exercise.correctAnswer
    )
    correctAnswer = match ? match.text : exercise.correctAnswer
    comparisonAnswer = exercise.correctAnswer
  } else if (exercise.type === 'fill-in-blank') {
    correctAnswer = exercise.correctAnswer
    comparisonAnswer = exercise.correctAnswer
    acceptedVariations = exercise.acceptedVariations || []
  } else {
    const pairs = exercise.pairs.map(
      pair => `${pair.japanese}=>${pair.english}`
    )
    comparisonAnswer = pairs.join('|')
    correctAnswer = exercise.pairs
      .map(pair => `${pair.japanese} = ${pair.english}`)
      .join(' | ')
  }

  const normalizedCorrect = normalizeAnswer(comparisonAnswer)[0]

  if (normalizedVariants.includes(normalizedCorrect)) {
    return {
      isCorrect: true,
      message: exercise.correctFeedback,
      correctAnswer,
    }
  }

  if (acceptedVariations.length > 0) {
    const isAccepted = acceptedVariations.some(variation => {
      const variationNormalized = normalizeAnswer(variation)[0]
      return normalizedVariants.includes(variationNormalized)
    })
    if (isAccepted) {
      return {
        isCorrect: true,
        message: exercise.correctFeedback,
        correctAnswer,
      }
    }
  }

  return {
    isCorrect: false,
    message: exercise.incorrectFeedback,
    correctAnswer,
    explanation: exercise.explanation,
  }
}

function normalizeAnswer(answer: string | string[]): string[] {
  if (Array.isArray(answer)) {
    const fromRomaji = answer.some(item => /[a-z]/i.test(item))
    const hasSpaces = answer.some(item => /\s/.test(item))
    const joined = answer.map(item => normalizeSingle(item)).join('|')
    if (!fromRomaji) return [joined]
    // Only apply particle swaps when token boundaries exist (space-separated romaji).
    if (!hasSpaces) return [joined]
    const swapped = applyParticleSwaps(joined)
    return swapped === joined ? [joined] : [joined, swapped]
  }
  const fromRomaji = /[a-z]/i.test(answer)
  const hasSpaces = /\s/.test(answer)
  const normalized = normalizeSingle(answer)
  if (!fromRomaji) return [normalized]
  // Only apply particle swaps when token boundaries exist (space-separated romaji).
  if (!hasSpaces) return [normalized]
  const swapped = applyParticleSwaps(normalized)
  return swapped === normalized ? [normalized] : [normalized, swapped]
}

function normalizeSingle(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[。、！？!?.,]/g, '')
  const normalized = normalizeRomajiTokens(base)
  return normalized.replace(/\s+/g, '')
}

function normalizeRomajiTokens(text: string): string {
  if (!/[a-z]/.test(text)) {
    return text
  }

  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return text

  const mapped = tokens.map(token => {
    switch (token) {
      case 'wa':
        return 'は'
      case 'ga':
        return 'が'
      case 'o':
        return 'を'
      case 'ni':
        return 'に'
      case 'de':
        return 'で'
      case 'to':
        return 'と'
      case 'mo':
        return 'も'
      case 'desu':
        return 'です'
      case 'deshita':
        return 'でした'
      default:
        return romajiToHiragana(token)
    }
  })

  return mapped.join(' ')
}

function applyParticleSwaps(text: string): string {
  return text.replace(/わ/g, 'は').replace(/お/g, 'を').replace(/え/g, 'へ')
}

function romajiToHiragana(input: string): string {
  if (!/[a-z]/.test(input)) return input

  const map: Record<string, string> = {
    kya: 'きゃ',
    kyu: 'きゅ',
    kyo: 'きょ',
    gya: 'ぎゃ',
    gyu: 'ぎゅ',
    gyo: 'ぎょ',
    sha: 'しゃ',
    shu: 'しゅ',
    sho: 'しょ',
    ja: 'じゃ',
    ju: 'じゅ',
    jo: 'じょ',
    cha: 'ちゃ',
    chu: 'ちゅ',
    cho: 'ちょ',
    nya: 'にゃ',
    nyu: 'にゅ',
    nyo: 'にょ',
    hya: 'ひゃ',
    hyu: 'ひゅ',
    hyo: 'ひょ',
    mya: 'みゃ',
    myu: 'みゅ',
    myo: 'みょ',
    rya: 'りゃ',
    ryu: 'りゅ',
    ryo: 'りょ',
    bya: 'びゃ',
    byu: 'びゅ',
    byo: 'びょ',
    pya: 'ぴゃ',
    pyu: 'ぴゅ',
    pyo: 'ぴょ',
    shi: 'し',
    chi: 'ち',
    tsu: 'つ',
    fu: 'ふ',
    ka: 'か',
    ki: 'き',
    ku: 'く',
    ke: 'け',
    ko: 'こ',
    sa: 'さ',
    su: 'す',
    se: 'せ',
    so: 'そ',
    ta: 'た',
    te: 'て',
    to: 'と',
    na: 'な',
    ni: 'に',
    nu: 'ぬ',
    ne: 'ね',
    no: 'の',
    ha: 'は',
    hi: 'ひ',
    he: 'へ',
    ho: 'ほ',
    ma: 'ま',
    mi: 'み',
    mu: 'む',
    me: 'め',
    mo: 'も',
    ya: 'や',
    yu: 'ゆ',
    yo: 'よ',
    ra: 'ら',
    ri: 'り',
    ru: 'る',
    re: 'れ',
    ro: 'ろ',
    wa: 'わ',
    wo: 'を',
    ga: 'が',
    gi: 'ぎ',
    gu: 'ぐ',
    ge: 'げ',
    go: 'ご',
    za: 'ざ',
    ji: 'じ',
    zu: 'ず',
    ze: 'ぜ',
    zo: 'ぞ',
    da: 'だ',
    de: 'で',
    do: 'ど',
    ba: 'ば',
    bi: 'び',
    bu: 'ぶ',
    be: 'べ',
    bo: 'ぼ',
    pa: 'ぱ',
    pi: 'ぴ',
    pu: 'ぷ',
    pe: 'ぺ',
    po: 'ぽ',
    a: 'あ',
    i: 'い',
    u: 'う',
    e: 'え',
    o: 'お',
  }

  let result = ''
  let i = 0
  const text = input.toLowerCase()

  while (i < text.length) {
    const two = text.slice(i, i + 2)
    const three = text.slice(i, i + 3)

    const current = text[i]
    const next = text[i + 1]
    if (
      next &&
      current === next &&
      !'aeiou'.includes(current) &&
      current !== 'n'
    ) {
      result += 'っ'
      i += 1
      continue
    }

    if (map[three]) {
      result += map[three]
      i += 3
      continue
    }
    if (map[two]) {
      result += map[two]
      i += 2
      continue
    }

    if (current === 'n') {
      const following = text[i + 1]
      if (!following || !'aeiouy'.includes(following)) {
        result += 'ん'
        i += 1
        continue
      }
    }

    if (map[current]) {
      result += map[current]
      i += 1
      continue
    }

    result += current
    i += 1
  }

  return result
}
