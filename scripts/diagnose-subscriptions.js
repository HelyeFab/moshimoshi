#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function diagnoseSubscriptions() {
  console.log('🔍 Diagnosing subscription data storage...\n');

  // Get all users
  const usersSnapshot = await db.collection('users').get();
  console.log(`📊 Total users: ${usersSnapshot.size}\n`);

  // Sample fields from users
  const subscriptionFields = new Set();
  const usersWithSubscriptionData = [];

  usersSnapshot.forEach(doc => {
    const userData = doc.data();

    // Collect all subscription-related fields
    Object.keys(userData).forEach(key => {
      if (key.toLowerCase().includes('subscr') ||
          key.toLowerCase().includes('tier') ||
          key.toLowerCase().includes('stripe') ||
          key.toLowerCase().includes('premium') ||
          key.toLowerCase().includes('plan')) {
        subscriptionFields.add(key);
      }
    });

    // Check if user has any subscription indicators
    const hasSubscriptionData =
      userData.tier ||
      userData.subscription ||
      userData.subscriptionStatus ||
      userData.stripeSubscriptionId ||
      userData.stripeCustomerId ||
      userData.premiumUntil;

    if (hasSubscriptionData) {
      usersWithSubscriptionData.push({
        id: doc.id,
        email: userData.email,
        tier: userData.tier,
        subscription: userData.subscription,
        subscriptionStatus: userData.subscriptionStatus,
        stripeSubscriptionId: userData.stripeSubscriptionId,
        stripeCustomerId: userData.stripeCustomerId,
        premiumUntil: userData.premiumUntil,
      });
    }
  });

  console.log('📋 Subscription-related fields found in users collection:');
  console.log(Array.from(subscriptionFields).sort().join(', '));
  console.log();

  console.log(`👥 Users with subscription data: ${usersWithSubscriptionData.length}`);
  if (usersWithSubscriptionData.length > 0) {
    console.log('\n🔎 Users with subscription indicators:');
    usersWithSubscriptionData.forEach((user, index) => {
      console.log(`\n${index + 1}. User: ${user.email || user.id}`);
      console.log(`   tier: ${user.tier || 'undefined'}`);
      console.log(`   subscription: ${JSON.stringify(user.subscription) || 'undefined'}`);
      console.log(`   subscriptionStatus: ${user.subscriptionStatus || 'undefined'}`);
      console.log(`   stripeSubscriptionId: ${user.stripeSubscriptionId || 'undefined'}`);
      console.log(`   stripeCustomerId: ${user.stripeCustomerId || 'undefined'}`);
      console.log(`   premiumUntil: ${user.premiumUntil || 'undefined'}`);
    });
  }

  // Check subscriptions collection
  console.log('\n\n📦 Checking subscriptions collection...');
  const subscriptionsSnapshot = await db.collection('subscriptions').get();
  console.log(`   Documents in subscriptions collection: ${subscriptionsSnapshot.size}`);

  if (subscriptionsSnapshot.size > 0) {
    console.log('\n🔎 Sample subscription documents:');
    subscriptionsSnapshot.docs.slice(0, 5).forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. ID: ${doc.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   User: ${data.userId}`);
      console.log(`   Tier/Plan: ${data.tier || data.plan}`);
      console.log(`   Stripe ID: ${data.stripeSubscriptionId}`);
    });
  }

  // Check for subscriptions sub-collection under users
  console.log('\n\n📦 Checking for subscriptions sub-collection under users...');
  let foundSubCollections = 0;

  // Sample first 10 users to check for sub-collections
  const sampleUsers = usersSnapshot.docs.slice(0, 10);
  for (const userDoc of sampleUsers) {
    const subCollections = await userDoc.ref.listCollections();
    const hasSubscriptions = subCollections.some(col => col.id === 'subscriptions');
    if (hasSubscriptions) {
      foundSubCollections++;
      const subSnapshot = await userDoc.ref.collection('subscriptions').get();
      console.log(`   User ${userDoc.id} has subscriptions sub-collection with ${subSnapshot.size} documents`);
    }
  }

  if (foundSubCollections === 0) {
    console.log('   No subscriptions sub-collection found in sampled users');
  }

  // Check Stripe customers collection (common pattern)
  console.log('\n\n📦 Checking customers collection (Stripe pattern)...');
  try {
    const customersSnapshot = await db.collection('customers').limit(5).get();
    console.log(`   Documents in customers collection: ${customersSnapshot.size}`);

    if (customersSnapshot.size > 0) {
      console.log('\n🔎 Sample customer documents:');
      for (const doc of customersSnapshot.docs) {
        const data = doc.data();
        console.log(`\n   Customer ID: ${doc.id}`);
        console.log(`   Stripe Customer: ${data.stripeId || data.customerId}`);

        // Check for subscriptions sub-collection
        const subsSnapshot = await doc.ref.collection('subscriptions').get();
        if (subsSnapshot.size > 0) {
          console.log(`   ✅ Has ${subsSnapshot.size} subscription(s):`);
          subsSnapshot.forEach(subDoc => {
            const subData = subDoc.data();
            console.log(`      - Status: ${subData.status}, Plan: ${subData.items?.[0]?.price?.id || subData.plan}`);
          });
        }
      }
    }
  } catch (err) {
    console.log('   customers collection does not exist or error:', err.message);
  }

  console.log('\n✅ Diagnosis complete!');
  process.exit(0);
}

diagnoseSubscriptions().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
