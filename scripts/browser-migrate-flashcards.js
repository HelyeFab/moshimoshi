// Copy and paste this entire code into your browser console at http://localhost:3000

(async () => {
  console.log('🚀 Checking for local flashcard decks...');

  try {
    // Check if you're premium
    const authRes = await fetch('/api/user/subscription');
    const auth = await authRes.json();

    console.log('Your plan:', auth.subscription?.plan);
    console.log('Premium?', auth.subscription?.status === 'active' &&
                 (auth.subscription?.plan === 'premium_monthly' ||
                  auth.subscription?.plan === 'premium_yearly'));

    // Open IndexedDB
    const dbRequest = indexedDB.open('moshimoshi-offline-db');
    const db = await new Promise((resolve, reject) => {
      dbRequest.onsuccess = () => resolve(dbRequest.result);
      dbRequest.onerror = () => reject(dbRequest.error);
    });

    // Check for flashcard decks
    if (!db.objectStoreNames.contains('flashcardDecks')) {
      console.log('No flashcard store found');
      db.close();
      return;
    }

    const tx = db.transaction(['flashcardDecks'], 'readonly');
    const store = tx.objectStore('flashcardDecks');
    const decks = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    console.log(`Found ${decks.length} local deck(s)`);

    if (decks.length > 0) {
      console.log('\nLocal decks:');
      decks.forEach(d => console.log(`- ${d.name} (${d.cards?.length || 0} cards)`));

      // Upload to Firebase
      console.log('\n📤 Uploading to Firebase...');

      for (const deck of decks) {
        const res = await fetch('/api/flashcards/decks', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            name: deck.name,
            description: deck.description || '',
            emoji: deck.emoji || '🎴',
            color: deck.color || 'primary',
            cardStyle: deck.cardStyle || 'minimal',
            settings: deck.settings || {},
            initialCards: deck.cards || []
          })
        });

        if (res.ok) {
          console.log(`✅ Uploaded: ${deck.name}`);
        } else {
          console.error(`❌ Failed to upload: ${deck.name}`);
        }
      }
    }

    db.close();

    // Check Firebase
    console.log('\n🔍 Checking Firebase...');
    const fbRes = await fetch('/api/flashcards/decks');
    const fbData = await fbRes.json();
    console.log(`Decks in Firebase: ${fbData.decks?.length || 0}`);
    fbData.decks?.forEach(d => console.log(`- ${d.name}`));

  } catch (error) {
    console.error('Error:', error);
  }
})();