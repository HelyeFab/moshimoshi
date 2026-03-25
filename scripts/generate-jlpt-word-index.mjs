import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const RAW_DIR = path.join(ROOT, 'src', 'data', 'external', 'jlpt-word-list', 'raw')
const GENERATED_DIR = path.join(ROOT, 'src', 'data', 'external', 'jlpt-word-list', 'generated')
const OUTPUT_FILE = path.join(GENERATED_DIR, 'jlpt-word-index.json')

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))
  })
}

function normalizeTags(tags) {
  return tags
    .split(/\s+/)
    .map(tag => tag.trim())
    .filter(Boolean)
}

function compareEntries(a, b) {
  if (a.jlpt !== b.jlpt) return LEVELS.indexOf(a.jlpt) - LEVELS.indexOf(b.jlpt)
  if (a.expression !== b.expression) return a.expression.localeCompare(b.expression, 'ja')
  return a.reading.localeCompare(b.reading, 'ja')
}

async function main() {
  const levels = {}
  const byExpression = {}
  const counts = {}

  for (const level of LEVELS) {
    const rawPath = path.join(RAW_DIR, `${level.toLowerCase()}.csv`)
    const csv = await fs.readFile(rawPath, 'utf8')
    const rows = parseCsv(csv)

    const entries = rows.map((row, index) => ({
      expression: row.expression.trim(),
      reading: row.reading.trim(),
      meaning: row.meaning.trim(),
      tags: normalizeTags(row.tags || ''),
      jlpt: level,
      sourceRow: index + 2,
    }))

    levels[level] = entries
    counts[level] = entries.length

    for (const entry of entries) {
      if (!entry.expression) continue
      const key = entry.expression
      if (!byExpression[key]) byExpression[key] = []
      byExpression[key].push(entry)
    }
  }

  for (const expression of Object.keys(byExpression)) {
    byExpression[expression].sort(compareEntries)
  }

  await fs.mkdir(GENERATED_DIR, { recursive: true })
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'elzup/jlpt-word-list',
        levels,
        byExpression,
        counts,
      },
      null,
      2
    ) + '\n'
  )

  console.log(`[JLPTWordIndex] Wrote ${OUTPUT_FILE}`)
  console.log(`[JLPTWordIndex] Counts: ${JSON.stringify(counts)}`)
}

main().catch(error => {
  console.error('[JLPTWordIndex] Failed to build index:', error)
  process.exitCode = 1
})
