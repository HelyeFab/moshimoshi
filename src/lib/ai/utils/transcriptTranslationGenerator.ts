/**
 * Transcript Translation Pre-Generator
 * Pre-generates translations for YouTube transcript segments
 * Stores in Firestore for instant retrieval by frontend
 *
 * Uses Ollama (Qwen 2.5 32B via Modal) as primary ($0 cost)
 * Falls back to OpenAI (GPT-4o-mini) if Ollama unavailable
 *
 * Follows bookWordExplanationGenerator.ts pattern
 */

import { db } from '@/lib/firebase/admin';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, providerHealth } from '../config/providers';

// Firestore collection (reuses existing transcriptCache)
const COLLECTION = 'transcriptCache';

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
  translation?: string;
  translationData?: {
    translatedText: string;
    confidence: number;
    grammarNotes?: Array<{
      pattern: string;
      explanation: string;
    }>;
    keyVocabulary?: Array<{
      word: string;
      reading: string;
      meaning: string;
      jlptLevel?: string;
    }>;
  };
}

export interface TranslationGenerationResult {
  contentId: string;
  translatedCount: number;
  failedCount: number;
  totalSegments: number;
  duration: number;
  provider: string;
  costInfo: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export interface TranslationProgressCallback {
  (current: number, total: number, segment: string, status: 'success' | 'failed' | 'cached'): void;
}

/**
 * Check if translations already exist for a transcript
 */
export async function hasTranslations(contentId: string): Promise<boolean> {
  if (!db) return false;

  try {
    const doc = await db.collection(COLLECTION).doc(contentId).get();
    if (!doc.exists) return false;

    const data = doc.data();
    const transcript = data?.transcript as TranscriptSegment[] | undefined;

    if (!transcript || transcript.length === 0) return false;

    // Check if at least 80% of segments have translations
    const translatedCount = transcript.filter(seg => seg.translation || seg.translationData).length;
    return translatedCount >= transcript.length * 0.8;
  } catch (error) {
    console.error('[TranscriptTranslation] Error checking translations:', error);
    return false;
  }
}

/**
 * Get cached transcript with translations
 */
export async function getTranscriptWithTranslations(
  contentId: string
): Promise<TranscriptSegment[] | null> {
  if (!db) return null;

  try {
    const doc = await db.collection(COLLECTION).doc(contentId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    return data?.transcript as TranscriptSegment[] | undefined || null;
  } catch (error) {
    console.error('[TranscriptTranslation] Error fetching transcript:', error);
    return null;
  }
}

/**
 * Generate translation for a single segment using Ollama (Qwen 2.5 32B)
 */
async function generateTranslationOllama(
  ollamaClient: OllamaClient,
  segment: TranscriptSegment,
  userLevel: string
): Promise<{ translation: string; tokens: number }> {
  const systemPrompt = `You are a Japanese-English translator for language learners at ${userLevel} level.
Translate the Japanese text naturally and accurately.
Return JSON: {"translation": "English translation", "confidence": 0.95}
Keep translations natural and educational. Be concise.`;

  const userPrompt = `Translate: "${segment.text}"
Return valid JSON with translation field.`;

  const response = await ollamaClient.generate({
    prompt: `${systemPrompt}\n\n${userPrompt}`,
    format: 'json',
    options: {
      temperature: 0.3,
      num_predict: 200,
      top_p: 0.9
    }
  });

  try {
    const parsed = JSON.parse(response.response);
    const tokens = OllamaClient.estimateTokens(systemPrompt + userPrompt + response.response);
    return {
      translation: parsed.translation || response.response,
      tokens
    };
  } catch {
    // If JSON parse fails, use raw response
    return {
      translation: response.response.trim(),
      tokens: OllamaClient.estimateTokens(systemPrompt + userPrompt + response.response)
    };
  }
}

/**
 * Generate translation for a single segment using OpenAI (fallback)
 */
async function generateTranslationOpenAI(
  segment: TranscriptSegment,
  userLevel: string
): Promise<{ translation: string; tokens: number }> {
  const OpenAI = (await import('openai')).default;
  const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are a Japanese-English translator for language learners at ${userLevel} level. Translate naturally and accurately. Return JSON with "translation" field.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Translate: "${segment.text}"` }
    ],
    temperature: 0.3,
    max_tokens: 200,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  const tokens = completion.usage?.total_tokens || 0;

  return {
    translation: parsed.translation || content,
    tokens
  };
}

/**
 * Generate translations for transcript segments
 * Uses Ollama (Qwen 2.5 32B) as primary, OpenAI as fallback
 */
export async function generateTranscriptTranslations(
  contentId: string,
  segments: TranscriptSegment[],
  options: {
    mode?: 'full' | 'learning';
    userLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
    batchSize?: number;
    onProgress?: TranslationProgressCallback;
  } = {}
): Promise<TranslationGenerationResult> {
  const startTime = Date.now();
  const {
    userLevel = 'N4',
    batchSize = 5,
    onProgress
  } = options;

  console.log('\n' + '='.repeat(60));
  console.log(`🌐 [TranscriptTranslation] STARTING PRE-GENERATION`);
  console.log(`🌐 [TranscriptTranslation] Content ID: ${contentId}`);
  console.log(`🌐 [TranscriptTranslation] Segments: ${segments.length}`);
  console.log(`🌐 [TranscriptTranslation] User Level: ${userLevel}`);
  console.log('='.repeat(60) + '\n');

  if (segments.length === 0) {
    console.log('⚠️ [TranscriptTranslation] No segments to translate');
    return {
      contentId,
      translatedCount: 0,
      failedCount: 0,
      totalSegments: 0,
      duration: 0,
      provider: 'none',
      costInfo: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 }
    };
  }

  // Try Ollama first (free), fallback to OpenAI
  const providerConfig = getProviderConfig();
  let useOllama = providerConfig.enabled.ollama && providerHealth.isHealthy('ollama');
  let ollamaClient: OllamaClient | null = null;

  console.log(`🔍 [TranscriptTranslation] Provider check:`);
  console.log(`   - Ollama enabled in config: ${providerConfig.enabled.ollama}`);
  console.log(`   - Ollama health status: ${providerHealth.isHealthy('ollama') ? 'healthy' : 'unhealthy'}`);

  if (useOllama) {
    try {
      console.log(`🔄 [TranscriptTranslation] Initializing Ollama client...`);
      const ollamaConfig = getOllamaConfig();
      console.log(`   - Base URL: ${ollamaConfig.baseUrl}`);
      console.log(`   - Model: ${ollamaConfig.model}`);

      ollamaClient = new OllamaClient(ollamaConfig);

      console.log(`🏥 [TranscriptTranslation] Running Ollama health check...`);
      const healthStart = Date.now();
      const healthy = await ollamaClient.healthCheck();
      const healthTime = Date.now() - healthStart;

      if (!healthy) {
        console.warn(`⚠️ [TranscriptTranslation] Ollama health check FAILED (${healthTime}ms), falling back to OpenAI`);
        useOllama = false;
        providerHealth.markUnhealthy('ollama');
      } else {
        console.log(`✅ [TranscriptTranslation] Ollama health check PASSED (${healthTime}ms)`);
      }
    } catch (err) {
      console.error(`❌ [TranscriptTranslation] Ollama initialization error:`, err);
      useOllama = false;
    }
  }

  const provider = useOllama ? 'Ollama (Qwen 2.5 32B) - FREE' : 'OpenAI (GPT-4o-mini)';
  console.log(`\n🤖 [TranscriptTranslation] USING PROVIDER: ${provider}`);
  console.log(`⏱️ [TranscriptTranslation] Estimated time: ${segments.length * 2}-${segments.length * 5} seconds\n`);

  const translatedSegments: TranscriptSegment[] = [];
  let totalTokens = 0;
  let successCount = 0;
  let failCount = 0;

  // Process in batches to avoid rate limits
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const batchPromises = batch.map(async (segment, batchIndex) => {
      const globalIndex = i + batchIndex;

      try {
        // Skip if already has translation
        if (segment.translation || segment.translationData?.translatedText) {
          console.log(`⏭️ [${globalIndex + 1}/${segments.length}] "${segment.text.substring(0, 30)}..." CACHED`);
          onProgress?.(globalIndex + 1, segments.length, segment.text.substring(0, 30), 'cached');
          return segment;
        }

        let result: { translation: string; tokens: number };

        if (useOllama && ollamaClient) {
          result = await generateTranslationOllama(ollamaClient, segment, userLevel);
        } else {
          result = await generateTranslationOpenAI(segment, userLevel);
        }

        totalTokens += result.tokens;
        successCount++;

        const progress = Math.round(((globalIndex + 1) / segments.length) * 100);
        console.log(
          `✅ [${globalIndex + 1}/${segments.length}] (${progress}%) "${segment.text.substring(0, 25)}..." → "${result.translation.substring(0, 35)}..."`
        );

        onProgress?.(globalIndex + 1, segments.length, segment.text.substring(0, 30), 'success');

        return {
          ...segment,
          translation: result.translation
        };
      } catch (error) {
        failCount++;
        console.error(
          `❌ [${globalIndex + 1}/${segments.length}] "${segment.text.substring(0, 30)}..." FAILED:`,
          error instanceof Error ? error.message : error
        );
        onProgress?.(globalIndex + 1, segments.length, segment.text.substring(0, 30), 'failed');

        // Return segment without translation on failure
        return segment;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    translatedSegments.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < segments.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const duration = Date.now() - startTime;

  // Estimate cost ($0 for Ollama, ~$0.0001 per segment for OpenAI)
  const estimatedCost = useOllama ? 0 : (successCount * 0.0001);

  console.log('\n' + '='.repeat(60));
  console.log(`🎉 [TranscriptTranslation] GENERATION COMPLETE`);
  console.log('='.repeat(60));
  console.log(`📊 Results:`);
  console.log(`   - Success: ${successCount}/${segments.length} segments`);
  console.log(`   - Failed: ${failCount}/${segments.length} segments`);
  console.log(`   - Total time: ${Math.round(duration / 1000)}s`);
  console.log(`   - Total tokens: ${totalTokens}`);
  console.log(`   - Estimated cost: $${estimatedCost.toFixed(4)}`);
  console.log(`   - Provider: ${provider}`);
  console.log('='.repeat(60) + '\n');

  // Update Firestore with translations
  if (db && successCount > 0) {
    try {
      await db.collection(COLLECTION).doc(contentId).update({
        transcript: translatedSegments,
        'metadata.translationsGeneratedAt': new Date(),
        'metadata.translationUserLevel': userLevel,
        'metadata.translationProvider': useOllama ? 'ollama' : 'openai',
        'metadata.translationStats': {
          successCount,
          failCount,
          totalTokens,
          estimatedCost,
          duration
        }
      });
      console.log(`💾 [TranscriptTranslation] Saved ${successCount} translations to Firebase`);
    } catch (error) {
      console.error('[TranscriptTranslation] Failed to save translations:', error);
    }
  }

  return {
    contentId,
    translatedCount: successCount,
    failedCount: failCount,
    totalSegments: segments.length,
    duration,
    provider: useOllama ? 'ollama' : 'openai',
    costInfo: {
      promptTokens: Math.floor(totalTokens * 0.4),
      completionTokens: Math.floor(totalTokens * 0.6),
      totalTokens,
      estimatedCost
    }
  };
}

/**
 * Queue translation generation as a background job
 * Returns immediately, translations happen asynchronously
 */
export async function queueTranscriptTranslations(
  contentId: string,
  segments: TranscriptSegment[],
  options: {
    mode?: 'full' | 'learning';
    userLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  } = {}
): Promise<{ queued: boolean; message: string }> {
  // Check if already has translations
  const hasExisting = await hasTranslations(contentId);
  if (hasExisting) {
    return { queued: false, message: 'Translations already exist' };
  }

  // Mark as queued in Firestore
  if (db) {
    try {
      await db.collection(COLLECTION).doc(contentId).update({
        'metadata.translationStatus': 'queued',
        'metadata.translationQueuedAt': new Date()
      });
    } catch (error) {
      console.error('[TranscriptTranslation] Failed to mark as queued:', error);
    }
  }

  // Fire and forget - don't await
  generateTranscriptTranslations(contentId, segments, options)
    .then(result => {
      console.log(`[TranscriptTranslation] Background job complete: ${result.translatedCount}/${result.totalSegments} via ${result.provider}`);
      // Update status
      if (db) {
        db.collection(COLLECTION).doc(contentId).update({
          'metadata.translationStatus': 'complete'
        }).catch(console.error);
      }
    })
    .catch(error => {
      console.error('[TranscriptTranslation] Background job failed:', error);
      // Update status
      if (db) {
        db.collection(COLLECTION).doc(contentId).update({
          'metadata.translationStatus': 'failed',
          'metadata.translationError': error instanceof Error ? error.message : 'Unknown error'
        }).catch(console.error);
      }
    });

  return { queued: true, message: 'Translation generation queued' };
}

/**
 * Get translation status for a transcript
 */
export async function getTranslationStatus(
  contentId: string
): Promise<{
  status: 'none' | 'queued' | 'generating' | 'complete' | 'failed';
  translatedCount?: number;
  totalCount?: number;
  provider?: string;
  error?: string;
}> {
  if (!db) return { status: 'none' };

  try {
    const doc = await db.collection(COLLECTION).doc(contentId).get();
    if (!doc.exists) return { status: 'none' };

    const data = doc.data();
    const transcript = data?.transcript as TranscriptSegment[] | undefined;
    const metadata = data?.metadata;

    if (!transcript) return { status: 'none' };

    const translatedCount = transcript.filter(seg => seg.translation || seg.translationData).length;
    const totalCount = transcript.length;

    // Check metadata status
    const metadataStatus = metadata?.translationStatus;
    const provider = metadata?.translationProvider;

    if (metadataStatus === 'queued') {
      return { status: 'queued', translatedCount, totalCount };
    }
    if (metadataStatus === 'failed') {
      return { status: 'failed', translatedCount, totalCount, error: metadata?.translationError };
    }

    // Determine status from data
    if (translatedCount === 0) {
      return { status: 'none', translatedCount, totalCount };
    }
    if (translatedCount >= totalCount * 0.8) {
      return { status: 'complete', translatedCount, totalCount, provider };
    }

    return { status: 'generating', translatedCount, totalCount };
  } catch (error) {
    console.error('[TranscriptTranslation] Error getting status:', error);
    return { status: 'none' };
  }
}
