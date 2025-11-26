/**
 * Translation API Endpoint
 * Server-side translation using AI with Firebase caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai/AIService';
import { translationCache } from '@/lib/firebase/collections/translations';
import { TranslationMode } from '@/lib/ai/processors/TranslationProcessor';

export async function POST(request: NextRequest) {
  try {
    const {
      text,
      mode,
      userLevel,
      includeGrammarNotes,
      preserveGrammarStructure
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

      console.log(`❌ Firebase Cache MISS. Proceeding with AI translation...`);

    } catch (cacheError) {
      console.error('⚠️ Firebase cache error (proceeding with AI):', cacheError);
      // Continue with AI translation if Firebase cache fails
    }

    // 🤖 STEP 2: Make AI request (cache miss or cache error)
    const aiService = AIService.getInstance();
    const response = await aiService.translateText(text, mode as TranslationMode, {
      jlptLevel: userLevel,
      includeExplanations: includeGrammarNotes
    });

    console.log(`[API] AI Service Response:`, {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
      data: response.data
    });

    if (response.success && response.data) {
      const result = response.data;

      // 💾 STEP 3: Store in Firebase cache for future use
      try {
        const costInfo = {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
          estimatedCost: response.usage?.estimatedCost || 0
        };

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

        console.log(`💾 Stored translation in Firebase cache (${Date.now() - startTime}ms total)`);

      } catch (storeError) {
        console.error('⚠️ Failed to store translation in Firebase cache:', storeError);
        // Don't fail the translation if cache storage fails
      }

      return NextResponse.json({
        success: true,
        data: result,
        cached: false,
        usage: response.usage,
        responseTime: Date.now() - startTime
      });

    } else {
      throw new Error(response.error || 'Translation failed');
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