const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'src', 'lib', 'conjugation', 'usage', 'conjugation-usage-notes.ts')
const source = fs.readFileSync(filePath, 'utf8')

const rawMatch = source.match(
  /const RAW_USAGE_NOTES: Partial<Record<ConjugationFormKey, ConjugationUsageByType>> = \{([\s\S]*?)^\}\n\nconst CURATED_CONJUGATION_USAGE_NOTES/m
)

if (!rawMatch) {
  console.error('Failed to locate RAW_USAGE_NOTES block in conjugation-usage-notes.ts')
  process.exit(1)
}

const rawBlock = rawMatch[1]
const entryMatches = [...rawBlock.matchAll(/^\s{2}"([^"]+)":\s*\{([\s\S]*?)^\s{2}\},?/gm)]

if (entryMatches.length === 0) {
  console.error('No usage-note entries found in RAW_USAGE_NOTES')
  process.exit(1)
}

const pending = []

for (const match of entryMatches) {
  const key = match[1]
  const body = match[2]
  if (!/"reviewed":\s*true/.test(body)) {
    pending.push(key)
  }
}

if (pending.length > 0) {
  console.error(`Conjugation usage notes review check failed: ${pending.length} entries are not reviewed.`)
  for (const key of pending) {
    console.error(`- ${key}`)
  }
  process.exit(1)
}

console.log(`Conjugation usage notes review check passed: ${entryMatches.length}/${entryMatches.length} entries reviewed.`)
