import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local')
  process.exit(1)
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const LEVELS = ['n5', 'n4'] as const
const args = process.argv.slice(2)
const levelArg = args.find(arg => arg.startsWith('--level='))
const targetLevel = levelArg ? levelArg.split('=')[1] : null
const OUT_DIR = path.join(process.cwd(), 'public/data/grammar/sections')

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function buildPrompt(level: string, points: Array<{ id: string; title: any; category: string }>) {
  const jlpt = level.toUpperCase()
  const pointList = points.map(p => ({
    id: p.id,
    titleJa: p.title?.ja || '',
    titleEn: p.title?.en || '',
    category: p.category || 'uncategorized',
  }))

  return {
    system: `You are a Japanese curriculum designer. Return ONLY valid JSON.`,
    user: `Create JLPT ${jlpt} chapter groupings from the provided grammar points.

Requirements:
- Create between 8 and 12 chapters.
- Every point id must appear exactly once across chapters.
- Chapters must be ordered (1..N).
- Each chapter has a short, clear title.
- Provide titles localized for: en, ja, de, es, fr, it.
- Output schema:
{
  "version": "1.0.0",
  "jlptLevel": "${jlpt}",
  "lastUpdated": "YYYY-MM-DD",
  "chapters": [
    {
      "id": "${level}-ch1",
      "order": 1,
      "title": {"en": "...", "ja": "...", "de": "...", "es": "...", "fr": "...", "it": "..."},
      "points": ["point-id", "point-id"]
    }
  ]
}

Points:
${JSON.stringify(pointList)}

Return JSON only.`
  }
}

function validate(level: string, inputIds: string[], result: any) {
  if (!result || !Array.isArray(result.chapters)) {
    throw new Error(`${level}: Missing chapters array`)
  }
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const chapter of result.chapters) {
    if (!chapter?.title || !chapter?.points) {
      throw new Error(`${level}: Chapter missing title or points`)
    }
    const title = chapter.title
    for (const locale of ['en', 'ja', 'de', 'es', 'fr', 'it']) {
      if (!title[locale]) {
        throw new Error(`${level}: Chapter ${chapter.id} missing title.${locale}`)
      }
    }
    for (const id of chapter.points) {
      if (seen.has(id)) dupes.push(id)
      seen.add(id)
    }
  }
  if (dupes.length) {
    throw new Error(`${level}: Duplicate point ids found: ${dupes.slice(0, 5).join(', ')}`)
  }
  const missing = inputIds.filter(id => !seen.has(id))
  if (missing.length) {
    throw new Error(`${level}: Missing point ids: ${missing.slice(0, 5).join(', ')}`)
  }
}

function normalizeChapters(inputIds: string[], result: any) {
  const seen = new Set<string>()
  const deduped: string[][] = []
  const chapters = result.chapters as Array<{ points: string[] }>

  for (const chapter of chapters) {
    const cleaned: string[] = []
    for (const id of chapter.points || []) {
      if (seen.has(id)) continue
      seen.add(id)
      cleaned.push(id)
    }
    deduped.push(cleaned)
  }

  const missing = inputIds.filter(id => !seen.has(id))
  if (missing.length === 0) {
    for (let i = 0; i < chapters.length; i++) {
      chapters[i].points = deduped[i]
    }
    return
  }

  // Assign missing IDs to smallest chapters, round-robin
  const sizes = deduped.map(list => list.length)
  let cursor = 0
  for (const id of missing) {
    let minIndex = 0
    let minSize = sizes[0] ?? 0
    for (let i = 1; i < sizes.length; i++) {
      if (sizes[i] < minSize) {
        minSize = sizes[i]
        minIndex = i
      }
    }
    deduped[minIndex].push(id)
    sizes[minIndex] += 1
    cursor++
  }

  for (let i = 0; i < chapters.length; i++) {
    chapters[i].points = deduped[i]
  }
}

async function generate(level: typeof LEVELS[number]) {
  const indexPath = path.join(process.cwd(), `public/data/grammar/${level}-index.json`)
  const index = readJson<any>(indexPath)
  const points = (index.points || []) as Array<{ id: string; title: any; category: string }>
  const ids = points.map(p => p.id)

  const { system, user } = buildPrompt(level, points)

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  })

  const content = response.choices?.[0]?.message?.content || ''
  let parsed = JSON.parse(content)

  const attempts = [parsed]
  for (let i = 0; i < 2; i++) {
    try {
      parsed.version = '1.0.0'
      parsed.jlptLevel = level.toUpperCase()
      parsed.lastUpdated = new Date().toISOString().slice(0, 10)
      normalizeChapters(ids, parsed)
      validate(level, ids, parsed)
      break
    } catch (err) {
      const repair = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `${user}\n\nThe previous output had duplicate or missing point IDs. ` +
              `Return a corrected JSON where each point ID appears exactly once.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      })
      const repairContent = repair.choices?.[0]?.message?.content || ''
      parsed = JSON.parse(repairContent)
      attempts.push(parsed)
    }
  }

  parsed.version = '1.0.0'
  parsed.jlptLevel = level.toUpperCase()
  parsed.lastUpdated = new Date().toISOString().slice(0, 10)
  normalizeChapters(ids, parsed)
  validate(level, ids, parsed)

  const outPath = path.join(OUT_DIR, `${level}.json`)
  writeJson(outPath, parsed)
  console.log(`Wrote ${outPath}`)
}

async function main() {
  if (targetLevel) {
    if (!LEVELS.includes(targetLevel as any)) {
      throw new Error(`Invalid level: ${targetLevel}`)
    }
    await generate(targetLevel as typeof LEVELS[number])
    return
  }
  for (const level of LEVELS) {
    await generate(level)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
