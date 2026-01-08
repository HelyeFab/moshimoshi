/**
 * Cleanup Script - R2 Files + Upload Queue
 *
 * Run this in the browser console to:
 * 1. Clear all stuck upload jobs from IndexedDB
 * 2. Delete all R2 files for your user account
 *
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 */

(async function cleanup() {
  console.log('🧹 Starting cleanup...')

  try {
    // Step 1: Clear IndexedDB upload queue
    console.log('\n📦 Step 1: Clearing IndexedDB upload queue...')

    const dbName = 'ankiMediaDB'
    const storeName = 'syncQueue'

    const deleteDB = () => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => {
        console.log('✅ Deleted ankiMediaDB (upload queue cleared)')
        resolve()
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        console.warn('⚠️  Database deletion blocked. Close all tabs with this app and try again.')
        reject(new Error('Database deletion blocked'))
      }
    })

    await deleteDB()

    // Step 2: Delete all R2 files via API
    console.log('\n☁️  Step 2: Deleting all R2 files...')

    const response = await fetch('/api/anki/r2/cleanup', {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Cleanup failed')
    }

    const result = await response.json()

    console.log('✅ R2 cleanup complete:', {
      deletedCount: result.deletedCount,
      totalFiles: result.totalFiles,
      message: result.message
    })

    if (result.errors) {
      console.warn('⚠️  Some files had errors:', result.errors)
    }

    console.log('\n✨ Cleanup complete! You can now:')
    console.log('   1. Refresh the page')
    console.log('   2. Import your Anki deck again')
    console.log('   3. Watch it upload without duplicates')

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    console.log('\nManual cleanup steps:')
    console.log('1. F12 → Application → IndexedDB → Right-click "ankiMediaDB" → Delete')
    console.log('2. Refresh the page')
  }
})()
