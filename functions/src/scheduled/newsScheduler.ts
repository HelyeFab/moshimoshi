import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { filterArticles, checkDuplicates } from '../utils/articleValidation';
import { scrapeNHKEasy } from '../scrapers/nhkEasyScraper';
import { scrapeTodaii } from '../scrapers/todaii';
import { scrapeWatanoc } from '../scrapers/watanoc';
import { scrapeMainichiNews } from '../scrapers/mainichi-news';
import { scrapeMainichiShogakusei } from '../scrapers/mainichi-shogakusei';

// Initialize Firestore
const db = admin.firestore();

// News source configurations
const NEWS_SOURCES = [
  {
    name: 'NHK Easy',
    endpoint: 'nhk-easy',
    priority: 1,
    enabled: true
  },
  {
    name: 'Todaii',
    endpoint: 'todaii',
    priority: 2,
    enabled: true
  },
  {
    name: 'Watanoc',
    endpoint: 'watanoc',
    priority: 3,
    enabled: true
  },
  {
    name: 'Mainichi News',
    endpoint: 'mainichi-news',
    priority: 4,
    enabled: true
  },
  {
    name: 'Mainichi Elementary',
    endpoint: 'mainichi-shogakusei',
    priority: 5,
    enabled: true
  }
];

// Helper to trigger individual scraper
async function triggerScraper(source: typeof NEWS_SOURCES[0]) {
  const startTime = Date.now();

  try {
    logger.info('[NewsScheduler] Triggering scraper', { source: source.name });

    let result;

    // Call scrapers directly instead of via HTTP
    switch (source.endpoint) {
      case 'nhk-easy':
        result = await scrapeNHKEasy();
        break;
      case 'todaii': {
        const articles = await scrapeTodaii();
        result = { success: true, articles };
        break;
      }
      case 'watanoc': {
        const articles = await scrapeWatanoc();
        result = { success: true, articles };
        break;
      }
      case 'mainichi-news': {
        const articles = await scrapeMainichiNews();
        result = { success: true, articles };
        break;
      }
      case 'mainichi-shogakusei': {
        const articles = await scrapeMainichiShogakusei();
        result = { success: true, articles };
        break;
      }
      default:
        throw new Error(`Unknown scraper: ${source.endpoint}`);
    }

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info('[NewsScheduler] Scraper succeeded', {
        source: source.name,
        articlesCount: result.articles?.length || 0,
        durationMs: duration
      });
      return {
        source: source.name,
        endpoint: source.endpoint,
        success: true,
        articlesCount: result.articles?.length || 0,
        duration,
        timestamp: new Date().toISOString()
      };
    } else {
      logger.error('[NewsScheduler] Scraper failed', {
        source: source.name,
        error: result.error,
        durationMs: duration
      });
      return {
        source: source.name,
        endpoint: source.endpoint,
        success: false,
        articlesCount: 0,
        duration,
        error: result.error,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[NewsScheduler] Scraper error', {
      source: source.name,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration
    });
    return {
      source: source.name,
      endpoint: source.endpoint,
      success: false,
      articlesCount: 0,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

// Main scheduler function
export async function scheduledNewsScraper() {
  const startTime = Date.now();
  logger.info('[NewsScheduler] Starting scheduled news scraping');

  try {
    // Filter enabled sources only
    const enabledSources = NEWS_SOURCES.filter(s => s.enabled);

    if (enabledSources.length === 0) {
      logger.warn('[NewsScheduler] No news sources enabled');
      return {
        success: false,
        message: 'No news sources enabled',
        timestamp: new Date().toISOString()
      };
    }

    // Run all scrapers in parallel
    logger.info('[NewsScheduler] Running scrapers in parallel', {
      scraperCount: enabledSources.length
    });
    const results = await Promise.allSettled(
      enabledSources.map(source => triggerScraper(source))
    );

    // Process results
    const summary = {
      totalArticles: 0,
      successfulSources: 0,
      failedSources: 0,
      sources: {} as Record<string, any>,
      duration: 0,
      timestamp: new Date().toISOString()
    };

    results.forEach((result, index) => {
      const sourceName = enabledSources[index].name;

      if (result.status === 'fulfilled' && result.value.success) {
        summary.successfulSources++;
        summary.totalArticles += result.value.articlesCount;
        summary.sources[sourceName] = {
          success: true,
          articles: result.value.articlesCount,
          duration: result.value.duration
        };
      } else if (result.status === 'fulfilled') {
        summary.failedSources++;
        summary.sources[sourceName] = {
          success: false,
          error: result.value.error,
          duration: result.value.duration
        };
      } else {
        summary.failedSources++;
        summary.sources[sourceName] = {
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    summary.duration = Date.now() - startTime;

    // Log results to Firestore for monitoring
    try {
      await db.collection('scraping_logs').add({
        ...summary,
        type: 'scheduled',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info('[NewsScheduler] Results logged to Firestore');
    } catch (logError) {
      logger.error('[NewsScheduler] Failed to log results', {
        error: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }

    // Log summary
    logger.info('[NewsScheduler] Scraping summary', {
      totalArticles: summary.totalArticles,
      successfulSources: summary.successfulSources,
      totalSources: enabledSources.length,
      failedSources: summary.failedSources,
      durationMs: summary.duration,
      sources: summary.sources
    });

    // Send alert if all scrapers failed
    if (summary.successfulSources === 0) {
      logger.error('[NewsScheduler] ALERT: All scrapers failed', {
        totalSources: enabledSources.length,
        timestamp: new Date().toISOString()
      });
      // TODO: Send notification (email, Slack, etc.)
    }

    return {
      success: summary.successfulSources > 0,
      summary,
      message: `Scraped ${summary.totalArticles} articles from ${summary.successfulSources} sources`
    };

  } catch (error) {
    logger.error('[NewsScheduler] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime
    });

    // Log error to Firestore
    try {
      await db.collection('scraping_logs').add({
        type: 'scheduled',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      logger.error('[NewsScheduler] Failed to log error', {
        error: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }

    throw error;
  }
}

// Manual trigger function for testing
export async function manualNewsScraper(data: any, context: any) {
  // Check if user is authenticated OR has admin key
  const adminKey = data?.adminKey;
  const expectedAdminKey = process.env.NEWS_SCRAPER_ADMIN_KEY || 'news-scraper-admin-2025';

  if (!context.auth && adminKey !== expectedAdminKey) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated or provide valid admin key to trigger manual scraping'
    );
  }

  logger.info('[NewsScheduler] Manual trigger initiated', {
    userId: context.auth?.uid || 'admin-key',
    timestamp: new Date().toISOString()
  });

  // Run the scheduler
  const result = await scheduledNewsScraper();

  return result;
}

// Export functions for different triggers
export const scheduledNewsScraperFunction = onSchedule({
  schedule: '0 6 * * *', // 6:00 AM every day
  timeZone: 'Asia/Tokyo', // Japan time
  memory: '2GiB', // Increased from 1GiB for better performance
  timeoutSeconds: 540, // 9 minutes
  retryCount: 2 // Retry up to 2 times on failure
}, async (event) => {
  logger.info('[NewsScheduler] Scheduled trigger activated', {
    scheduleTime: event.scheduleTime,
    jobName: event.jobName
  });
  await scheduledNewsScraper();
});

export const manualNewsScraperFunction = onCall({
  memory: '2GiB', // Increased from 1GiB for better performance
  timeoutSeconds: 540,
  invoker: 'public' // Allow public invocation (auth checked via admin key inside)
}, async (request) => {
  return manualNewsScraper(request.data, request);
});