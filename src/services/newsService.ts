/**
 * News Service - Handles all news article operations
 * Provides pagination, filtering, and statistics for news articles
 */

export type NewsSource = 'all' | 'nhk-easy' | 'watanoc' | 'mainichi-news' | 'mainichi-shogakusei';
export type DifficultyLevel = 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type NewsCategory = 'all' | 'news' | 'culture' | 'science' | 'sports' | 'economy' | 'weather' | 'reading';

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  url: string;
  imageUrl?: string;
  thumbnail?: string;
  publishDate: Date | string;
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

export interface GetArticlesParams {
  source?: NewsSource;
  difficulty?: DifficultyLevel;
  category?: NewsCategory;
  limit?: number;
  offset?: number;
  searchQuery?: string;
}

export interface GetArticlesResult {
  articles: NewsArticle[];
  totalCount: number;
  hasMore: boolean;
}

export interface NewsStats {
  totalArticles: number;
  lastUpdated: Date | null;
  articlesBySource: Record<string, number>;
  articlesByDifficulty: Record<string, number>;
}

class NewsService {
  private baseUrl = '/api/news';

  /**
   * Get paginated articles with filters
   */
  async getArticles(params: GetArticlesParams = {}): Promise<GetArticlesResult> {
    const {
      source = 'all',
      difficulty = 'all',
      category = 'all',
      limit = 12,
      offset = 0,
      searchQuery
    } = params;

    try {
      const queryParams = new URLSearchParams();

      if (source && source !== 'all') queryParams.append('source', source);
      if (difficulty && difficulty !== 'all') queryParams.append('difficulty', difficulty);
      if (category && category !== 'all') queryParams.append('category', category);
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());
      if (searchQuery) queryParams.append('search', searchQuery);

      const response = await fetch(`${this.baseUrl}/articles?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        articles: data.articles || data.data || [],
        totalCount: data.totalCount || data.meta?.total || 0,
        hasMore: data.hasMore !== undefined ? data.hasMore : false
      };
    } catch (error) {
      console.error('[NewsService] Error fetching articles:', error);

      // Return empty result on error
      return {
        articles: [],
        totalCount: 0,
        hasMore: false
      };
    }
  }

  /**
   * Get statistics about news articles
   */
  async getStats(): Promise<NewsStats> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        totalArticles: data.totalArticles || 0,
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null,
        articlesBySource: data.articlesBySource || {},
        articlesByDifficulty: data.articlesByDifficulty || {}
      };
    } catch (error) {
      console.error('[NewsService] Error fetching stats:', error);

      return {
        totalArticles: 0,
        lastUpdated: null,
        articlesBySource: {},
        articlesByDifficulty: {}
      };
    }
  }

  /**
   * Trigger manual scraping for a specific source
   */
  async triggerScraping(source: NewsSource = 'nhk-easy'): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source })
      });

      if (!response.ok) {
        console.error('[NewsService] Scraping failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.error('[NewsService] Error triggering scraping:', error);
      return false;
    }
  }

  /**
   * Mark an article as read (for usage tracking)
   */
  markArticleRead(articleId: string): void {
    try {
      // Store in localStorage for session tracking
      const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
      if (!readArticles.includes(articleId)) {
        readArticles.push(articleId);
        localStorage.setItem('readArticles', JSON.stringify(readArticles));
      }
    } catch (error) {
      console.error('[NewsService] Error marking article as read:', error);
    }
  }
}

// Export singleton instance
export const newsService = new NewsService();
