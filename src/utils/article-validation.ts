/**
 * Article validation utilities for news scraping
 * Provides quick validation for Japanese articles
 */

interface ValidationResult {
  passed: boolean;
  reason?: string;
  shouldSave: boolean;
  japaneseRatio: number;
  visible: boolean;
  quality?: number;
}

interface ArticleData {
  title: string;
  content: string;
  url: string;
  source: string;
  publishDate?: Date;
}

/**
 * Quick validation for article content
 */
export function quickValidate(article: ArticleData): ValidationResult {
  const { content, title } = article;

  // Check if content exists
  if (!content || content.trim().length < 50) {
    return {
      passed: false,
      reason: 'Content too short or missing',
      shouldSave: false,
      japaneseRatio: 0,
      visible: false
    };
  }

  // Calculate precise Japanese ratio
  const japanesePatterns = {
    hiragana: /[\u3040-\u309F]/g,
    katakana: /[\u30A0-\u30FF]/g,
    kanji: /[\u4E00-\u9FAF]/g,
    japanesePunct: /[。、「」『』・]/g
  };

  const hiraganaMatches = (content.match(japanesePatterns.hiragana) || []).length;
  const katakanaMatches = (content.match(japanesePatterns.katakana) || []).length;
  const kanjiMatches = (content.match(japanesePatterns.kanji) || []).length;
  const punctMatches = (content.match(japanesePatterns.japanesePunct) || []).length;

  const totalJapanese = hiraganaMatches + katakanaMatches + kanjiMatches + punctMatches;
  const totalChars = content.replace(/\s/g, '').length;
  const japaneseRatio = totalChars > 0 ? (totalJapanese / totalChars) : 0;

  // Check for common scraping errors
  const errorPatterns = [
    /page not found/i,
    /404 error/i,
    /access denied/i,
    /please enable javascript/i,
    /please enable cookies/i,
    /cloudflare/i,
    /robot check/i,
    /captcha/i
  ];

  for (const pattern of errorPatterns) {
    if (pattern.test(content) || pattern.test(title)) {
      return {
        passed: false,
        reason: `Detected error pattern: ${pattern}`,
        shouldSave: false,
        japaneseRatio,
        visible: false
      };
    }
  }

  // Check for minimum Japanese content (30%)
  if (japaneseRatio < 0.3) {
    return {
      passed: false,
      reason: `Insufficient Japanese content: ${(japaneseRatio * 100).toFixed(1)}%`,
      shouldSave: false,
      japaneseRatio,
      visible: false
    };
  }

  // Check for minimum hiragana
  if (hiraganaMatches < 10) {
    return {
      passed: false,
      reason: 'Insufficient hiragana characters',
      shouldSave: false,
      japaneseRatio,
      visible: false
    };
  }

  // Quality score based on multiple factors
  const quality = Math.min(100, Math.round(
    (japaneseRatio * 50) + // Japanese ratio contributes 50%
    (Math.min(content.length / 40, 30)) + // Length contributes up to 30%
    (hiraganaMatches > 50 ? 20 : hiraganaMatches / 2.5) // Hiragana count contributes 20%
  ));

  return {
    passed: true,
    shouldSave: true,
    japaneseRatio,
    visible: japaneseRatio > 0.5 && content.length > 200,
    quality
  };
}

/**
 * Filter and validate multiple articles
 */
export function filterArticles(articles: ArticleData[]): {
  valid: ArticleData[];
  rejected: Array<{ article: ArticleData; reason: string }>;
} {
  const valid: ArticleData[] = [];
  const rejected: Array<{ article: ArticleData; reason: string }> = [];

  for (const article of articles) {
    const validation = quickValidate(article);

    if (validation.passed) {
      valid.push(article);
    } else {
      rejected.push({
        article,
        reason: validation.reason || 'Failed validation'
      });
    }
  }

  return { valid, rejected };
}

/**
 * Check for duplicate articles based on content similarity
 */
export function checkDuplicates(articles: any[]): any[] {
  const seen = new Map<string, any>();
  const unique: any[] = [];

  for (const article of articles) {
    // Create a fingerprint based on title and URL
    const fingerprint = `${article.title?.toLowerCase().trim()}::${article.url}`;

    if (!seen.has(fingerprint)) {
      seen.set(fingerprint, article);
      unique.push(article);
    }
  }

  return unique;
}