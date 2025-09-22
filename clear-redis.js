const Redis = require('@upstash/redis').Redis;

const redis = new Redis({
  url: 'https://magical-macaque-62618.upstash.io',
  token: 'AfSaAAIncDEyY2RkZjQ3YTNhZWU0OGMxYjZlYmU4ZTM2MjMwNjViYnAxNjI2MTg',
});

async function clearRedis() {
  try {
    console.log('Connecting to Upstash Redis...');

    // Get all keys
    const keys = await redis.keys('*');
    console.log(`Found ${keys.length} keys`);

    if (keys.length > 0) {
      // Delete all keys
      for (const key of keys) {
        await redis.del(key);
        console.log(`Deleted: ${key}`);
      }
    }

    console.log('✅ All Redis keys cleared!');
  } catch (error) {
    console.error('Error:', error);
  }
}

clearRedis();