# 🔥 Streak System Implementation Guide

## 1. Overview

The streak system tracks how many **consecutive calendar days** a user
has completed at least one review session.

-   **Free users** → streak is stored locally (`zustand` +
    `localStorage/IndexedDB`).
-   **Premium users** → streak is mirrored to Firestore for cross-device
    sync.

------------------------------------------------------------------------

## 2. Core Store (`streakStore.ts`)

``` ts
// src/stores/streakStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'

interface StreakState {
  currentStreak: number
  longestStreak: number
  lastActiveDay: string | null
  incrementStreak: () => void
  resetStreak: () => void
  loadFromSession: (timestamp: number) => void
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDay: null,

      loadFromSession: (timestamp: number) => {
        const today = dayjs(timestamp).format('YYYY-MM-DD')
        const { lastActiveDay, currentStreak, longestStreak } = get()

        if (!lastActiveDay) {
          set({
            currentStreak: 1,
            longestStreak: 1,
            lastActiveDay: today,
          })
          return
        }

        if (today === lastActiveDay) {
          return // Already counted for today
        }

        if (dayjs(today).diff(dayjs(lastActiveDay), 'day') === 1) {
          const newStreak = currentStreak + 1
          set({
            currentStreak: newStreak,
            longestStreak: Math.max(longestStreak, newStreak),
            lastActiveDay: today,
          })
        } else {
          set({
            currentStreak: 1,
            longestStreak: Math.max(longestStreak, 1),
            lastActiveDay: today,
          })
        }
      },

      resetStreak: () =>
        set({
          currentStreak: 0,
          lastActiveDay: null,
        }),

      incrementStreak: () => {
        const { currentStreak, longestStreak } = get()
        const newStreak = currentStreak + 1
        set({
          currentStreak: newStreak,
          longestStreak: Math.max(longestStreak, newStreak),
        })
      },
    }),
    {
      name: 'streak-storage',
    }
  )
)
```

------------------------------------------------------------------------

## 3. Firestore Sync (`streakSync.ts`)

``` ts
// src/lib/sync/streakSync.ts
import { useStreakStore } from '@/stores/streakStore'
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth } from '@/lib/firebase'

const db = getFirestore()

export async function pushStreakToFirestore() {
  const user = auth.currentUser
  if (!user) return

  const { currentStreak, longestStreak, lastActiveDay } = useStreakStore.getState()

  await setDoc(
    doc(db, 'users', user.uid, 'progress', 'streak'),
    {
      currentStreak,
      longestStreak,
      lastActiveDay,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export function subscribeToStreakFromFirestore() {
  const user = auth.currentUser
  if (!user) return

  const streakDoc = doc(db, 'users', user.uid, 'progress', 'streak')

  return onSnapshot(streakDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data()
      const { currentStreak, longestStreak, lastActiveDay } = data

      useStreakStore.setState({
        currentStreak,
        longestStreak,
        lastActiveDay,
      })
    }
  })
}
```

------------------------------------------------------------------------

## 4. Hooking into Review Flow

Inside `reviewSessionFlow.ts` (or equivalent session completion
handler):

``` ts
import { useStreakStore } from '@/stores/streakStore'
import { pushStreakToFirestore } from '@/lib/sync/streakSync'

export async function completeReviewSession(session: Session) {
  // 1. Save session results
  await saveSessionLog(session)

  // 2. Update streak
  useStreakStore.getState().loadFromSession(Date.now())

  // 3. Push to Firestore (premium only)
  await pushStreakToFirestore()
}
```

On app load (for premium users after login):

``` ts
import { subscribeToStreakFromFirestore } from '@/lib/sync/streakSync'

useEffect(() => {
  const unsub = subscribeToStreakFromFirestore()
  return () => unsub && unsub()
}, [])
```

------------------------------------------------------------------------

## 5. Dependencies Checklist

-   ✅ `zustand` + `zustand/middleware`
-   ✅ `dayjs`
-   ✅ `firebase/firestore`
-   ✅ Auth setup (`auth.currentUser`)
-   ⚠️ Ensure `auth` and `db` are correctly exported in
    `lib/firebase.ts`

------------------------------------------------------------------------

## 6. Error Handling / Edge Cases

-   **First session ever** → streak starts at 1.
-   **Multiple sessions same day** → streak does not increment again.
-   **Skipped days** → streak resets to 1.
-   **Offline usage (free)** → persists locally.
-   **Premium user offline** → local streak will push to Firestore once
    online.

------------------------------------------------------------------------

## 7. Agent Tasks

When verifying this feature, an AI agent should:

1.  **Check Store**
    -   Confirm `streakStore.ts` exists and exports `useStreakStore`.
    -   Ensure `loadFromSession`, `resetStreak`, and `incrementStreak`
        work as intended.
2.  **Check Sync Layer**
    -   Confirm `streakSync.ts` has both `pushStreakToFirestore` and
        `subscribeToStreakFromFirestore`.
    -   Verify Firestore paths match the project convention
        (`users/{uid}/progress/streak`).
3.  **Check Integration**
    -   Verify `completeReviewSession()` calls both
        `loadFromSession(Date.now())` and `pushStreakToFirestore()`.
    -   Ensure subscription is initialized after login for premium
        users.
4.  **Check Dependencies**
    -   Ensure `dayjs`, `zustand`, and `firebase` packages are
        installed.
    -   Verify TypeScript types are available
        (`npm i -D @types/zustand @types/dayjs` if needed).
5.  **Fix Issues if Found**
    -   Amend Firestore imports if mismatched (`firebase/firestore` vs
        `firebase/firestore/lite`).
    -   Patch incorrect Firestore paths.
    -   Add missing imports (`auth`, `db`).
    -   Ensure `serverTimestamp()` is used for conflict resolution.
6.  **Enhancements to Suggest**
    -   Add **grace days** (optional setting).
    -   Add **UI animations** (confetti, flame) on streak increment.
    -   Add **unit tests** for streak transitions.
