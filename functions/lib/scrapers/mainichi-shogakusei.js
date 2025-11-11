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
exports.scrapeMainichiShogakusei = scrapeMainichiShogakusei;
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
async function scrapeMainichiShogakusei() {
    const articles = [];
    try {
        console.log('🌐 Fetching Mainichi Shogakusei articles...');
        // Mainichi Shogakusei is the elementary school student news section
        const response = await fetch('https://mainichi.jp/maisho/');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        // Find article links - Mainichi Shogakusei has its own structure
        const articleLinks = [];
        // Look for article links in the maisho section
        $('a[href*="/maisho/articles/"], a[href*="/articles/"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href && !articleLinks.includes(href)) {
                articleLinks.push(href);
            }
        });
        // Also check for different patterns
        if (articleLinks.length === 0) {
            $('.article-list a, .news-list a, [class*="article"] a').each((_, element) => {
                const href = $(element).attr('href');
                if (href && !articleLinks.includes(href)) {
                    articleLinks.push(href);
                }
            });
        }
        console.log(`📰 Found ${articleLinks.length} article links on Mainichi Shogakusei`);
        // Process each article (limit to first 10)
        for (const link of articleLinks.slice(0, 10)) {
            try {
                const articleUrl = link.startsWith('http') ? link : `https://mainichi.jp${link}`;
                console.log(`📄 Fetching article: ${articleUrl}`);
                const articleResponse = await fetch(articleUrl);
                if (!articleResponse.ok) {
                    console.warn(`⚠️ Failed to fetch article: ${articleUrl}`);
                    continue;
                }
                const articleHtml = await articleResponse.text();
                const article$ = cheerio.load(articleHtml);
                // Extract title
                const title = cleanText(article$('h1').first().text() ||
                    article$('.article-title').text() ||
                    article$('.title').text() ||
                    article$('[class*="headline"]').first().text());
                if (!title) {
                    console.warn(`⚠️ No title found for article: ${articleUrl}`);
                    continue;
                }
                // Extract content with furigana support
                let content = '';
                const contentSelectors = [
                    '.article-body',
                    '.article-content',
                    '.main-content',
                    '.story-body',
                    '[class*="content"]',
                    'article',
                    'main'
                ];
                for (const selector of contentSelectors) {
                    const element = article$(selector).first();
                    if (element.length) {
                        // Remove script and style tags
                        element.find('script').remove();
                        element.find('style').remove();
                        // Remove ads and related sections
                        element.find('.ad, .related, .recommendation, .ranking').remove();
                        // Keep ruby base text but remove rt (furigana)
                        element.find('rt').remove();
                        content = cleanText(element.text());
                        if (content.length > 100)
                            break; // Found substantial content
                    }
                }
                // Extract date
                let publishDate = new Date();
                const dateSelectors = ['.date', '.publish-date', 'time', '[class*="date"]'];
                for (const selector of dateSelectors) {
                    const dateEl = article$(selector).first();
                    const dateText = dateEl.text() || dateEl.attr('datetime');
                    if (dateText) {
                        // Try to parse Japanese date format (e.g., 2024年1月15日)
                        let parsedDate = new Date(dateText);
                        if (isNaN(parsedDate.getTime())) {
                            // Try extracting numbers from Japanese date
                            const match = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                            if (match) {
                                parsedDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                            }
                        }
                        if (!isNaN(parsedDate.getTime())) {
                            publishDate = parsedDate;
                            break;
                        }
                    }
                }
                // Extract image
                const imageUrl = article$('.article-image img, .main-image img, article img').first().attr('src');
                // Generate summary
                const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');
                const newsArticle = {
                    id: generateArticleId(articleUrl),
                    title,
                    content: content || title,
                    summary,
                    url: articleUrl,
                    imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://mainichi.jp${imageUrl}`) : undefined,
                    publishDate,
                    source: 'Mainichi Shogakusei',
                    category: 'news',
                    difficulty: 'N5', // Elementary school level, easiest
                    tags: ['mainichi', 'shogakusei', 'easy', 'kids'],
                    metadata: {
                        wordCount: content.length,
                        readingTime: Math.ceil(content.length / 250), // Slower reading for beginners
                        hasFurigana: true // Shogakusei news typically has furigana
                    }
                };
                articles.push(newsArticle);
                // Be respectful to the server
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (articleError) {
                console.error(`❌ Error processing article ${link}:`, articleError);
                continue;
            }
        }
        console.log(`✅ Successfully scraped ${articles.length} articles from Mainichi Shogakusei`);
    }
    catch (error) {
        console.error('❌ Error scraping Mainichi Shogakusei:', error);
        throw error;
    }
    return articles;
}
//# sourceMappingURL=mainichi-shogakusei.js.map