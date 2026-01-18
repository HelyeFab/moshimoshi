const fs = require('fs')
const path = require('path')

const repoRoot = process.cwd()
const indexPath = path.join(repoRoot, 'public/data/grammar/n4-index.json')
const outDir = path.join(repoRoot, 'public/data/grammar/exercises/n4')

const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const points = Array.isArray(indexData.points) ? indexData.points : []

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const stripSpaces = (value) => value.replace(/\s+/g, '')
const toLower = (value) => value.toLowerCase()

const getField = (point, field) => {
  if (field === 'ja') return point.title?.ja || ''
  if (field === 'romaji') return point.title?.romaji || ''
  if (field === 'en') return point.title?.en || ''
  if (field === 'shortDescription') return point.shortDescription || ''
  return ''
}

const collectDistractors = (currentId, field, count) => {
  const result = []
  for (let i = 0; i < points.length && result.length < count; i += 1) {
    const candidate = points[i]
    if (!candidate || candidate.id === currentId) continue
    const value = getField(candidate, field)
    if (!value) continue
    result.push(candidate)
  }
  return result
}

const buildOptions = (indexPosition, correctPoint, distractors, field, includeRomaji = false) => {
  const correctValue = getField(correctPoint, field)
  const options = new Array(4).fill(null)
  const correctIndex = indexPosition % 4
  options[correctIndex] = {
    text: correctValue,
    romaji: includeRomaji ? getField(correctPoint, 'romaji') : undefined,
  }

  let cursor = 0
  for (let i = 0; i < 4; i += 1) {
    if (i === correctIndex) continue
    const candidate = distractors[cursor]
    cursor += 1
    options[i] = {
      text: getField(candidate, field),
      romaji: includeRomaji ? getField(candidate, 'romaji') : undefined,
    }
  }

  return options.map((option, idx) => ({
    id: ['a', 'b', 'c', 'd'][idx],
    text: option?.text || '',
    ...(option?.romaji ? { romaji: option.romaji } : {}),
  }))
}

const buildExerciseSet = (point, indexPosition) => {
  const id = point.id
  const ja = point.title?.ja || ''
  const romaji = point.title?.romaji || ''
  const en = point.title?.en || ''
  const shortDescription = point.shortDescription || ''

  const jaDistractors = collectDistractors(id, 'ja', 3)
  const enDistractors = collectDistractors(id, 'en', 3)
  const romajiDistractors = collectDistractors(id, 'romaji', 3)
  const descDistractors = collectDistractors(id, 'shortDescription', 3)
  const pairDistractors = collectDistractors(id, 'ja', 2)

  const exercises = [
    {
      id: `${id}-ex-01`,
      type: 'multiple-choice',
      question: `Choose the grammar pattern that matches: "${en}".`,
      options: buildOptions(indexPosition, point, jaDistractors, 'ja', true),
      correctAnswer: ['a', 'b', 'c', 'd'][indexPosition % 4],
      correctFeedback: `Great! ${ja} matches "${en}".`,
      incorrectFeedback: `Not quite. The correct pattern is ${ja}.`,
      explanation: shortDescription || `This pattern expresses: ${en}.`,
      difficulty: 'easy',
    },
    {
      id: `${id}-ex-02`,
      type: 'multiple-choice',
      question: `Choose the correct meaning for: ${ja}.`,
      options: buildOptions(indexPosition + 1, point, enDistractors, 'en'),
      correctAnswer: ['a', 'b', 'c', 'd'][(indexPosition + 1) % 4],
      correctFeedback: `Correct! ${ja} means "${en}".`,
      incorrectFeedback: `Not quite. The correct meaning is "${en}".`,
      explanation: shortDescription || `Use ${ja} to express: ${en}.`,
      difficulty: 'easy',
    },
    {
      id: `${id}-ex-03`,
      type: 'multiple-choice',
      question: `Choose the correct romaji for: ${ja}.`,
      options: buildOptions(indexPosition + 2, point, romajiDistractors, 'romaji'),
      correctAnswer: ['a', 'b', 'c', 'd'][(indexPosition + 2) % 4],
      correctFeedback: `Correct! ${romaji} is right.`,
      incorrectFeedback: `Not quite. The correct romaji is ${romaji}.`,
      explanation: shortDescription || `This pattern is read as ${romaji}.`,
      difficulty: 'medium',
    },
    {
      id: `${id}-ex-04`,
      type: 'multiple-choice',
      question: `Which explanation matches: ${ja}?`,
      options: buildOptions(indexPosition + 3, point, descDistractors, 'shortDescription'),
      correctAnswer: ['a', 'b', 'c', 'd'][(indexPosition + 3) % 4],
      correctFeedback: 'Nice! That explanation fits this grammar.',
      incorrectFeedback: `Not quite. The correct explanation is: ${shortDescription}`,
      explanation: shortDescription || `This pattern expresses: ${en}.`,
      difficulty: 'medium',
    },
    {
      id: `${id}-ex-05`,
      type: 'fill-in-blank',
      question: `Write the Japanese pattern for: "${en}".`,
      correctAnswer: ja,
      acceptedVariations: [ja, stripSpaces(ja)].filter(Boolean),
      correctFeedback: `Nice! ${ja} is correct.`,
      incorrectFeedback: `The correct pattern is: ${ja}${romaji ? ` (${romaji}).` : '.'}`,
      explanation: shortDescription || `Use ${ja} to express: ${en}.`,
      hints: [romaji, shortDescription].filter(Boolean),
      difficulty: 'medium',
    },
    {
      id: `${id}-ex-06`,
      type: 'fill-in-blank',
      question: `Write the romaji for: ${ja}.`,
      correctAnswer: romaji,
      acceptedVariations: [romaji, toLower(romaji)].filter(Boolean),
      correctFeedback: `Nice! ${romaji} is correct.`,
      incorrectFeedback: `The correct romaji is: ${romaji}.`,
      explanation: shortDescription || `This pattern is read as ${romaji}.`,
      hints: [shortDescription].filter(Boolean),
      difficulty: 'medium',
    },
    {
      id: `${id}-ex-07`,
      type: 'fill-in-blank',
      question: `Write the English meaning for: ${ja}.`,
      correctAnswer: en,
      acceptedVariations: [en, toLower(en)].filter(Boolean),
      correctFeedback: `Correct! "${en}" is right.`,
      incorrectFeedback: `The correct meaning is: "${en}".`,
      explanation: shortDescription || `This pattern expresses: ${en}.`,
      hints: [shortDescription].filter(Boolean),
      difficulty: 'hard',
    },
    {
      id: `${id}-ex-08`,
      type: 'sentence-matching',
      question: 'Match the Japanese patterns with their English meanings:',
      pairs: [
        {
          japanese: ja,
          romaji,
          english: en,
        },
        {
          japanese: pairDistractors[0]?.title?.ja || '',
          romaji: pairDistractors[0]?.title?.romaji || '',
          english: pairDistractors[0]?.title?.en || '',
        },
        {
          japanese: pairDistractors[1]?.title?.ja || '',
          romaji: pairDistractors[1]?.title?.romaji || '',
          english: pairDistractors[1]?.title?.en || '',
        },
      ],
      correctFeedback: 'Nice work! You matched the meanings correctly.',
      incorrectFeedback: 'Review the patterns and try again.',
      explanation: shortDescription || `This pattern is used to express: ${en}.`,
      difficulty: 'hard',
    },
    {
      id: `${id}-ex-09`,
      type: 'multiple-choice',
      question: `Choose the pattern that fits this usage: ${shortDescription || en}.`,
      options: buildOptions(indexPosition + 4, point, jaDistractors, 'ja', true),
      correctAnswer: ['a', 'b', 'c', 'd'][(indexPosition + 4) % 4],
      correctFeedback: `Correct! ${ja} matches that usage.`,
      incorrectFeedback: `Not quite. The correct pattern is ${ja}.`,
      explanation: shortDescription || `This pattern expresses: ${en}.`,
      difficulty: 'hard',
    },
    {
      id: `${id}-ex-10`,
      type: 'fill-in-blank',
      question: 'Write the Japanese pattern (no spaces):',
      correctAnswer: stripSpaces(ja),
      acceptedVariations: [stripSpaces(ja), ja].filter(Boolean),
      correctFeedback: `Great! ${stripSpaces(ja)} is correct.`,
      incorrectFeedback: `The correct pattern is: ${stripSpaces(ja)}.`,
      explanation: shortDescription || `Use ${ja} to express: ${en}.`,
      hints: [romaji].filter(Boolean),
      difficulty: 'hard',
    },
  ]

  return {
    grammarPointId: id,
    version: '1.0.0',
    totalExercises: exercises.length,
    exercises,
  }
}

for (let i = 0; i < points.length; i += 1) {
  const point = points[i]
  const payload = buildExerciseSet(point, i)
  const outPath = path.join(outDir, `${point.id}.json`)
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n')
}

console.log(`Generated ${points.length} N4 exercise files in ${outDir}`)
