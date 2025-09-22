/**
 * Quick validation utilities for article content
 * Designed to be fast (<100ms) for use during scraping
 */

/**
 * Check if text contains enough Japanese characters to be considered a Japanese article
 * @param {string} text - The text to check
 * @returns {boolean} - True if text appears to be Japanese
 */
function isLikelyJapanese(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Quick length check - too short to determine
  if (text.length < 50) {
    return false;
  }

  // Regex patterns for different character sets
  const japanesePatterns = {
    hiragana: /[\u3040-\u309F]/g,
    katakana: /[\u30A0-\u30FF]/g,
    kanji: /[\u4E00-\u9FAF]/g,
    // Common Japanese punctuation
    japanesePunctuation: /[。、！？「」『』（）]/g
  };

  // Count Japanese characters
  const hiraganaCount = (text.match(japanesePatterns.hiragana) || []).length;
  const katakanaCount = (text.match(japanesePatterns.katakana) || []).length;
  const kanjiCount = (text.match(japanesePatterns.kanji) || []).length;
  const japanesePunctuationCount = (text.match(japanesePatterns.japanesePunctuation) || []).length;
  
  const totalJapaneseChars = hiraganaCount + katakanaCount + kanjiCount + japanesePunctuationCount;
  
  // Remove all whitespace for accurate character counting
  const textNoSpaces = text.replace(/\s/g, '');
  const totalChars = textNoSpaces.length;
  
  // Calculate Japanese character ratio
  const japaneseRatio = totalJapaneseChars / totalChars;
  
  // Log for debugging (can be removed in production)
  console.log(`[Quick Validation] Japanese ratio: ${(japaneseRatio * 100).toFixed(1)}% (${totalJapaneseChars}/${totalChars} chars)`);
  
  // Article is considered Japanese if:
  // 1. Has at least 30% Japanese characters
  // 2. Has at least some hiragana (every Japanese text has hiragana)
  return japaneseRatio > 0.3 && hiraganaCount > 0;
}

/**
 * Quick check for obviously problematic content with Smart Visibility
 * @param {string} content - Article content
 * @param {string} title - Article title
 * @param {Object} sourceInfo - Optional source information for trusted source checking
 * @returns {Object} - Validation result with visibility recommendation
 */
function quickValidate(content, title = '', sourceInfo = null) {
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
  
  // Check for common scraping errors first
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
    if (pattern.test(content)) {
      return {
        passed: false,
        reason: 'Content contains error messages',
        shouldSave: false,
        japaneseRatio: japaneseRatio,
        visible: false
      };
    }
  }

  // Check for content that's mostly HTML/code
  const htmlTagCount = (content.match(/<[^>]+>/g) || []).length;
  const codePatterns = (content.match(/\{|\}|\[|\]|function|const|var|let|class/g) || []).length;
  
  if (htmlTagCount > 20 || codePatterns > 30) {
    return {
      passed: false,
      reason: 'Content appears to be HTML/code rather than article text',
      shouldSave: false,
      japaneseRatio: japaneseRatio,
      visible: false
    };
  }
  
  // Check if it's from a trusted source
  const trustedSources = ['nhk-easy', 'nhk-news'];
  const isTrustedSource = sourceInfo && trustedSources.includes(
    typeof sourceInfo === 'object' ? sourceInfo.id : sourceInfo
  );
  
  // Smart Visibility based on Japanese ratio
  if (japaneseRatio < 0.3) {
    // Very low Japanese content - reject completely
    return {
      passed: false,
      reason: 'Content appears to be English or non-Japanese',
      shouldSave: false,
      japaneseRatio: japaneseRatio,
      visible: false
    };
  } else if (japaneseRatio < 0.70) {
    // Low Japanese (30-70%) - save but hide, high priority for AI
    return {
      passed: true,
      reason: `Content has mixed languages (${Math.round(japaneseRatio * 100)}% Japanese), needs AI review`,
      shouldSave: true,
      needsAIEnhancement: true,
      japaneseRatio: japaneseRatio,
      visible: false,  // Hidden until AI validates
      priority: 'high'
    };
  } else if (japaneseRatio < 0.87) {
    // Medium Japanese (70-87%) - show but mark for AI enhancement
    return {
      passed: true,
      reason: `Good Japanese content (${Math.round(japaneseRatio * 100)}%), AI enhancement recommended`,
      shouldSave: true,
      needsAIEnhancement: true,
      japaneseRatio: japaneseRatio,
      visible: true,  // Now visible immediately (changed from false)
      priority: 'medium'
    };
  } else {
    // Excellent Japanese (87%+) - show immediately
    return {
      passed: true,
      reason: `Excellent Japanese content (${Math.round(japaneseRatio * 100)}%)`,
      shouldSave: true,
      needsAIEnhancement: false,
      japaneseRatio: japaneseRatio,
      visible: true,  // Visible immediately
      priority: 'low'
    };
  }
}

/**
 * Filter an array of articles, removing obviously invalid ones
 * @param {Array} articles - Array of article objects
 * @returns {Array} - Filtered array of valid articles
 */
function filterArticles(articles) {
  if (!articles || !Array.isArray(articles)) {
    return [];
  }

  const validArticles = [];
  const rejectedArticles = [];
  const hiddenArticles = [];

  for (const article of articles) {
    const validation = quickValidate(
      article.content || article.body, 
      article.title,
      article.source
    );
    
    if (validation.shouldSave) {
      // Add comprehensive validation metadata
      article.quickValidation = {
        passed: validation.passed,
        reason: validation.reason,
        needsAIEnhancement: validation.needsAIEnhancement || false,
        japaneseRatio: validation.japaneseRatio,
        visible: validation.visible || false,
        priority: validation.priority || 'normal',
        validatedAt: new Date().toISOString()
      };
      
      // Set visibility and priority fields
      article.visible = validation.visible || false;
      article.aiValidationPriority = validation.priority || 'normal';
      
      validArticles.push(article);
      
      // Track hidden articles
      if (!validation.visible) {
        hiddenArticles.push({
          title: article.title,
          japaneseRatio: validation.japaneseRatio,
          reason: validation.reason
        });
      }
    } else {
      rejectedArticles.push({
        title: article.title,
        url: article.url,
        reason: validation.reason,
        japaneseRatio: validation.japaneseRatio
      });
    }
  }

  // Enhanced logging with visibility stats
  console.log(`✅ [Quick Validation] Accepted: ${validArticles.length} articles`);
  if (hiddenArticles.length > 0) {
    console.log(`👁️‍🗨️ [Quick Validation] Hidden (pending AI): ${hiddenArticles.length} articles`);
    hiddenArticles.forEach(h => {
      console.log(`  - "${h.title?.substring(0, 30)}..." - ${Math.round(h.japaneseRatio * 100)}% Japanese`);
    });
  }
  const visibleCount = validArticles.filter(a => a.visible).length;
  if (visibleCount > 0) {
    console.log(`✨ [Quick Validation] Immediately visible: ${visibleCount} articles`);
  }
  if (rejectedArticles.length > 0) {
    console.log(`❌ [Quick Validation] Rejected: ${rejectedArticles.length} articles`);
    rejectedArticles.forEach(r => {
      console.log(`  - "${r.title?.substring(0, 30)}..." - ${r.reason}`);
    });
  }

  return validArticles;
}

// Export for use in other functions
module.exports = {
  isLikelyJapanese,
  quickValidate,
  filterArticles
};