const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function setPremiumClaim() {
  try {
    // Get current claims
    const userRecord = await admin.auth().getUser(userId);
    console.log('Current claims:', userRecord.customClaims);

    // Set premium claim
    await admin.auth().setCustomUserClaims(userId, {
      ...userRecord.customClaims,
      premium: true
    });

    console.log('✅ Set premium: true custom claim');

    // Verify
    const updated = await admin.auth().getUser(userId);
    console.log('Updated claims:', updated.customClaims);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

setPremiumClaim();
