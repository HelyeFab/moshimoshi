const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require(path.join(process.cwd(), 'moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const auth = admin.auth();
const firestore = admin.firestore();

async function createUserDan() {
  try {
    console.log('Creating Firebase Auth user...');

    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email: 'dan@beano.com',
      emailVerified: true,
      password: 'Beano200419!',
      displayName: 'Dan',
      disabled: false
    });

    console.log('✅ Firebase Auth user created:', userRecord.uid);

    // Create the Firestore user document with complete schema
    const userDoc = {
      // Core fields
      profileVersion: 1,
      locale: 'en',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),

      // Identity
      email: 'dan@beano.com',
      emailVerified: true,

      // Profile
      profile: {
        displayName: 'Dan',
        avatarUrl: null
      },

      // Subscription - free tier
      subscription: {
        plan: 'free',
        status: 'active',
        metadata: {
          source: 'auth',
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }
      },

      // Default preferences
      preferences: {
        language: 'en',
        theme: 'dark',
        dailyGoalMinutes: 10,
        notifications: {
          email: true,
          push: false
        }
      },

      // User state
      userState: 'active',

      // Study preferences (extended)
      preferredLanguage: 'en',
      studyGoal: 'casual',
      studyTime: '30min',

      // Notifications (detailed)
      notifications: {
        email: true,
        push: false,
        studyReminders: true,
        weeklyProgress: true
      },

      // Privacy settings
      privacy: {
        profileVisible: false,
        progressVisible: false
      },

      // Stats
      stats: {
        totalStudyTime: 0,
        lessonsCompleted: 0,
        streakDays: 0,
        lastStudyDate: null
      },

      // Timestamps
      lastActiveAt: admin.firestore.Timestamp.now()
    };

    console.log('Creating Firestore user document...');
    await firestore.collection('users').doc(userRecord.uid).set(userDoc);

    console.log('✅ Firestore user document created');
    console.log('\n=== User Created Successfully ===');
    console.log('UID:', userRecord.uid);
    console.log('Email:', 'dan@beano.com');
    console.log('Display Name:', 'Dan');
    console.log('Email Verified:', true);
    console.log('Tier:', 'free');
    console.log('Password:', 'Beano200419!');
    console.log('================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user:', error);

    // If user already exists, try to get their info
    if (error.code === 'auth/email-already-exists') {
      console.log('\n⚠️  User with this email already exists. Fetching existing user...');
      try {
        const existingUser = await auth.getUserByEmail('dan@beano.com');
        console.log('Existing user UID:', existingUser.uid);
      } catch (fetchError) {
        console.error('Error fetching existing user:', fetchError);
      }
    }

    process.exit(1);
  }
}

createUserDan();
