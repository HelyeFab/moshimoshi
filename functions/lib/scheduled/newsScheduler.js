"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualNewsScraperFunction = exports.scheduledNewsScraperFunction = void 0;
exports.scheduledNewsScraper = scheduledNewsScraper;
exports.manualNewsScraper = manualNewsScraper;
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
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
async function triggerScraper(source) {
    const startTime = Date.now();
    try {
        console.log(`[NewsScheduler] Triggering ${source.name} scraper...`);
        // Get the base URL from environment or use default
        const baseUrl = process.env.FUNCTIONS_EMULATOR_URL ||
            `https://${process.env.GCLOUD_PROJECT}.web.app`;
        // Call the API endpoint
        const response = await (0, node_fetch_1.default)(`${baseUrl}/api/news/scrape?source=${source.endpoint}&force=true`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Request': 'true' // Internal request marker
            },
            signal: AbortSignal.timeout(55000) // 55 seconds timeout
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        const duration = Date.now() - startTime;
        if (result.success) {
            console.log(`✅ [NewsScheduler] ${source.name}: ${result.articlesCount || 0} articles scraped in ${duration}ms`);
            return {
                source: source.name,
                endpoint: source.endpoint,
                success: true,
                articlesCount: result.articlesCount || 0,
                duration,
                timestamp: new Date().toISOString()
            };
        }
        else {
            console.error(`❌ [NewsScheduler] ${source.name} failed:`, result.error);
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
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [NewsScheduler] ${source.name} error:`, error);
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
async function scheduledNewsScraper() {
    const startTime = Date.now();
    console.log('🗞️ [NewsScheduler] Starting scheduled news scraping...');
    try {
        // Filter enabled sources only
        const enabledSources = NEWS_SOURCES.filter(s => s.enabled);
        if (enabledSources.length === 0) {
            console.warn('⚠️ [NewsScheduler] No news sources enabled');
            return {
                success: false,
                message: 'No news sources enabled',
                timestamp: new Date().toISOString()
            };
        }
        // Run all scrapers in parallel
        console.log(`[NewsScheduler] Running ${enabledSources.length} scrapers in parallel...`);
        const results = await Promise.allSettled(enabledSources.map(source => triggerScraper(source)));
        // Process results
        const summary = {
            totalArticles: 0,
            successfulSources: 0,
            failedSources: 0,
            sources: {},
            duration: 0,
            timestamp: new Date().toISOString()
        };
        results.forEach((result, index) => {
            var _a;
            const sourceName = enabledSources[index].name;
            if (result.status === 'fulfilled' && result.value.success) {
                summary.successfulSources++;
                summary.totalArticles += result.value.articlesCount;
                summary.sources[sourceName] = {
                    success: true,
                    articles: result.value.articlesCount,
                    duration: result.value.duration
                };
            }
            else if (result.status === 'fulfilled') {
                summary.failedSources++;
                summary.sources[sourceName] = {
                    success: false,
                    error: result.value.error,
                    duration: result.value.duration
                };
            }
            else {
                summary.failedSources++;
                summary.sources[sourceName] = {
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'
                };
            }
        });
        summary.duration = Date.now() - startTime;
        // Log results to Firestore for monitoring
        try {
            await db.collection('scraping_logs').add(Object.assign(Object.assign({}, summary), { type: 'scheduled', createdAt: admin.firestore.FieldValue.serverTimestamp() }));
            console.log('✅ [NewsScheduler] Results logged to Firestore');
        }
        catch (logError) {
            console.error('❌ [NewsScheduler] Failed to log results:', logError);
        }
        // Log summary
        console.log('📊 [NewsScheduler] Scraping Summary:');
        console.log(`  - Total Articles: ${summary.totalArticles}`);
        console.log(`  - Successful Sources: ${summary.successfulSources}/${enabledSources.length}`);
        console.log(`  - Failed Sources: ${summary.failedSources}`);
        console.log(`  - Total Duration: ${summary.duration}ms`);
        // Send alert if all scrapers failed
        if (summary.successfulSources === 0) {
            console.error('🚨 [NewsScheduler] ALERT: All scrapers failed!');
            // TODO: Send notification (email, Slack, etc.)
        }
        return {
            success: summary.successfulSources > 0,
            summary,
            message: `Scraped ${summary.totalArticles} articles from ${summary.successfulSources} sources`
        };
    }
    catch (error) {
        console.error('❌ [NewsScheduler] Fatal error:', error);
        // Log error to Firestore
        try {
            await db.collection('scraping_logs').add({
                type: 'scheduled',
                error: error instanceof Error ? error.message : 'Unknown error',
                success: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        catch (logError) {
            console.error('Failed to log error:', logError);
        }
        throw error;
    }
}
// Manual trigger function for testing
async function manualNewsScraper(data, context) {
    // Check if user is authenticated (optional)
    if (!context.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to trigger manual scraping');
    }
    console.log(`🔧 [NewsScheduler] Manual trigger by user: ${context.auth.uid}`);
    // Run the scheduler
    const result = await scheduledNewsScraper();
    return result;
}
// Export functions for different triggers
exports.scheduledNewsScraperFunction = (0, scheduler_1.onSchedule)({
    schedule: '0 6 * * *', // 6:00 AM every day
    timeZone: 'Asia/Tokyo', // Japan time
    memory: '1GiB',
    timeoutSeconds: 540 // 9 minutes
}, async (event) => {
    console.log('⏰ [NewsScheduler] Scheduled trigger activated');
    await scheduledNewsScraper();
});
exports.manualNewsScraperFunction = (0, https_1.onCall)({
    memory: '1GiB',
    timeoutSeconds: 540
}, async (request) => {
    return manualNewsScraper(request.data, request);
});
//# sourceMappingURL=newsScheduler.js.map