#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_VIDEOS = ['Xs0Lxif1u9E', 't9U8QfOxMMw']
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000'
const DEFAULT_LANG = 'ja'
const ORPHAN_PARTICLE_REGEX = /^(ね|よ|な|か|さ|ぞ|ぜ|わ|よね|ねえ|ねぇ)[。！？!?]?$/
const SENTENCE_END_REGEX = /[。！？!?]$/

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    lang: DEFAULT_LANG,
    forceRefresh: false,
    videos: [...DEFAULT_VIDEOS],
    out: '02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/benchmark-latest.json',
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--force-refresh') options.forceRefresh = true
    else if (arg.startsWith('--base-url=')) options.baseUrl = arg.split('=')[1]
    else if (arg.startsWith('--lang=')) options.lang = arg.split('=')[1]
    else if (arg.startsWith('--videos=')) {
      options.videos = arg
        .split('=')[1]
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    } else if (arg.startsWith('--out=')) {
      options.out = arg.split('=')[1]
    } else if (arg === '--help') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp() {
  console.log(`YouTube Shadowing Benchmark

Usage:
  node scripts/youtube-shadowing-benchmark.mjs [options]

Options:
  --base-url=http://127.0.0.1:3000
  --lang=ja
  --videos=Xs0Lxif1u9E,t9U8QfOxMMw
  --force-refresh
  --out=02-PRODUCTION_DOCS/youtube-shadowing/agent-execution/benchmark-latest.json
`)
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function analyzeSegments(segments) {
  const safe = Array.isArray(segments) ? segments : []
  const total = safe.length
  if (total === 0) {
    return {
      total: 0,
      shortTextCount: 0,
      shortTextRatio: 0,
      longDurationCount: 0,
      overlapCount: 0,
      orphanParticleCount: 0,
      tinyFragmentCount: 0,
      tinyFragmentRatio: 0,
      tinyCharCount: 0,
      first10TinyCount: 0,
    }
  }

  let shortTextCount = 0
  let longDurationCount = 0
  let overlapCount = 0
  let orphanParticleCount = 0
  let tinyFragmentCount = 0
  let tinyCharCount = 0
  let first10TinyCount = 0
  let brokenFragmentCount = 0
  let first10BrokenCount = 0

  for (let i = 0; i < safe.length; i++) {
    const seg = safe[i] || {}
    const text = String(seg.text || '').trim()
    const start = toNumber(seg.start, toNumber(seg.startTime, 0))
    const end = toNumber(seg.end, toNumber(seg.endTime, start))
    const duration = Math.max(0, end - start)
    const prev = i > 0 ? safe[i - 1] : null
    const prevEnd = prev
      ? toNumber(prev.end, toNumber(prev.endTime, toNumber(prev.start, toNumber(prev.startTime, 0))))
      : null

    // A "broken fragment" is < 4 chars without sentence-ending punctuation.
    // Natural short utterances (うん。, はい。) are excluded.
    const isBroken = text.length > 0 && text.length < 4 && !SENTENCE_END_REGEX.test(text)

    if (text.length < 8) shortTextCount += 1
    if (duration > 10) longDurationCount += 1
    if (prevEnd != null && start < prevEnd) overlapCount += 1
    if (ORPHAN_PARTICLE_REGEX.test(text)) orphanParticleCount += 1
    if (text.length < 6 || duration < 1.2) tinyFragmentCount += 1
    if (text.length < 4) tinyCharCount += 1
    if (i < 10 && text.length < 4) first10TinyCount += 1
    if (isBroken) brokenFragmentCount += 1
    if (i < 10 && isBroken) first10BrokenCount += 1
  }

  return {
    total,
    shortTextCount,
    shortTextRatio: shortTextCount / total,
    longDurationCount,
    overlapCount,
    orphanParticleCount,
    tinyFragmentCount,
    tinyFragmentRatio: total > 0 ? tinyFragmentCount / total : 0,
    tinyCharCount,
    first10TinyCount,
    brokenFragmentCount,
    brokenFragmentRatio: total > 0 ? brokenFragmentCount / total : 0,
    first10BrokenCount,
  }
}

function evaluateVideo(videoId, payload, segmentStats) {
  const processing = payload?.processing || {}
  const aiReason = processing.aiReason || 'unknown'
  const aiMethod = processing.aiMethod || 'unknown'
  const aiAcceptRatio = toNumber(processing.ai_accept_ratio, 0)

  const rules = []
  rules.push({
    name: 'No overlap timeline',
    pass: segmentStats.overlapCount === 0,
    detail: `overlapCount=${segmentStats.overlapCount}`,
  })
  rules.push({
    name: 'No >10s segments',
    pass: segmentStats.longDurationCount === 0,
    detail: `longDurationCount=${segmentStats.longDurationCount}`,
  })
  rules.push({
    name: 'Low orphan particles',
    pass: segmentStats.orphanParticleCount <= 1,
    detail: `orphanParticleCount=${segmentStats.orphanParticleCount}`,
  })

  // Hard anti-fragment gates — only enforced when AI output is accepted.
  // Deterministic fallback reflects source caption quality which we cannot
  // improve without AI; these gates prevent shipping bad AI, not bad source.
  // Uses "broken fragment" = < 4 chars without sentence-ending punctuation.
  // This excludes natural short utterances like うん。, はい。 which are valid
  // for conversational content.
  if (aiMethod === 'ai') {
    rules.push({
      name: 'AI: Broken fragment ratio <= 0.15',
      pass: segmentStats.brokenFragmentRatio <= 0.15,
      detail: `brokenFragmentRatio=${segmentStats.brokenFragmentRatio.toFixed(3)}`,
    })
    rules.push({
      name: 'AI: First 10 segments: max 2 broken fragments',
      pass: segmentStats.first10BrokenCount <= 2,
      detail: `first10BrokenCount=${segmentStats.first10BrokenCount}`,
    })
  }

  if (videoId === 'Xs0Lxif1u9E') {
    rules.push({
      name: 'AI accepted or rare deterministic reason',
      pass:
        aiMethod === 'ai' ||
        ['openai_alignment_failed', 'openai_duration_safety_reject', 'openai_quality_regression'].includes(aiReason) ||
        aiReason.startsWith('openai_fragmentation_reject'),
      detail: `aiMethod=${aiMethod}, aiReason=${aiReason}`,
    })
  }

  if (videoId === 't9U8QfOxMMw') {
    rules.push({
      name: 'No global timeout fallback',
      pass: aiReason !== 'openai_timeout',
      detail: `aiReason=${aiReason}`,
    })
    rules.push({
      name: 'Chunked AI attempted',
      pass: toNumber(processing.ai_chunks_total, 0) > 1,
      detail: `ai_chunks_total=${toNumber(processing.ai_chunks_total, 0)}`,
    })
    rules.push({
      name: 'Meaningful AI acceptance',
      pass: aiMethod === 'ai' && aiAcceptRatio >= 0.3,
      detail: `aiMethod=${aiMethod}, ai_accept_ratio=${aiAcceptRatio.toFixed(2)}`,
    })
  }

  const failed = rules.filter(r => !r.pass)
  return {
    pass: failed.length === 0,
    failedRules: failed,
    rules,
  }
}

async function fetchTranscript(baseUrl, videoId, lang, forceRefresh) {
  const url = new URL(`/api/youtube/transcript/${videoId}`, baseUrl)
  url.searchParams.set('lang', lang)
  if (forceRefresh) url.searchParams.set('forceRefresh', 'true')

  const startedAt = Date.now()
  const response = await fetch(url.toString())
  const elapsedMs = Date.now() - startedAt
  const text = await response.text()

  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Non-JSON response (${response.status}) from ${url.toString()}`)
  }

  return { url: url.toString(), status: response.status, elapsedMs, json }
}

async function main() {
  const opts = parseArgs(process.argv)
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: opts.baseUrl,
    lang: opts.lang,
    forceRefresh: opts.forceRefresh,
    videos: [],
    overallPass: true,
  }

  for (const videoId of opts.videos) {
    console.log(`\n[benchmark] Checking ${videoId}...`)
    try {
      const result = await fetchTranscript(opts.baseUrl, videoId, opts.lang, opts.forceRefresh)
      const payload = result.json
      const segmentStats = analyzeSegments(payload.segments)
      const verdict = evaluateVideo(videoId, payload, segmentStats)

      report.videos.push({
        videoId,
        status: result.status,
        elapsedMs: result.elapsedMs,
        source: payload.source || 'unknown',
        available: Boolean(payload.available),
        totalSegments: toNumber(payload.totalSegments, segmentStats.total),
        processing: payload.processing || {},
        segmentStats,
        verdict,
      })

      if (!verdict.pass) report.overallPass = false
      const tag = verdict.pass ? 'PASS' : 'FAIL'
      console.log(`[benchmark] ${videoId}: ${tag} (${result.elapsedMs}ms)`)
      console.log(
        `[benchmark] method=${payload?.processing?.aiMethod || 'n/a'} reason=${payload?.processing?.aiReason || 'n/a'} segments=${segmentStats.total}`
      )
    } catch (error) {
      report.overallPass = false
      report.videos.push({
        videoId,
        error: error instanceof Error ? error.message : String(error),
        verdict: { pass: false, failedRules: [{ name: 'Fetch/parsing', detail: 'request failed' }] },
      })
      console.error(`[benchmark] ${videoId}: ERROR`, error instanceof Error ? error.message : error)
    }
  }

  const outPath = path.resolve(process.cwd(), opts.out)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(`\n[benchmark] Overall: ${report.overallPass ? 'PASS' : 'FAIL'}`)
  console.log(`[benchmark] Report written: ${outPath}`)
  if (!report.overallPass) process.exitCode = 1
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

