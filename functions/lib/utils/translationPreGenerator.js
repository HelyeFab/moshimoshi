'use strict'
/**
 * Translation Pre-Generator for News Articles
 * Pre-generates translations for title, summary, and content segments
 * Stores in Firestore for instant retrieval by frontend
 *
 * Uses Qwen 2.5 32B via Modal Ollama endpoint for cost-effective AI processing
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = []
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
          return ar
        }
      return ownKeys(o)
    }
    return function (mod) {
      if (mod && mod.__esModule) return mod
      var result = {}
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i])
      __setModuleDefault(result, mod)
      return result
    }
  })()
Object.defineProperty(exports, '__esModule', { value: true })
exports.generateArticleTranslations = generateArticleTranslations
exports.storeArticleTranslations = storeArticleTranslations
exports.generateBatchTranslations = generateBatchTranslations
exports.getCachedTranslations = getCachedTranslations
const admin = __importStar(require('firebase-admin'))
const logger = __importStar(require('firebase-functions/logger'))
const params_1 = require('firebase-functions/params')
// Initialize Firestore
const db = admin.firestore()
// Define Modal API key for Qwen 2.5 access
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY')
// Qwen 2.5 configuration via Modal Ollama
const QWEN_CONFIG = {
  baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
  model: 'qwen2.5:32b',
  timeout: 300000, // 5 minutes for 32B model
}
/**
 * Call Qwen 2.5 via Modal Ollama endpoint
 */
async function callQwen(systemPrompt, userPrompt) {
  var _a, _b, _c, _d, _e
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), QWEN_CONFIG.timeout)
  try {
    const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MODAL_API_KEY.value(),
      },
      body: JSON.stringify({
        model: QWEN_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Qwen API error: ${response.status} - ${errorText}`)
    }
    const data = await response.json()
    const content =
      ((_b = (_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null ||
      _b === void 0
        ? void 0
        : _b.content) || '{}'
    return {
      content,
      usage: {
        promptTokens:
          ((_c = data.usage) === null || _c === void 0 ? void 0 : _c.prompt_tokens) || 0,
        completionTokens:
          ((_d = data.usage) === null || _d === void 0 ? void 0 : _d.completion_tokens) || 0,
        totalTokens: ((_e = data.usage) === null || _e === void 0 ? void 0 : _e.total_tokens) || 0,
      },
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Qwen API timeout after 5 minutes')
    }
    throw error
  }
}
/**
 * Generate translation for a single text segment using Qwen 2.5
 */
async function generateSegmentTranslation(text, type, mode = 'learning') {
  const systemPrompt = `You are an expert Japanese-English translator specializing in educational translations for language learners.

For ${mode} mode:
${
  mode === 'learning'
    ? `
- Provide comprehensive educational translation
- Extract key vocabulary with meanings
- Note important grammar patterns
- Focus on teaching opportunities
`
    : `
- Provide accurate, natural English translation
- Maintain the tone and nuance of the original
- Use clear, accessible language
`
}

Return a JSON object with this structure:
{
  "translatedText": "The English translation",
  "confidence": 0.95,
  "keyVocabulary": [
    { "word": "Japanese word", "meaning": "English meaning" }
  ],
  "grammarNotes": ["Important grammar pattern explanations"]
}`
  const userPrompt = `Translate this Japanese ${type}:

"${text}"

Mode: ${mode}
Return a valid JSON object as specified.`
  try {
    const { content, usage } = await callQwen(systemPrompt, userPrompt)
    const parsed = JSON.parse(content)
    const segment = {
      originalText: text,
      translatedText: parsed.translatedText || '',
      type,
      mode,
      confidence: parsed.confidence || 0.9,
      metadata: {
        wordCount: text.length,
        keyVocabulary: parsed.keyVocabulary || [],
        grammarNotes: parsed.grammarNotes || [],
      },
    }
    return { segment, usage }
  } catch (error) {
    logger.error('[TranslationPreGen] Error generating translation with Qwen', {
      type,
      model: QWEN_CONFIG.model,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
/**
 * Split content into sentences for individual translation
 */
function splitIntoSentences(content) {
  // Split by Japanese sentence endings: 。！？
  const sentences = content.split(/[。！？]/)
  // Filter out empty sentences and trim
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + '。') // Add back the period
}
/**
 * Generate all translations for a single article
 */
async function generateArticleTranslations(article) {
  const startTime = Date.now()
  logger.info('[TranslationPreGen] Starting translation generation', {
    articleId: article.id,
    title: article.title.substring(0, 50),
  })
  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0
  try {
    // 1. Translate title (learning mode for educational value)
    const { segment: titleSegment, usage: titleUsage } = await generateSegmentTranslation(
      article.title,
      'title',
      'learning'
    )
    totalPromptTokens += titleUsage.promptTokens
    totalCompletionTokens += titleUsage.completionTokens
    totalTokens += titleUsage.totalTokens
    // 2. Translate summary (learning mode)
    const { segment: summarySegment, usage: summaryUsage } = await generateSegmentTranslation(
      article.summary,
      'summary',
      'learning'
    )
    totalPromptTokens += summaryUsage.promptTokens
    totalCompletionTokens += summaryUsage.completionTokens
    totalTokens += summaryUsage.totalTokens
    // 3. Translate full content (full mode for complete understanding)
    const { segment: contentSegment, usage: contentUsage } = await generateSegmentTranslation(
      article.content,
      'content',
      'full'
    )
    totalPromptTokens += contentUsage.promptTokens
    totalCompletionTokens += contentUsage.completionTokens
    totalTokens += contentUsage.totalTokens
    // 4. Split content into sentences and translate each (optional - for sentence-by-sentence reading)
    const sentences = splitIntoSentences(article.content)
    const sentenceSegments = []
    // Only translate first 10 sentences to save costs
    const sentencesToTranslate = sentences.slice(0, 10)
    for (const sentence of sentencesToTranslate) {
      try {
        const { segment, usage } = await generateSegmentTranslation(sentence, 'sentence', 'full')
        sentenceSegments.push(segment)
        totalPromptTokens += usage.promptTokens
        totalCompletionTokens += usage.completionTokens
        totalTokens += usage.totalTokens
      } catch (sentenceError) {
        logger.error('[TranslationPreGen] Error translating sentence', {
          sentence: sentence.substring(0, 50),
          error: sentenceError instanceof Error ? sentenceError.message : 'Unknown error',
        })
        // Continue with next sentence
      }
    }
    // Qwen 2.5 via Modal Ollama is self-hosted = $0 cost
    // Keeping token tracking for monitoring purposes
    const estimatedCost = 0
    const translation = {
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
        estimatedCost,
      },
    }
    const duration = Date.now() - startTime
    logger.info('[TranslationPreGen] Translation generation completed', {
      articleId: article.id,
      durationMs: duration,
      tokensUsed: totalTokens,
      estimatedCost: estimatedCost.toFixed(4),
      sentencesTranslated: sentenceSegments.length,
    })
    return translation
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[TranslationPreGen] Translation generation failed', {
      articleId: article.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    })
    throw error
  }
}
/**
 * Store article translations in Firestore
 */
async function storeArticleTranslations(translation) {
  try {
    const docRef = db.collection('news_article_translations').doc(translation.articleId)
    await docRef.set(
      Object.assign(Object.assign({}, translation), {
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      })
    )
    logger.info('[TranslationPreGen] Translations stored', {
      articleId: translation.articleId,
      collection: 'news_article_translations',
    })
  } catch (error) {
    logger.error('[TranslationPreGen] Failed to store translations', {
      articleId: translation.articleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
/**
 * Generate and store translations for multiple articles (batch)
 */
async function generateBatchTranslations(articles) {
  const startTime = Date.now()
  logger.info('[TranslationPreGen] Starting batch translation generation', {
    articleCount: articles.length,
  })
  const results = []
  let successCount = 0
  let failureCount = 0
  let totalCost = 0
  for (const article of articles) {
    try {
      // Generate translations
      const translation = await generateArticleTranslations(article)
      // Store in Firestore
      await storeArticleTranslations(translation)
      // Track success
      results.push({
        articleId: article.id,
        success: true,
        translation,
      })
      successCount++
      totalCost += translation.costInfo.estimatedCost
      logger.info('[TranslationPreGen] Article translation completed', {
        articleId: article.id,
        successCount,
        remainingArticles: articles.length - successCount - failureCount,
      })
    } catch (error) {
      // Track failure
      results.push({
        articleId: article.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      failureCount++
      logger.error('[TranslationPreGen] Article translation failed', {
        articleId: article.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount,
      })
    }
  }
  const duration = Date.now() - startTime
  logger.info('[TranslationPreGen] Batch translation generation completed', {
    total: articles.length,
    successCount,
    failureCount,
    totalCost: totalCost.toFixed(4),
    durationMs: duration,
    avgTimePerArticle: Math.round(duration / articles.length),
  })
  return {
    successCount,
    failureCount,
    totalCost,
    results,
  }
}
/**
 * Get cached translations for an article
 */
async function getCachedTranslations(articleId) {
  try {
    const docRef = db.collection('news_article_translations').doc(articleId)
    const doc = await docRef.get()
    if (doc.exists) {
      return doc.data()
    }
    return null
  } catch (error) {
    logger.error('[TranslationPreGen] Error fetching cached translations', {
      articleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}
//# sourceMappingURL=translationPreGenerator.js.map
