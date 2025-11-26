/**
 * Translation Pre-Generator for News Articles
 * Pre-generates translations for title, summary, and content segments
 * Stores in Firestore for instant retrieval by frontend
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import OpenAI from 'openai';
import { defineSecret } from 'firebase-functions/params';

// Initialize Firestore
const db = admin.firestore();

// Define OpenAI secret
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY.value()
    });
  }
  return openai;
}

export interface TranslationSegment {
  originalText: string;
  translatedText: string;
  type: 'title' | 'summary' | 'content' | 'sentence';
  mode: 'learning' | 'full';
  confidence: number;
  metadata?: {
    wordCount?: number;
    keyVocabulary?: Array<{
      word: string;
      meaning: string;
    }>;
    grammarNotes?: string[];
  };
}

export interface ArticleTranslation {
  articleId: string;
  title: TranslationSegment;
  summary: TranslationSegment;
  content: TranslationSegment;
  sentences?: TranslationSegment[];
  generatedAt: admin.firestore.Timestamp;
  costInfo: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export interface BatchTranslationResult {
  successCount: number;
  failureCount: number;
  totalCost: number;
  results: Array<{
    articleId: string;
    success: boolean;
    error?: string;
    translation?: ArticleTranslation;
  }>;
}

/**
 * Generate translation for a single text segment
 */
async function generateSegmentTranslation(
  text: string,
  type: 'title' | 'summary' | 'content' | 'sentence',
  mode: 'learning' | 'full' = 'learning'
): Promise<{ segment: TranslationSegment; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const ai = getOpenAI();

  const systemPrompt = `You are an expert Japanese-English translator specializing in educational translations for language learners.

For ${mode} mode:
${mode === 'learning' ? `
- Provide comprehensive educational translation
- Extract key vocabulary with meanings
- Note important grammar patterns
- Focus on teaching opportunities
` : `
- Provide accurate, natural English translation
- Maintain the tone and nuance of the original
- Use clear, accessible language
`}

Return a JSON object with this structure:
{
  "translatedText": "The English translation",
  "confidence": 0.95,
  "keyVocabulary": [
    { "word": "Japanese word", "meaning": "English meaning" }
  ],
  "grammarNotes": ["Important grammar pattern explanations"]
}`;

  const userPrompt = `Translate this Japanese ${type}:

"${text}"

Mode: ${mode}
Return a valid JSON object as specified.`;

  try {
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower for consistent translations
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    const segment: TranslationSegment = {
      originalText: text,
      translatedText: parsed.translatedText || '',
      type,
      mode,
      confidence: parsed.confidence || 0.9,
      metadata: {
        wordCount: text.length,
        keyVocabulary: parsed.keyVocabulary || [],
        grammarNotes: parsed.grammarNotes || []
      }
    };

    const usage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    };

    return { segment, usage };

  } catch (error) {
    logger.error('[TranslationPreGen] Error generating translation', {
      type,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

/**
 * Split content into sentences for individual translation
 */
function splitIntoSentences(content: string): string[] {
  // Split by Japanese sentence endings: 。！？
  const sentences = content.split(/[。！？]/);

  // Filter out empty sentences and trim
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + '。'); // Add back the period
}

/**
 * Generate all translations for a single article
 */
export async function generateArticleTranslations(article: {
  id: string;
  title: string;
  summary: string;
  content: string;
}): Promise<ArticleTranslation> {
  const startTime = Date.now();

  logger.info('[TranslationPreGen] Starting translation generation', {
    articleId: article.id,
    title: article.title.substring(0, 50)
  });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;

  try {
    // 1. Translate title (learning mode for educational value)
    const { segment: titleSegment, usage: titleUsage } = await generateSegmentTranslation(
      article.title,
      'title',
      'learning'
    );
    totalPromptTokens += titleUsage.promptTokens;
    totalCompletionTokens += titleUsage.completionTokens;
    totalTokens += titleUsage.totalTokens;

    // 2. Translate summary (learning mode)
    const { segment: summarySegment, usage: summaryUsage } = await generateSegmentTranslation(
      article.summary,
      'summary',
      'learning'
    );
    totalPromptTokens += summaryUsage.promptTokens;
    totalCompletionTokens += summaryUsage.completionTokens;
    totalTokens += summaryUsage.totalTokens;

    // 3. Translate full content (full mode for complete understanding)
    const { segment: contentSegment, usage: contentUsage } = await generateSegmentTranslation(
      article.content,
      'content',
      'full'
    );
    totalPromptTokens += contentUsage.promptTokens;
    totalCompletionTokens += contentUsage.completionTokens;
    totalTokens += contentUsage.totalTokens;

    // 4. Split content into sentences and translate each (optional - for sentence-by-sentence reading)
    const sentences = splitIntoSentences(article.content);
    const sentenceSegments: TranslationSegment[] = [];

    // Only translate first 10 sentences to save costs
    const sentencesToTranslate = sentences.slice(0, 10);

    for (const sentence of sentencesToTranslate) {
      try {
        const { segment, usage } = await generateSegmentTranslation(
          sentence,
          'sentence',
          'full'
        );
        sentenceSegments.push(segment);

        totalPromptTokens += usage.promptTokens;
        totalCompletionTokens += usage.completionTokens;
        totalTokens += usage.totalTokens;
      } catch (sentenceError) {
        logger.error('[TranslationPreGen] Error translating sentence', {
          sentence: sentence.substring(0, 50),
          error: sentenceError instanceof Error ? sentenceError.message : 'Unknown error'
        });
        // Continue with next sentence
      }
    }

    // Calculate estimated cost (GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output)
    const estimatedCost = (
      (totalPromptTokens / 1_000_000) * 0.15 +
      (totalCompletionTokens / 1_000_000) * 0.60
    );

    const translation: ArticleTranslation = {
      articleId: article.id,
      title: titleSegment,
      summary: summarySegment,
      content: contentSegment,
      sentences: sentenceSegments,
      generatedAt: admin.firestore.Timestamp.now(),
      costInfo: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens,
        estimatedCost
      }
    };

    const duration = Date.now() - startTime;

    logger.info('[TranslationPreGen] Translation generation completed', {
      articleId: article.id,
      durationMs: duration,
      tokensUsed: totalTokens,
      estimatedCost: estimatedCost.toFixed(4),
      sentencesTranslated: sentenceSegments.length
    });

    return translation;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[TranslationPreGen] Translation generation failed', {
      articleId: article.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration
    });

    throw error;
  }
}

/**
 * Store article translations in Firestore
 */
export async function storeArticleTranslations(translation: ArticleTranslation): Promise<void> {
  try {
    const docRef = db.collection('news_article_translations').doc(translation.articleId);

    await docRef.set({
      ...translation,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info('[TranslationPreGen] Translations stored', {
      articleId: translation.articleId,
      collection: 'news_article_translations'
    });

  } catch (error) {
    logger.error('[TranslationPreGen] Failed to store translations', {
      articleId: translation.articleId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

/**
 * Generate and store translations for multiple articles (batch)
 */
export async function generateBatchTranslations(
  articles: Array<{ id: string; title: string; summary: string; content: string }>
): Promise<BatchTranslationResult> {
  const startTime = Date.now();

  logger.info('[TranslationPreGen] Starting batch translation generation', {
    articleCount: articles.length
  });

  const results: BatchTranslationResult['results'] = [];
  let successCount = 0;
  let failureCount = 0;
  let totalCost = 0;

  for (const article of articles) {
    try {
      // Generate translations
      const translation = await generateArticleTranslations(article);

      // Store in Firestore
      await storeArticleTranslations(translation);

      // Track success
      results.push({
        articleId: article.id,
        success: true,
        translation
      });

      successCount++;
      totalCost += translation.costInfo.estimatedCost;

      logger.info('[TranslationPreGen] Article translation completed', {
        articleId: article.id,
        successCount,
        remainingArticles: articles.length - successCount - failureCount
      });

    } catch (error) {
      // Track failure
      results.push({
        articleId: article.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      failureCount++;

      logger.error('[TranslationPreGen] Article translation failed', {
        articleId: article.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount
      });
    }
  }

  const duration = Date.now() - startTime;

  logger.info('[TranslationPreGen] Batch translation generation completed', {
    total: articles.length,
    successCount,
    failureCount,
    totalCost: totalCost.toFixed(4),
    durationMs: duration,
    avgTimePerArticle: Math.round(duration / articles.length)
  });

  return {
    successCount,
    failureCount,
    totalCost,
    results
  };
}

/**
 * Get cached translations for an article
 */
export async function getCachedTranslations(articleId: string): Promise<ArticleTranslation | null> {
  try {
    const docRef = db.collection('news_article_translations').doc(articleId);
    const doc = await docRef.get();

    if (doc.exists) {
      return doc.data() as ArticleTranslation;
    }

    return null;

  } catch (error) {
    logger.error('[TranslationPreGen] Error fetching cached translations', {
      articleId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return null;
  }
}
