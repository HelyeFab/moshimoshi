import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'
import { pathToFileURL } from 'url'

const LOCALES = ['ja', 'de', 'es', 'fr', 'it'] as const
const DEFAULT_MODEL = 'gpt-4o-mini'
const STRINGS_ROOT = path.join(process.cwd(), 'src/i18n/locales')

const grammarStallKeys = [
  'title',
  'description',
  'jlptBadge',
  'explanation',
  'structure',
  'examples',
  'related',
  'practice',
  'example',
  'breakdown',
  'note',
  'pattern',
  'componentExamples',
] as const

type GrammarStallKeys = (typeof grammarStallKeys)[number]

interface GrammarStallBlock {
  title: string
  description: string
  jlptBadge: string
  explanation: string
  structure: string
  examples: string
  related: string
  practice: string
  example: string
  breakdown: string
  note: string
  pattern: string
  componentExamples: string
  breadcrumb: {
    learn: string
    grammar: string
  }
}

async function loadEnvFile(envPath: string) {
  try {
    const raw = await fs.readFile(envPath, 'utf-8')
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\n/g, '\n')
      }
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // ignore missing env file
  }
}

async function importLocaleStrings(locale: string) {
  const filePath = path.join(STRINGS_ROOT, locale, 'strings.ts')
  const module = await import(pathToFileURL(filePath).href)
  return module.strings as Record<string, any>
}

function escapeString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function formatGrammarStallBlock(block: GrammarStallBlock) {
  return [
    '  grammarStall: {',
    `    title: '${escapeString(block.title)}',`,
    `    description: '${escapeString(block.description)}',`,
    `    jlptBadge: '${escapeString(block.jlptBadge)}',`,
    `    explanation: '${escapeString(block.explanation)}',`,
    `    structure: '${escapeString(block.structure)}',`,
    `    examples: '${escapeString(block.examples)}',`,
    `    related: '${escapeString(block.related)}',`,
    `    practice: '${escapeString(block.practice)}',`,
    `    example: '${escapeString(block.example)}',`,
    `    breakdown: '${escapeString(block.breakdown)}',`,
    `    note: '${escapeString(block.note)}',`,
    `    pattern: '${escapeString(block.pattern)}',`,
    `    componentExamples: '${escapeString(block.componentExamples)}',`,
    '    breadcrumb: {',
    `      learn: '${escapeString(block.breadcrumb.learn)}',`,
    `      grammar: '${escapeString(block.breadcrumb.grammar)}',`,
    '    },',
    '  },',
  ].join('\n')
}

function findMatchingBrace(content: string, startIndex: number) {
  let depth = 0
  let inSingle = false
  let inDouble = false
  let inTemplate = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = startIndex; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }

    if (inSingle) {
      if (char === '\\' && next) {
        i += 1
        continue
      }
      if (char === "'") inSingle = false
      continue
    }

    if (inDouble) {
      if (char === '\\' && next) {
        i += 1
        continue
      }
      if (char === '"') inDouble = false
      continue
    }

    if (inTemplate) {
      if (char === '\\' && next) {
        i += 1
        continue
      }
      if (char === '`') inTemplate = false
      continue
    }

    if (char === '/' && next === '/') {
      inLineComment = true
      i += 1
      continue
    }

    if (char === '/' && next === '*') {
      inBlockComment = true
      i += 1
      continue
    }

    if (char === "'") {
      inSingle = true
      continue
    }

    if (char === '"') {
      inDouble = true
      continue
    }

    if (char === '`') {
      inTemplate = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }

  return -1
}

function replaceOrInsertGrammarStall(content: string, block: string) {
  const existingMatch = content.match(/\bgrammarStall\s*:\s*\{/)
  if (existingMatch?.index !== undefined) {
    const braceStart = content.indexOf('{', existingMatch.index)
    const braceEnd = findMatchingBrace(content, braceStart)
    if (braceEnd === -1) {
      throw new Error('Failed to parse existing grammarStall block')
    }
    let endIndex = braceEnd + 1
    while (endIndex < content.length && /\s/.test(content[endIndex])) endIndex += 1
    if (content[endIndex] === ',') endIndex += 1
    return content.slice(0, existingMatch.index) + block + content.slice(endIndex)
  }

  const learnMatch = content.match(/\blearn\s*:\s*\{/)?.index
  if (learnMatch === undefined) {
    throw new Error('Failed to find learn block to insert grammarStall')
  }
  const learnBraceStart = content.indexOf('{', learnMatch)
  const learnBraceEnd = findMatchingBrace(content, learnBraceStart)
  if (learnBraceEnd === -1) {
    throw new Error('Failed to parse learn block')
  }

  let insertIndex = learnBraceEnd + 1
  while (insertIndex < content.length && /\s/.test(content[insertIndex])) insertIndex += 1
  if (content[insertIndex] === ',') insertIndex += 1

  const before = content.slice(0, insertIndex)
  const after = content.slice(insertIndex)
  return `${before}\n\n${block}${after}`
}

function buildSchema() {
  const properties: Record<string, any> = {}
  for (const key of grammarStallKeys) {
    properties[key] = { type: 'string' }
  }
  properties.breadcrumb = {
    type: 'object',
    additionalProperties: false,
    properties: {
      learn: { type: 'string' },
      grammar: { type: 'string' },
    },
    required: ['learn', 'grammar'],
  }

  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: [...grammarStallKeys, 'breadcrumb'],
  }
}

async function translateGrammarStall(
  client: OpenAI,
  model: string,
  locale: string,
  base: GrammarStallBlock
) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You are a localization assistant. Translate UI strings from English into the target locale. Keep placeholders like {{count}} and {{level}} intact. Keep "JLPT" as-is. Return only JSON that matches the provided schema.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Target locale: ${locale}\n\nSource JSON:\n${JSON.stringify(base, null, 2)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'grammar_stall_translations',
        schema: buildSchema(),
        strict: true,
      },
    },
  })

  const raw = response.output_text
  if (!raw) {
    throw new Error('No response text received from OpenAI')
  }

  return JSON.parse(raw) as GrammarStallBlock
}

async function main() {
  const shouldWrite = process.argv.includes('--write')
  await loadEnvFile(path.join(process.cwd(), '.env.local'))

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY or OPEN_AI_API_KEY not set')
  }

  const model = process.env.OPENAI_TRANSLATE_MODEL || DEFAULT_MODEL
  const client = new OpenAI({ apiKey })

  const enStrings = await importLocaleStrings('en')
  if (!enStrings.grammarStall) {
    throw new Error('Missing grammarStall block in en strings')
  }

  const base = enStrings.grammarStall as GrammarStallBlock

  for (const locale of LOCALES) {
    const localePath = path.join(STRINGS_ROOT, locale, 'strings.ts')
    const fileContent = await fs.readFile(localePath, 'utf-8')

    const translated = await translateGrammarStall(client, model, locale, base)
    const block = formatGrammarStallBlock(translated)
    const updated = replaceOrInsertGrammarStall(fileContent, block)

    if (shouldWrite) {
      await fs.writeFile(localePath, updated, 'utf-8')
      console.log(`[${locale}] updated`) // eslint-disable-line no-console
    } else {
      console.log(`\n[${locale}] Suggested block:\n${block}`) // eslint-disable-line no-console
    }
  }
}

main().catch((error) => {
  console.error('[translate-missing-grammar-stall] Failed:', error) // eslint-disable-line no-console
  process.exit(1)
})
