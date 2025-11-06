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

export async function scrapeWatanoc(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    console.log('🌐 Fetching Watanoc homepage...');

    const response = await fetch('https://watanoc.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`✅ Fetched ${html.length} characters from Watanoc`);

    // Extract article URLs and metadata using regex (as in the working version)
    const articleRegex = /<article[^>]*class="[^"]*loop-article[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let match;
    let count = 0;
    const articleData: Array<{url: string, title: string, rawTitle: string}> = [];

    while ((match = articleRegex.exec(html)) && count < 5) {
      const articleHtml = match[1];

      const urlMatch = articleHtml.match(/href="(https:\/\/watanoc\.com\/[^"]+)"/);
      const titleMatch = articleHtml.match(/title="([^"]+)"/);

      if (urlMatch && titleMatch) {
        articleData.push({
          url: urlMatch[1],
          title: titleMatch[1].replace(/\s*\(n[1-5]\).*$/i, ''),
          rawTitle: titleMatch[1]
        });
        count++;
      }
    }

    console.log(`📰 Found ${articleData.length} article links on Watanoc`);

    // Now fetch actual content for each article
    for (let i = 0; i < articleData.length; i++) {
      const data = articleData[i];

      try {
        console.log(`📄 Fetching article content: ${data.title}`);

        const articleResponse = await fetch(data.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });

        if (!articleResponse.ok) {
          console.warn(`Failed to fetch article ${i + 1}: HTTP ${articleResponse.status}`);
          continue;
        }

        const articleHtml = await articleResponse.text();

        // Extract content and image from the article page
        let content = '';
        let imageUrl = '';

        // Extract article image first
        const imageSelectors = [
          /<img[^>]*class="[^"]*(?:featured|thumbnail|article|post)[^"]*"[^>]*src="([^"]+)"/i,
          /<img[^>]*src="([^"]+)"[^>]*class="[^"]*(?:featured|thumbnail|article|post)[^"]*"/i,
          /<div[^>]*class="[^"]*(?:featured|thumbnail|post)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
          /<img[^>]*src="([^"]+)"[^>]*(?:width|height)="[^"]*"/i
        ];

        for (const selector of imageSelectors) {
          const imageMatch = articleHtml.match(selector);
          if (imageMatch && imageMatch[1]) {
            imageUrl = imageMatch[1].startsWith('http') ? imageMatch[1] : `https://watanoc.com${imageMatch[1]}`;
            console.log(`✅ Article image found: ${imageUrl}`);
            break;
          }
        }

        // Use cheerio for better content extraction
        const $ = cheerio.load(articleHtml);

        // Extract the actual article content from entry-content
        const entryContent = $('.entry-content').first();

        if (entryContent.length > 0) {
          // Remove any nested divs that might contain ads or other non-content
          entryContent.find('div.sharedaddy, div.jp-relatedposts, div.ads').remove();

          // Get the text content
          content = entryContent.text().trim();
          console.log(`✅ Extracted article content from .entry-content (${content.length} chars)`);
        } else {
          // Fallback: try other selectors
          const contentSelectors = ['.post-content', '.article-content', '.the-content', 'article > p'];

          for (const selector of contentSelectors) {
            const element = $(selector).first();
            if (element.length > 0) {
              content = element.text().trim();
              if (content.length > 50) {
                console.log(`✅ Extracted content using fallback selector: ${selector}`);
                break;
              }
            }
          }
        }

        // Clean content
        if (content) {
          // Remove URLs and English text
          content = content
            .replace(/https?:\/\/[^\s]+/gi, '') // Remove URLs
            .replace(/www\.[^\s]+/gi, '') // Remove www URLs
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '') // Remove email addresses
            .replace(/\s+/g, ' ') // Clean up extra spaces
            .trim();
        }

        // Extract JLPT level
        const levelMatch = data.rawTitle.match(/\(n([1-5])\)/i);
        const difficulty = levelMatch ? `N${levelMatch[1].toUpperCase()}` : 'N4';

        // Ensure we have meaningful content
        if (!content || content.length < 50) {
          console.log(`⚠️ Insufficient content extracted, creating fallback content`);
          content = `この記事について：${data.title}\n\nこの記事はWatanocから取得された日本語学習記事です。${difficulty}レベルの内容となっています。\n\n詳しい内容については元の記事をご覧ください。`;
        }

        // Generate summary
        const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');

        const newsArticle: NewsArticle = {
          id: generateArticleId(data.url),
          title: data.title,
          content: content,
          summary,
          url: data.url,
          imageUrl,
          publishDate: new Date(),
          source: 'Watanoc',
          category: 'reading',
          difficulty,
          tags: ['watanoc', 'japanese-learning', difficulty.toLowerCase()],
          metadata: {
            wordCount: content.length,
            readingTime: Math.ceil(content.length / 300),
            hasFurigana: false
          }
        };

        articles.push(newsArticle);
        console.log(`✅ Extracted article ${i + 1}: ${data.title} (${content.length} chars)`);

        // Be respectful - wait between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error processing article ${data.url}:`, error);
        continue;
      }
    }

    console.log(`✅ Successfully scraped ${articles.length} articles from Watanoc`);

  } catch (error) {
    console.error('❌ Error scraping Watanoc:', error);
    throw error;
  }

  return articles;
}