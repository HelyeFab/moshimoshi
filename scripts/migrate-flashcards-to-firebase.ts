/**
 * Migration Script: Upload Local Flashcard Decks to Firebase for Premium Users
 *
 * This script will:
 * 1. Check if you're a premium user
 * 2. Look for any flashcard decks in your browser's IndexedDB
 * 3. Upload them to Firebase if you're premium
 *
 * Run this in the browser console while logged in
 */

// This script should be run in the browser console
const migrateFlashcardsToFirebase = async () => {
  console.log('🚀 Starting Flashcard Migration to Firebase...');

  try {
    // 1. Check if user is logged in
    const authResponse = await fetch('/api/user/subscription');
    if (!authResponse.ok) {
      console.error('❌ Not logged in or unable to fetch subscription');
      return;
    }

    const authData = await authResponse.json();
    const isPremium = authData.subscription?.status === 'active' &&
                      (authData.subscription?.plan === 'premium_monthly' ||
                       authData.subscription?.plan === 'premium_yearly');

    console.log('📋 User Status:');
    console.log('   Plan:', authData.subscription?.plan || 'free');
    console.log('   Status:', authData.subscription?.status || 'inactive');
    console.log('   Premium:', isPremium ? '✅ Yes' : '❌ No');

    if (!isPremium) {
      console.log('ℹ️ You are not a premium user. Flashcards will remain in local storage.');
      return;
    }

    // 2. Open IndexedDB and look for flashcard decks
    const dbName = 'moshimoshi-offline-db';
    const openRequest = indexedDB.open(dbName);

    const db = await new Promise((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });

    // Check if flashcardDecks store exists
    if (!db.objectStoreNames.contains('flashcardDecks')) {
      console.log('ℹ️ No flashcard decks store found in IndexedDB');
      db.close();
      return;
    }

    // 3. Read all flashcard decks from IndexedDB
    const transaction = db.transaction(['flashcardDecks'], 'readonly');
    const store = transaction.objectStore('flashcardDecks');
    const getAllRequest = store.getAll();

    const localDecks = await new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });

    console.log(`\n📦 Found ${localDecks.length} deck(s) in local storage`);

    if (localDecks.length === 0) {
      console.log('ℹ️ No flashcard decks to migrate');
      db.close();
      return;
    }

    // 4. Upload each deck to Firebase
    console.log('\n📤 Uploading decks to Firebase...\n');

    for (const deck of localDecks) {
      console.log(`Uploading deck: ${deck.name}...`);

      try {
        const response = await fetch('/api/flashcards/decks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: deck.name,
            description: deck.description,
            emoji: deck.emoji,
            color: deck.color,
            cardStyle: deck.cardStyle,
            settings: deck.settings,
            sourceListId: deck.sourceListId,
            initialCards: deck.cards
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Successfully uploaded: ${deck.name}`);
          console.log(`   Storage location: ${result.storage?.location || 'firebase'}`);

          // Optionally remove from IndexedDB after successful upload
          // Uncomment the following if you want to remove local copies
          /*
          const deleteTransaction = db.transaction(['flashcardDecks'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('flashcardDecks');
          deleteStore.delete(deck.id);
          */
        } else {
          const error = await response.json();
          console.error(`❌ Failed to upload ${deck.name}:`, error.error);
        }
      } catch (error) {
        console.error(`❌ Error uploading ${deck.name}:`, error);
      }
    }

    db.close();

    // 5. Verify upload by fetching from Firebase
    console.log('\n🔍 Verifying Firebase storage...\n');

    const decksResponse = await fetch('/api/flashcards/decks');
    if (decksResponse.ok) {
      const data = await decksResponse.json();
      console.log(`📊 Decks now in Firebase: ${data.decks?.length || 0}`);
      if (data.decks && data.decks.length > 0) {
        data.decks.forEach(deck => {
          console.log(`   - ${deck.name} (${deck.stats?.totalCards || 0} cards)`);
        });
      }
    }

    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
};

// Export for use in browser console
console.log('📝 Copy and run this in your browser console:');
console.log('(' + migrateFlashcardsToFirebase.toString() + ')()');