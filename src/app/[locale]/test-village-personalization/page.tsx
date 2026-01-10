'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { motion } from 'framer-motion'
import Link from 'next/link'

type LearningGoal = 'jlpt' | 'travel' | 'anime' | 'conversation'
type DistrictId = 'foundation' | 'study' | 'immersion' | 'play' | 'community'

const DEFAULT_DISTRICT_ORDER: DistrictId[] = ['foundation', 'study', 'immersion', 'play', 'community']

const GOAL_TO_PRIORITY: Record<LearningGoal, DistrictId> = {
  conversation: 'immersion',
  anime: 'immersion',
  travel: 'immersion',
  jlpt: 'study',
}

const DISTRICT_INFO = {
  foundation: {
    emoji: '🏛️',
    name: 'Foundation',
    description: 'Core learning materials: Textbooks, Basics, Grammar',
    color: 'from-blue-500 to-cyan-500',
  },
  study: {
    emoji: '📚',
    name: 'Study',
    description: 'Structured practice: Flashcards, Drills, Tests',
    color: 'from-purple-500 to-pink-500',
  },
  immersion: {
    emoji: '🎬',
    name: 'Immersion',
    description: 'Real content: Stories, News, YouTube Shadowing',
    color: 'from-orange-500 to-red-500',
  },
  play: {
    emoji: '🎮',
    name: 'Play',
    description: 'Fun learning: Games, Quizzes, Challenges',
    color: 'from-green-500 to-emerald-500',
  },
  community: {
    emoji: '👥',
    name: 'Community',
    description: 'Social features: Forums, Sharing, Collaboration',
    color: 'from-indigo-500 to-violet-500',
  },
}

const GOAL_INFO = {
  jlpt: {
    title: 'JLPT Study',
    description: 'Pass the Japanese Language Proficiency Test',
    icon: '📚',
    priority: 'study',
    why: 'JLPT requires structured study and practice tests',
  },
  travel: {
    title: 'Travel Japanese',
    description: 'Learn Japanese for travel',
    icon: '✈️',
    priority: 'immersion',
    why: 'Travelers need real-world conversation practice',
  },
  anime: {
    title: 'Anime & Manga',
    description: 'Understand anime without subtitles',
    icon: '🎌',
    priority: 'immersion',
    why: 'Anime learners benefit from authentic content',
  },
  conversation: {
    title: 'Conversation',
    description: 'Have everyday conversations',
    icon: '💬',
    priority: 'immersion',
    why: 'Conversation requires immersion in real Japanese',
  },
}

function buildDistrictOrder(goal: LearningGoal | null): DistrictId[] {
  if (!goal || !GOAL_TO_PRIORITY[goal]) {
    return DEFAULT_DISTRICT_ORDER
  }
  const priority = GOAL_TO_PRIORITY[goal]
  const rest = DEFAULT_DISTRICT_ORDER.filter(district => district !== priority)
  return [priority, ...rest]
}

export default function TestVillagePersonalization() {
  const router = useRouter()
  const { user } = useAuth()
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null)
  const [currentUserGoal, setCurrentUserGoal] = useState<LearningGoal | null>(null)
  const [districtOrder, setDistrictOrder] = useState<DistrictId[]>(DEFAULT_DISTRICT_ORDER)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  // Fetch current user's goal
  useEffect(() => {
    if (user && user.uid !== 'guest') {
      fetch('/api/user/onboarding')
        .then(res => res.json())
        .then(data => {
          const goal = data?.data?.learningGoal as LearningGoal | null
          setCurrentUserGoal(goal)
          if (!selectedGoal && goal) {
            setSelectedGoal(goal)
            setDistrictOrder(buildDistrictOrder(goal))
          }
        })
        .catch(err => console.error('Failed to fetch onboarding:', err))
    }
  }, [user])

  // Update district order when goal changes
  useEffect(() => {
    setDistrictOrder(buildDistrictOrder(selectedGoal))
  }, [selectedGoal])

  const handleGoalSelect = (goal: LearningGoal) => {
    setSelectedGoal(goal)
    setUpdateSuccess(false)
  }

  const handleUpdateGoal = async () => {
    if (!selectedGoal || !user || user.uid === 'guest') return

    setIsUpdating(true)
    setUpdateSuccess(false)

    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningGoal: selectedGoal }),
      })

      if (response.ok) {
        setUpdateSuccess(true)
        setCurrentUserGoal(selectedGoal)

        // Trigger router refresh to invalidate cached dashboard data
        // This ensures the dashboard will re-fetch and show the new layout
        router.refresh()

        setTimeout(() => setUpdateSuccess(false), 3000)
      } else {
        alert('Failed to update goal. Please try again.')
      }
    } catch (err) {
      console.error('Error updating goal:', err)
      alert('Error updating goal. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              🧪 Village Layout Personalization Test
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              See how learning goals affect your dashboard layout
            </p>
          </div>
          <Link
            href={`/dashboard?refresh=${Date.now()}`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* User Status */}
        {user && (
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-4">
              <DoshiMascot size="medium" mood="happy" variant="animated" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Logged in as: {user.displayName || user.email}
                </h3>
                {currentUserGoal && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Current goal: <span className="font-semibold">{GOAL_INFO[currentUserGoal].title}</span>
                  </p>
                )}
                {!currentUserGoal && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ No goal set yet - Complete onboarding first
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Goal Selection */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Step 1: Choose Your Learning Goal
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Select a goal to see how it affects your dashboard layout
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(GOAL_INFO) as LearningGoal[]).map(goal => (
              <motion.button
                key={goal}
                onClick={() => handleGoalSelect(goal)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-6 rounded-xl border-2 transition-all ${
                  selectedGoal === goal
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-dark-600 hover:border-indigo-400'
                }`}
              >
                <div className="text-4xl mb-3">{GOAL_INFO[goal].icon}</div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {GOAL_INFO[goal].title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {GOAL_INFO[goal].description}
                </p>
                {selectedGoal === goal && (
                  <div className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    ✓ Selected
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Personalization Explanation */}
        {selectedGoal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white"
          >
            <h3 className="text-xl font-bold mb-2">
              🎯 Why {GOAL_INFO[selectedGoal].title}?
            </h3>
            <p className="text-indigo-100 mb-4">{GOAL_INFO[selectedGoal].why}</p>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <p className="text-sm font-medium">
                📍 Priority District:{' '}
                <span className="text-yellow-300 font-bold">
                  {DISTRICT_INFO[GOAL_TO_PRIORITY[selectedGoal]].emoji}{' '}
                  {DISTRICT_INFO[GOAL_TO_PRIORITY[selectedGoal]].name}
                </span>
              </p>
            </div>
          </motion.div>
        )}

        {/* District Order Preview */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Step 2: Your Dashboard Layout
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {selectedGoal
              ? `This is how your dashboard will be organized for ${GOAL_INFO[selectedGoal].title}`
              : 'Select a goal above to see the personalized layout'}
          </p>

          <div className="space-y-4">
            {districtOrder.map((district, index) => (
              <motion.div
                key={district}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  index === 0
                    ? 'border-yellow-500 bg-gradient-to-r ' + DISTRICT_INFO[district].color + ' text-white shadow-xl scale-105'
                    : 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700'
                }`}
              >
                {index === 0 && (
                  <div className="absolute -top-3 -right-3 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    ⭐ Priority District
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className={`text-4xl ${index === 0 ? 'text-white' : ''}`}>
                    {DISTRICT_INFO[district].emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-2xl font-bold ${index === 0 ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                        #{index + 1}
                      </span>
                      <h3 className={`text-xl font-bold ${index === 0 ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                        {DISTRICT_INFO[district].name}
                      </h3>
                    </div>
                    <p className={`text-sm ${index === 0 ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
                      {DISTRICT_INFO[district].description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Update Button (for logged-in users) */}
        {user && user.uid !== 'guest' && selectedGoal && selectedGoal !== currentUserGoal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Apply This Layout to Your Account
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Click below to update your learning goal and regenerate your dashboard layout.
            </p>
            <button
              onClick={handleUpdateGoal}
              disabled={isUpdating}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                `Update Goal to "${GOAL_INFO[selectedGoal].title}"`
              )}
            </button>
            {updateSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div className="text-green-800 dark:text-green-200 text-center mb-3">
                  ✅ Goal updated successfully! Your dashboard layout will regenerate on next visit.
                </div>
                <button
                  onClick={() => router.push(`/dashboard?refresh=${Date.now()}`)}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                  Go to Dashboard Now →
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Comparison Table */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            📊 All Goals Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-600">
                  <th className="text-left py-3 px-4 text-gray-900 dark:text-gray-100 font-bold">Goal</th>
                  <th className="text-left py-3 px-4 text-gray-900 dark:text-gray-100 font-bold">Priority District</th>
                  <th className="text-left py-3 px-4 text-gray-900 dark:text-gray-100 font-bold">District Order</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(GOAL_INFO) as LearningGoal[]).map(goal => {
                  const order = buildDistrictOrder(goal)
                  return (
                    <tr key={goal} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{GOAL_INFO[goal].icon}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{GOAL_INFO[goal].title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium">
                          {DISTRICT_INFO[GOAL_TO_PRIORITY[goal]].emoji} {DISTRICT_INFO[GOAL_TO_PRIORITY[goal]].name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {order.map((d, i) => (
                            <span
                              key={d}
                              className={`px-2 py-1 rounded text-xs ${
                                i === 0
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 font-bold'
                                  : 'bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {i === 0 ? '⭐ ' : ''}{d}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technical Info */}
        <div className="bg-gray-900 text-gray-100 rounded-xl shadow-lg p-6 border border-gray-700 font-mono text-sm">
          <h3 className="text-lg font-bold mb-4 text-white">🔧 Technical Details</h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-400">Default Order:</span>{' '}
              <span className="text-green-400">{JSON.stringify(DEFAULT_DISTRICT_ORDER)}</span>
            </div>
            {selectedGoal && (
              <>
                <div>
                  <span className="text-gray-400">Selected Goal:</span>{' '}
                  <span className="text-yellow-400">{selectedGoal}</span>
                </div>
                <div>
                  <span className="text-gray-400">Priority District:</span>{' '}
                  <span className="text-purple-400">{GOAL_TO_PRIORITY[selectedGoal]}</span>
                </div>
                <div>
                  <span className="text-gray-400">Computed Order:</span>{' '}
                  <span className="text-blue-400">{JSON.stringify(districtOrder)}</span>
                </div>
              </>
            )}
            <div className="pt-3 border-t border-gray-700 mt-3">
              <span className="text-gray-400">Storage Locations:</span>
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                <li>• <span className="text-cyan-400">users/{'{uid}'}/onboarding.learningGoal</span></li>
                <li>• <span className="text-cyan-400">users/{'{uid}'}/villageLayout/data.districtOrder</span></li>
                <li>• <span className="text-cyan-400">onboarding/{'{uid}'}/learningGoal</span> (analytics)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
