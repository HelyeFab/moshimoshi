interface FuriganaResponse {
  result: string;
  tokenCount: number;
  success: boolean;
}

interface FuriganaError {
  error: string;
  details?: string;
}

/**
 * Generate furigana for Japanese text using the Kuromoji tokenizer
 * @param text - Japanese text to process
 * @returns Promise with furigana-enhanced HTML string
 */
export async function generateFurigana(text: string): Promise<string> {
  try {
    if (!text || text.trim().length === 0) {
      return text;
    }

    const response = await fetch('/api/furigana', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.trim() }),
    });

    if (!response.ok) {
      const errorData: FuriganaError = await response.json();
      console.error('Furigana API error:', errorData);

      // Fallback to original text if API fails
      return text;
    }

    const data: FuriganaResponse = await response.json();

    if (data.success && data.result) {
      return data.result;
    } else {

      return text;
    }

  } catch (error) {
    console.error('Failed to generate furigana:', error);
    // Fallback to original text on any error
    return text;
  }
}

/**
 * Check if the furigana API is healthy and ready
 * @returns Promise with boolean indicating API health
 */
export async function checkFuriganaApiHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/furigana', {
      method: 'GET',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'healthy';

  } catch (error) {
    console.error('Failed to check furigana API health:', error);
    return false;
  }
}

/**
 * Process multiple paragraphs with furigana
 * @param paragraphs - Array of text paragraphs
 * @returns Promise with array of furigana-enhanced paragraphs
 */
export async function generateFuriganaForParagraphs(paragraphs: string[]): Promise<string[]> {
  const results: string[] = [];

  // Process paragraphs in batches to avoid overwhelming the API
  const batchSize = 5;

  for (let i = 0; i < paragraphs.length; i += batchSize) {
    const batch = paragraphs.slice(i, i + batchSize);

    const batchPromises = batch.map(paragraph => generateFurigana(paragraph));
    const batchResults = await Promise.all(batchPromises);

    results.push(...batchResults);

    // Small delay between batches to be nice to the server
    if (i + batchSize < paragraphs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Enhanced cache for furigana results with persistence and article-level caching
 */
class FuriganaCache {
  private cache = new Map<string, string>();
  private articleCache = new Map<string, Map<string, string>>();
  private maxSize = 100;
  private maxArticles = 10;
  private readonly STORAGE_KEY = 'furigana_cache_v2';

  constructor() {
    this.loadFromStorage();
  }

  get(text: string): string | undefined {
    return this.cache.get(text);
  }

  set(text: string, result: string): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(text, result);
    this.saveToStorage();
  }

  // Article-level caching for better performance
  getArticleCache(articleId: string): Map<string, string> | undefined {
    return this.articleCache.get(articleId);
  }

  setArticleCache(articleId: string, paragraphCache: Map<string, string>): void {
    if (this.articleCache.size >= this.maxArticles) {
      // Remove oldest article
      const firstKey = this.articleCache.keys().next().value;
      if (firstKey !== undefined) {
        this.articleCache.delete(firstKey);
      }
    }
    this.articleCache.set(articleId, paragraphCache);

  }

  getFromArticle(articleId: string, text: string): string | undefined {
    const articleCache = this.articleCache.get(articleId);
    return articleCache?.get(text) || this.cache.get(text);
  }

  setToArticle(articleId: string, text: string, result: string): void {
    // Set in main cache
    this.set(text, result);
    
    // Set in article cache
    let articleCache = this.articleCache.get(articleId);
    if (!articleCache) {
      articleCache = new Map();
      this.setArticleCache(articleId, articleCache);
    }
    articleCache.set(text, result);
  }

  clear(): void {
    this.cache.clear();
    this.articleCache.clear();
    this.clearStorage();
  }

  clearArticle(articleId: string): void {
    this.articleCache.delete(articleId);

  }

  size(): number {
    return this.cache.size;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(data.cache || []);
        // Don't persist article cache due to size - rebuild on demand

      }
    } catch (error) {

    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Only save main cache, not article cache (too large)
      const data = {
        cache: Array.from(this.cache.entries()).slice(-50), // Keep last 50 entries
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {

    }
  }

  private clearStorage(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

const furiganaCache = new FuriganaCache();

/**
 * Generate furigana with caching to improve performance
 * @param text - Japanese text to process
 * @returns Promise with furigana-enhanced HTML string
 */
export async function generateFuriganaWithCache(text: string): Promise<string> {
  const cached = furiganaCache.get(text);
  if (cached !== undefined) {
    return cached;
  }

  const result = await generateFurigana(text);
  furiganaCache.set(text, result);

  return result;
}

/**
 * Generate furigana for an article with article-level caching
 * @param articleId - Unique article identifier for caching
 * @param text - Japanese text to process
 * @returns Promise with furigana-enhanced HTML string
 */
export async function generateFuriganaForArticle(articleId: string, text: string): Promise<string> {
  const cached = furiganaCache.getFromArticle(articleId, text);
  if (cached !== undefined) {

    return cached;
  }

  const result = await generateFurigana(text);
  furiganaCache.setToArticle(articleId, text, result);

  return result;
}

/**
 * Pre-process an entire article's content with furigana and cache it
 * @param articleId - Unique article identifier
 * @param paragraphs - Array of text paragraphs from the article
 * @returns Promise with array of furigana-enhanced paragraphs
 */
export async function generateFuriganaForArticleParagraphs(articleId: string, paragraphs: string[]): Promise<string[]> {
  const results: string[] = [];
  const uncachedParagraphs: { index: number; text: string }[] = [];

  // Check what's already cached
  for (let i = 0; i < paragraphs.length; i++) {
    const cached = furiganaCache.getFromArticle(articleId, paragraphs[i]);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      uncachedParagraphs.push({ index: i, text: paragraphs[i] });
    }
  }

  if (uncachedParagraphs.length === 0) {

    return results;
  }

  // Process uncached paragraphs in batches
  const batchSize = 3; // Smaller batches for articles to prevent freezing
  for (let i = 0; i < uncachedParagraphs.length; i += batchSize) {
    const batch = uncachedParagraphs.slice(i, i + batchSize);
    
    const batchPromises = batch.map(({ text }) => generateFurigana(text));
    const batchResults = await Promise.all(batchPromises);

    // Store results and cache them
    batch.forEach(({ index, text }, batchIndex) => {
      const result = batchResults[batchIndex];
      results[index] = result;
      furiganaCache.setToArticle(articleId, text, result);
    });

    // Longer delay between batches for articles
    if (i + batchSize < uncachedParagraphs.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Clear the furigana cache
 */
export function clearFuriganaCache(): void {
  furiganaCache.clear();
}

/**
 * Clear furigana cache for a specific article
 */
export function clearArticleFuriganaCache(articleId: string): void {
  furiganaCache.clearArticle(articleId);
}

/**
 * Get furigana cache statistics
 */
export function getFuriganaCacheStats(): { size: number; maxSize: number; articles: number } {
  return {
    size: furiganaCache.size(),
    maxSize: 100,
    articles: furiganaCache['articleCache'].size // Access private member for stats
  };
}