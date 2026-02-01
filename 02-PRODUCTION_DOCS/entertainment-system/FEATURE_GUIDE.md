# Entertainment System - Feature Implementation Guide

**Status:** ACTIVE
**Last Updated:** 2026-02-01

## Table of Contents

1. [Games System Implementation](#1-games-system-implementation)
2. [Gamification Core](#2-gamification-core)
3. [Achievements System](#3-achievements-system)
4. [Leaderboard System](#4-leaderboard-system)
5. [Review Hub](#5-review-hub)
6. [Integration Patterns](#6-integration-patterns)
7. [Advanced Topics](#7-advanced-topics)

---

## 1. Games System Implementation

### 1.1 Creating a New Game

#### Step 1: Create Game Directory

```bash
mkdir -p src/app/[locale]/games/my-new-game
touch src/app/[locale]/games/my-new-game/page.tsx
```

#### Step 2: Implement Game Component

```typescript
// src/app/[locale]/games/my-new-game/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'

interface GameState {
  score: number
  level: number
  isGameOver: boolean
  isPaused: boolean
}

export default function MyNewGame() {
  const { t, strings } = useI18n()
  const { user } = useAuth()
  const router = useRouter()

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    level: 1,
    isGameOver: false,
    isPaused: false
  })

  // Game logic
  const handleGameAction = (action: string) => {
    // Update game state based on action
    setGameState(prev => ({
      ...prev,
      score: prev.score + 10
    }))
  }

  const handleGameOver = async () => {
    setGameState(prev => ({ ...prev, isGameOver: true }))

    // Award XP via coordinator
    try {
      await fetch('/api/gamification/game-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: 'my-new-game',
          score: gameState.score,
          level: gameState.level
        })
      })
    } catch (error) {
      console.error('Failed to award XP:', error)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Game UI */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-xl">
          <div className="flex justify-between mb-6">
            <div>Score: {gameState.score}</div>
            <div>Level: {gameState.level}</div>
          </div>

          {/* Game canvas/area */}
          <div className="min-h-[400px] bg-gray-100 dark:bg-dark-900 rounded-xl">
            {/* Your game rendering logic */}
          </div>

          {/* Game controls */}
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg"
            >
              {gameState.isPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg"
            >
              Back
            </button>
          </div>
        </div>

        {/* Game Over Modal */}
        {gameState.isGameOver && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 max-w-md">
              <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
              <p className="text-lg mb-2">Final Score: {gameState.score}</p>
              <p className="text-lg mb-6">Level Reached: {gameState.level}</p>

              <div className="flex gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg"
                >
                  Play Again
                </button>
                <button
                  onClick={() => router.push('/games')}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg"
                >
                  Back to Games
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

#### Step 3: Add Game Card to Directory

```typescript
// src/app/[locale]/games/page.tsx

const games = [
  // ... existing games
  {
    id: 'my-new-game',
    title: strings.games?.myNewGame?.title || 'My New Game',
    description: strings.games?.myNewGame?.description || 'Game description',
    icon: '🎮',
    color: 'from-blue-400 to-indigo-600',
    available: true,
  },
]

const handlePlayGame = (gameId: string) => {
  // ... existing cases
  if (gameId === 'my-new-game') {
    router.push('/games/my-new-game')
  }
}
```

#### Step 4: Add i18n Strings

```typescript
// src/i18n/locales/en/strings.ts

export const strings = {
  // ... existing strings
  games: {
    // ... existing games
    myNewGame: {
      title: 'My New Game',
      description: 'An exciting new learning game',
      instructions: 'Click the correct answer to score points',
      gameOver: 'Game Over!',
      playAgain: 'Play Again',
    },
  },
}
```

---

### 1.2 Game State Management Pattern

#### Using useState for Simple Games

```typescript
interface SimpleGameState {
  currentQuestion: number
  correctAnswers: number
  timeRemaining: number
}

const [state, setState] = useState<SimpleGameState>({
  currentQuestion: 0,
  correctAnswers: 0,
  timeRemaining: 60
})

// Update pattern
const handleAnswer = (isCorrect: boolean) => {
  setState(prev => ({
    ...prev,
    correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
    currentQuestion: prev.currentQuestion + 1
  }))
}
```

#### Using useReducer for Complex Games

```typescript
interface ComplexGameState {
  entities: GameEntity[]
  player: PlayerState
  level: LevelState
  physics: PhysicsState
}

type GameAction =
  | { type: 'MOVE_PLAYER', payload: { x: number, y: number } }
  | { type: 'SPAWN_ENTITY', payload: GameEntity }
  | { type: 'COLLISION', payload: { entityId: string } }
  | { type: 'LEVEL_UP' }

const gameReducer = (state: ComplexGameState, action: GameAction): ComplexGameState => {
  switch (action.type) {
    case 'MOVE_PLAYER':
      return {
        ...state,
        player: {
          ...state.player,
          position: action.payload
        }
      }

    case 'SPAWN_ENTITY':
      return {
        ...state,
        entities: [...state.entities, action.payload]
      }

    case 'COLLISION':
      // Handle collision logic
      return {
        ...state,
        entities: state.entities.filter(e => e.id !== action.payload.entityId)
      }

    case 'LEVEL_UP':
      return {
        ...state,
        level: {
          ...state.level,
          current: state.level.current + 1,
          difficulty: state.level.difficulty * 1.2
        }
      }

    default:
      return state
  }
}

// Usage
const [gameState, dispatch] = useReducer(gameReducer, initialState)

dispatch({ type: 'MOVE_PLAYER', payload: { x: 100, y: 200 } })
```

---

### 1.3 Audio Integration

#### Setting Up Audio Manager

```typescript
// src/utils/GameAudioManager.ts

export class GameAudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map()
  private musicTrack: HTMLAudioElement | null = null
  private isMuted: boolean = false
  private volume: number = 1.0

  constructor() {
    if (typeof window !== 'undefined') {
      // Check localStorage for saved preferences
      const savedMute = localStorage.getItem('game_audio_muted')
      this.isMuted = savedMute === 'true'

      const savedVolume = localStorage.getItem('game_audio_volume')
      this.volume = savedVolume ? parseFloat(savedVolume) : 1.0
    }
  }

  preloadSound(id: string, url: string): void {
    if (this.sounds.has(id)) return

    const audio = new Audio(url)
    audio.volume = this.volume
    audio.muted = this.isMuted

    this.sounds.set(id, audio)
  }

  playSound(id: string): void {
    const sound = this.sounds.get(id)
    if (!sound) {
      console.warn(`Sound ${id} not found`)
      return
    }

    sound.currentTime = 0
    sound.play().catch(err => {
      console.warn('Audio play failed:', err)
    })
  }

  playMusic(url: string, loop: boolean = true): void {
    if (this.musicTrack) {
      this.musicTrack.pause()
    }

    this.musicTrack = new Audio(url)
    this.musicTrack.volume = this.volume * 0.5 // Music quieter than SFX
    this.musicTrack.loop = loop
    this.musicTrack.muted = this.isMuted

    this.musicTrack.play().catch(err => {
      console.warn('Music play failed:', err)
    })
  }

  stopMusic(): void {
    if (this.musicTrack) {
      this.musicTrack.pause()
      this.musicTrack.currentTime = 0
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    localStorage.setItem('game_audio_volume', this.volume.toString())

    // Update all active sounds
    this.sounds.forEach(sound => {
      sound.volume = this.volume
    })

    if (this.musicTrack) {
      this.musicTrack.volume = this.volume * 0.5
    }
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted
    localStorage.setItem('game_audio_muted', this.isMuted.toString())

    this.sounds.forEach(sound => {
      sound.muted = this.isMuted
    })

    if (this.musicTrack) {
      this.musicTrack.muted = this.isMuted
    }
  }

  cleanup(): void {
    this.stopMusic()
    this.sounds.clear()
  }
}

// Usage in game component
const audioManager = useMemo(() => new GameAudioManager(), [])

useEffect(() => {
  // Preload sounds
  audioManager.preloadSound('correct', '/sounds/correct.mp3')
  audioManager.preloadSound('wrong', '/sounds/wrong.mp3')
  audioManager.preloadSound('levelup', '/sounds/levelup.mp3')

  return () => {
    audioManager.cleanup()
  }
}, [audioManager])

// Play sounds on events
const handleCorrectAnswer = () => {
  audioManager.playSound('correct')
  // ... rest of logic
}
```

---

### 1.4 Canvas-Based Game Example

```typescript
// src/app/[locale]/games/canvas-game/page.tsx

export default function CanvasGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 800
    canvas.height = 600

    // Game state
    let player = { x: 400, y: 300, radius: 20 }
    let entities: Array<{ x: number, y: number, radius: number }> = []

    // Game loop
    const gameLoop = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw player
      ctx.beginPath()
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2)
      ctx.fillStyle = '#3b82f6'
      ctx.fill()
      ctx.closePath()

      // Draw entities
      entities.forEach(entity => {
        ctx.beginPath()
        ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2)
        ctx.fillStyle = '#ef4444'
        ctx.fill()
        ctx.closePath()

        // Update entity position
        entity.y += 2
      })

      // Remove off-screen entities
      entities = entities.filter(e => e.y < canvas.height + e.radius)

      // Spawn new entities randomly
      if (Math.random() < 0.02) {
        entities.push({
          x: Math.random() * canvas.width,
          y: -20,
          radius: 15
        })
      }

      animationRef.current = requestAnimationFrame(gameLoop)
    }

    // Start game loop
    gameLoop()

    // Mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      player.x = e.clientX - rect.left
      player.y = e.clientY - rect.top
    }

    canvas.addEventListener('mousemove', handleMouseMove)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      canvas.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <canvas
        ref={canvasRef}
        className="border-4 border-gray-800 rounded-lg shadow-2xl"
      />
    </div>
  )
}
```

---

## 2. Gamification Core

### 2.1 Awarding XP from Any Component

#### Client-Side Pattern (Optimistic)

```typescript
// In any component
import { useGamificationStore } from '@/state/userGamification'

export function MyLearningComponent() {
  const { awardXP, incrementSessionCount } = useGamificationStore()

  const handleActivityComplete = async () => {
    // Optimistic update (instant UI feedback)
    awardXP(50)
    incrementSessionCount()

    // Server-side verification and persistence
    try {
      await fetch('/api/gamification/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: 'custom_activity',
          score: 100,
          accuracy: 95
        })
      })
    } catch (error) {
      console.error('Failed to sync XP:', error)
      // Rollback handled by Zustand store
    }
  }

  return (
    <button onClick={handleActivityComplete}>
      Complete Activity
    </button>
  )
}
```

#### Server-Side Pattern (Authoritative)

```typescript
// src/app/api/gamification/activity/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { coordinator } from '@/lib/gamification/services/gamification-coordinator'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { activityType, score, accuracy } = await request.json()

  try {
    const result = await coordinator.processCustomActivity({
      userId: session.uid,
      activityType,
      score,
      accuracy,
      timestamp: new Date()
    })

    return NextResponse.json({
      success: true,
      xpAwarded: result.xpAwarded,
      newTotalXP: result.newTotalXP,
      levelUp: result.levelUp,
      newLevel: result.newLevel,
      achievementsUnlocked: result.achievementsUnlocked
    })
  } catch (error) {
    console.error('Gamification error:', error)
    return NextResponse.json({
      error: 'Failed to process activity'
    }, { status: 500 })
  }
}
```

---

### 2.2 Custom XP Calculation

#### Create Custom XP Calculator

```typescript
// src/lib/gamification/calculators/customActivityXP.ts

interface CustomActivityData {
  itemsCompleted: number
  timeSpent: number // seconds
  difficulty: 'easy' | 'medium' | 'hard'
  accuracy: number // 0-100
  bonusMultiplier?: number
}

export function calculateCustomActivityXP(data: CustomActivityData): number {
  // Base XP per item
  const baseXPPerItem = {
    easy: 5,
    medium: 10,
    hard: 15
  }[data.difficulty]

  let totalXP = data.itemsCompleted * baseXPPerItem

  // Accuracy bonus (10% bonus at 90%+, 20% at 95%+, 30% at 100%)
  if (data.accuracy >= 100) {
    totalXP *= 1.3
  } else if (data.accuracy >= 95) {
    totalXP *= 1.2
  } else if (data.accuracy >= 90) {
    totalXP *= 1.1
  }

  // Speed bonus (completed in under 5 minutes = 10% bonus)
  if (data.timeSpent < 300) {
    totalXP *= 1.1
  }

  // Apply custom multiplier if present
  if (data.bonusMultiplier) {
    totalXP *= data.bonusMultiplier
  }

  // Cap at reasonable maximum
  return Math.min(Math.floor(totalXP), 500)
}

// Usage in coordinator
import { calculateCustomActivityXP } from './calculators/customActivityXP'

const xpToAward = calculateCustomActivityXP({
  itemsCompleted: 20,
  timeSpent: 240,
  difficulty: 'hard',
  accuracy: 95,
  bonusMultiplier: 1.5
})
```

---

### 2.3 Streak Management

#### Check Current Streak

```typescript
import { useGamificationStore } from '@/state/userGamification'

export function StreakDisplay() {
  const { currentStreak, bestStreak, lastActivityDate } = useGamificationStore()

  // Validate streak freshness
  const isStreakFresh = useMemo(() => {
    if (!lastActivityDate) return false

    const lastActivity = new Date(lastActivityDate)
    const now = new Date()
    const hoursSince = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)

    return hoursSince < 24
  }, [lastActivityDate])

  return (
    <div className="flex items-center gap-4">
      <div>
        <div className="text-sm text-gray-500">Current Streak</div>
        <div className="text-2xl font-bold text-primary-500">
          {isStreakFresh ? currentStreak : 0} days
          {!isStreakFresh && currentStreak > 0 && (
            <span className="text-xs text-red-500 ml-2">(Broken)</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-sm text-gray-500">Best Streak</div>
        <div className="text-2xl font-bold text-yellow-500">
          {bestStreak} days
        </div>
      </div>
    </div>
  )
}
```

#### Update Streak on Activity

```typescript
// Server-side in coordinator
import { updateStreak } from '@/lib/gamification/services/streakService'

async function processActivity(userId: string, activityData: any) {
  try {
    // Update streak (if eligible)
    const streakResult = await updateStreak(userId, {
      minXPThreshold: 10, // Minimum XP to count for streak
      activityDate: new Date()
    })

    if (streakResult.updated) {
      console.log(`Streak updated: ${streakResult.currentStreak} days`)
    }
  } catch (error) {
    console.warn('Streak update failed, continuing with XP award:', error)
    // Don't let streak failures block XP awards
  }

  // ... rest of XP processing
}
```

---

## 3. Achievements System

### 3.1 Defining New Achievements

#### Edit Configuration File

```json
// src/config/gamification/achievements.json

{
  "achievements": [
    {
      "id": "custom_milestone",
      "name": "Custom Milestone",
      "description": "Complete 100 custom activities",
      "icon": "🎯",
      "category": "progress",
      "points": 50,
      "rarity": "rare",
      "condition": {
        "type": "custom_activity_count",
        "operator": ">=",
        "value": 100
      },
      "hidden": false,
      "secret": false
    },
    {
      "id": "speed_demon",
      "name": "Speed Demon",
      "description": "Complete an activity in under 60 seconds",
      "icon": "⚡",
      "category": "speed",
      "points": 25,
      "rarity": "uncommon",
      "condition": {
        "type": "activity_time",
        "operator": "<=",
        "value": 60
      },
      "hidden": false,
      "secret": true
    }
  ]
}
```

#### Achievement Categories

| Category | Description | Example |
|----------|-------------|---------|
| `progress` | Milestone achievements | First session, 100 items reviewed |
| `streak` | Daily streak achievements | 7-day streak, 30-day streak |
| `accuracy` | Perfect performance | 10 perfect answers in a row |
| `speed` | Fast completion | Complete drill in <1 minute |
| `special` | Time-based or unique | Night owl (active at 2am) |

#### Rarity Levels

| Rarity | Color | Points Range | Example |
|--------|-------|--------------|---------|
| Common | Gray | 5-10 | First session |
| Uncommon | Green | 15-25 | 10 sessions completed |
| Rare | Blue | 30-50 | 7-day streak |
| Epic | Purple | 60-100 | 30-day streak |
| Legendary | Yellow | 150-200 | 100-day streak |
| Mythic | Custom | 250+ | Unique achievements |

---

### 3.2 Checking Achievements Programmatically

#### In Achievement Engine

```typescript
// src/lib/gamification/services/achievementEngine.ts

import achievementsConfig from '@/config/gamification/achievements.json'

interface AchievementCheckContext {
  userId: string
  eventType: string
  eventData: any
  userStats: {
    sessionCount: number
    totalXP: number
    currentStreak: number
    // ... other stats
  }
}

export async function checkAchievements(
  context: AchievementCheckContext
): Promise<string[]> {
  const unlockedAchievements: string[] = []

  for (const achievement of achievementsConfig.achievements) {
    // Skip already unlocked
    if (await isAchievementUnlocked(context.userId, achievement.id)) {
      continue
    }

    // Check condition
    const isUnlocked = evaluateCondition(achievement.condition, context)

    if (isUnlocked) {
      await unlockAchievement(context.userId, achievement.id)
      unlockedAchievements.push(achievement.id)
    }
  }

  return unlockedAchievements
}

function evaluateCondition(
  condition: any,
  context: AchievementCheckContext
): boolean {
  const { type, operator, value } = condition

  let actualValue: number = 0

  // Get actual value based on condition type
  switch (type) {
    case 'session_count':
      actualValue = context.userStats.sessionCount
      break
    case 'total_xp':
      actualValue = context.userStats.totalXP
      break
    case 'streak_count':
      actualValue = context.userStats.currentStreak
      break
    case 'activity_time':
      actualValue = context.eventData.timeSpent || 0
      break
    // Add more condition types as needed
    default:
      return false
  }

  // Evaluate operator
  switch (operator) {
    case '>=':
      return actualValue >= value
    case '<=':
      return actualValue <= value
    case '==':
      return actualValue === value
    default:
      return false
  }
}
```

---

### 3.3 Achievement Notification UI

```typescript
// src/components/gamification/AchievementNotification.tsx

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  rarity: string
}

interface Props {
  achievement: Achievement | null
  onDismiss: () => void
}

export function AchievementNotification({ achievement, onDismiss }: Props) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(onDismiss, 5000)
      return () => clearTimeout(timer)
    }
  }, [achievement, onDismiss])

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed top-20 right-4 z-50"
        >
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl shadow-2xl p-6 max-w-sm">
            <div className="flex items-start gap-4">
              <div className="text-5xl">{achievement.icon}</div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-white" />
                  <span className="text-sm font-semibold text-white uppercase">
                    Achievement Unlocked!
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {achievement.name}
                </h3>

                <p className="text-sm text-white/90">
                  {achievement.description}
                </p>

                <div className="mt-3">
                  <span className={`
                    inline-block px-3 py-1 rounded-full text-xs font-semibold
                    ${achievement.rarity === 'legendary' ? 'bg-yellow-200 text-yellow-900' :
                      achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-900' :
                      achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-900' :
                      'bg-gray-200 text-gray-900'}
                  `}>
                    {achievement.rarity.toUpperCase()}
                  </span>
                </div>
              </div>

              <button
                onClick={onDismiss}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Usage in parent component
const [notification, setNotification] = useState<Achievement | null>(null)

// Listen for achievement unlocks
useEffect(() => {
  const handleAchievement = (event: CustomEvent) => {
    setNotification(event.detail.achievement)
  }

  window.addEventListener('achievement-unlocked', handleAchievement)
  return () => window.removeEventListener('achievement-unlocked', handleAchievement)
}, [])

return (
  <>
    {/* Your app content */}
    <AchievementNotification
      achievement={notification}
      onDismiss={() => setNotification(null)}
    />
  </>
)
```

---

## 4. Leaderboard System

### 4.1 Fetching Leaderboard Data

```typescript
// src/hooks/useLeaderboard.ts

import { useState, useEffect } from 'react'
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/leaderboard/types'

export function useLeaderboard(page: number = 1, limit: number = 20) {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true)

        const response = await fetch(
          `/api/leaderboard?page=${page}&limit=${limit}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard')
        }

        const result = await response.json()
        setData(result)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [page, limit])

  return { data, loading, error }
}

// Usage in component
export function LeaderboardTable() {
  const { data, loading, error } = useLeaderboard(1, 50)

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!data) return null

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>XP</th>
          <th>Level</th>
          <th>Streak</th>
        </tr>
      </thead>
      <tbody>
        {data.entries.map(entry => (
          <tr key={entry.userId}>
            <td>#{entry.rank}</td>
            <td>{entry.displayName}</td>
            <td>{entry.totalXP.toLocaleString()}</td>
            <td>{entry.currentLevel}</td>
            <td>{entry.currentStreak} days</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

---

### 4.2 User Rank Display

```typescript
// src/components/leaderboard/UserRankCard.tsx

import { useState, useEffect } from 'react'
import { TrendingUp, Award } from 'lucide-react'

interface UserRank {
  rank: number
  totalXP: number
  currentLevel: number
  xpToNextLevel: number
  percentile: number
}

export function UserRankCard() {
  const [userRank, setUserRank] = useState<UserRank | null>(null)

  useEffect(() => {
    async function fetchUserRank() {
      const response = await fetch('/api/leaderboard/user-rank')
      const data = await response.json()
      setUserRank(data)
    }

    fetchUserRank()
  }, [])

  if (!userRank) return null

  return (
    <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm opacity-90">Your Rank</div>
          <div className="text-4xl font-bold">#{userRank.rank}</div>
        </div>

        <div className="bg-white/20 rounded-full p-4">
          <Award className="w-8 h-8" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm opacity-90">Total XP</div>
          <div className="text-2xl font-bold">
            {userRank.totalXP.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-sm opacity-90">Level</div>
          <div className="text-2xl font-bold">{userRank.currentLevel}</div>
        </div>
      </div>

      {/* Progress to next level */}
      <div className="bg-white/20 rounded-lg p-3">
        <div className="flex justify-between text-sm mb-2">
          <span>{userRank.xpToNextLevel} XP to next level</span>
          <span>Top {userRank.percentile}%</span>
        </div>

        <div className="bg-white/30 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{
              width: `${((userRank.totalXP % 1000) / 1000) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}
```

---

### 4.3 Privacy Controls

```typescript
// src/components/leaderboard/PrivacyToggle.tsx

import { useState } from 'react'
import { EyeOff, Eye } from 'lucide-react'

export function LeaderboardPrivacyToggle() {
  const [isOptedOut, setIsOptedOut] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/leaderboard/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optOut: !isOptedOut })
      })

      if (response.ok) {
        setIsOptedOut(!isOptedOut)
      }
    } catch (error) {
      console.error('Failed to update privacy settings:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-dark-800 rounded-lg">
      <div>
        <div className="font-medium">Leaderboard Visibility</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {isOptedOut
            ? 'Your profile is hidden from the leaderboard'
            : 'Your profile is visible on the leaderboard'
          }
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium
          ${isOptedOut
            ? 'bg-gray-300 text-gray-700'
            : 'bg-primary-500 text-white'
          }
          disabled:opacity-50
        `}
      >
        {isOptedOut ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {isOptedOut ? 'Hidden' : 'Visible'}
      </button>
    </div>
  )
}
```

---

## 5. Review Hub

### 5.1 Stats Overview Component

```typescript
// src/components/review/dashboard/CustomStatsWidget.tsx

import { useMemo } from 'react'
import { useReviewData } from '@/hooks/useReviewData'
import { Calendar, Target, TrendingUp, Award } from 'lucide-react'

export function ReviewStatsWidget() {
  const { reviewData, loading } = useReviewData()

  const stats = useMemo(() => {
    if (!reviewData) return null

    return {
      dueToday: reviewData.queue.filter(item =>
        new Date(item.nextReview) <= new Date()
      ).length,

      dueThisWeek: reviewData.queue.filter(item => {
        const nextReview = new Date(item.nextReview)
        const weekFromNow = new Date()
        weekFromNow.setDate(weekFromNow.getDate() + 7)
        return nextReview <= weekFromNow
      }).length,

      masteredItems: reviewData.items.filter(item =>
        item.srsStage === 'mastered'
      ).length,

      accuracyRate: Math.round(
        (reviewData.correctCount / reviewData.totalReviews) * 100
      )
    }
  }, [reviewData])

  if (loading || !stats) return <LoadingSkeleton />

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Calendar className="w-6 h-6" />}
        label="Due Today"
        value={stats.dueToday}
        color="text-red-500"
      />

      <StatCard
        icon={<Target className="w-6 h-6" />}
        label="Due This Week"
        value={stats.dueThisWeek}
        color="text-orange-500"
      />

      <StatCard
        icon={<Award className="w-6 h-6" />}
        label="Mastered"
        value={stats.masteredItems}
        color="text-green-500"
      />

      <StatCard
        icon={<TrendingUp className="w-6 h-6" />}
        label="Accuracy"
        value={`${stats.accuracyRate}%`}
        color="text-blue-500"
      />
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl p-6 shadow-lg">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  )
}
```

---

### 5.2 Progress Heatmap

```typescript
// src/components/review/charts/ActivityHeatmap.tsx

import { useMemo } from 'react'

interface ActivityData {
  date: string // YYYY-MM-DD
  count: number
}

interface Props {
  data: ActivityData[]
  days?: number // Default 365
}

export function ActivityHeatmap({ data, days = 365 }: Props) {
  const heatmapData = useMemo(() => {
    // Generate array of last N days
    const dateArray: ActivityData[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const found = data.find(d => d.date === dateStr)
      dateArray.push({
        date: dateStr,
        count: found?.count || 0
      })
    }

    return dateArray
  }, [data, days])

  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-dark-800'
    if (count < 5) return 'bg-green-200 dark:bg-green-900'
    if (count < 10) return 'bg-green-400 dark:bg-green-700'
    if (count < 20) return 'bg-green-600 dark:bg-green-500'
    return 'bg-green-800 dark:bg-green-300'
  }

  // Group by weeks
  const weeks = []
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7))
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day, dayIndex) => (
              <div
                key={day.date}
                className={`
                  w-3 h-3 rounded-sm ${getColor(day.count)}
                  hover:ring-2 hover:ring-primary-500 transition-all
                  cursor-pointer
                `}
                title={`${day.date}: ${day.count} reviews`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 1, 5, 10, 20].map(count => (
            <div
              key={count}
              className={`w-3 h-3 rounded-sm ${getColor(count)}`}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
```

---

## 6. Integration Patterns

### 6.1 URE Event Integration

```typescript
// Listen to Review Engine events and award XP

import { eventBus } from '@/lib/review-engine/core/events'

// In gamificationListener.ts
eventBus.on('SESSION_COMPLETED', async (event) => {
  const { sessionId, results } = event.data

  const xpResult = await coordinator.processReviewCompletion({
    userId: event.userId,
    sessionId,
    itemsReviewed: results.total,
    correctCount: results.correct,
    accuracy: (results.correct / results.total) * 100
  })

  // Emit achievement notifications if any unlocked
  if (xpResult.achievementsUnlocked.length > 0) {
    xpResult.achievementsUnlocked.forEach(achievementId => {
      const achievement = getAchievementById(achievementId)
      window.dispatchEvent(new CustomEvent('achievement-unlocked', {
        detail: { achievement }
      }))
    })
  }
})
```

---

### 6.2 Feature Flag Pattern

```typescript
// Consistent pattern for all entertainment features

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const isFeatureEnabled = process.env.NEXT_PUBLIC_FEATURE_X === 'true'

export default function FeaturePage() {
  const router = useRouter()

  // Redirect if feature disabled
  useEffect(() => {
    if (!isFeatureEnabled) {
      router.replace('/dashboard')
    }
  }, [router])

  // Prevent flash of content
  if (!isFeatureEnabled) {
    return null
  }

  return (
    <div>
      {/* Feature content */}
    </div>
  )
}
```

---

## 7. Advanced Topics

### 7.1 Optimistic Updates with Rollback

```typescript
// In Zustand store

import create from 'zustand'
import { persist } from 'zustand/middleware'

interface GamificationState {
  totalXP: number
  currentLevel: number
  operations: Array<{ id: string, pending: boolean }>
}

interface GamificationActions {
  awardXP: (amount: number, operationId: string) => void
  confirmOperation: (operationId: string) => void
  rollbackOperation: (operationId: string) => void
}

export const useGamificationStore = create<GamificationState & GamificationActions>()(
  persist(
    (set, get) => ({
      totalXP: 0,
      currentLevel: 1,
      operations: [],

      awardXP: (amount, operationId) => {
        set(state => ({
          totalXP: state.totalXP + amount,
          operations: [
            ...state.operations,
            { id: operationId, pending: true, amount }
          ]
        }))
      },

      confirmOperation: (operationId) => {
        set(state => ({
          operations: state.operations.filter(op => op.id !== operationId)
        }))
      },

      rollbackOperation: (operationId) => {
        set(state => {
          const operation = state.operations.find(op => op.id === operationId)
          if (!operation) return state

          return {
            totalXP: state.totalXP - operation.amount,
            operations: state.operations.filter(op => op.id !== operationId)
          }
        })
      }
    }),
    {
      name: 'gamification-storage'
    }
  )
)

// Usage
const operationId = crypto.randomUUID()
awardXP(50, operationId)

try {
  await syncToServer()
  confirmOperation(operationId)
} catch (error) {
  rollbackOperation(operationId)
}
```

---

### 7.2 Custom Leaderboard Timeframes

```typescript
// Create monthly leaderboard

// In API route
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const timeframe = searchParams.get('timeframe') || 'allTime'

  if (timeframe === 'monthly') {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Query Firestore for users active this month
    const snapshot = await db
      .collection('users')
      .where('lastActivityDate', '>=', startOfMonth)
      .orderBy('xp.total', 'desc')
      .limit(100)
      .get()

    const entries = snapshot.docs.map((doc, index) => ({
      rank: index + 1,
      ...doc.data()
    }))

    return NextResponse.json({ entries, timeframe: 'monthly' })
  }

  // ... other timeframes
}
```

---

### 7.3 Real-Time Leaderboard Updates

```typescript
// Using Firestore listeners for live updates

import { onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore'

export function useLiveLeaderboard(topN: number = 10) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('xp.total', 'desc'),
      limit(topN)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newEntries = snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        userId: doc.id,
        ...doc.data()
      }))

      setEntries(newEntries)
    })

    return () => unsubscribe()
  }, [topN])

  return entries
}
```

---

## Conclusion

This feature guide covers the core implementation patterns for the Entertainment System. For troubleshooting common issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

**Next Steps:**
1. Review the [README.md](./README.md) for architecture overview
2. Explore individual game implementations in `/src/app/[locale]/games/`
3. Test XP calculation with custom activities
4. Create your first achievement
5. Customize leaderboard display

**Need Help?**
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review Universal Review Engine docs: `/docs/REVIEW_ENGINE_DEEP_DIVE.md`
- Contact the development team

---

*Last Updated: 2026-02-01*
