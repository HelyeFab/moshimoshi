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
const OUT_PATH = path.join(process.cwd(), 'public/data/grammar/category-labels.json')

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

async function generateLabels(categories: string[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      {
        role: 'system',
        content:
          'Return JSON only. Provide localized labels for grammar categories. Keep labels concise.',
      },
      {
        role: 'user',
        content: `Categories: ${JSON.stringify(categories)}\n\nReturn JSON schema:\n{\n  "version": "1.0.0",\n  "lastUpdated": "YYYY-MM-DD",\n  "labels": {\n    "category-slug": {"en": "...", "ja": "...", "de": "...", "es": "...", "fr": "...", "it": "..."}\n  }\n}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const content = response.choices?.[0]?.message?.content || ''
  const parsed = JSON.parse(content)
  parsed.version = '1.0.0'
  parsed.lastUpdated = new Date().toISOString().slice(0, 10)
  return parsed
}

async function main() {
  const categories = new Set<string>()
  for (const level of LEVELS) {
    const indexPath = path.join(process.cwd(), `public/data/grammar/${level}-index.json`)
    const index = readJson<any>(indexPath)
    for (const point of index.points || []) {
      if (point.category) categories.add(point.category)
    }
  }

  const list = Array.from(categories).sort()
  const data = await generateLabels(list)
  writeJson(OUT_PATH, data)
  console.log(`Wrote ${OUT_PATH}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
