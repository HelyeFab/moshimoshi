import * as cheerio from 'cheerio';
import crypto from 'crypto';

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

// Helper to extract JLPT level from title or content
function extractDifficulty(text: string): string {
  if (text.includes('N5') || text.includes('初級')) return 'N5';
  if (text.includes('N4')) return 'N4';
  if (text.includes('N3') || text.includes('中級')) return 'N3';
  if (text.includes('N2')) return 'N2';
  if (text.includes('N1') || text.includes('上級')) return 'N1';
  return 'N3'; // Default to intermediate
}

export async function scrapeTodaii(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    console.log('🌐 Fetching Todaii articles...');

    // Fetch the main page
    const response = await fetch('https://www.todaii.net/');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find article links
    const articleLinks: string[] = [];
    $('a[href^="/article/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !articleLinks.includes(href)) {
        articleLinks.push(href);
      }
    });

    console.log(`📰 Found ${articleLinks.length} article links on Todaii`);

    // Process each article (limit to first 10)
    for (const link of articleLinks.slice(0, 10)) {
      try {
        const articleUrl = `https://www.todaii.net${link}`;
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
          article$('[class*="title"]').first().text()
        );

        if (!title) {
          console.warn(`⚠️ No title found for article: ${articleUrl}`);
          continue;
        }

        // Extract content
        let content = '';
        const contentSelectors = [
          '.article-content',
          '.article-body',
          '.content',
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
            // Remove ruby annotations but keep base text
            element.find('rt').remove();
            content = cleanText(element.text());
            if (content.length > 100) break; // Found substantial content
          }
        }

        // Extract date
        let publishDate = new Date();
        const dateText = article$('.date, .publish-date, [class*="date"]').first().text();
        if (dateText) {
          const parsedDate = new Date(dateText);
          if (!isNaN(parsedDate.getTime())) {
            publishDate = parsedDate;
          }
        }

        // Extract image
        const imageUrl = article$('img').first().attr('src');

        // Generate summary
        const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');

        // Extract difficulty
        const difficulty = extractDifficulty(title + ' ' + content);

        const newsArticle: NewsArticle = {
          id: generateArticleId(articleUrl),
          title,
          content: content || title,
          summary,
          url: articleUrl,
          imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://www.todaii.net${imageUrl}`) : undefined,
          publishDate,
          source: 'Todaii',
          category: 'reading',
          difficulty,
          tags: ['todaii', 'reading', 'practice'],
          metadata: {
            wordCount: content.length,
            readingTime: Math.ceil(content.length / 300),
            hasFurigana: true // Todaii typically has furigana
          }
        };

        articles.push(newsArticle);

        // Be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (articleError) {
        console.error(`❌ Error processing article ${link}:`, articleError);
        continue;
      }
    }

    console.log(`✅ Successfully scraped ${articles.length} articles from Todaii`);

  } catch (error) {
    console.error('❌ Error scraping Todaii:', error);
    throw error;
  }

  return articles;
}