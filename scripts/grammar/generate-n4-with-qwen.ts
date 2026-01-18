/**
 * Generate N4 GrammarPoint drafts using Modal-hosted Qwen (Ollama)
 *
 * Usage:
 *   npx tsx scripts/grammar/generate-n4-with-qwen.ts
 *
 * Options:
 *   --limit=N        Process only N points
 *   --start=N        Start at index N in sorted draft list
 *   --overwrite      Overwrite existing outputs
 *   --continue       Skip failures and continue
 *   --provider=NAME  Use single provider (ollama or openai)
 *   --providers=a,b  Use multiple providers round-robin (ollama,openai)
 *   --concurrency=N  Number of parallel jobs (default: provider count)
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import PQueue from 'p-queue'
import { OllamaClient } from '@/lib/ai/clients/OllamaClient'
import { getOllamaConfig } from '@/lib/ai/config/providers'
import OpenAI from 'openai'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const DRAFT_DIR = path.join(process.cwd(), 'public/data/grammar/points/n4-drafts')
const OUT_DIR = path.join(process.cwd(), 'public/data/grammar/points/n4-gpt')
const OUT_INDEX = path.join(process.cwd(), 'public/data/grammar/n4-index.gpt.json')
const OUT_CHECKLIST = path.join(process.cwd(), 'public/data/grammar/n4-gpt-checklist.md')

const args = process.argv.slice(2)
const limitArg = args.find(a => a.startsWith('--limit='))
const startArg = args.find(a => a.startsWith('--start='))
const providerArg = args.find(a => a.startsWith('--provider='))
const providersArg = args.find(a => a.startsWith('--providers='))
const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
const continueOnError = args.includes('--continue')
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null
const start = startArg ? parseInt(startArg.split('=')[1], 10) : 0
const provider = (providerArg ? providerArg.split('=')[1] : 'ollama').toLowerCase()
const providers = (providersArg ? providersArg.split('=')[1] : '')
  .split(',')
  .map(p => p.trim().toLowerCase())
  .filter(Boolean)
const overwrite = args.includes('--overwrite')
const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : null

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function collectCategories(): string[] {
  const n5Dir = path.join(process.cwd(), 'public/data/grammar/points/n5')
  if (!fs.existsSync(n5Dir)) return ['uncategorized']
  const files = fs.readdirSync(n5Dir).filter(f => f.endsWith('.json'))
  const set = new Set<string>()
  for (const f of files) {
    const p = path.join(n5Dir, f)
    try {
      const data = readJson<any>(p)
      if (data?.category) set.add(data.category)
    } catch {
      // ignore
    }
  }
  const list = Array.from(set)
  return list.length ? list.sort() : ['uncategorized']
}

function buildPrompt(seed: any, categories: string[]) {
  const titleJa = seed.title?.ja || ''
  const explanation = seed.explanation?.en || ''
  const formation = seed.structure?.pattern || ''
  const examples = Array.isArray(seed.examples) ? seed.examples.map((ex: any) => ({
    japanese: ex.japanese || '',
    romaji: ex.romaji || '',
    english: ex.english || ''
  })) : []

  return {
    system: `You are a Japanese grammar curriculum editor. Return ONLY valid JSON.\n\nOutput schema:\n{\n  "point": {\n    "id": string,\n    "version": "1.0.0",\n    "title": {"ja": string, "romaji": string, "en": string},\n    "jlptLevel": "N4",\n    "category": string,\n    "explanation": {"en": string, "ja": string},\n    "structure": {"pattern": string, "components": [{"part": string, "explanation": string, "examples": string[]}]},\n    "examples": [{"japanese": string, "romaji": string, "english": string, "breakdown": {"token": "gloss"}, "notes": string}],\n    "relatedPoints": string[],\n    "commonMistakes": [{"mistake": string, "correction": string, "example": string}],\n    "tags": string[]\n  },\n  "index": {\n    "shortDescription": string,\n    "difficulty": "intermediate"\n  }\n}\n\nRules:\n- Use category from this allowed list: ${categories.join(', ')}\n- shortDescription must be 50-100 characters in English.\n- Keep meaning faithful to the seed text; do not invent unrelated grammar.\n- Use natural Japanese/English; concise but clear.\n- relatedPoints can be empty array if unsure.\n- tags must include "n4" and 3-6 additional relevant tags.\n- If examples are missing breakdown, add 3-8 key token glosses.\n- Do not include extra keys.` ,
    user: `Seed data (use and improve):\nTitle (JA): ${titleJa}\nFormation: ${formation}\nExplanation (EN): ${explanation}\nExamples: ${JSON.stringify(examples)}\n\nReturn the JSON object with point + index.`
  }
}

async function generateWithOllama(ollama: OllamaClient, seed: any, categories: string[]) {
  const { system, user } = buildPrompt(seed, categories)

  const response = await ollama.generate({
    prompt: `${system}\n\n${user}`,
    format: 'json',
    options: {
      temperature: 0.4,
      top_p: 0.9,
      num_predict: 900,
    },
  })

  let parsed: any
  try {
    parsed = JSON.parse(response.response)
  } catch (err) {
    // Retry once with stricter formatting hints
    const repair = await ollama.generate({
      prompt: `${system}\n\nImportant: Return ONLY valid JSON. No trailing commas. Ensure all arrays/objects are closed.\n\n${user}`,
      format: 'json',
      options: {
        temperature: 0.2,
        top_p: 0.9,
        num_predict: 900,
      },
    })
    try {
      parsed = JSON.parse(repair.response)
    } catch (err2) {
      throw new Error(`Failed to parse JSON: ${String(err2)}`)
    }
  }

  if (!parsed?.point || !parsed?.index) {
    throw new Error('Missing point or index in response')
  }

  return parsed
}

async function generateWithOpenAI(openai: OpenAI, seed: any, categories: string[]) {
  const { system, user } = buildPrompt(seed, categories)

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const content = response.choices?.[0]?.message?.content || ''
  let parsed: any
  try {
    parsed = parseJsonSafe(content)
  } catch (err) {
    const repair = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are a JSON repair bot. Fix invalid JSON and return only a valid JSON object that matches the expected schema.',
        },
        { role: 'user', content: `Expected schema:\n${system}\n\nInvalid JSON:\n${content}` },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })
    const repairContent = repair.choices?.[0]?.message?.content || ''
    parsed = parseJsonSafe(repairContent)
  }

  if (!parsed?.point || !parsed?.index) {
    throw new Error('Missing point or index in response')
  }

  return parsed
}

function parseJsonSafe(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    const startIdx = content.indexOf('{')
    const endIdx = content.lastIndexOf('}')
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      throw new Error('Failed to parse JSON: no JSON object found')
    }
    const sliced = content.slice(startIdx, endIdx + 1)
    try {
      return JSON.parse(sliced)
    } catch (err) {
      throw new Error(`Failed to parse JSON: ${String(err)}`)
    }
  }
}
function validateAndFix(seed: any, generated: any) {
  const point = generated.point
  const index = generated.index

  // Ensure stable identity
  point.id = seed.id
  point.version = '1.0.0'
  point.jlptLevel = 'N4'

  if (!point.title) point.title = { ja: seed.title?.ja || '', romaji: '', en: '' }
  if (!point.title.ja) point.title.ja = seed.title?.ja || ''

  if (!point.explanation) point.explanation = { en: seed.explanation?.en || '', ja: '' }
  if (!point.explanation.en) point.explanation.en = seed.explanation?.en || ''

  if (!point.structure) point.structure = { pattern: seed.structure?.pattern || '', components: [] }
  if (!point.structure.pattern) point.structure.pattern = seed.structure?.pattern || ''

  if (!Array.isArray(point.examples)) point.examples = seed.examples || []

  if (!Array.isArray(point.relatedPoints)) point.relatedPoints = []
  if (!Array.isArray(point.commonMistakes)) point.commonMistakes = []
  if (!Array.isArray(point.tags)) point.tags = ['n4']

  index.difficulty = 'intermediate'

  return { point, index }
}

function buildChecklist(points: any[], indexPoints: any[]) {
  const lines: string[] = []
  lines.push('# N4 GPT Checklist')
  lines.push('')
  lines.push('Fields that still need review/QA:')
  lines.push('')
  lines.push(`Total points: ${points.length}`)
  lines.push('')

  for (const p of points) {
    const missing: string[] = []

    if (!p.title?.ja) missing.push('title.ja')
    if (!p.title?.romaji) missing.push('title.romaji')
    if (!p.title?.en) missing.push('title.en')
    if (!p.category || p.category === 'uncategorized') missing.push('category')
    if (!p.explanation?.en) missing.push('explanation.en')
    if (!p.explanation?.ja) missing.push('explanation.ja')
    if (!p.structure?.components?.length) missing.push('structure.components')
    if (!p.relatedPoints?.length) missing.push('relatedPoints')
    if (!p.commonMistakes?.length) missing.push('commonMistakes')
    if (!p.tags?.length) missing.push('tags')

    const idx = indexPoints.find(i => i.id === p.id)
    if (!idx?.shortDescription) missing.push('index.shortDescription')
    if (idx?.shortDescription) {
      const len = idx.shortDescription.length
      if (len < 50 || len > 100) missing.push('index.shortDescription length 50-100')
    }

    const missingBreakdown = (p.examples || []).some((ex: any) => !ex.breakdown || Object.keys(ex.breakdown).length === 0)
    if (missingBreakdown) missing.push('examples.breakdown')

    lines.push(`- ${p.id} | ${p.title?.ja || '(missing title)'}`)
    lines.push(`  Missing: ${missing.join(', ')}`)
  }

  return lines.join('\n') + '\n'
}

async function main() {
  let ollama: OllamaClient | null = null
  let openai: OpenAI | null = null

  const providerList = providers.length ? providers : [provider]
  const useOllama = providerList.includes('ollama')
  const useOpenAI = providerList.includes('openai')

  if (providerList.some(p => p !== 'ollama' && p !== 'openai')) {
    console.error('Invalid provider. Use --provider=ollama|openai or --providers=ollama,openai')
    process.exit(1)
  }

  if (useOllama) {
    const ollamaConfig = getOllamaConfig()
    if (!ollamaConfig.apiKey || !ollamaConfig.baseUrl) {
      console.error('Missing Ollama config. Check .env.local for OLLAMA_BASE_URL and MODAL_API_KEY.')
      process.exit(1)
    }
    ollama = new OllamaClient(ollamaConfig)
  }

  if (useOpenAI) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY in .env.local.')
      process.exit(1)
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  if (!fs.existsSync(DRAFT_DIR)) {
    console.error(`Draft dir not found: ${DRAFT_DIR}`)
    process.exit(1)
  }

  ensureDir(OUT_DIR)

  const categories = collectCategories()
  const files = fs.readdirSync(DRAFT_DIR).filter(f => f.endsWith('.json'))
  const sliced = files.slice(start)
  const todo = limit ? sliced.slice(0, limit) : sliced

  const queue = new PQueue({ concurrency: concurrency || providerList.length || 1 })

  const outPoints: any[] = []
  const outIndexPoints: any[] = []

  let processed = 0

  let providerIdx = 0

  for (const file of todo) {
    queue.add(async () => {
      const inPath = path.join(DRAFT_DIR, file)
      const outPath = path.join(OUT_DIR, file)

      if (!overwrite && fs.existsSync(outPath)) {
        const existing = readJson<any>(outPath)
        outPoints.push(existing)
        processed++
        console.log(`Skipping ${file} (exists) [${processed}/${todo.length}]`)
        return
      }

      const seed = readJson<any>(inPath)

      let generated: any
      let attempt = 0
      let lastErr: any

      while (attempt < 2) {
        attempt++
        try {
          const picked = providerList[providerIdx % providerList.length]
          providerIdx++

          if (picked === 'ollama') {
            generated = await generateWithOllama(ollama as OllamaClient, seed, categories)
          } else {
            generated = await generateWithOpenAI(openai as OpenAI, seed, categories)
          }
          break
        } catch (err) {
          lastErr = err
          console.warn(`⚠️  ${file} attempt ${attempt} failed:`, (err as Error).message)
          // If multiple providers available, try the other on the next attempt
        }
      }

      if (!generated) {
        if (continueOnError) {
          console.warn(`❌ Skipping ${file} after failures: ${String(lastErr)}`)
          return
        }
        throw new Error(`Failed to generate for ${file}: ${String(lastErr)}`)
      }

      const { point, index } = validateAndFix(seed, generated)

      writeJson(outPath, point)
      outPoints.push(point)
      outIndexPoints.push({
        id: point.id,
        order: outIndexPoints.length + 1,
        category: point.category || 'uncategorized',
        title: point.title,
        shortDescription: index.shortDescription || '',
        jlptLevel: 'N4',
        difficulty: 'intermediate',
      })

      processed++
      console.log(`Generated ${file} [${processed}/${todo.length}]`)
    })
  }

  await queue.onIdle()

  // Build index output
  const index = {
    version: '1.0.0',
    jlptLevel: 'N4',
    totalPoints: outIndexPoints.length,
    lastUpdated: '2026-01-17',
    points: outIndexPoints,
  }

  writeJson(OUT_INDEX, index)

  const checklist = buildChecklist(outPoints, outIndexPoints)
  fs.writeFileSync(OUT_CHECKLIST, checklist)

  console.log(`\n✅ Done. Wrote ${outPoints.length} points.`)
  console.log(`Index: ${OUT_INDEX}`)
  console.log(`Checklist: ${OUT_CHECKLIST}`)
}

main().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
