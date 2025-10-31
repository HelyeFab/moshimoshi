#!/usr/bin/env tsx
/**
 * Check All Collections for Date Format Issues
 *
 * Scans all Firebase collections for this user to identify
 * which ones have Timestamp vs String date fields
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const serviceAccount = require('../firebase-admin-key.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()

interface CollectionSummary {
  name: string
  path: string
  count: number
  hasTimestamps: boolean
  hasStrings: boolean
  sampleDates: any[]
}

async function checkUserCollections(userId: string) {
  console.log(`\n🔍 Scanning all collections for user: ${userId}\n`)

  const results: CollectionSummary[] = []

  // Top-level collections that include userId
  const topLevel = [
    { name: 'user_stats', path: `user_stats/${userId}` },
    { name: 'drill_sessions', path: 'drill_sessions', filter: { field: 'userId', value: userId } },
  ]

  // User subcollections
  const subcollections = [
    'review_sessions',
    'study_sessions',
    'review_history',
    'srs_data',
    'progress',
    'drill_history',
    'searched_words',
    'lists',
    'flashcard_decks'
  ]

  // Check top-level collections
  for (const coll of topLevel) {
    try {
      let query: any

      if (coll.path.includes('/')) {
        // Direct document
        const doc = await db.doc(coll.path).get()
        if (doc.exists) {
          const data = doc.data()!
          const analysis = analyzeDateFields(data)
          results.push({
            name: coll.name,
            path: coll.path,
            count: 1,
            hasTimestamps: analysis.hasTimestamps,
            hasStrings: analysis.hasStrings,
            sampleDates: analysis.samples
          })
        }
      } else {
        // Collection with filter
        query = db.collection(coll.path)
        if (coll.filter) {
          query = query.where(coll.filter.field, '==', coll.filter.value)
        }

        const snapshot = await query.limit(3).get()

        if (!snapshot.empty) {
          const samples = snapshot.docs.map(doc => doc.data())
          const analysis = analyzeDateFields(samples[0])

          results.push({
            name: coll.name,
            path: coll.path,
            count: snapshot.size,
            hasTimestamps: analysis.hasTimestamps,
            hasStrings: analysis.hasStrings,
            sampleDates: analysis.samples
          })
        }
      }
    } catch (error: any) {
      console.log(`  ⚠️  Error checking ${coll.name}: ${error.message}`)
    }
  }

  // Check subcollections
  for (const subColl of subcollections) {
    try {
      const snapshot = await db
        .collection('users')
        .doc(userId)
        .collection(subColl)
        .limit(3)
        .get()

      if (!snapshot.empty) {
        const samples = snapshot.docs.map(doc => doc.data())
        const analysis = analyzeDateFields(samples[0])

        results.push({
          name: subColl,
          path: `users/${userId}/${subColl}`,
          count: snapshot.size,
          hasTimestamps: analysis.hasTimestamps,
          hasStrings: analysis.hasStrings,
          sampleDates: analysis.samples
        })
      }
    } catch (error: any) {
      // Collection doesn't exist or no permission
    }
  }

  return results
}

function analyzeDateFields(data: any): {
  hasTimestamps: boolean
  hasStrings: boolean
  samples: any[]
} {
  const samples: any[] = []
  let hasTimestamps = false
  let hasStrings = false

  function scan(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key

      // Check if it's a date-related field
      if (key.includes('At') || key.includes('Date') || key === 'timestamp' || key === 'updatedAt' || key === 'createdAt') {
        if (value instanceof Timestamp) {
          hasTimestamps = true
          samples.push({ field: fullPath, type: 'Timestamp', value: value.toDate().toISOString() })
        } else if (typeof value === 'string') {
          hasStrings = true
          samples.push({ field: fullPath, type: 'string', value })
        } else if (value && typeof value === 'object' && '_seconds' in value) {
          hasTimestamps = true
          samples.push({ field: fullPath, type: 'Timestamp', value: 'Firestore Timestamp object' })
        }
      }

      // Recurse for nested objects
      if (value && typeof value === 'object' && !(value instanceof Timestamp)) {
        scan(value, fullPath)
      }
    }
  }

  scan(data)

  return { hasTimestamps, hasStrings, samples }
}

async function main() {
  const userId = process.argv[2]

  if (!userId) {
    console.error('❌ Error: User ID required')
    console.log('Usage: npx tsx scripts/check-all-collections.ts <userId>')
    process.exit(1)
  }

  try {
    const results = await checkUserCollections(userId)

    console.log(`📊 Found ${results.length} collections with data\n`)

    // Group by status
    const needsMigration = results.filter(r => r.hasTimestamps)
    const alreadyMigrated = results.filter(r => r.hasStrings && !r.hasTimestamps)
    const mixed = results.filter(r => r.hasTimestamps && r.hasStrings)

    if (needsMigration.length > 0) {
      console.log(`\n⚠️  Collections with Timestamp objects (need migration):`)
      for (const coll of needsMigration) {
        console.log(`\n  📁 ${coll.name} (${coll.count} docs)`)
        console.log(`     Path: ${coll.path}`)
        coll.sampleDates.slice(0, 3).forEach(sample => {
          console.log(`     - ${sample.field}: ${sample.type} = ${sample.value}`)
        })
      }
    }

    if (mixed.length > 0) {
      console.log(`\n⚡ Collections with MIXED date formats (partially migrated):`)
      for (const coll of mixed) {
        console.log(`\n  📁 ${coll.name} (${coll.count} docs)`)
        console.log(`     Path: ${coll.path}`)
        coll.sampleDates.slice(0, 3).forEach(sample => {
          console.log(`     - ${sample.field}: ${sample.type} = ${sample.value}`)
        })
      }
    }

    if (alreadyMigrated.length > 0) {
      console.log(`\n✅ Collections already using ISO strings:`)
      for (const coll of alreadyMigrated) {
        console.log(`   - ${coll.name} (${coll.count} docs)`)
      }
    }

    // Summary
    console.log(`\n\n📈 Summary:`)
    console.log(`   Total collections: ${results.length}`)
    console.log(`   ✅ Already migrated: ${alreadyMigrated.length}`)
    console.log(`   ⚠️  Need migration: ${needsMigration.length}`)
    console.log(`   ⚡ Mixed formats: ${mixed.length}`)

    if (needsMigration.length > 0 || mixed.length > 0) {
      console.log(`\n💡 Recommendation: Expand migration script to include all collections`)
    } else {
      console.log(`\n🎉 All collections are using ISO strings!`)
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Scan failed:', error)
    process.exit(1)
  }
}

main()
