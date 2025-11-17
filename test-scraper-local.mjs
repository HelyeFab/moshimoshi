// Test script to call the manual news scraper
const url = 'https://manualNewsScraperFunction-949068340758.us-central1.run.app';

console.log('🚀 Triggering manual news scraper (NHK Easy)...\n');

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      source: 'nhk-easy',
      adminKey: 'news-scraper-admin-2025'
    }
  })
});

const result = await response.json();

if (response.ok) {
  console.log('✅ Scraper completed successfully!\n');
  console.log('📊 Result:', JSON.stringify(result, null, 2));
} else {
  console.error('❌ Scraper failed:', response.status, response.statusText);
  console.error('Error:', JSON.stringify(result, null, 2));
}
