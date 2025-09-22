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

// Helper to strip ruby tags but keep the text
function stripRubyTags(html: string): string {
  // Remove <rt> tags and their content
  let text = html.replace(/<rt>.*?<\/rt>/g, '');
  // Remove remaining <ruby> tags but keep content
  text = text.replace(/<\/?ruby>/g, '');
  return text;
}

export async function scrapeNHKEasy(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    console.log('🌐 Fetching NHK Easy News from API...');

    // Fetch the JSON API
    const response = await fetch('https://www3.nhk.or.jp/news/easy/news-list.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // The API returns an array with one object containing dates
    const newsData = data[0];

    if (!newsData) {
      console.log('📰 No news data available');
      return articles;
    }

    // Process articles from recent dates only
    const sortedDates = Object.keys(newsData).sort().reverse(); // Most recent first
    const recentDates = sortedDates.slice(0, 3); // Only last 3 days

    for (const dateKey of recentDates) {
      const dateArticles = newsData[dateKey];

      if (!Array.isArray(dateArticles)) continue;

      console.log(`📅 Processing ${dateArticles.length} articles from ${dateKey}`);

      for (const article of dateArticles.slice(0, 5)) { // Limit to 5 articles per date
        try {
          const newsId = article.news_id;
          const articleUrl = `https://www3.nhk.or.jp/news/easy/${newsId}/${newsId}.html`;

          // Fetch the full article content
          console.log(`📄 Fetching article: ${stripRubyTags(article.title).substring(0, 50)}...`);
          const articleResponse = await fetch(articleUrl);

          if (!articleResponse.ok) {
            console.warn(`⚠️ Failed to fetch article: ${articleUrl}`);
            continue;
          }

          const articleHtml = await articleResponse.text();

          // Extract content from the HTML
          // NHK Easy articles have content in <div class="article-body">
          const contentMatch = articleHtml.match(/<div[^>]*class="article-body"[^>]*>([\s\S]*?)<\/div>/);
          let content = '';

          if (contentMatch) {
            content = contentMatch[1];
            // Clean up the content
            content = content.replace(/<script[\s\S]*?<\/script>/g, ''); // Remove scripts
            content = content.replace(/<style[\s\S]*?<\/style>/g, ''); // Remove styles
            content = content.replace(/<rt>.*?<\/rt>/g, ''); // Remove furigana readings
            content = content.replace(/<[^>]*>/g, ' '); // Remove all HTML tags
            content = content.replace(/\s+/g, ' ').trim(); // Clean whitespace
          }

          // If no content found in article-body, try the news-article-body
          if (!content) {
            const altMatch = articleHtml.match(/<div[^>]*id="js-article-body"[^>]*>([\s\S]*?)<div[^>]*class="article-main__tool"/);
            if (altMatch) {
              content = altMatch[1];
              content = content.replace(/<rt>.*?<\/rt>/g, '');
              content = content.replace(/<[^>]*>/g, ' ');
              content = content.replace(/\s+/g, ' ').trim();
            }
          }

          // Generate summary (first 200 characters)
          const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');

          // Build image URL if available
          let imageUrl;
          if (article.has_news_easy_image && article.news_easy_image_uri) {
            imageUrl = `https://www3.nhk.or.jp/news/easy/${newsId}/${article.news_easy_image_uri}`;
          }

          const newsArticle: NewsArticle = {
            id: generateArticleId(articleUrl),
            title: stripRubyTags(article.title),
            content: content || article.title, // Fallback to title if no content
            summary,
            url: articleUrl,
            imageUrl,
            publishDate: new Date(article.news_prearranged_time),
            source: 'NHK Easy',
            category: 'news',
            difficulty: 'N5', // NHK Easy is beginner level
            tags: ['nhk', 'easy', 'news'],
            metadata: {
              wordCount: content.length,
              readingTime: Math.ceil(content.length / 300), // 300 chars per minute
              hasFurigana: true // NHK Easy always has furigana
            }
          };

          articles.push(newsArticle);

          // Small delay to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (articleError) {
          console.error(`❌ Error processing article ${article.news_id}:`, articleError);
          continue;
        }
      }
    }

    console.log(`✅ Successfully scraped ${articles.length} articles from NHK Easy`);

  } catch (error) {
    console.error('❌ Error scraping NHK Easy:', error);
    throw error;
  }

  return articles;
}