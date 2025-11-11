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
exports.scrapeMainichiNews = scrapeMainichiNews;
const cheerio = __importStar(require("cheerio"));
const crypto_1 = __importDefault(require("crypto"));
// Helper to generate consistent IDs
function generateArticleId(url) {
    return crypto_1.default.createHash('md5').update(url).digest('hex');
}
// Helper to clean text
function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}
async function scrapeMainichiNews() {
    const articles = [];
    try {
        console.log('🌐 Fetching Mainichi homepage...');
        const response = await fetch('https://mainichi.jp/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ja,en;q=0.9',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const html = await response.text();
        console.log(`✅ Fetched ${html.length} characters from Mainichi`);
        // Parse HTML with cheerio
        const $ = cheerio.load(html);
        // Find article links - Mainichi uses various selectors
        const articleLinks = [];
        // Common article selectors for Mainichi
        const selectors = [
            'article a[href*="/articles/"]',
            '.articlelist a[href*="/articles/"]',
            '.top-news a[href*="/articles/"]',
            '.news-list a[href*="/articles/"]',
            'h2 a[href*="/articles/"]',
            'h3 a[href*="/articles/"]',
            'a.c-article-card__link',
            'a.p-article-card__link'
        ];
        const seenUrls = new Set();
        selectors.forEach(selector => {
            $(selector).each((i, elem) => {
                if (articleLinks.length >= 10)
                    return false; // Stop after 10 articles
                const href = $(elem).attr('href');
                const text = $(elem).text().trim();
                // Skip if it's a paid article (有料記事)
                if (text.includes('有料記事') || (href === null || href === void 0 ? void 0 : href.includes('premier'))) {
                    console.log(`⏭️ Skipping paid article: ${text}`);
                    return;
                }
                if (href && !seenUrls.has(href)) {
                    seenUrls.add(href);
                    const fullUrl = href.startsWith('http') ? href : `https://mainichi.jp${href}`;
                    articleLinks.push({
                        url: fullUrl,
                        title: text || 'No title'
                    });
                }
            });
        });
        console.log(`📰 Found ${articleLinks.length} article links on Mainichi`);
        // Fetch each article content
        for (let i = 0; i < Math.min(articleLinks.length, 5); i++) {
            const link = articleLinks[i];
            try {
                console.log(`📄 Fetching article ${i + 1}: ${link.title}`);
                const articleResponse = await fetch(link.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml',
                        'Accept-Language': 'ja,en;q=0.9',
                    }
                });
                if (!articleResponse.ok) {
                    console.warn(`Failed to fetch article: HTTP ${articleResponse.status}`);
                    continue;
                }
                const articleHtml = await articleResponse.text();
                const article$ = cheerio.load(articleHtml);
                // Extract title - try multiple selectors
                let title = '';
                const titleSelectors = [
                    'h1.title',
                    'h1.article-title',
                    'h1.entry-title',
                    'h1',
                    '.article-header h1',
                    'meta[property="og:title"]'
                ];
                for (const selector of titleSelectors) {
                    if (selector.includes('meta')) {
                        title = article$(selector).attr('content') || '';
                    }
                    else {
                        title = article$(selector).first().text().trim();
                    }
                    if (title)
                        break;
                }
                if (!title) {
                    title = link.title;
                }
                // Extract content - try multiple selectors
                let content = '';
                const contentSelectors = [
                    '.article-body',
                    '.entry-content',
                    '.main-text',
                    '.article-content',
                    '.story-body',
                    '[class*="body"]',
                    'article'
                ];
                for (const selector of contentSelectors) {
                    const element = article$(selector).first();
                    if (element.length > 0) {
                        // Remove unwanted elements
                        element.find('script, style, nav, aside, .ad, .advertisement, .related').remove();
                        content = element.text().trim();
                        if (content.length > 100) {
                            console.log(`✅ Extracted content using selector: ${selector} (${content.length} chars)`);
                            break;
                        }
                    }
                }
                // Extract image
                let imageUrl = '';
                const imageSelectors = [
                    'meta[property="og:image"]',
                    '.article-image img',
                    '.main-image img',
                    'article img',
                    'figure img'
                ];
                for (const selector of imageSelectors) {
                    if (selector.includes('meta')) {
                        imageUrl = article$(selector).attr('content') || '';
                    }
                    else {
                        imageUrl = article$(selector).first().attr('src') || '';
                    }
                    if (imageUrl) {
                        if (!imageUrl.startsWith('http')) {
                            imageUrl = `https://mainichi.jp${imageUrl}`;
                        }
                        break;
                    }
                }
                // Extract date
                let publishDate = new Date();
                const dateSelectors = [
                    'time[datetime]',
                    'meta[property="article:published_time"]',
                    '.date',
                    '.publish-date',
                    '[class*="date"]'
                ];
                for (const selector of dateSelectors) {
                    let dateText = '';
                    if (selector.includes('meta')) {
                        dateText = article$(selector).attr('content') || '';
                    }
                    else if (selector.includes('time')) {
                        dateText = article$(selector).attr('datetime') || article$(selector).text();
                    }
                    else {
                        dateText = article$(selector).first().text();
                    }
                    if (dateText) {
                        const parsed = new Date(dateText);
                        if (!isNaN(parsed.getTime())) {
                            publishDate = parsed;
                            break;
                        }
                    }
                }
                // Clean content
                if (content) {
                    content = content
                        .replace(/\s+/g, ' ')
                        .replace(/https?:\/\/[^\s]+/gi, '')
                        .replace(/www\.[^\s]+/gi, '')
                        .trim();
                }
                // Ensure we have meaningful content
                if (!content || content.length < 50) {
                    console.log(`⚠️ Insufficient content, skipping article`);
                    continue;
                }
                // Generate summary
                const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');
                const newsArticle = {
                    id: generateArticleId(link.url),
                    title: cleanText(title),
                    content,
                    summary,
                    url: link.url,
                    imageUrl,
                    publishDate,
                    source: 'Mainichi News',
                    category: 'news',
                    difficulty: 'N2', // Mainichi News is typically intermediate-advanced
                    tags: ['mainichi', 'news', 'current-events'],
                    metadata: {
                        wordCount: content.length,
                        readingTime: Math.ceil(content.length / 300),
                        hasFurigana: false
                    }
                };
                articles.push(newsArticle);
                console.log(`✅ Successfully extracted article ${i + 1}: ${title}`);
                // Be respectful to the server
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
                console.error(`❌ Error processing article ${link.url}:`, error);
                continue;
            }
        }
        console.log(`✅ Successfully scraped ${articles.length} articles from Mainichi News`);
    }
    catch (error) {
        console.error('❌ Error scraping Mainichi News:', error);
        throw error;
    }
    return articles;
}
//# sourceMappingURL=mainichi-news.js.map