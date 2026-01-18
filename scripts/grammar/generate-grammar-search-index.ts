import fs from 'fs'
import path from 'path'

const LEVELS = ['n5', 'n4'] as const
const OUT_PATH = path.join(process.cwd(), 'public/data/grammar/search-index.json')

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

function buildSearchText(parts: string[]) {
  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function getPointTags(level: string, pointId: string) {
  const pointPath = path.join(
    process.cwd(),
    'public/data/grammar/points',
    level,
    `${pointId}.json`
  )
  try {
    const point = readJson<any>(pointPath)
    return Array.isArray(point.tags) ? point.tags : []
  } catch {
    return []
  }
}

async function main() {
  const entries: any[] = []

  for (const level of LEVELS) {
    const indexPath = path.join(process.cwd(), `public/data/grammar/${level}-index.json`)
    const index = readJson<any>(indexPath)
    for (const point of index.points || []) {
      const tags = getPointTags(level, point.id)
      const searchText = buildSearchText([
        point.title?.ja,
        point.title?.romaji,
        point.title?.en,
        point.shortDescription,
        point.category,
        ...(tags || []),
      ])
      entries.push({
        id: point.id,
        level,
        jlptLevel: point.jlptLevel,
        category: point.category || 'uncategorized',
        title: point.title,
        shortDescription: point.shortDescription || '',
        tags,
        searchText,
      })
    }
  }

  const output = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString().slice(0, 10),
    totalPoints: entries.length,
    entries,
  }

  writeJson(OUT_PATH, output)
  console.log(`Wrote ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
