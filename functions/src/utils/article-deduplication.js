// Utility module for article deduplication
const crypto = require('crypto');

/**
 * Generate a consistent ID for an article based on its URL
 * This ensures the same article always gets the same ID
 * @param {string} url - The article URL
 * @returns {string} - A consistent article ID
 */
function generateArticleId(url) {
  // Create a hash of the URL to get a consistent ID
  // Using first 12 chars of hash for readability while maintaining uniqueness
  const hash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 12);
  return `article_${hash}`;
}

/**
 * Check if articles already exist in Firestore and filter out duplicates
 * @param {Object} db - Firestore database instance
 * @param {Array} articles - Array of articles to check
 * @returns {Promise<Array>} - Array of articles that don't exist yet
 */
async function filterExistingArticles(db, articles) {
  if (!articles || articles.length === 0) {
    return [];
  }

  const articlesRef = db.collection('articles');
  const newArticles = [];
  
  // Check each article
  for (const article of articles) {
    // Generate consistent ID based on URL
    const consistentId = generateArticleId(article.url);
    
    try {
      const doc = await articlesRef.doc(consistentId).get();
      
      if (!doc.exists) {
        // Article doesn't exist, add it with the consistent ID
        newArticles.push({
          ...article,
          id: consistentId
        });
      } else {
        console.log(`⏭️  Skipping duplicate article: ${article.title}`);
      }
    } catch (error) {
      console.error(`Error checking article existence: ${error.message}`);
      // If there's an error checking, include the article to be safe
      newArticles.push({
        ...article,
        id: consistentId
      });
    }
  }
  
  console.log(`📊 Deduplication: ${articles.length} articles checked, ${newArticles.length} are new`);
  return newArticles;
}

/**
 * Enhanced save function that checks for duplicates before saving
 * @param {Object} db - Firestore database instance
 * @param {Array} articles - Array of articles to save
 * @param {Object} admin - Firebase admin instance for timestamps
 * @returns {Promise<number>} - Number of articles actually saved
 */
async function saveArticlesWithDeduplication(db, articles, admin) {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  // Filter out existing articles
  const newArticles = await filterExistingArticles(db, articles);
  
  if (newArticles.length === 0) {
    console.log('ℹ️  No new articles to save');
    return 0;
  }

  const batch = db.batch();
  const articlesRef = db.collection('articles');

  for (const article of newArticles) {
    const docRef = articlesRef.doc(article.id);
    const data = {
      ...article
    };
    
    // Convert Date objects to Firestore timestamps if admin is provided
    if (admin) {
      if (article.publishDate instanceof Date) {
        data.publishDate = admin.firestore.Timestamp.fromDate(article.publishDate);
      }
      if (article.scrapedAt instanceof Date) {
        data.scrapedAt = admin.firestore.Timestamp.fromDate(article.scrapedAt);
      }
    }
    
    batch.set(docRef, data);
  }

  await batch.commit();
  console.log(`✅ Successfully saved ${newArticles.length} new articles to Firebase`);
  return newArticles.length;
}

module.exports = {
  generateArticleId,
  filterExistingArticles,
  saveArticlesWithDeduplication
};