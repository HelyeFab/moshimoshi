import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { removePhotoCaptions } from '../utils/scraper-utils';
import { generateBatchAudio } from '../utils/newsAudioGenerator';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  url: string;
  imageUrl?: string;
  publishDate: Date;
  source: string;
  category: string;
  difficulty: string;
  tags?: string[];

  // TTS-generated audio fields
  generatedTitleAudioUrl?: string;
  generatedSummaryAudioUrl?: string;
  generatedContentAudioUrl?: string;
  audioGeneratedAt?: Date;
  audioProvider?: 'edge-tts' | 'kokoro';
  audioVoice?: string;
  audioStatus?: 'pending' | 'generated' | 'failed' | 'partial';
  audioError?: string;

  metadata?: {
    wordCount?: number;
    readingTime?: number;
    hasFurigana?: boolean;
  };
}

// Helper to generate consistent IDs
function generateArticleId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Helper to clean text
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export async function scrapeMainichiNews(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

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
    const articleLinks: { url: string; title: string }[] = [];

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
        if (articleLinks.length >= 10) return false; // Stop after 10 articles

        const href = $(elem).attr('href');
        const text = $(elem).text().trim();

        // Skip if it's a paid article (有料記事)
        if (text.includes('有料記事') || href?.includes('premier')) {
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
          } else {
            title = article$(selector).first().text().trim();
          }
          if (title) break;
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
          } else {
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
          } else if (selector.includes('time')) {
            dateText = article$(selector).attr('datetime') || article$(selector).text();
          } else {
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
          // First remove photo captions
          content = removePhotoCaptions(content);

          // Then clean URLs and whitespace
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

        const newsArticle: NewsArticle = {
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

        // Generate TTS audio for title, summary, and content
        console.log(`🔊 Generating TTS audio for: ${title.substring(0, 50)}`);

        try {
          const audioResult = await generateBatchAudio({
            id: newsArticle.id,
            title: newsArticle.title,  // Plain text title
            summary: newsArticle.summary,
            content: newsArticle.content, // Full content
            source: 'mainichi-news'
          });

          // Update article with audio metadata
          if (audioResult.titleAudio) {
            newsArticle.generatedTitleAudioUrl = audioResult.titleAudio.url;
            newsArticle.audioProvider = audioResult.titleAudio.provider;
            newsArticle.audioVoice = audioResult.titleAudio.voice;
            newsArticle.audioGeneratedAt = audioResult.titleAudio.generatedAt;
          }

          if (audioResult.summaryAudio) {
            newsArticle.generatedSummaryAudioUrl = audioResult.summaryAudio.url;
          }

          if (audioResult.contentAudio) {
            newsArticle.generatedContentAudioUrl = audioResult.contentAudio.url;
          }

          // Set audio status
          if (audioResult.errors.length === 0) {
            newsArticle.audioStatus = 'generated';
            console.log(`✅ TTS audio generated successfully for article ${i + 1}`);
          } else if (audioResult.titleAudio || audioResult.summaryAudio || audioResult.contentAudio) {
            newsArticle.audioStatus = 'partial';
            newsArticle.audioError = audioResult.errors.join('; ');
            console.warn(`⚠️ TTS audio partially generated: ${audioResult.errors.join('; ')}`);
          } else {
            newsArticle.audioStatus = 'failed';
            newsArticle.audioError = audioResult.errors.join('; ');
            console.error(`❌ TTS audio generation failed: ${audioResult.errors.join('; ')}`);
          }
        } catch (audioError) {
          newsArticle.audioStatus = 'failed';
          newsArticle.audioError = audioError instanceof Error ? audioError.message : 'Unknown error';
          console.error(`❌ TTS audio generation exception:`, audioError);
        }

        articles.push(newsArticle);
        console.log(`✅ Successfully extracted article ${i + 1}: ${title}`);

        // Be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error processing article ${link.url}:`, error);
        continue;
      }
    }

    console.log(`✅ Successfully scraped ${articles.length} articles from Mainichi News`);

  } catch (error) {
    console.error('❌ Error scraping Mainichi News:', error);
    throw error;
  }

  return articles;
}