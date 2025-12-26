// This script clears the trending videos cache by restarting the module
console.log('🔄 Clearing trending videos cache...\n');

// The cache is module-level, so the easiest way is to restart your dev server
// Or we can call the API endpoint

const CLEAR_CACHE_URL = 'http://localhost:3000/api/youtube/popular/clear-cache';

async function clearCache() {
  try {
    const response = await fetch(CLEAR_CACHE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Cache cleared successfully!');
      console.log('🎬 Tomo\'s video should now appear on the trending page\n');
    } else {
      console.log('⚠️  Response:', data);
      console.log('\n💡 Alternative: Restart your dev server to clear the cache');
      console.log('   Run: npm run dev\n');
    }
  } catch (error) {
    console.log('⚠️  Could not connect to local server');
    console.log('💡 Please restart your dev server to clear the cache:');
    console.log('   1. Stop the server (Ctrl+C)');
    console.log('   2. Run: npm run dev');
    console.log('   3. Visit: http://localhost:3000/popular-videos\n');
  }
}

clearCache();
