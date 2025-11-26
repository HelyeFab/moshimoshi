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

export async function scrapeMainichiShogakusei(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

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
    const articleLinks: string[] = [];

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
        // Handle protocol-relative URLs (//mainichi.jp/...)
        let articleUrl = link;
        if (link.startsWith('//')) {
          articleUrl = `https:${link}`;
        } else if (!link.startsWith('http')) {
          articleUrl = `https://mainichi.jp${link}`;
        }
        console.log(`📄 Fetching article: ${articleUrl}`);

        const articleResponse = await fetch(articleUrl);
        if (!articleResponse.ok) {
          console.warn(`⚠️ Failed to fetch article: ${articleUrl}`);
          continue;
        }

        const articleHtml = await articleResponse.text();
        const article$ = cheerio.load(articleHtml);

        // Extract title
        const title = cleanText(
          article$('h1').first().text() ||
          article$('.article-title').text() ||
          article$('.title').text() ||
          article$('[class*="headline"]').first().text()
        );

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
            // Remove photo captions
            content = removePhotoCaptions(content);
            if (content.length > 100) break; // Found substantial content
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

        const newsArticle: NewsArticle = {
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

        // Generate TTS audio for title, summary, and content
        console.log(`🔊 Generating TTS audio for: ${title.substring(0, 50)}`);

        try {
          const audioResult = await generateBatchAudio({
            id: newsArticle.id,
            title: newsArticle.title,  // Plain text title
            summary: newsArticle.summary,
            content: newsArticle.content, // Full content
            source: 'mainichi-shogakusei'
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
            console.log(`✅ TTS audio generated successfully`);
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

        // Be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (articleError) {
        console.error(`❌ Error processing article ${link}:`, articleError);
        continue;
      }
    }

    console.log(`✅ Successfully scraped ${articles.length} articles from Mainichi Shogakusei`);

  } catch (error) {
    console.error('❌ Error scraping Mainichi Shogakusei:', error);
    throw error;
  }

  return articles;
}