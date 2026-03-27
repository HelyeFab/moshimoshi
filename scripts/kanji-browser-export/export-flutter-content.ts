import fs from 'node:fs/promises'
import path from 'node:path'

import { KanjiBrowserAdapter } from '@/lib/review-engine/adapters/KanjiBrowserAdapter'
import type { JLPTLevel, Kanji } from '@/types/kanji'

type RawKanji = {
  kanji: string
  meaning: string
  onyomi?: string[]
  kunyomi?: string[]
  grade?: number
}

type ExportExample = {
  word: string
  reading: string
  meaning: string
}

type FlutterCatalogEntry = {
  character: string
  primaryMeaning: string
  meanings: string[]
  onyomi: string[]
  kunyomi: string[]
  jlptLevel: JLPTLevel
  strokeCount: number
  grade?: number
  frequency?: number
  examples?: ExportExample[]
  radicals?: string[]
  components?: string[]
}

type FlutterExportManifest = {
  version: 1
  generatedAt: string
  source: 'moshimoshi'
  catalog: FlutterCatalogEntry[]
  studySequences: Record<string, Awaited<ReturnType<KanjiBrowserAdapter['generateStudySequence']>>>
}

const LEVEL_FILE_MAP: Record<JLPTLevel, string> = {
  N5: 'jlpt_5.json',
  N4: 'jlpt_4.json',
  N3: 'jlpt_3.json',
  N2: 'jlpt_2.json',
  N1: 'jlpt_1.json',
}

const STROKE_COUNTS = new Map<string, number>([
  ['人', 2],
  ['一', 1],
  ['日', 4],
  ['年', 6],
  ['大', 3],
  ['月', 4],
  ['水', 4],
  ['火', 4],
  ['木', 4],
  ['金', 8],
  ['土', 3],
  ['子', 3],
  ['女', 3],
  ['男', 7],
  ['中', 4],
  ['小', 3],
  ['上', 3],
  ['下', 3],
  ['左', 5],
  ['右', 5],
  ['本', 5],
  ['今', 4],
  ['何', 7],
  ['時', 10],
  ['分', 4],
  ['前', 9],
  ['後', 9],
  ['週', 11],
  ['来', 7],
  ['見', 7],
])

const FREQUENCIES = new Map<string, number>([
  ['人', 5],
  ['一', 2],
  ['日', 1],
  ['年', 3],
  ['大', 7],
  ['月', 4],
  ['水', 78],
  ['火', 574],
  ['木', 464],
  ['金', 53],
  ['土', 363],
  ['子', 72],
  ['女', 151],
  ['男', 240],
  ['中', 11],
  ['小', 114],
  ['上', 35],
  ['下', 97],
  ['左', 630],
  ['右', 602],
  ['本', 10],
  ['今', 49],
  ['何', 340],
  ['時', 16],
  ['分', 26],
  ['前', 27],
  ['後', 29],
  ['週', 146],
  ['来', 89],
  ['見', 22],
])

const EXAMPLES = new Map<string, ExportExample[]>([
  ['人', [
    { word: '日本人', reading: 'にほんじん', meaning: 'Japanese person' },
    { word: '人々', reading: 'ひとびと', meaning: 'people' },
    { word: '外国人', reading: 'がいこくじん', meaning: 'foreigner' },
  ]],
  ['一', [
    { word: '一つ', reading: 'ひとつ', meaning: 'one (thing)' },
    { word: '一人', reading: 'ひとり', meaning: 'one person' },
    { word: '一月', reading: 'いちがつ', meaning: 'January' },
  ]],
  ['日', [
    { word: '日本', reading: 'にほん', meaning: 'Japan' },
    { word: '日曜日', reading: 'にちようび', meaning: 'Sunday' },
    { word: '今日', reading: 'きょう', meaning: 'today' },
  ]],
  ['年', [
    { word: '今年', reading: 'ことし', meaning: 'this year' },
    { word: '来年', reading: 'らいねん', meaning: 'next year' },
    { word: '一年', reading: 'いちねん', meaning: 'one year' },
  ]],
  ['大', [
    { word: '大きい', reading: 'おおきい', meaning: 'big' },
    { word: '大学', reading: 'だいがく', meaning: 'university' },
    { word: '大人', reading: 'おとな', meaning: 'adult' },
  ]],
])

function parseArgs(argv: string[]) {
  const options = {
    out: path.join(process.cwd(), 'tmp', 'kanji-browser-flutter-export.json'),
    pretty: false,
    limit: undefined as number | undefined,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') {
      options.out = argv[i + 1] ?? options.out
      i += 1
    } else if (arg === '--pretty') {
      options.pretty = true
    } else if (arg === '--limit') {
      const value = Number(argv[i + 1])
      if (Number.isFinite(value) && value > 0) {
        options.limit = value
      }
      i += 1
    }
  }

  return options
}

function splitMeanings(rawMeaning: string): string[] {
  const values = rawMeaning
    .split(';')
    .map(value => value.trim())
    .filter(Boolean)

  return values.length > 0 ? Array.from(new Set(values)) : [rawMeaning.trim()]
}

async function readRawKanjiByLevel(level: JLPTLevel): Promise<RawKanji[]> {
  const filePath = path.join(process.cwd(), 'public', 'data', 'kanji', LEVEL_FILE_MAP[level])
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as RawKanji[]
}

function normalizeKanji(raw: RawKanji, level: JLPTLevel): Kanji {
  const meanings = splitMeanings(raw.meaning)
  return {
    kanji: raw.kanji,
    meaning: raw.meaning,
    meanings,
    onyomi: raw.onyomi ?? [],
    kunyomi: raw.kunyomi ?? [],
    jlpt: level,
    strokeCount: STROKE_COUNTS.get(raw.kanji) ?? 0,
    grade: raw.grade,
    frequency: FREQUENCIES.get(raw.kanji),
    examples: EXAMPLES.get(raw.kanji) ?? [],
  }
}

function toCatalogEntry(kanji: Kanji): FlutterCatalogEntry {
  return {
    character: kanji.kanji,
    primaryMeaning: kanji.meanings[0] ?? kanji.meaning,
    meanings: kanji.meanings,
    onyomi: kanji.onyomi,
    kunyomi: kanji.kunyomi,
    jlptLevel: kanji.jlpt,
    strokeCount: kanji.strokeCount,
    grade: typeof kanji.grade === 'number' ? kanji.grade : undefined,
    frequency: kanji.frequency,
    examples: kanji.examples.length > 0 ? kanji.examples : undefined,
    radicals: kanji.radicals,
    components: kanji.components,
  }
}

async function loadAllKanji(): Promise<Kanji[]> {
  const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
  const all = await Promise.all(levels.map(async level => {
    const raw = await readRawKanjiByLevel(level)
    return raw.map(item => normalizeKanji(item, level))
  }))

  return all.flat()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const adapter = new KanjiBrowserAdapter()
  const allKanji = await loadAllKanji()
  const selectedKanji = options.limit ? allKanji.slice(0, options.limit) : allKanji

  const studySequences: FlutterExportManifest['studySequences'] = {}
  for (const kanji of selectedKanji) {
    studySequences[kanji.kanji] = await adapter.generateStudySequence(kanji)
  }

  const manifest: FlutterExportManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'moshimoshi',
    catalog: selectedKanji.map(toCatalogEntry),
    studySequences,
  }

  await fs.mkdir(path.dirname(options.out), { recursive: true })
  await fs.writeFile(
    options.out,
    JSON.stringify(manifest, null, options.pretty ? 2 : undefined),
    'utf8'
  )

  console.log(
    `[kanji-browser-export] wrote ${manifest.catalog.length} catalog entries and ` +
    `${Object.keys(manifest.studySequences).length} study sequences to ${options.out}`
  )
}

main().catch(error => {
  console.error('[kanji-browser-export] failed:', error)
  process.exitCode = 1
})
