/**
 * Quiz Data Migration Script
 *
 * Migrates quiz questions from legacy format (correctIndex) to new unified format (correctAnswer)
 *
 * Usage:
 *   npm run migrate:quiz:dry-run  # Dry run - see what would change without making changes
 *   npm run migrate:quiz           # Live run - actually migrates the data
 *
 * Safety features:
 * - Creates backup collection before making any changes
 * - Keeps _legacyCorrectIndex field for rollback capability
 * - Comprehensive logging
 * - Dry-run mode for validation
 *
 * Collections migrated:
 * - stories (where quiz != null)
 * - ai_story_drafts (where quiz != null)
 * - comic_episodes (where quiz != null)
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin for this script
function initializeFirebaseForScript() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json')

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at: ${serviceAccountPath}`)
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })

    console.log('✅ Firebase Admin initialized from service account file')
    console.log(`Project ID: ${serviceAccount.project_id}`)
  }

  return admin.firestore()
}

const db = initializeFirebaseForScript()
const FieldValue = admin.firestore.FieldValue

interface MigrationResult {
  storiesProcessed: number
  draftsProcessed: number
  comicsProcessed: number
  questionsUpdated: number
  errors: Array<{ docId: string; collection: string; error: string }>
  backupPath: string
  dryRun: boolean
}

/**
 * Migrate quiz data from correctIndex to correctAnswer
 *
 * @param dryRun - If true, only simulates the migration without making changes
 * @returns Migration result with statistics
 */
async function migrateQuizData(dryRun = true): Promise<MigrationResult> {
  console.log('\n=== Quiz Data Migration ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will modify data)'}`)
  console.log(`Started at: ${new Date().toISOString()}\n`)

  const result: MigrationResult = {
    storiesProcessed: 0,
    draftsProcessed: 0,
    comicsProcessed: 0,
    questionsUpdated: 0,
    errors: [],
    backupPath: '',
    dryRun,
  }

  if (!db) {
    throw new Error('Firebase Admin not initialized. Check your credentials.')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupCollectionName = `quiz_migration_backup_${timestamp}`
  result.backupPath = backupCollectionName

  console.log(`Backup collection: ${backupCollectionName}\n`)

  // Batch processing for efficiency (Firestore limit is 500 operations per batch)
  const batch = db.batch()
  let batchOperations = 0
  const MAX_BATCH_SIZE = 450 // Leave some margin

  /**
   * Helper function to commit batch if it's getting full
   */
  const commitBatchIfNeeded = async (): Promise<void> => {
    if (batchOperations >= MAX_BATCH_SIZE) {
      if (!dryRun) {
        console.log(`Committing batch with ${batchOperations} operations...`)
        await batch.commit()
      }
      batchOperations = 0
    }
  }

  // ========================================
  // MIGRATE STORIES COLLECTION
  // ========================================
  console.log('📚 Processing stories collection...')

  try {
    const storiesSnapshot = await db
      .collection('stories')
      .where('quiz', '!=', null)
      .get()

    console.log(`Found ${storiesSnapshot.size} stories with quizzes\n`)

    for (const doc of storiesSnapshot.docs) {
      try {
        const story = doc.data()
        const quiz = story.quiz || []

        // Check if already migrated
        if (quiz.length > 0 && 'correctAnswer' in quiz[0] && '_migrated' in story) {
          console.log(`⏭️  Skipping ${doc.id} - already migrated`)
          continue
        }

        // Backup original document
        if (!dryRun) {
          const backupRef = db.collection(backupCollectionName).doc(`story_${doc.id}`)
          batch.set(backupRef, {
            ...story,
            _backupType: 'story',
            _backupDate: timestamp,
          })
          batchOperations++
          await commitBatchIfNeeded()
        }

        // Migrate quiz questions
        let questionsMigrated = 0
        const migratedQuiz = quiz.map((q: any) => {
          // If has both correctIndex and correctAnswer, ensure they match and clean up correctIndex
          if ('correctIndex' in q && 'correctAnswer' in q) {
            if (q.correctIndex !== q.correctAnswer) {
              console.warn(`⚠️  Story ${doc.id}, Question ${q.id}: correctIndex (${q.correctIndex}) != correctAnswer (${q.correctAnswer}). Using correctAnswer.`)
            }
            questionsMigrated++
            const { correctIndex, ...rest } = q
            return {
              ...rest,
              type: rest.type || 'multiple-choice',
              _legacyCorrectIndex: correctIndex,  // Keep for rollback
            }
          }

          // If only has correctAnswer (already migrated), skip
          if ('correctAnswer' in q && !('correctIndex' in q)) {
            return q
          }

          // If only has correctIndex, migrate it
          if ('correctIndex' in q) {
            questionsMigrated++
            const { correctIndex, ...rest } = q
            return {
              ...rest,
              correctAnswer: correctIndex,  // Main change
              type: rest.type || 'multiple-choice',
              _legacyCorrectIndex: correctIndex,  // Keep for rollback
            }
          }

          // No correctIndex or correctAnswer - log warning
          console.warn(`⚠️  Warning: Story ${doc.id}, Question ${q.id} missing both correctIndex and correctAnswer`)
          return q
        })

        if (questionsMigrated > 0) {
          console.log(`✅ Story ${doc.id}: Migrated ${questionsMigrated} questions`)

          if (!dryRun) {
            batch.update(doc.ref, {
              quiz: migratedQuiz,
              _migrated: true,
              _migratedAt: timestamp,
              _migrationScript: 'migrate-quiz-data.ts',
            })
            batchOperations++
            await commitBatchIfNeeded()
          }

          result.storiesProcessed++
          result.questionsUpdated += questionsMigrated
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing story ${doc.id}:`, errorMessage)
        result.errors.push({
          docId: doc.id,
          collection: 'stories',
          error: errorMessage,
        })
      }
    }
  } catch (error) {
    console.error('❌ Error querying stories collection:', error)
    throw error
  }

  console.log('')

  // ========================================
  // MIGRATE AI_STORY_DRAFTS COLLECTION
  // ========================================
  console.log('📝 Processing ai_story_drafts collection...')

  try {
    const draftsSnapshot = await db
      .collection('ai_story_drafts')
      .where('quiz', '!=', null)
      .get()

    console.log(`Found ${draftsSnapshot.size} drafts with quizzes\n`)

    for (const doc of draftsSnapshot.docs) {
      try {
        const draft = doc.data()
        const quiz = draft.quiz || []

        // Check if already migrated
        if (quiz.length > 0 && 'correctAnswer' in quiz[0] && '_migrated' in draft) {
          console.log(`⏭️  Skipping draft ${doc.id} - already migrated`)
          continue
        }

        // Backup
        if (!dryRun) {
          const backupRef = db.collection(backupCollectionName).doc(`draft_${doc.id}`)
          batch.set(backupRef, {
            ...draft,
            _backupType: 'ai_story_draft',
            _backupDate: timestamp,
          })
          batchOperations++
          await commitBatchIfNeeded()
        }

        // Migrate
        let questionsMigrated = 0
        const migratedQuiz = quiz.map((q: any) => {
          // If has both correctIndex and correctAnswer, ensure they match and clean up correctIndex
          if ('correctIndex' in q && 'correctAnswer' in q) {
            if (q.correctIndex !== q.correctAnswer) {
              console.warn(`⚠️  Draft ${doc.id}, Question ${q.id}: correctIndex (${q.correctIndex}) != correctAnswer (${q.correctAnswer}). Using correctAnswer.`)
            }
            questionsMigrated++
            const { correctIndex, ...rest } = q
            return {
              ...rest,
              type: rest.type || 'multiple-choice',
              _legacyCorrectIndex: correctIndex,
            }
          }

          // If only has correctAnswer (already migrated), skip
          if ('correctAnswer' in q && !('correctIndex' in q)) {
            return q
          }

          // If only has correctIndex, migrate it
          if ('correctIndex' in q) {
            questionsMigrated++
            const { correctIndex, ...rest } = q
            return {
              ...rest,
              correctAnswer: correctIndex,
              type: rest.type || 'multiple-choice',
              _legacyCorrectIndex: correctIndex,
            }
          }

          return q
        })

        if (questionsMigrated > 0) {
          console.log(`✅ Draft ${doc.id}: Migrated ${questionsMigrated} questions`)

          if (!dryRun) {
            batch.update(doc.ref, {
              quiz: migratedQuiz,
              _migrated: true,
              _migratedAt: timestamp,
              _migrationScript: 'migrate-quiz-data.ts',
            })
            batchOperations++
            await commitBatchIfNeeded()
          }

          result.draftsProcessed++
          result.questionsUpdated += questionsMigrated
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing draft ${doc.id}:`, errorMessage)
        result.errors.push({
          docId: doc.id,
          collection: 'ai_story_drafts',
          error: errorMessage,
        })
      }
    }
  } catch (error) {
    console.error('❌ Error querying ai_story_drafts collection:', error)
    // Continue with comics even if drafts fail
  }

  console.log('')

  // ========================================
  // MIGRATE COMIC_EPISODES COLLECTION
  // ========================================
  console.log('📖 Processing comic_episodes collection...')

  try {
    const comicsSnapshot = await db
      .collection('comic_episodes')
      .where('quiz', '!=', null)
      .get()

    console.log(`Found ${comicsSnapshot.size} comics with quizzes\n`)

    for (const doc of comicsSnapshot.docs) {
      try {
        const episode = doc.data()
        const quiz = episode.quiz
        const questions = quiz?.questions || []

        // Check if already migrated
        if (questions.length > 0 && 'correctAnswer' in questions[0] && '_migrated' in episode) {
          console.log(`⏭️  Skipping comic ${doc.id} - already migrated`)
          continue
        }

        // Backup
        if (!dryRun) {
          const backupRef = db.collection(backupCollectionName).doc(`comic_${doc.id}`)
          batch.set(backupRef, {
            ...episode,
            _backupType: 'comic_episode',
            _backupDate: timestamp,
          })
          batchOperations++
          await commitBatchIfNeeded()
        }

        // Comics should already use correctAnswer, but check for any legacy correctIndex
        let questionsMigrated = 0
        const migratedQuestions = questions.map((q: any) => {
          // If has both correctIndex and correctAnswer, ensure they match and clean up correctIndex
          if ('correctIndex' in q && 'correctAnswer' in q) {
            if (q.correctIndex !== q.correctAnswer) {
              console.warn(`⚠️  Comic ${doc.id}, Question ${q.id}: correctIndex (${q.correctIndex}) != correctAnswer (${q.correctAnswer}). Using correctAnswer.`)
            }
            questionsMigrated++
            const { correctIndex, ...rest } = q
            return {
              ...rest,
              _legacyCorrectIndex: correctIndex,
            }
          }

          // If only has correctAnswer (already migrated), skip
          if ('correctAnswer' in q && !('correctIndex' in q)) {
            return q
          }

          // If only has correctIndex, migrate it
          if ('correctIndex' in q) {
            questionsMigrated++
            console.warn(`⚠️  Comic ${doc.id} has unexpected correctIndex field - migrating`)
            const { correctIndex, ...rest } = q
            return {
              ...rest,
              correctAnswer: correctIndex,
              _legacyCorrectIndex: correctIndex,
            }
          }

          return q
        })

        if (questionsMigrated > 0) {
          console.log(`✅ Comic ${doc.id}: Migrated ${questionsMigrated} questions`)

          if (!dryRun) {
            batch.update(doc.ref, {
              'quiz.questions': migratedQuestions,
              _migrated: true,
              _migratedAt: timestamp,
              _migrationScript: 'migrate-quiz-data.ts',
            })
            batchOperations++
            await commitBatchIfNeeded()
          }

          result.comicsProcessed++
          result.questionsUpdated += questionsMigrated
        } else {
          console.log(`✅ Comic ${doc.id}: Already using correctAnswer format`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing comic ${doc.id}:`, errorMessage)
        result.errors.push({
          docId: doc.id,
          collection: 'comic_episodes',
          error: errorMessage,
        })
      }
    }
  } catch (error) {
    console.error('❌ Error querying comic_episodes collection:', error)
    // Continue to commit what we have
  }

  console.log('')

  // ========================================
  // COMMIT REMAINING BATCH OPERATIONS
  // ========================================
  if (!dryRun && batchOperations > 0) {
    console.log(`Committing final batch with ${batchOperations} operations...`)
    await batch.commit()
  }

  console.log('\n=== Migration Summary ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Stories processed: ${result.storiesProcessed}`)
  console.log(`Drafts processed: ${result.draftsProcessed}`)
  console.log(`Comics processed: ${result.comicsProcessed}`)
  console.log(`Total questions updated: ${result.questionsUpdated}`)
  console.log(`Errors: ${result.errors.length}`)
  console.log(`Backup location: ${result.backupPath}`)
  console.log(`Completed at: ${new Date().toISOString()}`)

  if (result.errors.length > 0) {
    console.log('\n❌ Errors encountered:')
    result.errors.forEach(err => {
      console.log(`  - ${err.collection}/${err.docId}: ${err.error}`)
    })
  }

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made')
    console.log('Run without --dry-run flag to apply changes\n')
  } else {
    console.log('\n✅ Migration completed successfully!')
    console.log(`Backup stored in: ${result.backupPath}`)
    console.log('\nTo rollback, restore from backup collection\n')
  }

  return result
}

/**
 * CLI execution
 */
if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run')

  migrateQuizData(isDryRun)
    .then(result => {
      process.exit(result.errors.length > 0 ? 1 : 0)
    })
    .catch(error => {
      console.error('\n💥 Migration failed with fatal error:', error)
      process.exit(1)
    })
}

export { migrateQuizData }
