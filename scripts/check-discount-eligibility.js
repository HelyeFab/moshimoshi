const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDiscount() {
  const email = process.argv[2] || 'emmanuelfabiani@yahoo.com';

  console.log('Checking discount eligibility for:', email);
  console.log('');

  // First find the user by email
  const usersSnapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.log('❌ No user found with email', email);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const uid = userDoc.id;
  const userData = userDoc.data();

  console.log('=== USER INFO ===');
  console.log('UID:', uid);
  console.log('Email:', userData.email);
  console.log('');

  // Check waitlist
  const waitlistSnapshot = await db.collection('waitlist')
    .where('email', '==', email)
    .limit(1)
    .get();

  console.log('=== WAITLIST ===');
  if (waitlistSnapshot.empty) {
    console.log('❌ Not on waitlist');
  } else {
    const waitlistData = waitlistSnapshot.docs[0].data();
    console.log('✅ On waitlist');
    console.log('   linkedUid:', waitlistData.linkedUid || 'null');
    console.log('   discountGranted:', waitlistData.discountGranted || false);
  }
  console.log('');

  // Check discount eligibility
  const discountRef = db.collection('stripe').doc('discounts').collection('users').doc(uid);
  const discountDoc = await discountRef.get();

  console.log('=== DISCOUNT ELIGIBILITY ===');
  console.log('Path: stripe/discounts/users/' + uid);
  if (!discountDoc.exists) {
    console.log('❌ No discount document found');
  } else {
    const data = discountDoc.data();
    console.log('✅ Discount document exists');
    console.log('   eligible:', data.eligible);
    console.log('   promotionCodeId:', data.promotionCodeId);
    console.log('   source:', data.source);
    console.log('   redeemed:', data.redeemed);
    console.log('   redeemedAt:', data.redeemedAt ? data.redeemedAt.toDate() : 'null');

    if (data.eligible && !data.redeemed) {
      console.log('');
      console.log('✅ READY FOR CHECKOUT - 25% discount will be auto-applied');
    } else if (data.redeemed) {
      console.log('');
      console.log('⚠️  Discount already redeemed - will NOT be applied again');
    }
  }
}

checkDiscount().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
