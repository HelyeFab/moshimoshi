'use client'

/**
 * Streak Save Modal Component
 * Phase 2: XP-Save Mechanic
 *
 * Displays modal when user's streak is breaking, offering choice to save with XP.
 * Shows cost breakdown, surge pricing, and XP before/after.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Flame, Zap, Clock, TrendingUp } from 'lucide-react'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useGamification } from '@/hooks/useGamification'
import Modal from '@/components/ui/Modal'
import { LoadingButton } from '@/components/ui/Loading'

interface StreakSaveModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveSuccess?: () => void
}

interface EligibilityData {
  canSave: boolean
  reason: string
  cost: number | null
  userXP: number | null
  streakToSave: number | null
  daysSinceActivity: number | null
  costBreakdown: {
    baseCost: number
    surgePricing: boolean
    daysSince: number
    totalCost: number
  } | null
}

interface SaveResult {
  success: boolean
  xpDeducted?: number
  newXP?: number
  newLevel?: number
  streakSaved?: number
  newLastActivityDate?: string
  error?: {
    code: string
    message: string
  }
}

export default function StreakSaveModal({
  isOpen,
  onClose,
  onSaveSuccess
}: StreakSaveModalProps) {
  const { showToast } = useToast()
  const { totalXP, currentLevel, currentStreak, lastActivityDate } = useGamification()

  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check eligibility when modal opens
  useEffect(() => {
    if (!isOpen) {
      setEligibility(null)
      setError(null)
      return
    }

    checkEligibility()
  }, [isOpen])

  /**
   * Check if user can save streak (GET endpoint)
   */
  const checkEligibility = async () => {
    setChecking(true)
    setError(null)

    try {
      const response = await fetch('/api/gamification/streak/save')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: EligibilityData = await response.json()
      setEligibility(data)

    } catch (err) {
      console.error('[StreakSaveModal] Check error:', err)
      setError('Failed to check streak status. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  /**
   * Save streak (POST endpoint)
   */
  const handleSave = async () => {
    if (!eligibility?.canSave) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/gamification/streak/save', {
        method: 'POST'
      })

      const data: SaveResult = await response.json()

      if (!data.success || !response.ok) {
        throw new Error(data.error?.message || 'Failed to save streak')
      }

      // Success! Update Zustand store
      const { useGamificationStore } = await import('@/state/userGamification')
      useGamificationStore.setState({
        totalXP: data.newXP!,
        currentLevel: data.newLevel!,
        currentStreak: data.streakSaved!,
        lastActivityDate: data.newLastActivityDate!
      })

      // Show success toast
      showToast(
        `Streak saved! -${data.xpDeducted} XP`,
        'success',
        3000
      )

      // Call success callback
      onSaveSuccess?.()

      // Close modal
      onClose()

    } catch (err) {
      console.error('[StreakSaveModal] Save error:', err)
      const message = err instanceof Error ? err.message : 'Failed to save streak'
      setError(message)
      showToast(message, 'error', 5000)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Close modal and mark as dismissed
   */
  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title=""
      size="md"
      showCloseButton={!saving}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-full">
              <Flame className="w-12 h-12 text-orange-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Save Your Streak?
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Your streak is about to break. Trade XP to keep it alive!
          </p>
        </div>

        {/* Loading State */}
        {checking && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Checking streak status...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !checking && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          </div>
        )}

        {/* Cannot Save State */}
        {eligibility && !eligibility.canSave && !checking && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Cannot save streak:</strong> {eligibility.reason}
              </p>
            </div>

            {eligibility.cost !== null && eligibility.userXP !== null && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>Cost: {eligibility.cost} XP</p>
                <p>Your XP: {eligibility.userXP} XP</p>
                {eligibility.userXP < eligibility.cost && (
                  <p className="text-red-600 dark:text-red-400 mt-2">
                    You need {eligibility.cost - eligibility.userXP} more XP to save your streak.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Can Save State */}
        {eligibility && eligibility.canSave && !checking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Streak Info */}
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {eligibility.streakToSave} day{eligibility.streakToSave === 1 ? '' : 's'} streak
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{eligibility.daysSinceActivity} day{eligibility.daysSinceActivity === 1 ? '' : 's'} inactive</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                You've been inactive for {eligibility.daysSinceActivity} day{eligibility.daysSinceActivity === 1 ? '' : 's'}.
                Your streak is about to break!
              </p>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Cost Breakdown
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Base cost:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {eligibility.costBreakdown!.baseCost} XP
                  </span>
                </div>

                {eligibility.costBreakdown!.surgePricing && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-amber-500" />
                      Surge (Day {eligibility.costBreakdown!.daysSince}):
                    </span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      ×{eligibility.costBreakdown!.daysSince}
                    </span>
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-2"></div>

                <div className="flex justify-between text-base">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    {eligibility.cost} XP
                  </span>
                </div>
              </div>
            </div>

            {/* XP Before/After */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Your XP:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {eligibility.userXP}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {eligibility.userXP! - eligibility.cost!}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                ℹ️ This will extend your grace period to yesterday, giving you ~20 hours to complete an activity and continue your streak.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <LoadingButton
                onClick={handleSave}
                isLoading={saving}
                disabled={saving}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                💚 Save Streak ({eligibility.cost} XP)
              </LoadingButton>

              <button
                onClick={handleClose}
                disabled={saving}
                className="w-full px-6 py-3 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Let It Go
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </Modal>
  )
}
