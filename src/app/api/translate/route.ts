/**
 * Translation API Endpoint
 * Server-side translation using AI with Firebase caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai/AIService';
import { translationCache } from '@/lib/firebase/collections/translations';
import { TranslationMode } from '@/lib/ai/processors/TranslationProcessor';

const CHUNK_MAX_CHARS = 800;

function splitIntoChunks(text: string, maxChars: number): string[] {
  const sentences = text
    .split(/(?<=[。！？!?\\n])/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1 || text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? '' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

function mergeTranslationResults(
  results: any[],
  originalText: string,
  mode: TranslationMode
) {
  const translatedText = results.map(r => r?.translatedText || '').join('\n').trim();
  const avgConfidence =
    results.length > 0
      ? results.reduce((sum, r) => sum + (r?.confidence || 0), 0) / results.length
      : 0.8;

  const merged: any = {
    originalText,
    translatedText,
    mode,
    confidence: Math.max(0, Math.min(1, avgConfidence)),
    hints: results.flatMap(r => r?.hints || []),
    grammarNotes: results.flatMap(r => r?.grammarNotes || []),
    keyVocabulary: results.flatMap(r => r?.keyVocabulary || []),
    alternatives: results.flatMap(r => r?.alternatives || []),
    learningPoints: results.flatMap(r => r?.learningPoints || []),
    nextSteps: results.flatMap(r => r?.nextSteps || []),
  };

  if (mode === 'partial') {
    merged.partialTranslation = {
      original: originalText,
      partial: results
        .map(r => r?.partialTranslation?.partial || r?.translatedText || '')
        .join('\n')
        .trim(),
      translatedParts: results.flatMap(r => r?.partialTranslation?.translatedParts || []),
      remainingJapanese: results.flatMap(r => r?.partialTranslation?.remainingJapanese || []),
    };
  }

  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const {
      text,
      mode,
      userLevel,
      includeGrammarNotes,
      preserveGrammarStructure,
      clientChunked,
    } = await request.json();

    // Validate required fields
    if (!text || !mode) {
      return NextResponse.json(
        { success: false, error: 'Text and mode are required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // 🔍 STEP 1: Check Firebase cache first
    console.log(`🔍 Checking Firebase cache for: "${text.substring(0, 50)}..." (${mode})`);

    try {
      if (!translationCache || typeof translationCache.getCachedTranslation !== 'function') {
        console.warn('⚠️ Translation cache not initialized; skipping cache read');
      } else {
        const cachedResult = await translationCache.getCachedTranslation(
          text,
          mode as TranslationMode,
          userLevel || 'N5',
          {
            includeGrammarNotes: includeGrammarNotes ?? true,
            preserveGrammarStructure: preserveGrammarStructure ?? true
          }
        );

        if (cachedResult) {
          console.log(`✅ Firebase Cache HIT! (${Date.now() - startTime}ms)`);
          return NextResponse.json({
            success: true,
            data: cachedResult,
            cached: true,
            responseTime: Date.now() - startTime
          });
        }
      }

      console.log(`❌ Firebase Cache MISS. Proceeding with AI translation...`);

    } catch (cacheError) {
      console.error('⚠️ Firebase cache error (proceeding with AI):', cacheError);
      // Continue with AI translation if Firebase cache fails
    }

    // 🤖 STEP 2: Make AI request (cache miss or cache error)
    const aiService = AIService.getInstance();
    const chunks = clientChunked ? [text] : splitIntoChunks(text, CHUNK_MAX_CHARS);
    const chunked = chunks.length > 1;

    if (chunked) {
      console.log(`[Translate] Chunking text into ${chunks.length} parts (max ${CHUNK_MAX_CHARS} chars).`);
    }

    const chunkResults = [];
    const usageTotals = { promptTokens: 0, completionTokens: 0, estimatedCost: 0 };
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const response = await aiService.translateText(chunk, mode as TranslationMode, {
        jlptLevel: userLevel,
        includeExplanations: includeGrammarNotes,
        timeout: 60000,
        maxRetries: 1,
      });

      console.log(`[API] AI Service Response:`, {
        success: response.success,
        hasData: !!response.data,
        error: response.error,
        data: response.data
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Translation failed');
      }
      if (response.usage) {
        usageTotals.promptTokens += response.usage.promptTokens || 0;
        usageTotals.completionTokens += response.usage.completionTokens || 0;
        usageTotals.estimatedCost += response.usage.estimatedCost || 0;
      }
      chunkResults.push(response.data);
    }

    const response = {
      success: true,
      data: chunked
        ? mergeTranslationResults(chunkResults, text, mode as TranslationMode)
        : chunkResults[0],
      usage: usageTotals,
    };
    if (response.success && response.data) {
      const result = response.data;

      // 💾 STEP 3: Store in Firebase cache for future use
      try {
        const costInfo = {
          promptTokens: usageTotals.promptTokens || 0,
          completionTokens: usageTotals.completionTokens || 0,
          estimatedCost: usageTotals.estimatedCost || 0
        };

        if (!translationCache || typeof translationCache.storeTranslation !== 'function') {
          console.warn('⚠️ Translation cache not initialized; skipping cache write');
        } else {
          await translationCache.storeTranslation(
            text,
            mode as TranslationMode,
            userLevel || 'N5',
            result,
            costInfo,
            undefined, // context - could be enhanced later
            {
              includeGrammarNotes: includeGrammarNotes ?? true,
              preserveGrammarStructure: preserveGrammarStructure ?? true
            }
          );
        }

        console.log(`💾 Stored translation in Firebase cache (${Date.now() - startTime}ms total)`);

      } catch (storeError) {
        console.error('⚠️ Failed to store translation in Firebase cache:', storeError);
        // Don't fail the translation if cache storage fails
      }

      return NextResponse.json({
        success: true,
        data: result,
        cached: false,
        usage: usageTotals,
        responseTime: Date.now() - startTime
      });

    } else {
      throw new Error('Translation failed');
    }

  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed'
      },
      { status: 500 }
    );
  }
}
