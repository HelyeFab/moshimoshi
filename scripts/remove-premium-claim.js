const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function removePremiumClaim() {
  try {
    const userRecord = await admin.auth().getUser(userId);
    const { premium, ...otherClaims } = userRecord.customClaims || {};

    await admin.auth().setCustomUserClaims(userId, otherClaims);

    console.log('✅ Removed premium claim');
    const updated = await admin.auth().getUser(userId);
    console.log('Claims now:', updated.customClaims);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

removePremiumClaim();
