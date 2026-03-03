import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'

type Args = {
  word: string
  negativeWord: string
  routeUrl?: string
  routeCookie?: string
  serviceAccountPath?: string
  aiTimeoutMs: number
  cacheTimeoutMs: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    word: '灯る',
    negativeWord: 'テーブル',
    aiTimeoutMs: 8000,
    cacheTimeoutMs: 5000,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (!next && a.startsWith('--')) continue
    if (a === '--word' && next) {
      args.word = next
      i++
    } else if (a === '--negative-word' && next) {
      args.negativeWord = next
      i++
    } else if (a === '--route-url' && next) {
      args.routeUrl = next
      i++
    } else if (a === '--route-cookie' && next) {
      args.routeCookie = next
      i++
    } else if (a === '--service-account' && next) {
      args.serviceAccountPath = next
      i++
    } else if (a === '--ai-timeout-ms' && next) {
      const parsed = Number.parseInt(next, 10)
      if (Number.isFinite(parsed) && parsed > 0) args.aiTimeoutMs = parsed
      i++
    } else if (a === '--cache-timeout-ms' && next) {
      const parsed = Number.parseInt(next, 10)
      if (Number.isFinite(parsed) && parsed > 0) args.cacheTimeoutMs = parsed
      i++
    }
  }

  return args
}

function loadEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv')
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  } catch {
    // optional
  }
}

function applyServiceAccountFromFile(serviceAccountPath?: string) {
  const explicit = serviceAccountPath || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!explicit) return

  const abs = path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit)
  const raw = fs.readFileSync(abs, 'utf8')
  const json = JSON.parse(raw) as {
    project_id?: string
    client_email?: string
    private_key?: string
  }

  if (json.project_id && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    process.env.FIREBASE_ADMIN_PROJECT_ID = json.project_id
  }
  if (json.client_email && !process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = json.client_email
  }
  if (json.private_key && !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = json.private_key
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = abs
}

function now() {
  return new Date().toISOString()
}

function isConjugatablePos(pos: string) {
  return pos === 'verb' || pos === 'i-adjective' || pos === 'na-adjective'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnv()
  applyServiceAccountFromFile(args.serviceAccountPath)
  patchServerOnlyForNodeCli()

  const { adminDb } = await import('../src/lib/firebase/admin')
  const cache = await import('../src/lib/drill/server/drill-word-resolution-cache')
  const { DrillWordResolverProcessorHybrid } = await import('../src/lib/ai/processors/DrillWordResolverProcessorHybrid')

  if (!adminDb) {
    throw new Error('Firebase Admin is not initialized. Check .env.local / service account.')
  }

  console.log(`[${now()}] Drill AI fallback smoke starting`)
  console.log('Config:', {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'default',
    word: args.word,
    negativeWord: args.negativeWord,
    routeUrl: args.routeUrl || null,
    routeMode: !!(args.routeUrl && args.routeCookie),
  })

  const processor = new DrillWordResolverProcessorHybrid({
    model: 'gpt-4o-mini',
    config: { temperature: 0.3, maxTokens: 500 },
  })

  console.log('\n[1/4] Positive path: AI resolve + cache write/read')
  const before = await withTimeout(cache.get(args.word), args.cacheTimeoutMs, 'Cache get (before)')
  console.log('Cache before:', before ? { status: before.status, hitCount: before.hitCount, source: before.source } : null)

  const started = Date.now()
  const aiResult = await withTimeout(processor.process({ word: args.word }), args.aiTimeoutMs, 'AI resolve')
  console.log('AI result:', {
    provider: aiResult.metadata?.provider,
    model: aiResult.metadata?.model,
    durationMs: Date.now() - started,
    partOfSpeech: aiResult.data.partOfSpeech,
    conjugationType: aiResult.data.conjugationType,
    confidence: aiResult.data.confidence,
    lemma: aiResult.data.lemma,
    reading: aiResult.data.reading,
  })

  if (aiResult.data.confidence !== 'low' && isConjugatablePos(aiResult.data.partOfSpeech) && aiResult.data.conjugationType) {
    await withTimeout(cache.setResolved(
      args.word,
      {
        surface: aiResult.data.surface,
        lemma: aiResult.data.lemma,
        reading: aiResult.data.reading,
        meaning: aiResult.data.meaning ?? undefined,
        partOfSpeech: aiResult.data.partOfSpeech as any,
        conjugationType: aiResult.data.conjugationType as any,
        confidence: aiResult.data.confidence as any,
        alternatives: aiResult.data.alternatives?.map(a => `${a.lemma} (${a.reading})`) ?? undefined,
        notes: aiResult.data.notes ?? undefined,
      },
      aiResult.metadata?.provider === 'ollama' ? 'ollama' : 'openai',
    ), args.cacheTimeoutMs, 'Cache setResolved')
    console.log('Cache write: setResolved')
  } else if (aiResult.data.confidence !== 'low') {
    await withTimeout(
      cache.setUnresolved(args.word, aiResult.metadata?.provider === 'ollama' ? 'ollama' : 'openai'),
      args.cacheTimeoutMs,
      'Cache setUnresolved'
    )
    console.log('Cache write: setUnresolved (AI says non-conjugatable)')
  } else {
    console.log('Cache write skipped: low-confidence result (expected behavior)')
  }

  const after = await withTimeout(cache.get(args.word), args.cacheTimeoutMs, 'Cache get (after)')
  console.log('Cache after:', after ? {
    status: after.status,
    hitCount: after.hitCount,
    source: after.source,
    result: after.result ? {
      partOfSpeech: after.result.partOfSpeech,
      conjugationType: after.result.conjugationType,
      confidence: after.result.confidence,
      reading: after.result.reading,
    } : null,
  } : null)

  if (after) {
    await withTimeout(cache.touchHit(args.word), args.cacheTimeoutMs, 'Cache touchHit')
    const afterHit = await withTimeout(cache.get(args.word), args.cacheTimeoutMs, 'Cache get (after touchHit)')
    console.log('Cache after touchHit:', afterHit ? { hitCount: afterHit.hitCount, lastUsedAt: String(afterHit.lastUsedAt) } : null)
  }

  console.log('\n[2/4] Negative/non-conjugatable path (cache unresolved)')
  const negative = await withTimeout(processor.process({ word: args.negativeWord }), args.aiTimeoutMs, 'AI resolve (negative)')
  console.log('AI negative result:', {
    provider: negative.metadata?.provider,
    partOfSpeech: negative.data.partOfSpeech,
    conjugationType: negative.data.conjugationType,
    confidence: negative.data.confidence,
    lemma: negative.data.lemma,
  })
  if (negative.data.confidence !== 'low' && !isConjugatablePos(negative.data.partOfSpeech)) {
    await withTimeout(
      cache.setUnresolved(args.negativeWord, negative.metadata?.provider === 'ollama' ? 'ollama' : 'openai'),
      args.cacheTimeoutMs,
      'Cache setUnresolved (negative)'
    )
    const negCached = await withTimeout(cache.get(args.negativeWord), args.cacheTimeoutMs, 'Cache get (negative)')
    console.log('Negative cache status:', negCached ? { status: negCached.status, source: negCached.source } : null)
  } else {
    console.log('Negative unresolved cache write skipped (AI confidence low or still conjugatable)')
  }

  console.log('\n[3/4] Cache key normalization samples')
  console.log({
    raw: args.word,
    trimmedKey: cache.normalizeKey(`  ${args.word}  `),
    exactKey: cache.normalizeKey(args.word),
    equalAfterTrim: cache.normalizeKey(`  ${args.word}  `) === cache.normalizeKey(args.word),
  })

  console.log('\n[4/4] Optional real route smoke')
  if (args.routeUrl && args.routeCookie) {
    const routePayload = {
      mode: 'focus',
      focusWord: args.word,
      questionsCount: 5,
    }
    const resp = await fetch(args.routeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: args.routeCookie,
      },
      body: JSON.stringify(routePayload),
    })
    const json = await resp.json().catch(() => null)
    console.log('Route response:', {
      status: resp.status,
      ok: resp.ok,
      success: json?.success,
      errorCode: json?.error?.code,
      questions: Array.isArray(json?.data?.questions) ? json.data.questions.length : undefined,
    })
  } else {
    console.log('Skipped. Provide --route-url and --route-cookie for true end-to-end route verification.')
  }

  console.log(`\n[${now()}] Smoke complete`)
}

function patchServerOnlyForNodeCli() {
  const anyModule = Module as unknown as { _load?: (...args: any[]) => unknown }
  if (!anyModule._load) return
  const originalLoad = anyModule._load
  anyModule._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === 'server-only') return {}
    return originalLoad.call(this, request, parent, isMain)
  }
}

main().catch(error => {
  console.error('[drill-ai-fallback-smoke] FAILED:', error)
  process.exit(1)
})
