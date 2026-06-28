#!/usr/bin/env node
/**
 * build-jmdict-freq.mjs
 *
 * Generates `public/data/dictionary/jmdict-freq.json` — a compact
 * `{ entryId: frequencyBand }` sidecar (lower band = more frequent) used by the
 * dictionary search to rank the everyday word first (本 above 書籍, 家 above
 * ハウス, 金 above マネー, 魚 above 漁る, …). This is the data-driven replacement
 * for the old hardcoded COMMON_WORDS table.
 *
 * TWO FREQUENCY SOURCES, MERGED
 *   1. BCCWJ (NINJAL) — the 100M-word Balanced Corpus of Contemporary Written
 *      Japanese. A real, continuous corpus ranking with full coverage of common
 *      vocabulary, so it cleanly separates near-synonyms (家 ≫ ハウス) that the
 *      JMdict bands tie. Free for research/educational use.
 *      https://clrd.ninjal.ac.jp/bccwj/en/freq-list.html  (BCCWJ-main_goihyo.zip)
 *   2. JMdict / EDRDG priority data — the `nfXX` corpus-frequency bands plus the
 *      news1/ichi1/spec1/gai1 "(P)" markers from the upstream JMdict XML. Used as
 *      a fallback for entries BCCWJ doesn't list. Same licence as the dictionary.
 *      https://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
 *
 * The shipped jmdict-simplified JSON strips both signals down to `common: true`,
 * which is why this sidecar is needed.
 *
 * USAGE
 *   node scripts/build-jmdict-freq.mjs <JMdict_e.xml> [BCCWJ.txt]
 * JMdict_e is required (or it downloads/caches JMdict_e.gz from EDRDG).
 * BCCWJ.txt (UTF-16, tab-separated, from BCCWJ-main_goihyo.zip) is optional but
 * recommended — without it the sidecar uses JMdict bands only.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import https from 'node:https'

const ROOT = process.cwd()
const COMMON = path.join(ROOT, 'public', 'data', 'dictionary', 'jmdict-eng-common.json')
const OUT = path.join(ROOT, 'public', 'data', 'dictionary', 'jmdict-freq.json')
const JMDICT_URL = 'https://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz'
const JMDICT_CACHE = path.join(os.tmpdir(), 'JMdict_e.xml')
const BUCKET = 500 // entries per band, matching JMdict's nfXX semantics

const kataToHira = s =>
  (s || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      const out = fs.createWriteStream(dest)
      res.pipe(zlib.createGunzip()).pipe(out)
      out.on('finish', () => out.close(resolve))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function getJmdictPath() {
  const arg = process.argv[2]
  if (arg) return arg
  if (fs.existsSync(JMDICT_CACHE)) return JMDICT_CACHE
  console.log(`Downloading ${JMDICT_URL} …`)
  await download(JMDICT_URL, JMDICT_CACHE)
  return JMDICT_CACHE
}

// --- JMdict priority bands (fallback) --------------------------------------
function jmdictBands(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf-8')
  const bands = {}
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  const seqRe = /<ent_seq>(\d+)<\/ent_seq>/
  const priRe = /<(?:ke|re)_pri>([a-z0-9]+)<\/(?:ke|re)_pri>/g
  let m
  while ((m = entryRe.exec(xml)) !== null) {
    const body = m[1]
    const seq = seqRe.exec(body)
    if (!seq) continue
    let nf = null, strong = false, gai1 = false, weak = false, gai2 = false, pm
    while ((pm = priRe.exec(body)) !== null) {
      const t = pm[1]
      const nfm = /^nf(\d{2})$/.exec(t)
      if (nfm) { const b = parseInt(nfm[1], 10); nf = nf === null ? b : Math.min(nf, b) }
      else if (t === 'news1' || t === 'ichi1' || t === 'spec1') strong = true
      else if (t === 'gai1') gai1 = true
      else if (t === 'news2' || t === 'ichi2' || t === 'spec2') weak = true
      else if (t === 'gai2') gai2 = true
    }
    const band = nf !== null ? nf : strong ? 3 : gai1 ? 12 : weak ? 22 : gai2 ? 32 : null
    if (band !== null) bands[seq[1]] = band
  }
  return bands
}

// --- BCCWJ corpus frequencies (primary) ------------------------------------
function bccwjFreq(txtPath) {
  // UTF-16 with BOM; tab-separated. Cols: 2=reading(katakana), 3=lemma surface,
  // 9..14 = frequency counts per register.
  const raw = fs.readFileSync(txtPath, 'utf16le').replace(/^﻿/, '')
  const lines = raw.split(/\r?\n/)
  const freq = new Map() // "surface\treadingHira" -> summed count
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const c = lines[i].split('\t')
    if (c.length < 15) continue
    const reading = kataToHira(c[2])
    const surface = c[3]
    if (!surface) continue
    let total = 0
    for (let k = 9; k <= 14; k++) total += parseInt(c[k], 10) || 0
    if (total <= 0) continue
    const key = surface + '\t' + reading
    freq.set(key, (freq.get(key) || 0) + total)
  }
  return freq
}

async function main() {
  const xmlPath = await getJmdictPath()
  const bccwjPath = process.argv[3]

  const jmBands = jmdictBands(xmlPath)
  console.log(`JMdict priority bands: ${Object.keys(jmBands).length}`)

  const common = JSON.parse(fs.readFileSync(COMMON, 'utf-8'))

  let bccwjBands = {}
  if (bccwjPath) {
    const freq = bccwjFreq(bccwjPath)
    console.log(`BCCWJ lemmas: ${freq.size}`)
    // Match each common entry to BCCWJ by (surface, reading), then rank by freq.
    const matched = []
    for (const w of common.words) {
      const kanji = w.kanji?.[0]?.text || ''
      const kana = w.kana?.[0]?.text || ''
      const readingHira = kataToHira(kana)
      const surface = kanji || kana
      const f = freq.get(surface + '\t' + readingHira) ?? freq.get(kana + '\t' + readingHira)
      if (f) matched.push({ id: w.id, f })
    }
    matched.sort((a, b) => b.f - a.f)
    matched.forEach((e, i) => { bccwjBands[e.id] = Math.min(48, Math.floor(i / BUCKET) + 1) })
    console.log(`BCCWJ-matched common entries: ${matched.length}`)
  }

  // Merge: BCCWJ band wins (continuous, full coverage); else JMdict band.
  const freqOut = {}
  const ids = new Set([...Object.keys(jmBands), ...Object.keys(bccwjBands)])
  for (const id of ids) {
    const band = bccwjBands[id] ?? jmBands[id]
    if (band != null) freqOut[id] = band
  }

  fs.writeFileSync(OUT, JSON.stringify(freqOut))
  const kb = Math.round(fs.statSync(OUT).size / 1024)
  console.log(`Wrote ${Object.keys(freqOut).length} bands → ${OUT} (${kb} KB)`)
}

main().catch(err => { console.error(err); process.exit(1) })
