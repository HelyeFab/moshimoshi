// Firebase Security Rules for Progress Collections
// Add these rules to your existing firestore.rules file

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User progress collections
    match /users/{userId}/progress/{script} {
      // Users can only read/write their own progress
      allow read: if request.auth != null && request.auth.uid == userId;

      // Write is allowed if:
      // 1. User is authenticated and matches the userId
      // 2. The document userId field matches the authenticated user
      // 3. The script field is valid (hiragana, katakana, kanji, etc.)
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.userId == userId
        && request.resource.data.script in ['hiragana', 'katakana', 'kanji', 'vocabulary', 'grammar', 'particles'];

      // Prevent deletion of progress documents
      allow delete: if false;
    }

    // Alternative structure if using subcollections
    match /userProgress/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Parent document should not be written directly

      match /{script}/{document} {
        allow read: if request.auth != null && request.auth.uid == userId;

        allow create, update: if request.auth != null
          && request.auth.uid == userId
          && request.resource.data.userId == userId;

        allow delete: if false; // Prevent accidental deletion
      }
    }
  }
}

// Additional validation rules for progress documents
function isValidProgress(data) {
  return data.keys().hasAll(['userId', 'script', 'characters', 'updatedAt'])
    && data.userId is string
    && data.script is string
    && data.characters is map
    && data.updatedAt is timestamp;
}

// Premium user check (if you want to restrict certain features)
function isPremiumUser() {
  return request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscription.plan in ['premium_monthly', 'premium_yearly']
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscription.status == 'active';
}