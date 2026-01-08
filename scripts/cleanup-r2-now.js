/**
 * SERVER-SIDE R2 Cleanup Script
 *
 * Deletes ALL deck files from Cloudflare R2
 * Run with: node scripts/cleanup-r2-now.js
 */

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3')
require('dotenv').config({ path: '.env.local' })

async function cleanup() {
  console.log('🧹 Starting R2 cleanup...\n')

  // Load R2 config from environment
  const client = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  })

  const bucket = process.env.R2_BUCKET

  if (!bucket) {
    console.error('❌ R2_BUCKET not found in environment variables')
    process.exit(1)
  }

  console.log('📦 Bucket:', bucket)
  console.log('🔍 Listing all objects...\n')

  // List all objects
  let allObjects = []
  let continuationToken = undefined

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    })

    const listResponse = await client.send(listCommand)
    const objects = listResponse.Contents || []

    allObjects.push(...objects.map(obj => ({ Key: obj.Key })))
    continuationToken = listResponse.NextContinuationToken

    console.log(`📄 Found ${objects.length} objects in this batch (total: ${allObjects.length})`)
  } while (continuationToken)

  console.log(`\n✅ Total objects found: ${allObjects.length}\n`)

  if (allObjects.length === 0) {
    console.log('✨ Nothing to delete!')
    return
  }

  // Show what will be deleted
  console.log('🗑️  Files to delete:')
  allObjects.slice(0, 10).forEach(obj => console.log(`   - ${obj.Key}`))
  if (allObjects.length > 10) {
    console.log(`   ... and ${allObjects.length - 10} more files\n`)
  }

  // Delete in batches of 1000
  const BATCH_SIZE = 1000
  let totalDeleted = 0

  for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
    const batch = allObjects.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(allObjects.length / BATCH_SIZE)

    console.log(`🗑️  Deleting batch ${batchNum}/${totalBatches} (${batch.length} files)...`)

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: batch,
        Quiet: false,
      },
    })

    const deleteResponse = await client.send(deleteCommand)
    const deleted = deleteResponse.Deleted?.length || 0
    totalDeleted += deleted

    console.log(`   ✅ Deleted ${deleted} files`)

    if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
      console.error('   ❌ Errors:', deleteResponse.Errors.slice(0, 5))
    }
  }

  console.log(`\n✨ Cleanup complete!`)
  console.log(`   Total deleted: ${totalDeleted} files`)
  console.log(`   Total found: ${allObjects.length} files`)
}

cleanup().catch(error => {
  console.error('\n❌ Cleanup failed:', error.message)
  process.exit(1)
})
