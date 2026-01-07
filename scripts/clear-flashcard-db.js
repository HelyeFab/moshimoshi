/**
 * Clear all decks from the FlashcardDB IndexedDB database
 * Run this in the browser console to delete existing decks
 */

(async function clearFlashcardDB() {
  console.log('🗑️ Clearing FlashcardDB...')

  // Delete the entire database
  const deleteRequest = indexedDB.deleteDatabase('FlashcardDB')

  deleteRequest.onsuccess = () => {
    console.log('✅ FlashcardDB deleted successfully!')
    console.log('💡 You can now import your Anki deck fresh with stats initialized')
    console.log('🔄 Refresh the page to start fresh')
  }

  deleteRequest.onerror = (event) => {
    console.error('❌ Failed to delete FlashcardDB:', event)
  }

  deleteRequest.onblocked = () => {
    console.warn('⚠️ Database deletion blocked - close all tabs using this site and try again')
  }
})()
