const https = require('https');

// Calculate date range
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

const apiUrl = `https://nhk-api-proxy-production.up.railway.app/news?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;

console.log('🔍 Checking Railway NHK API...');
console.log('Date Range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
console.log('URL:', apiUrl);
console.log('');

// Get API key from environment
const apiKey = process.env.MODAL_API_KEY;
if (!apiKey) {
  console.error('❌ MODAL_API_KEY not set in environment');
  console.error('Please run: export MODAL_API_KEY=your_key');
  process.exit(1);
}

const options = {
  headers: {
    'Accept': 'application/json',
    'X-API-Key': apiKey.trim()
  }
};

https.get(apiUrl, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
      console.error('Response:', data);
      process.exit(1);
    }

    try {
      const articles = JSON.parse(data);
      console.log(`✅ Railway API returned ${articles.length} articles`);
      console.log('');

      // Sort by publish date (newest first)
      articles.sort((a, b) => new Date(b.publishedAtUtc) - new Date(a.publishedAtUtc));

      // Show last 10
      console.log('📰 Last 10 Articles from Railway API:');
      articles.slice(0, 10).forEach((article, i) => {
        const publishDate = new Date(article.publishedAtUtc);
        const now = new Date();
        const ageHours = ((now - publishDate) / (1000 * 60 * 60)).toFixed(1);
        console.log(`${i + 1}. [${publishDate.toISOString().split('T')[0]}] ${article.title.substring(0, 50)}... (${ageHours}h ago)`);
      });

      // Check if there are articles from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentArticles = articles.filter(a => new Date(a.publishedAtUtc) > oneDayAgo);
      console.log(`\n📊 Articles published in last 24 hours: ${recentArticles.length}`);

      // Check articles from last 3 days
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const recent3Days = articles.filter(a => new Date(a.publishedAtUtc) > threeDaysAgo);
      console.log(`📊 Articles published in last 3 days: ${recent3Days.length}`);

      // Check articles from last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent7Days = articles.filter(a => new Date(a.publishedAtUtc) > sevenDaysAgo);
      console.log(`📊 Articles published in last 7 days: ${recent7Days.length}`);

    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.error('Raw response:', data.substring(0, 500));
    }
  });
}).on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});
