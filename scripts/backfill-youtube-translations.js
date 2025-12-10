/**
 * Backfill YouTube Transcript Translations
 *
 * This script adds English translations to YouTube transcripts that are missing them.
 * Uses Ollama (Qwen 2.5 32B) as primary ($0 cost), OpenAI as fallback.
 *
 * Usage:
 *   node scripts/backfill-youtube-translations.js [options]
 *
 * Options:
 *   --dry-run        Preview changes without saving
 *   --limit=N        Process only N transcripts (default: all)
 *   --content-id=ID  Process only a specific transcript (e.g., youtube_nSOQdg28Btg)
 *   --force          Re-translate even if translations exist
 *   --provider=X     Force provider: 'ollama' or 'openai' (default: auto)
 *   --batch-size=N   Segments per batch (default: 5)
 *   --user-level=X   JLPT level for translations: N5-N1 (default: N4)
 *
 * Examples:
 *   node scripts/backfill-youtube-translations.js --dry-run
 *   node scripts/backfill-youtube-translations.js --limit=5
 *   node scripts/backfill-youtube-translations.js --content-id=youtube_nSOQdg28Btg
 *   node scripts/backfill-youtube-translations.js --provider=ollama --limit=10
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const contentIdArg = args.find(a => a.startsWith('--content-id='));
const specificContentId = contentIdArg ? contentIdArg.split('=')[1] : null;

const providerArg = args.find(a => a.startsWith('--provider='));
const forceProvider = providerArg ? providerArg.split('=')[1] : null;

const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 5;

const userLevelArg = args.find(a => a.startsWith('--user-level='));
const userLevel = userLevelArg ? userLevelArg.split('=')[1] : 'N4';

// Ollama configuration
const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
  apiKey: process.env.MODAL_API_KEY || '',
  model: process.env.OLLAMA_MODEL || 'qwen2.5:32b',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '300000'),
};

/**
 * Check Ollama health
 */
async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy';
    }
    return false;
  } catch (error) {
    console.warn('Ollama health check failed:', error.message);
    return false;
  }
}

/**
 * Translate text using Ollama (Qwen 2.5 32B)
 */
async function translateWithOllama(japaneseText, level) {
  const systemPrompt = `You are a Japanese-English translator for language learners at ${level} level.
Translate the Japanese text naturally and accurately.
Return JSON: {"translation": "English translation"}
Keep translations natural and educational. Be concise.`;

  const userPrompt = `Translate: "${japaneseText}"
Return valid JSON with translation field.`;

  const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/generate`, {
    method: 'POST',
    headers: {
      'X-API-Key': OLLAMA_CONFIG.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_CONFIG.model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.3,
        num_predict: 200,
        top_p: 0.9
      }
    }),
    signal: AbortSignal.timeout(OLLAMA_CONFIG.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();

  try {
    const parsed = JSON.parse(data.response);
    return parsed.translation || data.response;
  } catch {
    return data.response.trim();
  }
}

/**
 * Translate text using OpenAI (fallback)
 */
async function translateWithOpenAI(japaneseText, level) {
  const OpenAI = require('openai');
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a Japanese-English translator for ${level} level learners. Translate naturally and accurately. Return JSON with "translation" field.`
      },
      {
        role: 'user',
        content: `Translate: "${japaneseText}"`
      }
    ],
    temperature: 0.3,
    max_tokens: 200,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return parsed.translation || content;
}

/**
 * Process a single transcript
 */
async function processTranscript(doc, provider, translateFn) {
  const contentId = doc.id;
  const data = doc.data();

  console.log(`\n📺 Processing: ${contentId}`);
  console.log(`   Video: ${data.videoTitle || data.videoUrl || 'Unknown'}`);
  console.log(`   Language: ${data.language || 'ja'}`);
  console.log(`   Segments: ${data.transcript?.length || 0}`);

  if (!data.transcript || data.transcript.length === 0) {
    console.log('   ⚠️  No transcript segments found, skipping');
    return { skipped: true, reason: 'no_segments' };
  }

  // Check which segments need translation
  const segmentsToTranslate = [];
  data.transcript.forEach((segment, index) => {
    const hasTranslation = segment.translation && segment.translation.trim().length > 0;
    if ((!hasTranslation || force) && segment.text) {
      segmentsToTranslate.push({ index, segment });
    }
  });

  if (segmentsToTranslate.length === 0) {
    console.log('   ✅ All segments already have translations');
    return { skipped: true, reason: 'already_translated' };
  }

  console.log(`   📝 Segments needing translation: ${segmentsToTranslate.length}/${data.transcript.length}`);
  console.log(`   🤖 Provider: ${provider}`);

  // Translate segments
  const updatedTranscript = [...data.transcript];
  let translatedCount = 0;
  let failedCount = 0;

  // Process in batches
  for (let i = 0; i < segmentsToTranslate.length; i += batchSize) {
    const batch = segmentsToTranslate.slice(i, i + batchSize);

    const batchPromises = batch.map(async ({ index, segment }) => {
      const progress = Math.round(((i + batch.indexOf({ index, segment }) + 1) / segmentsToTranslate.length) * 100);

      if (dryRun) {
        console.log(`   [DRY RUN] [${progress}%] Would translate: "${segment.text.substring(0, 40)}..."`);
        return { index, success: true, dryRun: true };
      }

      try {
        const translation = await translateFn(segment.text, userLevel);
        updatedTranscript[index] = {
          ...updatedTranscript[index],
          translation: translation
        };
        console.log(`   ✅ [${progress}%] "${segment.text.substring(0, 25)}..." → "${translation.substring(0, 30)}..."`);
        return { index, success: true };
      } catch (error) {
        console.log(`   ❌ [${progress}%] Failed: ${error.message}`);
        return { index, success: false, error: error.message };
      }
    });

    const results = await Promise.all(batchPromises);
    results.forEach(r => {
      if (r.success && !r.dryRun) translatedCount++;
      else if (!r.success) failedCount++;
    });

    // Small delay between batches
    if (i + batchSize < segmentsToTranslate.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Save updates
  if (!dryRun && translatedCount > 0) {
    console.log(`   💾 Saving ${translatedCount} translations...`);
    await db.collection('transcriptCache').doc(contentId).update({
      transcript: updatedTranscript,
      'metadata.translationsGeneratedAt': admin.firestore.FieldValue.serverTimestamp(),
      'metadata.translationProvider': provider,
      'metadata.translationUserLevel': userLevel,
      'metadata.translationStats': {
        translatedCount,
        failedCount,
        totalSegments: data.transcript.length
      }
    });
    console.log('   ✅ Saved!');
  }

  return {
    success: true,
    translatedSegments: translatedCount,
    failedSegments: failedCount,
    totalSegments: data.transcript.length
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 YouTube Transcript Translation Backfill');
  console.log('==========================================');
  console.log(`   User Level: ${userLevel}`);
  console.log(`   Batch Size: ${batchSize}`);

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be saved\n');
  }

  if (force) {
    console.log('⚠️  FORCE MODE - Will re-translate existing translations\n');
  }

  // Determine which provider to use
  let provider = 'openai';
  let translateFn = translateWithOpenAI;

  if (forceProvider === 'ollama') {
    console.log('📌 Forcing Ollama provider...');
    const healthy = await checkOllamaHealth();
    if (!healthy) {
      console.error('❌ Ollama is not healthy, cannot force Ollama provider');
      process.exit(1);
    }
    provider = 'ollama';
    translateFn = translateWithOllama;
  } else if (forceProvider === 'openai') {
    console.log('📌 Forcing OpenAI provider...');
    provider = 'openai';
    translateFn = translateWithOpenAI;
  } else {
    // Auto-select: prefer Ollama if healthy
    console.log('🔍 Auto-selecting provider...');
    const ollamaHealthy = await checkOllamaHealth();
    if (ollamaHealthy) {
      console.log('   ✅ Ollama is healthy - using Qwen 2.5 32B ($0 cost)');
      provider = 'ollama';
      translateFn = translateWithOllama;
    } else {
      console.log('   ⚠️  Ollama not available - falling back to OpenAI');
      provider = 'openai';
      translateFn = translateWithOpenAI;
    }
  }

  console.log(`\n🤖 Using provider: ${provider === 'ollama' ? 'Ollama (Qwen 2.5 32B) - FREE' : 'OpenAI (GPT-4o-mini)'}\n`);

  // Process specific content ID or all
  if (specificContentId) {
    console.log(`📌 Processing specific transcript: ${specificContentId}\n`);
    const doc = await db.collection('transcriptCache').doc(specificContentId).get();
    if (!doc.exists) {
      console.error(`❌ Transcript not found: ${specificContentId}`);
      process.exit(1);
    }
    await processTranscript(doc, provider, translateFn);
    return;
  }

  // Query transcripts - simple query to avoid index requirements
  let query = db.collection('transcriptCache');

  const snapshot = await query.get();

  // Filter for YouTube content type in memory
  let docs = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.contentType === 'youtube' || doc.id.startsWith('youtube_');
  });

  // Sort by lastAccessed descending
  docs.sort((a, b) => {
    const aTime = a.data().lastAccessed?.toDate?.()?.getTime() || 0;
    const bTime = b.data().lastAccessed?.toDate?.()?.getTime() || 0;
    return bTime - aTime;
  });

  if (limit) {
    console.log(`📊 Limiting to ${limit} transcripts\n`);
    docs = docs.slice(0, limit);
  }

  console.log(`📚 Found ${docs.length} YouTube transcripts to check\n`);

  if (docs.length === 0) {
    console.log('No transcripts found. Try without filters or check if transcriptCache collection exists.');
    return;
  }

  let stats = {
    processed: 0,
    translated: 0,
    skipped: 0,
    failed: 0,
    segmentsTranslated: 0,
    segmentsFailed: 0,
  };

  for (const doc of docs) {
    try {
      const result = await processTranscript(doc, provider, translateFn);
      stats.processed++;

      if (result.skipped) {
        stats.skipped++;
      } else if (result.success) {
        stats.translated++;
        stats.segmentsTranslated += result.translatedSegments;
        stats.segmentsFailed += result.failedSegments;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      stats.failed++;
    }
  }

  console.log('\n==========================================');
  console.log('📊 Summary');
  console.log('==========================================');
  console.log(`   Provider: ${provider === 'ollama' ? 'Ollama (Qwen 2.5 32B)' : 'OpenAI (GPT-4o-mini)'}`);
  console.log(`   Transcripts processed: ${stats.processed}`);
  console.log(`   Transcripts translated: ${stats.translated}`);
  console.log(`   Transcripts skipped: ${stats.skipped}`);
  console.log(`   Transcripts failed: ${stats.failed}`);
  console.log(`   Total segments translated: ${stats.segmentsTranslated}`);
  console.log(`   Total segments failed: ${stats.segmentsFailed}`);

  if (provider === 'ollama') {
    console.log(`   Estimated cost: $0.00 (Ollama)`);
  } else {
    const estimatedCost = stats.segmentsTranslated * 0.0001;
    console.log(`   Estimated cost: $${estimatedCost.toFixed(4)} (OpenAI)`);
  }

  if (dryRun) {
    console.log('\n🔍 This was a DRY RUN - no changes were saved');
    console.log('   Run without --dry-run to apply changes');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
