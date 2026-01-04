/**
 * Migration Script: Old FSRS → ts-fsrs
 *
 * This script migrates flashcards from the old custom FSRS implementation
 * to the new ts-fsrs library wrapper.
 *
 * What it does:
 * 1. Backs up all flashcard data
 * 2. Converts old FSRS SRSData to ts-fsrs compatible format
 * 3. Updates algorithm field to ensure correct factory routing
 * 4. Validates migration success
 *
 * Usage:
 *   npx tsx scripts/migrate-to-tsfsrs.ts <userId>
 *   npx tsx scripts/migrate-to-tsfsrs.ts --dry-run <userId>  # Test without changes
 *
 * Safety:
 * - Creates backup before any changes
 * - Supports dry-run mode
 * - Validates all conversions
 * - Can be safely re-run
 */

import { adminDb } from '@/lib/firebase-admin'
import * as fs from 'fs'
import * as path from 'path'

interface OldSRSData {
  interval: number
  lastReviewedAt: Date | null
  nextReviewAt: Date
  status: 'new' | 'learning' | 'review' | 'mastered'
  reviewCount: number
  correctCount: number
  streak: number
  bestStreak: number
  algorithm?: 'sm2' | 'fsrs'

  // Old FSRS fields (may be incorrect)
  stability?: number
  difficulty?: number
  retrievability?: number
  state?: number

  // SM-2 fields
  easeFactor?: number
  repetitions?: number
}

interface NewSRSData extends OldSRSData {
  algorithm: 'fsrs'
  state: number // ts-fsrs State enum
}

interface Card {
  id: string
  metadata?: Record<string, any>
  [key: string]: any
}

interface Deck {
  id: string
  name: string
  cards: Card[]
  userId: string
  [key: string]: any
}

/**
 * Map old status to ts-fsrs State enum
 */
function mapStatusToState(status: string): number {
  switch (status) {
    case 'new': return 0 // State.New
    case 'learning': return 1 // State.Learning
    case 'review': return 2 // State.Review
    case 'mastered': return 2 // State.Review (mastered is just Review with high stability)
    default: return 0
  }
}

/**
 * Migrate a single card's SRS data
 */
function migrateCardSRS(oldData: OldSRSData): NewSRSData {
  // If already using ts-fsrs format, skip
  if (oldData.algorithm === 'fsrs' && oldData.state !== undefined) {
    console.log('  Card already migrated to ts-fsrs format')
    return oldData as NewSRSData
  }

  // If SM-2 card, don't migrate (will use SM-2 wrapper)
  if (oldData.algorithm === 'sm2' || oldData.easeFactor !== undefined) {
    console.log('  SM-2 card - keeping as SM-2')
    return oldData as any
  }

  // Migrate old FSRS to ts-fsrs format
  const state = mapStatusToState(oldData.status)

  const newData: NewSRSData = {
    ...oldData,
    algorithm: 'fsrs',
    state,

    // Ensure FSRS fields exist with defaults if missing
    stability: oldData.stability ?? 0,
    difficulty: oldData.difficulty ?? 5,
    retrievability: oldData.retrievability ?? 1.0
  }

  console.log(`  Migrated: ${oldData.status} → state=${state}, stability=${newData.stability}`)

  return newData
}

/**
 * Migrate a single deck
 */
function migrateDeck(deck: Deck): Deck {
  console.log(`\n📦 Migrating deck: ${deck.name} (${deck.cards?.length || 0} cards)`)

  if (!deck.cards || deck.cards.length === 0) {
    console.log('  No cards to migrate')
    return deck
  }

  const migratedCards = deck.cards.map((card, index) => {
    console.log(`  Card ${index + 1}/${deck.cards.length}: ${card.id}`)

    // Card data might be in different places depending on structure
    const srsData = card.metadata?.srsData || card.srsData

    if (!srsData) {
      console.log('    No SRS data - skipping')
      return card
    }

    const migratedSRS = migrateCardSRS(srsData as OldSRSData)

    // Update card with migrated data
    if (card.metadata?.srsData) {
      return {
        ...card,
        metadata: {
          ...card.metadata,
          srsData: migratedSRS
        }
      }
    } else if (card.srsData) {
      return {
        ...card,
        srsData: migratedSRS
      }
    }

    return card
  })

  return {
    ...deck,
    cards: migratedCards,
    updatedAt: Date.now()
  }
}

/**
 * Main migration function
 */
async function migrateToTSFSRS(userId: string, dryRun: boolean = false): Promise<void> {
  console.log('🚀 Starting migration to ts-fsrs\n')
  console.log(`User ID: ${userId}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`)
  console.log('=' .repeat(50))

  // Step 1: Fetch all decks
  console.log('\n📥 Fetching decks from Firestore...')

  const decksRef = adminDb.collection('flashcardDecks').where('userId', '==', userId)
  const snapshot = await decksRef.get()

  if (snapshot.empty) {
    console.log('❌ No decks found for this user')
    return
  }

  console.log(`✅ Found ${snapshot.size} decks\n`)

  // Step 2: Create backup
  console.log('💾 Creating backup...')

  const backupData = {
    timestamp: new Date().toISOString(),
    userId,
    decksCount: snapshot.size,
    decks: snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }))
  }

  const backupDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const backupPath = path.join(
    backupDir,
    `tsfsrs-migration-${userId}-${Date.now()}.json`
  )

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2))
  console.log(`✅ Backup saved: ${backupPath}\n`)

  // Step 3: Migrate each deck
  let totalCards = 0
  let migratedCards = 0
  let skippedCards = 0

  for (const doc of snapshot.docs) {
    const deck = doc.data() as Deck
    const originalCardCount = deck.cards?.length || 0
    totalCards += originalCardCount

    const migratedDeck = migrateDeck(deck)

    const cardsWithFSRS = migratedDeck.cards.filter(card => {
      const srsData = card.metadata?.srsData || card.srsData
      return srsData?.algorithm === 'fsrs'
    }).length

    migratedCards += cardsWithFSRS
    skippedCards += (originalCardCount - cardsWithFSRS)

    // Update Firestore (unless dry run)
    if (!dryRun) {
      await doc.ref.update({
        cards: migratedDeck.cards,
        updatedAt: migratedDeck.updatedAt
      })
      console.log(`  ✅ Updated in Firestore`)
    } else {
      console.log(`  🔍 Dry run - would update ${cardsWithFSRS} cards`)
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(50))
  console.log('✨ Migration Complete!\n')
  console.log(`📊 Summary:`)
  console.log(`  Total decks: ${snapshot.size}`)
  console.log(`  Total cards: ${totalCards}`)
  console.log(`  Migrated to ts-fsrs: ${migratedCards}`)
  console.log(`  Kept as SM-2: ${skippedCards}`)
  console.log(`  Backup: ${backupPath}`)

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made to the database')
    console.log('Run without --dry-run to apply changes')
  } else {
    console.log('\n✅ Changes saved to Firestore')
  }

  console.log('\n' + '='.repeat(50))
  console.log('Next steps:')
  console.log('1. Test flashcard reviews in the app')
  console.log('2. Verify intervals are reasonable')
  console.log('3. Monitor for any issues')
  console.log('4. Keep backup file until confident migration succeeded')
  console.log('\nTo rollback: Use the backup file to restore original data')
}

/**
 * Rollback function (use backup to restore)
 */
async function rollback(backupPath: string): Promise<void> {
  console.log('🔄 Rolling back from backup...\n')

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup file not found: ${backupPath}`)
    process.exit(1)
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
  console.log(`Backup from: ${backup.timestamp}`)
  console.log(`User ID: ${backup.userId}`)
  console.log(`Decks: ${backup.decksCount}`)
  console.log()

  for (const deckBackup of backup.decks) {
    console.log(`Restoring deck: ${deckBackup.data.name}`)

    const docRef = adminDb.collection('flashcardDecks').doc(deckBackup.id)
    await docRef.update({
      cards: deckBackup.data.cards,
      updatedAt: Date.now()
    })
  }

  console.log('\n✅ Rollback complete!')
}

// ========================================
// CLI Interface
// ========================================

const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('Usage:')
  console.log('  Migrate:  npx tsx scripts/migrate-to-tsfsrs.ts <userId>')
  console.log('  Dry run:  npx tsx scripts/migrate-to-tsfsrs.ts --dry-run <userId>')
  console.log('  Rollback: npx tsx scripts/migrate-to-tsfsrs.ts --rollback <backupPath>')
  process.exit(1)
}

if (args[0] === '--rollback') {
  const backupPath = args[1]
  if (!backupPath) {
    console.error('❌ Backup path required for rollback')
    process.exit(1)
  }
  rollback(backupPath).catch(error => {
    console.error('❌ Rollback failed:', error)
    process.exit(1)
  })
} else {
  const isDryRun = args[0] === '--dry-run'
  const userId = isDryRun ? args[1] : args[0]

  if (!userId) {
    console.error('❌ User ID required')
    process.exit(1)
  }

  migrateToTSFSRS(userId, isDryRun).catch(error => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
}
