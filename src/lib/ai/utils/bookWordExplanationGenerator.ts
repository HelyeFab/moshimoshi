/**
 * Book Word Explanation Pre-Generator
 * Pre-generates comprehensive word explanations for book content
 * Stores in Firestore for instant retrieval by frontend
 *
 * Uses Qwen 2.5 32B via Modal Ollama endpoint for cost-effective AI processing ($0)
 */

import { db } from '@/lib/firebase/admin';
import { OllamaClient } from '../clients/OllamaClient';
import { getProviderConfig, getOllamaConfig, providerHealth } from '../config/providers';
import type { WordExplanation } from '../types';

// Firestore collection for book word explanations
const COLLECTION = 'book_word_explanations';

// Word extraction configuration
const COMMON_PARTICLES = new Set([
  'は', 'が', 'を', 'に', 'へ', 'と', 'で', 'の', 'や', 'か', 'も',
  'から', 'まで', 'より', 'など', 'ので', 'のに', 'ば', 'たら',
  'けど', 'けれど', 'けれども', 'し', 'て', 'た', 'だ', 'です', 'ます'
]);

const BASIC_WORDS = new Set([
  'これ', 'それ', 'あれ', 'ここ', 'そこ', 'あそこ', 'どこ',
  'この', 'その', 'あの', 'どの', 'だれ', 'なに', 'なん',
  'はい', 'いいえ', 'ええ', 'うん', 'ううん'
]);

export interface ExtractedWord {
  word: string;
  frequency: number;
  type: 'kanji' | 'hiragana' | 'katakana' | 'mixed';
  estimatedJLPT?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
}

export interface BookWordExplanations {
  bookId: string;
  words: WordExplanation[];
  wordCount: number;
  generatedAt: Date;
  costInfo: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number; // $0 for Qwen via Modal
  };
}

/**
 * Extract top words from book content
 */
export function extractTopWords(content: string, limit: number = 50): ExtractedWord[] {
  // Clean and normalize content
  let normalized = content.replace(/<[^>]*>/g, ' ');
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, ' ');
  normalized = normalized.replace(/[0-9]+/g, ' ');
  normalized = normalized.replace(/[.,!?;:()「」『』【】〈〉《》〔〕［］｛｝]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Extract Japanese words
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]+/g;
  const matches = normalized.match(japaneseRegex) || [];

  // Count frequency
  const frequency: Record<string, number> = {};
  matches.forEach(word => {
    if (word.length >= 2) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  });

  // Filter and score words
  const words: ExtractedWord[] = [];
  Object.entries(frequency).forEach(([word, count]) => {
    // Skip particles and basic words
    if (COMMON_PARTICLES.has(word) || BASIC_WORDS.has(word)) return;

    // Skip pure short hiragana (likely particles)
    if (word.length <= 2 && /^[\u3040-\u309F]+$/.test(word)) return;

    const type = determineWordType(word);
    const estimatedJLPT = estimateJLPTLevel(word, type);

    words.push({ word, frequency: count, type, estimatedJLPT });
  });

  // Sort by frequency and take top N
  words.sort((a, b) => b.frequency - a.frequency);
  return words.slice(0, limit);
}

function determineWordType(word: string): 'kanji' | 'hiragana' | 'katakana' | 'mixed' {
  const hasKanji = /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(word);
  const hasHiragana = /[\u3040-\u309F]/.test(word);
  const hasKatakana = /[\u30A0-\u30FF]/.test(word);

  if (hasKanji && (hasHiragana || hasKatakana)) return 'mixed';
  if (hasKanji) return 'kanji';
  if (hasHiragana) return 'hiragana';
  if (hasKatakana) return 'katakana';
  return 'mixed';
}

function estimateJLPTLevel(word: string, type: string): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined {
  if (type === 'katakana') return word.length <= 3 ? 'N4' : 'N3';
  if (type === 'hiragana') return word.length <= 3 ? 'N5' : 'N4';
  if (type === 'kanji' || type === 'mixed') {
    if (word.length <= 2) return 'N5';
    if (word.length === 3) return 'N4';
    if (word.length === 4) return 'N3';
    return 'N2';
  }
  return undefined;
}

/**
 * Generate word explanation using Ollama (Qwen 2.5 32B)
 */
async function generateWordExplanation(
  ollamaClient: OllamaClient,
  word: ExtractedWord,
  context?: string
): Promise<{ explanation: WordExplanation; tokens: number }> {
  const systemPrompt = `You are a Japanese dictionary for N5-N3 learners. Return JSON:
{
  "word": "kanji",
  "reading": "hiragana",
  "romaji": "romaji",
  "meaning": "English definition",
  "partOfSpeech": "noun/verb/adjective/etc",
  "kanjiBreakdown": [{"kanji":"X","meaning":"M","kunYomi":["y"],"onYomi":["Z"]}],
  "conjugation": {"dictionary":"x","present":"x","past":"y","negative":"z","teForm":"w"},
  "relatedWords": {"synonyms":[],"antonyms":[],"compounds":[]},
  "jlptLevel": "N5-N1",
  "formality": "casual/formal/neutral/both",
  "usageNotes": "brief usage note",
  "examples": [{"japanese":"x","furigana":"y","translation":"z"}]
}
Include kanjiBreakdown only if word has kanji. Include conjugation only for verbs/adjectives.`;

  const userPrompt = `Word: ${word.word}
${context ? `Context: ${context.substring(0, 200)}` : ''}
${word.estimatedJLPT ? `Estimated JLPT: ${word.estimatedJLPT}` : ''}
Return complete JSON.`;

  try {
    const response = await ollamaClient.generate({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      format: 'json',
      options: {
        temperature: 0.3,
        num_predict: 500,
        top_p: 0.9
      }
    });

    const parsed = JSON.parse(response.response);

    const explanation: WordExplanation = {
      word: parsed.word || word.word,
      reading: parsed.reading || '',
      romaji: parsed.romaji || '',
      meaning: parsed.meaning || '',
      partOfSpeech: parsed.partOfSpeech || 'unknown',
      kanjiBreakdown: parsed.kanjiBreakdown,
      conjugation: parsed.conjugation,
      relatedWords: parsed.relatedWords,
      jlptLevel: parsed.jlptLevel || word.estimatedJLPT,
      formality: parsed.formality || 'neutral',
      usageNotes: parsed.usageNotes,
      examples: parsed.examples || []
    };

    const tokens = OllamaClient.estimateTokens(systemPrompt + userPrompt + response.response);

    return { explanation, tokens };
  } catch (error) {
    console.error(`[BookWordExplanation] Error generating for "${word.word}":`, error);
    throw error;
  }
}

/**
 * Generate word explanations for a book using OpenAI as fallback
 */
async function generateWordExplanationOpenAI(
  word: ExtractedWord,
  context?: string
): Promise<{ explanation: WordExplanation; tokens: number }> {
  const OpenAI = (await import('openai')).default;
  const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an expert Japanese dictionary. Provide a comprehensive word explanation in JSON format with: word, reading (hiragana), romaji, meaning, partOfSpeech, kanjiBreakdown (if applicable), conjugation (for verbs/adjectives), relatedWords, jlptLevel, formality, usageNotes, examples (2-3).`;

  const userPrompt = `Explain this Japanese word: "${word.word}"
${context ? `Context: ${context.substring(0, 200)}` : ''}
Return valid JSON.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  const explanation: WordExplanation = {
    word: parsed.word || word.word,
    reading: parsed.reading || '',
    romaji: parsed.romaji || '',
    meaning: parsed.meaning || '',
    partOfSpeech: parsed.partOfSpeech || 'unknown',
    kanjiBreakdown: parsed.kanjiBreakdown,
    conjugation: parsed.conjugation,
    relatedWords: parsed.relatedWords,
    jlptLevel: parsed.jlptLevel || word.estimatedJLPT,
    formality: parsed.formality || 'neutral',
    usageNotes: parsed.usageNotes,
    examples: parsed.examples || []
  };

  const tokens = completion.usage?.total_tokens || 0;

  return { explanation, tokens };
}

/**
 * Generate and store word explanations for a book
 */
export async function generateBookWordExplanations(
  bookId: string,
  content: string,
  wordLimit: number = 50,
  onProgress?: (current: number, total: number, word: string, status: 'success' | 'failed') => void
): Promise<BookWordExplanations> {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log(`📚 [BookWordExplanation] STARTING PRE-GENERATION`);
  console.log(`📚 [BookWordExplanation] Book ID: ${bookId}`);
  console.log(`📚 [BookWordExplanation] Content length: ${content.length} chars`);
  console.log(`📚 [BookWordExplanation] Word limit: ${wordLimit}`);
  console.log('='.repeat(60) + '\n');

  // Extract top words
  const extractStart = Date.now();
  const words = extractTopWords(content, wordLimit);
  const extractTime = Date.now() - extractStart;

  console.log(`📝 [BookWordExplanation] Word extraction completed in ${extractTime}ms`);
  console.log(`📝 [BookWordExplanation] Extracted ${words.length} unique words:`);
  words.slice(0, 10).forEach((w, i) => {
    console.log(`   ${i + 1}. "${w.word}" (freq: ${w.frequency}, type: ${w.type}, JLPT: ${w.estimatedJLPT || '?'})`);
  });
  if (words.length > 10) {
    console.log(`   ... and ${words.length - 10} more words`);
  }
  console.log('');

  if (words.length === 0) {
    console.log('⚠️ [BookWordExplanation] No words extracted, returning empty result');
    return {
      bookId,
      words: [],
      wordCount: 0,
      generatedAt: new Date(),
      costInfo: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 }
    };
  }

  const explanations: WordExplanation[] = [];
  let totalTokens = 0;
  let successCount = 0;
  let failCount = 0;
  const context = content.substring(0, 500); // Use first 500 chars as context

  // Try Ollama first (free), fallback to OpenAI
  const providerConfig = getProviderConfig();
  let useOllama = providerConfig.enabled.ollama && providerHealth.isHealthy('ollama');
  let ollamaClient: OllamaClient | null = null;

  console.log(`🔍 [BookWordExplanation] Provider check:`);
  console.log(`   - Ollama enabled in config: ${providerConfig.enabled.ollama}`);
  console.log(`   - Ollama health status: ${providerHealth.isHealthy('ollama') ? 'healthy' : 'unhealthy'}`);

  if (useOllama) {
    try {
      console.log(`🔄 [BookWordExplanation] Initializing Ollama client...`);
      const ollamaConfig = getOllamaConfig();
      console.log(`   - Base URL: ${ollamaConfig.baseUrl}`);
      console.log(`   - Model: ${ollamaConfig.model}`);

      ollamaClient = new OllamaClient(ollamaConfig);

      console.log(`🏥 [BookWordExplanation] Running Ollama health check...`);
      const healthStart = Date.now();
      const healthy = await ollamaClient.healthCheck();
      const healthTime = Date.now() - healthStart;

      if (!healthy) {
        console.warn(`⚠️ [BookWordExplanation] Ollama health check FAILED (${healthTime}ms), falling back to OpenAI`);
        useOllama = false;
        providerHealth.markUnhealthy('ollama');
      } else {
        console.log(`✅ [BookWordExplanation] Ollama health check PASSED (${healthTime}ms)`);
      }
    } catch (err) {
      console.error(`❌ [BookWordExplanation] Ollama initialization error:`, err);
      useOllama = false;
    }
  }

  const provider = useOllama ? 'Ollama (Qwen 2.5 32B) - FREE' : 'OpenAI (GPT-4o-mini) - $0.0001/word';
  console.log(`\n🤖 [BookWordExplanation] USING PROVIDER: ${provider}`);
  console.log(`⏱️ [BookWordExplanation] Estimated time: ${words.length * 3}-${words.length * 5} seconds\n`);

  // Generate explanations for each word
  console.log(`🚀 [BookWordExplanation] Starting word-by-word generation...\n`);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordStart = Date.now();

    try {
      let result: { explanation: WordExplanation; tokens: number };

      if (useOllama && ollamaClient) {
        result = await generateWordExplanation(ollamaClient, word, context);
      } else {
        result = await generateWordExplanationOpenAI(word, context);
      }

      const wordTime = Date.now() - wordStart;
      explanations.push(result.explanation);
      totalTokens += result.tokens;
      successCount++;

      // Log every word with timing
      const progress = Math.round(((i + 1) / words.length) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const eta = Math.round((elapsed / (i + 1)) * (words.length - i - 1));

      console.log(
        `✅ [${i + 1}/${words.length}] (${progress}%) "${word.word}" → "${result.explanation.meaning?.substring(0, 30)}..." ` +
        `[${wordTime}ms] [ETA: ${eta}s]`
      );

      // Callback for UI updates
      onProgress?.(i + 1, words.length, word.word, 'success');

    } catch (error) {
      const wordTime = Date.now() - wordStart;
      failCount++;

      console.error(
        `❌ [${i + 1}/${words.length}] "${word.word}" FAILED [${wordTime}ms]:`,
        error instanceof Error ? error.message : error
      );

      // Callback for UI updates
      onProgress?.(i + 1, words.length, word.word, 'failed');

      // Continue with next word
    }
  }

  const duration = Date.now() - startTime;
  const avgTimePerWord = Math.round(duration / words.length);

  // Estimate cost ($0 for Ollama, ~$0.0001 per word for OpenAI)
  const estimatedCost = useOllama ? 0 : (explanations.length * 0.0001);

  console.log('\n' + '='.repeat(60));
  console.log(`🎉 [BookWordExplanation] GENERATION COMPLETE`);
  console.log('='.repeat(60));
  console.log(`📊 Results:`);
  console.log(`   - Success: ${successCount}/${words.length} words`);
  console.log(`   - Failed: ${failCount}/${words.length} words`);
  console.log(`   - Total time: ${Math.round(duration / 1000)}s (${duration}ms)`);
  console.log(`   - Avg time per word: ${avgTimePerWord}ms`);
  console.log(`   - Total tokens: ${totalTokens}`);
  console.log(`   - Estimated cost: $${estimatedCost.toFixed(4)}`);
  console.log(`   - Provider: ${provider}`);
  console.log('='.repeat(60) + '\n');

  const bookExplanations: BookWordExplanations = {
    bookId,
    words: explanations,
    wordCount: explanations.length,
    generatedAt: new Date(),
    costInfo: {
      promptTokens: Math.floor(totalTokens * 0.4),
      completionTokens: Math.floor(totalTokens * 0.6),
      totalTokens,
      estimatedCost
    }
  };

  return bookExplanations;
}

/**
 * Remove undefined values recursively (Firestore doesn't accept undefined)
 */
function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item)) as T;
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}

/**
 * Store book word explanations in Firestore
 */
export async function storeBookWordExplanations(
  explanations: BookWordExplanations
): Promise<void> {
  if (!db) {
    console.error('[BookWordExplanation] Firebase Admin not initialized');
    return;
  }

  try {
    const docRef = db.collection(COLLECTION).doc(explanations.bookId);
    const cleaned = removeUndefinedValues(explanations);

    await docRef.set({
      ...cleaned,
      generatedAt: new Date(),
      lastUpdated: new Date()
    });

    console.log(`✅ [BookWordExplanation] Stored ${explanations.wordCount} explanations for book: ${explanations.bookId}`);
  } catch (error) {
    console.error('[BookWordExplanation] Failed to store:', error);
    throw error;
  }
}

/**
 * Get cached word explanations for a book
 */
export async function getCachedBookWordExplanations(
  bookId: string
): Promise<BookWordExplanations | null> {
  if (!db) return null;

  try {
    const docRef = db.collection(COLLECTION).doc(bookId);
    const doc = await docRef.get();

    if (doc.exists) {
      return doc.data() as BookWordExplanations;
    }

    return null;
  } catch (error) {
    console.error('[BookWordExplanation] Error fetching cached explanations:', error);
    return null;
  }
}
