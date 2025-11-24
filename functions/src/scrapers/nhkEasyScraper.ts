import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import crypto from 'crypto';
import {
  RateLimiter,
  RobotsTxtChecker,
  RetryHandler,
  safeFetch
} from '../utils/scraper-utils';

// Initialize Firestore
const db = admin.firestore();

interface NewsArticle {
  id: string;
  title: string;
  titleWithFurigana?: string; // HTML with <ruby> tags for furigana
  content: string;
  contentWithFurigana?: string; // Full HTML with furigana and grammar colors
  summary: string;
  summaryWithFurigana?: string; // Summary with furigana
  url: string;
  imageUrl?: string;
  audioUrl?: string; // m3u8 audio URL for listening practice (NHK native)
  publishDate: Date;
  source: string;
  category: string;
  difficulty: string;
  tags?: string[];
  sourceId?: string; // Original article ID from source

  // TTS-generated audio fields
  generatedTitleAudioUrl?: string;     // TTS-generated audio for title
  generatedSummaryAudioUrl?: string;   // TTS-generated audio for summary
  generatedContentAudioUrl?: string;   // TTS-generated audio for full content
  audioGeneratedAt?: Date;             // When audio was generated
  audioProvider?: 'edge-tts' | 'kokoro';  // TTS provider used
  audioVoice?: string;                 // Voice ID used
  audioStatus?: 'pending' | 'generated' | 'failed' | 'partial';  // Generation status
  audioError?: string;                 // Error message if generation failed

  metadata?: {
    wordCount?: number;
    readingTime?: number;
    hasFurigana?: boolean;
  };
}

interface NHKArticle {
  news_id: string;
  title: string;
  title_with_ruby: string;
  news_prearranged_time: string;
  has_news_easy_image: boolean;
  news_easy_image_uri: string;
  news_web_url: string;
}

// Helper to generate consistent IDs
function generateArticleId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * NHK Easy scraper using self-hosted NHK Easy API
 * Fetches articles from our Sheldon-hosted nhk-easy-api service
 * Much faster and more reliable than HTML scraping
 */
export async function scrapeNHKEasy(): Promise<{ success: boolean; articles: NewsArticle[]; error?: string }> {
  const startTime = Date.now();
  const articles: NewsArticle[] = [];

  try {
    logger.info('[NHK Easy] Starting API fetch', {
      source: 'NHK Easy API',
      endpoint: 'nhk.selfmind.dev',
      timestamp: new Date().toISOString()
    });

    // Calculate date range: fetch articles from last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const apiUrl = `https://nhk.selfmind.dev/news?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;

    logger.info('[NHK Easy] Fetching from API', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Fetch from our self-hosted API
    const response = await safeFetch(apiUrl, {
      timeoutMs: 30000,
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    interface NHKAPIArticle {
      newsId: string;
      title: string;
      titleWithRuby: string;
      outline: string;
      outlineWithRuby: string;
      body: string;
      bodyWithoutHtml: string;
      url: string;
      m3u8Url: string;
      imageUrl: string;
      publishedAtUtc: string;
    }

    const apiArticles: NHKAPIArticle[] = await response.json();

    logger.info('[NHK Easy] API response received', {
      articleCount: apiArticles.length
    });

    if (!Array.isArray(apiArticles) || apiArticles.length === 0) {
      logger.info('[NHK Easy] No articles available');
      return { success: true, articles: [] };
    }

    // Transform API articles to our NewsArticle format
    for (const apiArticle of apiArticles) {
      try {
        // Use bodyWithoutHtml as the plain text content
        const content = apiArticle.bodyWithoutHtml;

        // Use outline (summary without HTML) as summary
        const summary = apiArticle.outline || content.substring(0, 200) + (content.length > 200 ? '...' : '');

        const newsArticle: NewsArticle = {
          id: generateArticleId(apiArticle.url),
          title: apiArticle.title,
          titleWithFurigana: apiArticle.titleWithRuby, // Full title with furigana
          content,
          contentWithFurigana: apiArticle.body, // Full HTML with furigana and grammar colors
          summary,
          summaryWithFurigana: apiArticle.outlineWithRuby, // Summary with furigana
          url: apiArticle.url,
          imageUrl: apiArticle.imageUrl || undefined,
          audioUrl: apiArticle.m3u8Url || undefined, // Audio for listening practice!
          publishDate: new Date(apiArticle.publishedAtUtc),
          source: 'NHK Easy',
          sourceId: apiArticle.newsId, // Original NHK article ID
          category: 'news',
          difficulty: 'N5', // NHK Easy is beginner level
          tags: ['nhk', 'easy', 'news', 'beginner'],
          metadata: {
            wordCount: content.length,
            readingTime: Math.ceil(content.length / 300), // 300 chars per minute for beginners
            hasFurigana: true // NHK Easy always has furigana
          }
        };

        // NHK Easy provides native professional audio via m3u8Url
        // No need to generate TTS - use the high-quality native audio instead
        logger.info('[NHK Easy] Using native NHK audio', {
          articleId: newsArticle.id,
          title: newsArticle.title.substring(0, 50),
          hasNativeAudio: !!newsArticle.audioUrl
        });

        articles.push(newsArticle);

        logger.debug('[NHK Easy] Article processed', {
          newsId: apiArticle.newsId,
          title: newsArticle.title.substring(0, 50),
          contentLength: content.length
        });

      } catch (articleError) {
        logger.error('[NHK Easy] Error processing article', {
          newsId: apiArticle.newsId,
          error: articleError instanceof Error ? articleError.message : 'Unknown error'
        });
        continue;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('[NHK Easy] API fetch completed successfully', {
      articlesProcessed: articles.length,
      durationMs: duration,
      avgTimePerArticle: articles.length > 0 ? Math.round(duration / articles.length) : 0
    });

    // Store articles in Firestore with batch chunking
    // Firestore has a 500 operation limit per batch, so we chunk at 100 for optimal performance
    if (articles.length > 0) {
      try {
        const BATCH_SIZE = 100;
        let totalStored = 0;

        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
          const batch = db.batch();
          const chunk = articles.slice(i, i + BATCH_SIZE);

          for (const article of chunk) {
            const docRef = db.collection('news_articles').doc(article.id);
            batch.set(docRef, {
              ...article,
              publishDate: admin.firestore.Timestamp.fromDate(article.publishDate),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }

          await batch.commit();
          totalStored += chunk.length;

          logger.debug('[NHK Easy] Batch committed', {
            batchNumber: Math.floor(i / BATCH_SIZE) + 1,
            articlesInBatch: chunk.length,
            totalStored
          });
        }

        logger.info('[NHK Easy] Articles stored in Firestore', {
          count: totalStored,
          batches: Math.ceil(articles.length / BATCH_SIZE)
        });
      } catch (dbError) {
        logger.error('[NHK Easy] Failed to store in Firestore', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          articleCount: articles.length
        });
        // Continue - return articles even if storage fails
      }
    }

    return { success: true, articles };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[NHK Easy] API fetch failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
      articlesCollected: articles.length
    });

    return {
      success: false,
      articles: [],
      error: error instanceof Error ? error.message : 'Failed to fetch from API'
    };
  }
}