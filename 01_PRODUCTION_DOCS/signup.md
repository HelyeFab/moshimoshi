SIGNUP (/auth/signup)
    ↓
  SIGNIN (/auth/signin) ← redirect after signup
    ↓
  [First-time check]
    ↓
  ONBOARDING FLOW (/onboarding/*) ← Only if not completed
    1. Welcome
    2. Learning Goal (JLPT/Travel/Anime/Conversation)
    3. Experience Level (Beginner/Intermediate/Advanced)
    4. Feature Showcase
    5. Ready to Go → Saves to Firestore
    ↓
  INTRO TUTORIAL (/intro) ← 5 interactive panels
    ↓
  DASHBOARD (/dashboard) ← Main app interface
    • Learning Village
    • Gamification (XP, Streak)
    • Navigation to all features
