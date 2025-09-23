#!/usr/bin/env node

/**
 * Script to clear the entire Upstash Redis database
 * WARNING: This will delete ALL data in the Redis database
 */

const https = require('https');
const url = require('url');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('❌ Missing Redis credentials in .env.local');
  console.error('Required: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

/**
 * Execute Redis command via REST API
 */
async function executeRedisCommand(command) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${REDIS_URL}/${command.join('/')}`);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Main function to clear Redis
 */
async function clearRedis() {
  console.log('🔴 WARNING: This will delete ALL data in the Redis database!');
  console.log(`📍 Database: ${REDIS_URL}`);
  console.log('');

  // Add a 3-second countdown for safety
  for (let i = 3; i > 0; i--) {
    process.stdout.write(`Starting in ${i}... `);
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('\r');
  }
  console.log('');

  try {
    // First, let's check the current database size
    console.log('📊 Checking database size before clearing...');
    const dbSize = await executeRedisCommand(['DBSIZE']);
    console.log(`   Current number of keys: ${dbSize.result || 0}`);

    if (dbSize.result === 0) {
      console.log('✅ Database is already empty!');
      return;
    }

    // Execute FLUSHDB to clear the current database
    console.log('\n🗑️  Clearing database...');
    const flushResult = await executeRedisCommand(['FLUSHDB']);

    if (flushResult.result === 'OK') {
      console.log('✅ Database cleared successfully!');

      // Verify it's empty
      const newSize = await executeRedisCommand(['DBSIZE']);
      console.log(`\n📊 Database size after clearing: ${newSize.result || 0} keys`);

      if (newSize.result === 0) {
        console.log('✅ Verification complete: Database is empty!');
      } else {
        console.log('⚠️  Warning: Database still contains keys after flush');
      }
    } else {
      console.error('❌ Failed to clear database:', flushResult);
    }

  } catch (error) {
    console.error('❌ Error clearing Redis:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  clearRedis()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { clearRedis };