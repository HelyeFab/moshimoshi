#!/usr/bin/env node
/**
 * Backfill TTS audio for Tatoeba sentences (small-batch friendly).
 *
 * Usage examples:
 *   node scripts/backfill-tatoeba-audio.js --limit 200 --batch-size 50
 *   node scripts/backfill-tatoeba-audio.js --start 1000 --limit 500 --batch-size 50
 *   node scripts/backfill-tatoeba-audio.js --dry-run
 *
 * Notes:
 * - Requires Firebase Admin credentials (moshimoshi-service-account.json)
 * - Requires MODAL_API_KEY env var for VOICEVOX
 * - Writes to Firestore tts_cache + Firebase Storage directly
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const TATOEBA_DIR = path.join(process.cwd(), 'src/data/sentences/tatoeba');
const DEFAULT_SERVICE_ACCOUNT_PATH =
  '/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json';
const SERVICE_ACCOUNT_PATH =
  process.env.MOSHI_SERVICE_ACCOUNT_PATH ||
  (fs.existsSync(DEFAULT_SERVICE_ACCOUNT_PATH)
    ? DEFAULT_SERVICE_ACCOUNT_PATH
    : path.join(process.cwd(), 'moshimoshi-service-account.json'));
const VOICEVOX_ENDPOINT =
  'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech';
const DEFAULT_VOICE = '23';
const DEFAULT_SPEED = 0.85;
const DEFAULT_PITCH = 0;
const DEFAULT_VOLUME = 1;
const PROVIDER = 'voicevox';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const MODAL_API_KEY = process.env.MODAL_API_KEY;
if (!MODAL_API_KEY) {
  console.error('Error: MODAL_API_KEY environment variable is required');
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Service account not found: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const limit = parseInt(getArg('--limit', '200'), 10);
const batchSize = parseInt(getArg('--batch-size', '50'), 10);
const startArg = getArg('--start', null);
const stateFile = getArg('--state-file', '.tatoeba-tts-progress.json');
const autoResume = args.includes('--auto-resume');
const retryFailedOnly = args.includes('--retry-failed');
const start = startArg !== null ? parseInt(startArg, 10) : 0;
const dryRun = args.includes('--dry-run');
const sleepMs = parseInt(getArg('--sleep-ms', '500'), 10);
const maxRetries = parseInt(getArg('--max-retries', '3'), 10);
const backoffBaseMs = parseInt(getArg('--backoff-ms', '1500'), 10);
const logEvery = parseInt(getArg('--log-every', '1'), 10);

if (!fs.existsSync(TATOEBA_DIR)) {
  console.error(`Tatoeba directory not found: ${TATOEBA_DIR}`);
  process.exit(1);
}

function loadSentences() {
  const files = fs
    .readdirSync(TATOEBA_DIR)
    .filter(f => f.startsWith('examples-') && f.endsWith('.json'))
    .sort((a, b) => {
      const na = parseInt(a.replace('examples-', '').replace('.json', ''), 10);
      const nb = parseInt(b.replace('examples-', '').replace('.json', ''), 10);
      return na - nb;
    });

  const set = new Set();
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(TATOEBA_DIR, file), 'utf8'));
    for (const item of data) {
      const ja = (item.japanese || item.jp || item.ja || '').trim();
      if (ja) set.add(ja);
    }
  }
  return Array.from(set);
}

function loadState() {
  if (!fs.existsSync(stateFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u3000]/g, ' ')
    .normalize('NFC');
}

function getTextType(text) {
  const length = text.length;
  if (length === 1) return 'character';
  if (length < 10) return 'word';
  if (length < 50) return 'sentence';
  if (length < 500) return 'paragraph';
  return 'article';
}

function estimateDuration(text, speed = 1.0) {
  const charsPerSecond = 2.5 / speed;
  return Math.ceil(text.length / charsPerSecond);
}

function generateCacheKey(text, voice) {
  const normalized = normalizeText(text);
  const input = `${PROVIDER}:${voice}:s${DEFAULT_SPEED}:p${DEFAULT_PITCH}:v${DEFAULT_VOLUME}:${normalized}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

function generateStoragePath(cacheKey) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `tts/${PROVIDER}/${year}/${month}/${cacheKey}.mp3`;
}

async function synthesizeVoicevox(text, voice) {
  const response = await fetch(VOICEVOX_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY,
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: text,
      voice,
      speed: DEFAULT_SPEED,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`VOICEVOX API error (${response.status}): ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (!audioBuffer.length) {
    throw new Error('VOICEVOX returned empty audio');
  }
  return audioBuffer;
}

async function ensureCached(text) {
  const cacheKey = generateCacheKey(text, DEFAULT_VOICE);
  const docRef = db.collection('tts_cache').doc(cacheKey);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return { cached: true };
  }

  const storagePath = generateStoragePath(cacheKey);
  const file = bucket.file(storagePath);

  let audioUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  const [exists] = await file.exists();

  if (!exists) {
    const audioBuffer = await synthesizeVoicevox(text, DEFAULT_VOICE);
    await file.save(audioBuffer, {
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          provider: PROVIDER,
          synthesizedAt: new Date().toISOString(),
        },
      },
    });
    await file.makePublic();
  }

  const entry = {
    id: cacheKey,
    text,
    normalizedText: normalizeText(text),
    provider: PROVIDER,
    voice: DEFAULT_VOICE,
    speed: DEFAULT_SPEED,
    pitch: DEFAULT_PITCH,
    volume: DEFAULT_VOLUME,
    audioUrl,
    storagePath,
    duration: estimateDuration(text, DEFAULT_SPEED),
    size: null,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    accessCount: 1,
    metadata: {
      type: getTextType(text) === 'article' ? 'paragraph' : getTextType(text),
      language: 'ja',
    },
  };

  await docRef.set(entry);
  return { cached: false };
}

async function run() {
  const all = loadSentences();
  const total = all.length;
  const previousState = loadState();
  const effectiveStart =
    autoResume && startArg === null && previousState?.nextStart != null
      ? previousState.nextStart
      : start;

  let targetTexts;
  if (retryFailedOnly && previousState?.failedTexts?.length) {
    targetTexts = previousState.failedTexts;
  } else {
    targetTexts = all.slice(effectiveStart, Math.min(effectiveStart + limit, total));
  }

  const batches = chunk(targetTexts, Math.min(batchSize, 100));

  console.log(
    `[Tatoeba TTS] total=${total} start=${effectiveStart} limit=${limit} batches=${batches.length} batchSize=${batchSize} retryFailedOnly=${retryFailedOnly}`
  );

  if (dryRun) {
    console.log('[Tatoeba TTS] Dry run only, no API calls made.');
    return;
  }

  let processed = 0;
  let cached = 0;
  let failed = 0;
  let startedAt = Date.now();
  let failedTexts = [];

  for (let i = 0; i < batches.length; i++) {
    const texts = batches[i];
    let attempt = 0;
    let batchDone = false;
    let lastError = null;

    while (attempt <= maxRetries && !batchDone) {
      attempt++;
      try {
        let batchCached = 0;
        let batchFailed = 0;
        for (const text of texts) {
          try {
            const result = await ensureCached(text);
            if (result.cached) batchCached++;
          } catch (error) {
            batchFailed++;
            failedTexts.push(text);
          }
        }

        processed += texts.length;
        cached += batchCached;
        failed += batchFailed;
        batchDone = true;

        if ((i + 1) % logEvery === 0 || i === batches.length - 1) {
          const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
          console.log(
            `[Batch ${i + 1}/${batches.length}] processed=${processed} cached=${cached} failed=${failed} elapsed=${elapsedSec}s`
          );
        }
      } catch (err) {
        lastError = err;
        if (attempt > maxRetries) {
          console.error(
            `[Batch ${i + 1}] Failed after ${maxRetries} retries:`,
            err.message || err
          );
          failed += texts.length;
          break;
        }
        const backoffMs = backoffBaseMs * attempt;
        console.warn(
          `[Batch ${i + 1}] Error (attempt ${attempt}/${maxRetries}). Retrying in ${backoffMs}ms...`,
          err.message || err
        );
        await sleep(backoffMs);
      }
    }

    if (i < batches.length - 1 && sleepMs > 0) {
      await sleep(sleepMs);
    }
  }

  if (!retryFailedOnly) {
    saveState({
      nextStart: effectiveStart + processed,
      failedTexts,
      lastRunAt: new Date().toISOString(),
      lastRunStats: { processed, cached, failed },
    });
  } else {
    saveState({
      nextStart: previousState?.nextStart ?? effectiveStart,
      failedTexts,
      lastRunAt: new Date().toISOString(),
      lastRunStats: { processed, cached, failed },
    });
  }

  const totalSec = Math.round((Date.now() - startedAt) / 1000);
  console.log('[Tatoeba TTS] Done', { processed, cached, failed, totalSec });
}

run().catch(err => {
  console.error('[Tatoeba TTS] Fatal error:', err);
  process.exit(1);
});
