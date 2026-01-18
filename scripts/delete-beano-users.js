const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

async function deleteBeanoUsers() {
  try {
    console.log('Fetching all users...');

    const beanoUsers = [];
    let nextPageToken;

    // List all users
    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

      // Filter for @beano.com users
      const beanoUsersPage = listUsersResult.users.filter(user =>
        user.email && user.email.endsWith('@beano.com')
      );

      beanoUsers.push(...beanoUsersPage);
      nextPageToken = listUsersResult.pageToken;

    } while (nextPageToken);

    console.log(`\nFound ${beanoUsers.length} users with @beano.com domain:`);
    beanoUsers.forEach(user => {
      console.log(`  - ${user.email} (UID: ${user.uid})`);
    });

    if (beanoUsers.length === 0) {
      console.log('\nNo @beano.com users to delete.');
      return;
    }

    console.log('\n⚠️  Starting deletion process...\n');

    let deleted = 0;
    let failed = 0;

    for (const user of beanoUsers) {
      try {
        // Delete from Firestore first
        try {
          await admin.firestore().collection('users').doc(user.uid).delete();
          console.log(`  ✅ Deleted Firestore profile: ${user.email}`);
        } catch (firestoreError) {
          console.log(`  ⚠️  Firestore profile not found or already deleted: ${user.email}`);
        }

        // Delete from Firebase Auth
        await admin.auth().deleteUser(user.uid);
        console.log(`  ✅ Deleted Auth user: ${user.email}`);

        deleted++;
      } catch (error) {
        console.error(`  ❌ Failed to delete ${user.email}:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  - Successfully deleted: ${deleted}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Total processed: ${beanoUsers.length}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

deleteBeanoUsers();
