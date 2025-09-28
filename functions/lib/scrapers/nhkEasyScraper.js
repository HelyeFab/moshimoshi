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
exports.scrapeNHKEasy = scrapeNHKEasy;
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto_1 = __importDefault(require("crypto"));
// Initialize Firestore
const db = admin.firestore();
// Helper to generate consistent IDs
function generateArticleId(url) {
    return crypto_1.default.createHash('md5').update(url).digest('hex');
}
// Helper to strip ruby tags but keep the text
function stripRubyTags(html) {
    // Remove <rt> tags and their content
    let text = html.replace(/<rt>.*?<\/rt>/g, '');
    // Remove remaining <ruby> tags but keep content
    text = text.replace(/<\/?ruby>/g, '');
    return text;
}
// Enhanced NHK Easy scraper with retry logic
async function scrapeNHKEasy() {
    const articles = [];
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[NHK Easy] Attempt ${attempt}/${maxRetries} - Fetching news from API...`);
            // Fetch the JSON API with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            const response = await (0, node_fetch_1.default)('https://www3.nhk.or.jp/news/easy/news-list.json', {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                }
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            // The API returns an array with one object containing dates
            const newsData = data[0];
            if (!newsData) {
                console.log('[NHK Easy] No news data available');
                return { success: true, articles: [] };
            }
            // Process articles from recent dates only
            const sortedDates = Object.keys(newsData).sort().reverse(); // Most recent first
            const recentDates = sortedDates.slice(0, 5); // Last 5 days for better coverage
            for (const dateKey of recentDates) {
                const dateArticles = newsData[dateKey];
                if (!Array.isArray(dateArticles))
                    continue;
                console.log(`[NHK Easy] Processing ${dateArticles.length} articles from ${dateKey}`);
                // Process articles with rate limiting
                for (const article of dateArticles.slice(0, 10)) { // Limit to 10 articles per date
                    try {
                        const newsId = article.news_id;
                        const articleUrl = `https://www3.nhk.or.jp/news/easy/${newsId}/${newsId}.html`;
                        // Fetch the full article content with timeout
                        const articleController = new AbortController();
                        const articleTimeoutId = setTimeout(() => articleController.abort(), 20000); // 20 second timeout
                        const articleResponse = await (0, node_fetch_1.default)(articleUrl, {
                            signal: articleController.signal,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            }
                        });
                        clearTimeout(articleTimeoutId);
                        if (!articleResponse.ok) {
                            console.warn(`[NHK Easy] Failed to fetch article: ${articleUrl}`);
                            continue;
                        }
                        const articleHtml = await articleResponse.text();
                        // Enhanced content extraction with multiple fallback patterns
                        let content = '';
                        // Try pattern 1: article-body class
                        const contentMatch = articleHtml.match(/<div[^>]*class="article-body"[^>]*>([\s\S]*?)<\/div>/);
                        if (contentMatch) {
                            content = contentMatch[1];
                        }
                        // Try pattern 2: js-article-body id
                        if (!content) {
                            const altMatch = articleHtml.match(/<div[^>]*id="js-article-body"[^>]*>([\s\S]*?)<div[^>]*class="article-main__tool"/);
                            if (altMatch) {
                                content = altMatch[1];
                            }
                        }
                        // Try pattern 3: article-main__body class
                        if (!content) {
                            const mainMatch = articleHtml.match(/<div[^>]*class="article-main__body"[^>]*>([\s\S]*?)<\/div>/);
                            if (mainMatch) {
                                content = mainMatch[1];
                            }
                        }
                        // Clean up the content
                        if (content) {
                            content = content.replace(/<script[\s\S]*?<\/script>/g, ''); // Remove scripts
                            content = content.replace(/<style[\s\S]*?<\/style>/g, ''); // Remove styles
                            content = content.replace(/<rt>.*?<\/rt>/g, ''); // Remove furigana readings
                            content = content.replace(/<[^>]*>/g, ' '); // Remove all HTML tags
                            content = content.replace(/\s+/g, ' ').trim(); // Clean whitespace
                        }
                        // Skip if no content found
                        if (!content || content.length < 100) {
                            console.warn(`[NHK Easy] Insufficient content for article ${newsId}`);
                            continue;
                        }
                        // Generate summary (first 200 characters)
                        const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');
                        // Build image URL if available
                        let imageUrl;
                        if (article.has_news_easy_image && article.news_easy_image_uri) {
                            imageUrl = `https://www3.nhk.or.jp/news/easy/${newsId}/${article.news_easy_image_uri}`;
                        }
                        const newsArticle = {
                            id: generateArticleId(articleUrl),
                            title: stripRubyTags(article.title),
                            content,
                            summary,
                            url: articleUrl,
                            imageUrl,
                            publishDate: new Date(article.news_prearranged_time),
                            source: 'NHK Easy',
                            category: 'news',
                            difficulty: 'N5', // NHK Easy is beginner level
                            tags: ['nhk', 'easy', 'news', 'beginner'],
                            metadata: {
                                wordCount: content.length,
                                readingTime: Math.ceil(content.length / 300), // 300 chars per minute for beginners
                                hasFurigana: true // NHK Easy always has furigana
                            }
                        };
                        articles.push(newsArticle);
                        // Rate limiting - be respectful to the server
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    catch (articleError) {
                        console.error(`[NHK Easy] Error processing article ${article.news_id}:`, articleError);
                        continue;
                    }
                }
            }
            console.log(`✅ [NHK Easy] Successfully scraped ${articles.length} articles`);
            // Store articles in Firestore
            if (articles.length > 0) {
                try {
                    const batch = db.batch();
                    for (const article of articles) {
                        const docRef = db.collection('news_articles').doc(article.id);
                        batch.set(docRef, Object.assign(Object.assign({}, article), { publishDate: admin.firestore.Timestamp.fromDate(article.publishDate), createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
                    }
                    await batch.commit();
                    console.log(`✅ [NHK Easy] Stored ${articles.length} articles in Firestore`);
                }
                catch (dbError) {
                    console.error('[NHK Easy] Failed to store in Firestore:', dbError);
                    // Continue - return articles even if storage fails
                }
            }
            return { success: true, articles };
        }
        catch (error) {
            lastError = error;
            console.error(`[NHK Easy] Attempt ${attempt} failed:`, error);
            // If not the last attempt, wait before retrying with exponential backoff
            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`[NHK Easy] Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    // All attempts failed
    return {
        success: false,
        articles: [],
        error: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Failed after all retry attempts'
    };
}
//# sourceMappingURL=nhkEasyScraper.js.map