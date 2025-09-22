const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Pokemon to add (a nice starter collection)
const pokemonToAdd = [
  { id: 25, name: 'Pikachu', source: 'reward' },
  { id: 1, name: 'Bulbasaur', source: 'game' },
  { id: 4, name: 'Charmander', source: 'game' },
  { id: 7, name: 'Squirtle', source: 'game' },
  { id: 133, name: 'Eevee', source: 'reward' },
  { id: 150, name: 'Mewtwo', source: 'achievement' },
  { id: 151, name: 'Mew', source: 'achievement' },
  { id: 6, name: 'Charizard', source: 'game' },
  { id: 9, name: 'Blastoise', source: 'game' },
  { id: 94, name: 'Gengar', source: 'game' },
  { id: 143, name: 'Snorlax', source: 'reward' },
  { id: 149, name: 'Dragonite', source: 'game' }
];

async function addPokemonToUser() {
  try {
    // You'll need to replace this with your actual user ID
    // You can find it in Firebase Auth console or from your app
    console.log('Please provide your Firebase user ID.');
    console.log('You can find it by:');
    console.log('1. Going to Firebase Console > Authentication');
    console.log('2. Or running this in your app console when logged in: firebase.auth().currentUser.uid');
    console.log('\nFor now, I\'ll create a test document you can copy.\n');

    // Create a sample document structure
    const userId = 'YOUR_USER_ID_HERE'; // Replace with actual user ID

    const pokemonIds = pokemonToAdd.map(p => p.id);
    const catchHistory = pokemonToAdd.map((p, index) => ({
      pokemonId: p.id,
      caughtAt: new Date(Date.now() - (index * 86400000)).toISOString(), // Stagger catch dates
      source: p.source,
      jlptLevel: Math.floor(Math.random() * 5) + 1,
      kanjiIds: []
    }));

    const pokedexData = {
      userId: userId,
      caught: pokemonIds,
      lastCaught: {
        id: pokemonIds[pokemonIds.length - 1],
        date: new Date().toISOString()
      },
      totalCaught: pokemonIds.length,
      catchHistory: catchHistory,
      updatedAt: new Date().toISOString()
    };

    // Print the data structure
    console.log('Pokemon data structure to add:');
    console.log(JSON.stringify(pokedexData, null, 2));

    // Uncomment and modify this section once you have your user ID
    /*
    const userPokedexRef = db.collection('pokemon').doc(userId);
    await userPokedexRef.set(pokedexData, { merge: true });

    console.log(`\n✅ Successfully added ${pokemonIds.length} Pokemon to user ${userId}`);
    console.log('Pokemon added:', pokemonToAdd.map(p => `${p.name} (#${p.id})`).join(', '));
    */

    console.log('\n📝 To add these Pokemon to your account:');
    console.log('1. Replace YOUR_USER_ID_HERE with your actual Firebase user ID');
    console.log('2. Uncomment the Firebase write section in the script');
    console.log('3. Run the script again');

    // Alternative: Add to a test user for demonstration
    const testUserId = 'test-user-' + Date.now();
    const testPokedexRef = db.collection('pokemon').doc(testUserId);

    const testPokedexData = {
      ...pokedexData,
      userId: testUserId
    };

    await testPokedexRef.set(testPokedexData);
    console.log(`\n✅ Created test document with ID: ${testUserId}`);
    console.log('This test data can be viewed in Firebase Console > Firestore > pokemon collection');

  } catch (error) {
    console.error('Error adding Pokemon:', error);
  } finally {
    // Clean up
    await admin.app().delete();
    process.exit();
  }
}

// Function to add Pokemon to a specific user (call with user ID)
async function addPokemonToSpecificUser(userId) {
  try {
    const pokemonIds = pokemonToAdd.map(p => p.id);
    const catchHistory = pokemonToAdd.map((p, index) => ({
      pokemonId: p.id,
      caughtAt: new Date(Date.now() - (index * 86400000)).toISOString(),
      source: p.source,
      jlptLevel: Math.floor(Math.random() * 5) + 1,
      kanjiIds: []
    }));

    const pokedexData = {
      userId: userId,
      caught: pokemonIds,
      lastCaught: {
        id: pokemonIds[pokemonIds.length - 1],
        date: new Date().toISOString()
      },
      totalCaught: pokemonIds.length,
      catchHistory: catchHistory,
      updatedAt: new Date().toISOString()
    };

    const userPokedexRef = db.collection('pokemon').doc(userId);
    await userPokedexRef.set(pokedexData, { merge: true });

    console.log(`✅ Successfully added ${pokemonIds.length} Pokemon to user ${userId}`);
    console.log('Pokemon added:', pokemonToAdd.map(p => `${p.name} (#${p.id})`).join(', '));

    return true;
  } catch (error) {
    console.error('Error adding Pokemon to user:', error);
    return false;
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.length > 0 && args[0]) {
  // If user ID provided as argument, use it
  console.log(`Adding Pokemon to user: ${args[0]}`);
  addPokemonToSpecificUser(args[0]).then(() => {
    admin.app().delete();
    process.exit();
  });
} else {
  // Otherwise run the default function
  addPokemonToUser();
}