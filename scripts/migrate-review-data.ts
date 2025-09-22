#!/usr/bin/env node

/**
 * Migration script for review system data
 * Handles migration from old schema to new review system schema
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { 
  ReviewItemDAO, 
  ReviewSetDAO,
  ReviewItemDocument,
  ReviewSetDocument,
  ContentType
} from '../src/lib/firebase/dao'

/**
 * Migration configuration
 */
interface MigrationConfig {
  batchSize: number
  dryRun: boolean
  verbose: boolean
}

/**
 * Review data migration class
 */
export class ReviewDataMigration {
  private db: ReturnType<typeof getFirestore>
  private itemDAO: ReviewItemDAO
  private setDAO: ReviewSetDAO
  private config: MigrationConfig
  
  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      batchSize: 500,
      dryRun: false,
      verbose: true,
      ...config
    }
    
    // Initialize Firebase Admin
    this.initializeFirebase()
    this.db = getFirestore()
    this.itemDAO = new ReviewItemDAO()
    this.setDAO = new ReviewSetDAO()
  }
  
  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
      throw new Error('FIREBASE_ADMIN_PROJECT_ID not set')
    }
    
    const serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }
    
    initializeApp({
      credential: cert(serviceAccount as any),
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    })
  }
  
  /**
   * Main migration runner
   */
  async run(): Promise<void> {
    console.log('🚀 Starting review data migration...')
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`)
    
    try {
      // Run migrations in sequence
      await this.migrateFromOldSchema()
      await this.createDefaultSets()
      await this.backfillSRSData()
      await this.cleanupOrphanedItems()
      
      console.log('✅ Migration completed successfully!')
    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  }
  
  /**
   * Migrate from old schema to new review system
   */
  async migrateFromOldSchema(): Promise<void> {
    console.log('\n📦 Migrating from old schema...')
    
    try {
      // Check if old collections exist
      const collections = ['user_progress', 'learning_items', 'review_history']
      
      for (const collectionName of collections) {
        const collection = this.db.collection(collectionName)
        const snapshot = await collection.limit(1).get()
        
        if (!snapshot.empty) {
          console.log(`Found ${collectionName} collection, migrating...`)
          await this.migrateCollection(collectionName)
        } else {
          console.log(`No ${collectionName} collection found, skipping...`)
        }
      }
    } catch (error) {
      console.error('Error in schema migration:', error)
      throw error
    }
  }
  
  /**
   * Migrate a specific collection
   */
  private async migrateCollection(collectionName: string): Promise<void> {
    const collection = this.db.collection(collectionName)
    let migrated = 0
    let failed = 0
    
    // Process in batches
    let lastDoc = null
    let hasMore = true
    
    while (hasMore) {
      let query = collection.limit(this.config.batchSize)
      if (lastDoc) {
        query = query.startAfter(lastDoc)
      }
      
      const snapshot = await query.get()
      
      if (snapshot.empty) {
        hasMore = false
        break
      }
      
      const batch = this.db.batch()
      
      for (const doc of snapshot.docs) {
        try {
          const data = doc.data()
          
          // Transform old data to new schema
          const reviewItem = this.transformToReviewItem(data, collectionName)
          
          if (reviewItem && !this.config.dryRun) {
            const newDocRef = this.db.collection('review_items').doc()
            batch.set(newDocRef, {
              ...reviewItem,
              id: newDocRef.id
            })
            migrated++
          }
        } catch (error) {
          console.error(`Failed to migrate document ${doc.id}:`, error)
          failed++
        }
      }
      
      if (!this.config.dryRun) {
        await batch.commit()
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1]
      
      if (this.config.verbose) {
        console.log(`Processed ${migrated + failed} documents from ${collectionName}`)
      }
    }
    
    console.log(`✅ Migrated ${migrated} documents from ${collectionName} (${failed} failed)`)
  }
  
  /**
   * Transform old data format to new ReviewItemDocument
   */
  private transformToReviewItem(oldData: any, source: string): Partial<ReviewItemDocument> | null {
    try {
      // Map old fields to new schema
      // This is a simplified example - adjust based on actual old schema
      
      const contentType = this.mapContentType(oldData.type || oldData.contentType)
      if (!contentType) return null
      
      return {
        userId: oldData.userId || oldData.user_id,
        contentType,
        contentId: oldData.contentId || oldData.item_id || oldData.id,
        contentData: {
          primary: oldData.content || oldData.primary || '',
          secondary: oldData.meaning || oldData.secondary,
          tertiary: oldData.reading || oldData.tertiary,
          audioUrl: oldData.audio_url,
          imageUrl: oldData.image_url
        },
        status: this.mapStatus(oldData.status || 'new'),
        srsData: {
          interval: oldData.interval || 0,
          easeFactor: oldData.ease_factor || 2.5,
          repetitions: oldData.repetitions || 0,
          lastReviewedAt: oldData.last_reviewed ? Timestamp.fromDate(new Date(oldData.last_reviewed)) : null,
          nextReviewAt: oldData.next_review ? 
            Timestamp.fromDate(new Date(oldData.next_review)) : 
            Timestamp.now()
        },
        reviewCount: oldData.review_count || 0,
        correctCount: oldData.correct_count || 0,
        incorrectCount: oldData.incorrect_count || 0,
        streak: oldData.streak || 0,
        bestStreak: oldData.best_streak || 0,
        tags: oldData.tags || [],
        setIds: [],
        priority: 'normal' as const,
        pinnedAt: Timestamp.now(),
        isActive: true,
        createdAt: oldData.created_at ? 
          Timestamp.fromDate(new Date(oldData.created_at)) : 
          Timestamp.now(),
        updatedAt: Timestamp.now(),
        version: 1
      }
    } catch (error) {
      console.error('Error transforming document:', error)
      return null
    }
  }
  
  /**
   * Map old content type to new ContentType
   */
  private mapContentType(oldType: string): ContentType | null {
    const typeMap: Record<string, ContentType> = {
      'hiragana': 'kana',
      'katakana': 'kana',
      'kanji': 'kanji',
      'vocabulary': 'vocabulary',
      'word': 'vocabulary',
      'sentence': 'sentence',
      'grammar': 'grammar',
      'phrase': 'phrase'
    }
    
    return typeMap[oldType?.toLowerCase()] || null
  }
  
  /**
   * Map old status to new status
   */
  private mapStatus(oldStatus: string): 'new' | 'learning' | 'mastered' {
    const statusMap: Record<string, 'new' | 'learning' | 'mastered'> = {
      'new': 'new',
      'learning': 'learning',
      'review': 'learning',
      'mastered': 'mastered',
      'mature': 'mastered'
    }
    
    return statusMap[oldStatus?.toLowerCase()] || 'new'
  }
  
  /**
   * Create default review sets
   */
  async createDefaultSets(): Promise<void> {
    console.log('\n📚 Creating default review sets...')
    
    const defaultSets = [
      {
        name: 'JLPT N5 Vocabulary',
        description: 'Essential vocabulary for JLPT N5',
        category: 'official' as const,
        contentTypes: ['vocabulary'] as ContentType[],
        tags: ['jlpt', 'n5', 'vocabulary']
      },
      {
        name: 'JLPT N5 Kanji',
        description: 'Required kanji for JLPT N5',
        category: 'official' as const,
        contentTypes: ['kanji'] as ContentType[],
        tags: ['jlpt', 'n5', 'kanji']
      },
      {
        name: 'Hiragana',
        description: 'Complete hiragana character set',
        category: 'official' as const,
        contentTypes: ['kana'] as ContentType[],
        tags: ['hiragana', 'kana', 'beginner']
      },
      {
        name: 'Katakana',
        description: 'Complete katakana character set',
        category: 'official' as const,
        contentTypes: ['kana'] as ContentType[],
        tags: ['katakana', 'kana', 'beginner']
      }
    ]
    
    for (const setData of defaultSets) {
      try {
        // Check if set already exists
        const existing = await this.db.collection('review_sets')
          .where('name', '==', setData.name)
          .where('category', '==', 'official')
          .limit(1)
          .get()
        
        if (existing.empty && !this.config.dryRun) {
          const newSet: Omit<ReviewSetDocument, 'id'> = {
            userId: 'system', // System-created sets
            name: setData.name,
            description: setData.description,
            category: setData.category,
            itemIds: [],
            itemCount: 0,
            contentTypes: setData.contentTypes,
            isPublic: true,
            sharedWith: [],
            progress: { new: 0, learning: 0, mastered: 0 },
            dailyNewLimit: 20,
            reviewOrder: 'random',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            lastAccessedAt: Timestamp.now()
          }
          
          await this.setDAO.create(newSet)
          console.log(`✅ Created default set: ${setData.name}`)
        } else {
          console.log(`⏭️  Default set already exists: ${setData.name}`)
        }
      } catch (error) {
        console.error(`Failed to create default set ${setData.name}:`, error)
      }
    }
  }
  
  /**
   * Backfill SRS data for items without it
   */
  async backfillSRSData(): Promise<void> {
    console.log('\n🔧 Backfilling SRS data...')
    
    try {
      const itemsWithoutSRS = await this.db.collection('review_items')
        .where('srsData.interval', '==', 0)
        .limit(this.config.batchSize)
        .get()
      
      if (itemsWithoutSRS.empty) {
        console.log('No items need SRS backfill')
        return
      }
      
      let updated = 0
      const batch = this.db.batch()
      
      for (const doc of itemsWithoutSRS.docs) {
        const data = doc.data() as ReviewItemDocument
        
        // Calculate initial SRS values
        const srsData = {
          interval: 1,
          easeFactor: 2.5,
          repetitions: 0,
          lastReviewedAt: null,
          nextReviewAt: Timestamp.now()
        }
        
        if (!this.config.dryRun) {
          batch.update(doc.ref, { srsData })
          updated++
        }
      }
      
      if (!this.config.dryRun) {
        await batch.commit()
      }
      
      console.log(`✅ Backfilled SRS data for ${updated} items`)
    } catch (error) {
      console.error('Error backfilling SRS data:', error)
      throw error
    }
  }
  
  /**
   * Clean up orphaned items
   */
  async cleanupOrphanedItems(): Promise<void> {
    console.log('\n🧹 Cleaning up orphaned items...')
    
    try {
      // Find items with invalid references
      const orphanedItems = await this.db.collection('review_items')
        .where('userId', '==', '')
        .limit(this.config.batchSize)
        .get()
      
      if (orphanedItems.empty) {
        console.log('No orphaned items found')
        return
      }
      
      let deleted = 0
      const batch = this.db.batch()
      
      for (const doc of orphanedItems.docs) {
        if (!this.config.dryRun) {
          batch.delete(doc.ref)
          deleted++
        }
      }
      
      if (!this.config.dryRun) {
        await batch.commit()
      }
      
      console.log(`✅ Cleaned up ${deleted} orphaned items`)
    } catch (error) {
      console.error('Error cleaning up orphaned items:', error)
      throw error
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2)
  const config: Partial<MigrationConfig> = {}
  
  if (args.includes('--dry-run')) {
    config.dryRun = true
  }
  
  if (args.includes('--quiet')) {
    config.verbose = false
  }
  
  if (args.includes('--batch-size')) {
    const index = args.indexOf('--batch-size')
    config.batchSize = parseInt(args[index + 1])
  }
  
  const migration = new ReviewDataMigration(config)
  migration.run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}