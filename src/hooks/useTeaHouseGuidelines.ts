import { useState, useEffect } from 'react'
import { TEA_HOUSE_GUIDELINES_VERSION } from '@/lib/qa/guidelines'
import { useAuth } from './useAuth'

const WELCOME_SHOWN_KEY = 'teaHouseWelcomeShown'

export interface TeaHouseUserData {
  acknowledgedGuidelines: boolean
  acknowledgedAt?: Date
  guidelinesVersion?: string
  firstQuestionAt?: Date
  firstAnswerAt?: Date
  questionCount?: number
  answerCount?: number
  trustLevel?: 'new' | 'contributor' | 'trusted'
}

/**
 * Hook to manage Tea House guidelines acknowledgment
 *
 * - Tracks welcome modal (localStorage)
 * - Tracks guidelines acknowledgment (Firebase)
 * - Provides methods to acknowledge and check status
 */
export function useTeaHouseGuidelines() {
  const { user, isGuest } = useAuth()
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  // Check localStorage synchronously on mount to avoid flash
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(WELCOME_SHOWN_KEY) === 'true'
    }
    return false
  })

  // Check if user has acknowledged guidelines (Firebase)
  useEffect(() => {
    if (!user || isGuest) {
      setHasAcknowledged(null)
      setLoading(false)
      return
    }

    async function checkAcknowledgment() {
      try {
        const response = await fetch('/api/qa/guidelines', {
          credentials: 'include'
        })

        if (!response.ok) {
          setHasAcknowledged(false)
          return
        }

        const data = await response.json()
        setHasAcknowledged(data.acknowledged === true)
      } catch (error) {
        console.error('Error checking Tea House acknowledgment:', error)
        setHasAcknowledged(false)
      } finally {
        setLoading(false)
      }
    }

    checkAcknowledgment()
  }, [user, isGuest])

  /**
   * Mark welcome modal as shown (localStorage)
   */
  const markWelcomeShown = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, 'true')
    setHasSeenWelcome(true)
  }

  /**
   * Acknowledge guidelines (Firebase)
   */
  const acknowledgeGuidelines = async () => {
    if (!user || isGuest) {
      throw new Error('Must be logged in to acknowledge guidelines')
    }

    try {
      const response = await fetch('/api/qa/guidelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acknowledged: true })
      })

      if (!response.ok) {
        throw new Error('Failed to acknowledge guidelines')
      }

      setHasAcknowledged(true)
      return true
    } catch (error) {
      console.error('Error acknowledging guidelines:', error)
      throw error
    }
  }

  /**
   * Check if user needs to see welcome modal
   */
  const shouldShowWelcome = !hasSeenWelcome

  /**
   * Check if user needs to acknowledge guidelines before posting
   */
  const needsAcknowledgment = !isGuest && user && hasAcknowledged === false

  return {
    // Status
    hasAcknowledged,
    hasSeenWelcome,
    loading,
    shouldShowWelcome,
    needsAcknowledgment,

    // Actions
    markWelcomeShown,
    acknowledgeGuidelines,

    // Metadata
    guidelinesVersion: TEA_HOUSE_GUIDELINES_VERSION,
  }
}
