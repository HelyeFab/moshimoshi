const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

async function listAllUsers() {
  try {
    console.log('=== FETCHING ALL USERS ===\n');

    const allUsers = [];
    let nextPageToken;

    // List all users with pagination
    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

      allUsers.push(...listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;

    } while (nextPageToken);

    console.log(`Found ${allUsers.length} total users\n`);
    console.log('━'.repeat(80));
    console.log('USER LIST');
    console.log('━'.repeat(80));
    console.log();

    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email || 'No email'}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Email Verified: ${user.emailVerified}`);
      console.log(`   Created: ${user.metadata.creationTime}`);
      console.log(`   Last Sign In: ${user.metadata.lastSignInTime || 'Never'}`);
      console.log(`   Provider: ${user.providerData.map(p => p.providerId).join(', ')}`);
      console.log(`   Disabled: ${user.disabled}`);
      console.log();
    });

    console.log('━'.repeat(80));
    console.log('SUMMARY');
    console.log('━'.repeat(80));
    console.log(`Total users: ${allUsers.length}`);
    console.log(`Email verified: ${allUsers.filter(u => u.emailVerified).length}`);
    console.log(`Disabled: ${allUsers.filter(u => u.disabled).length}`);

    // Group by provider
    const providerCounts = {};
    allUsers.forEach(user => {
      user.providerData.forEach(provider => {
        providerCounts[provider.providerId] = (providerCounts[provider.providerId] || 0) + 1;
      });
    });

    console.log('\nProviders:');
    Object.entries(providerCounts).forEach(([provider, count]) => {
      console.log(`  ${provider}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

listAllUsers();
