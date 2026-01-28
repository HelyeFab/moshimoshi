#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function countPremiumUsers() {
  console.log('🔍 Counting premium users...\n');

  const usersSnapshot = await db.collection('users').get();

  let premiumMonthly = 0;
  let premiumYearly = 0;
  let freeUsers = 0;

  const premiumUsersList = [];

  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    const plan = userData.subscription?.plan;

    if (plan === 'premium_monthly') {
      premiumMonthly++;
      premiumUsersList.push({
        email: userData.email,
        plan: 'premium_monthly',
        status: userData.subscription?.status,
        stripeId: userData.subscription?.stripeSubscriptionId
      });
    } else if (plan === 'premium_yearly') {
      premiumYearly++;
      premiumUsersList.push({
        email: userData.email,
        plan: 'premium_yearly',
        status: userData.subscription?.status,
        stripeId: userData.subscription?.stripeSubscriptionId
      });
    } else {
      freeUsers++;
    }
  });

  console.log('📊 Results:');
  console.log(`   Premium Monthly: ${premiumMonthly}`);
  console.log(`   Premium Yearly: ${premiumYearly}`);
  console.log(`   Total Premium: ${premiumMonthly + premiumYearly}`);
  console.log(`   Free Users: ${freeUsers}`);
  console.log(`   Total Users: ${usersSnapshot.size}\n`);

  if (premiumUsersList.length > 0) {
    console.log('👥 Premium users:');
    premiumUsersList.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - ${user.plan} (${user.status}) - ${user.stripeId}`);
    });
  }

  // Calculate MRR
  const MONTHLY_AMOUNT = 8.99;
  const MONTHLY_EQUIVALENT_FROM_YEARLY = 8.33; // 99.99/12
  const monthlyRevenue = (premiumMonthly * MONTHLY_AMOUNT) + (premiumYearly * MONTHLY_EQUIVALENT_FROM_YEARLY);

  console.log(`\n💰 Monthly Recurring Revenue: £${monthlyRevenue.toFixed(2)}`);

  process.exit(0);
}

countPremiumUsers().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
