const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();

// January 2026 signups
const SIGNUP_START = new Date('2026-01-01T00:00:00.000Z');
const SIGNUP_END = new Date('2026-02-01T00:00:00.000Z');
const MIN_RETURN_GAP_MS = 86400000; // 24 hours (1 day)

async function checkRetention() {
  console.log('='.repeat(80));
  console.log('🔄 JANUARY 2026 USER RETENTION ANALYSIS');
  console.log('='.repeat(80));
  console.log('Signup period: Jan 1 - Jan 31, 2026');
  console.log('Return threshold: 24 hours after signup\n');

  const usersSnapshot = await db.collection('users')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(SIGNUP_START))
    .where('createdAt', '<', admin.firestore.Timestamp.fromDate(SIGNUP_END))
    .orderBy('createdAt', 'asc')
    .get();

  console.log('📊 Total January signups: ' + usersSnapshot.size + '\n');

  const returning = [];
  const notReturned = [];

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.();
    const lastActive = data.lastActive?.toDate?.();

    const gap = lastActive && createdAt ? lastActive - createdAt : 0;
    const gapDays = gap / 86400000;

    const user = {
      email: data.email || 'Unknown',
      displayName: data.displayName || 'Unknown',
      createdAt,
      lastActive,
      gapDays: gapDays.toFixed(1),
      plan: data.subscription?.plan || 'free'
    };

    if (gap >= MIN_RETURN_GAP_MS) {
      returning.push(user);
    } else {
      notReturned.push(user);
    }
  }

  // Sort returning users by gap (most engaged first)
  returning.sort((a, b) => parseFloat(b.gapDays) - parseFloat(a.gapDays));

  console.log('='.repeat(80));
  console.log('✅ RETURNING USERS (' + returning.length + '/' + usersSnapshot.size + ') - Active 24h+ after signup');
  console.log('='.repeat(80));

  returning.forEach((u, i) => {
    const created = u.createdAt.toISOString().split('T')[0];
    const lastSeen = u.lastActive.toISOString().split('T')[0];
    console.log((i+1) + '. ' + u.displayName + ' (' + u.email + ')');
    console.log('   Signed up: ' + created + ' | Last seen: ' + lastSeen + ' | Gap: ' + u.gapDays + ' days | Plan: ' + u.plan);
  });

  console.log('\n' + '='.repeat(80));
  console.log('❌ NOT RETURNED (' + notReturned.length + '/' + usersSnapshot.size + ') - Only active on signup day');
  console.log('='.repeat(80));

  notReturned.forEach((u, i) => {
    const created = u.createdAt.toISOString().split('T')[0];
    console.log((i+1) + '. ' + u.displayName + ' (' + u.email + ') - Signed up: ' + created);
  });

  // Summary
  const retentionRate = ((returning.length / usersSnapshot.size) * 100).toFixed(1);
  console.log('\n' + '='.repeat(80));
  console.log('📈 RETENTION SUMMARY');
  console.log('='.repeat(80));
  console.log('Total January signups:  ' + usersSnapshot.size);
  console.log('Returned (24h+):        ' + returning.length + ' (' + retentionRate + '%)');
  console.log('Not returned:           ' + notReturned.length + ' (' + (100 - retentionRate).toFixed(1) + '%)');

  // Premium conversion
  const premiumReturning = returning.filter(u => u.plan !== 'free').length;
  const premiumNotReturned = notReturned.filter(u => u.plan !== 'free').length;
  console.log('\nPremium among returning: ' + premiumReturning);
  console.log('Premium among not returned: ' + premiumNotReturned);

  process.exit(0);
}

checkRetention().catch(e => { console.error(e); process.exit(1); });
