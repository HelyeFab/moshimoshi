const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkUser() {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('❌ USER DOCUMENT DOES NOT EXIST');
      return;
    }

    const userData = userDoc.data();
    console.log('✅ User document exists');
    console.log('\n📋 Subscription data:');
    console.log(JSON.stringify(userData.subscription, null, 2));

    console.log('\n🔍 Subscription check:');
    if (userData.subscription) {
      console.log('  ✅ subscription field exists');
      console.log('  Status:', userData.subscription.status);
      console.log('  Plan:', userData.subscription.plan);

      // Check what the rules are looking for
      const isActive = userData.subscription.status === 'active';
      const isPremiumMonthly = userData.subscription.plan === 'premium_monthly';
      const isPremiumYearly = userData.subscription.plan === 'premium_yearly';

      console.log('\n🎯 Rule validation:');
      console.log('  status === "active":', isActive);
      console.log('  plan === "premium_monthly":', isPremiumMonthly);
      console.log('  plan === "premium_yearly":', isPremiumYearly);
      console.log('  SHOULD PASS:', isActive && (isPremiumMonthly || isPremiumYearly));
    } else {
      console.log('  ❌ subscription field DOES NOT EXIST');
    }

    // Check auth custom claims
    const userRecord = await admin.auth().getUser(userId);
    console.log('\n🔐 Auth custom claims:');
    console.log(JSON.stringify(userRecord.customClaims || {}, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkUser();
