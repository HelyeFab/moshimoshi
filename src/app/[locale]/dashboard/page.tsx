'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import LearningVillage from '@/components/dashboard/LearningVillage'
import PokedexCard from '@/components/pokedex/PokedexCard'
import { useSubscription } from '@/hooks/useSubscription'
import GuestModeBanner from '@/components/ui/GuestModeBanner'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import { useAutoSync } from '@/hooks/useAutoSync'
import StreakSaveModal from '@/components/gamification/StreakSaveModal'
import { useStreakSaveDetection } from '@/hooks/useStreakSaveDetection'
import Navbar from '@/components/layout/Navbar'
import logger from '@/lib/logger'
import { validateStreakDisplay, getStreakDeadline } from '@/lib/gamification/utils/streakValidation'

// Dynamically import Confetti to avoid SSR issues
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { user, loading: authLoading, isGuest, isOffline, refreshSession } = useAuth()
  const { getLocalePath } = useLocalePath()
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [hasCheckedFirstVisit, setHasCheckedFirstVisit] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // Force LearningVillage remount when refresh param is present
  const refreshKey = searchParams.get('refresh') || 'default'

  const { isPremium } = useSubscription()
  useAutoSync()

  const { totalXP, currentStreak, lastActivityDate, isEnabled: gamificationEnabled } =
    useGamification()
  const { shouldShowModal: shouldShowStreakSaveModal, dismissModal: dismissStreakSaveModal } =
    useStreakSaveDetection()

  const streakValidation = useMemo(() => {
    return validateStreakDisplay(currentStreak, lastActivityDate, 24)
  }, [currentStreak, lastActivityDate])

  const streakDeadline = useMemo(() => {
    return getStreakDeadline(lastActivityDate, 24)
  }, [lastActivityDate])
  
  const displayStreak = currentStreak

  const calculateTimeUntilDeadline = (): { hours: number; isActiveToday: boolean } | null => {
    if (streakValidation.isStale || displayStreak === 0) return null
    if (!streakDeadline) return null

    const now = new Date()
    const lastActivity = lastActivityDate ? new Date(lastActivityDate) : null

    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)

    if (lastActivity) {
      const lastActivityDayStart = new Date(lastActivity)
      lastActivityDayStart.setUTCHours(0, 0, 0, 0)

      if (todayStart.getTime() === lastActivityDayStart.getTime()) {
        return { hours: 0, isActiveToday: true }
      }
    }

    const hoursUntilDeadline = (streakDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntilDeadline <= 0) return null

    return {
      hours: Math.max(0, Math.ceil(hoursUntilDeadline)),
      isActiveToday: false,
    }
  }

  const deadlineInfo = calculateTimeUntilDeadline()

  useEffect(() => {
    if (searchParams.get('donation') === 'success') {
      setShowConfetti(true)
      showToast('Thank you for your support! ☕❤️', 'success', 5000)
      setTimeout(() => setShowConfetti(false), 10000)
      const url = new URL(window.location.href)
      url.searchParams.delete('donation')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, showToast])

  useEffect(() => {
    if (authLoading) return
    if (isGuest) {
      if (!sessionStorage.getItem('guest_welcomed')) {
        showToast(
          "Welcome! You're trying Moshimoshi as a guest. Sign up to save your progress! 🌟",
          'info',
          8000
        )
        sessionStorage.setItem('guest_welcomed', 'true')
      }
    } else if (user && !hasCheckedFirstVisit) {
      const hasVisited = localStorage.getItem('dashboard_visited')
      if (!hasVisited) {
        setIsFirstVisit(true)
        localStorage.setItem('dashboard_visited', 'true')
        showToast('Welcome to Moshimoshi! Doshi is excited to learn with you! 🎉', 'success', 5000)
      }
      setHasCheckedFirstVisit(true)
    }
  }, [authLoading, isGuest, user, showToast, hasCheckedFirstVisit])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Listen for profile updates from account page
  useEffect(() => {
    const handleProfileUpdate = async () => {
      // Force refresh the auth session to get the updated displayName immediately
      logger.info('[Dashboard] Profile updated event received, refreshing auth session')
      await refreshSession()
    }

    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('profile-updated', handleProfileUpdate)
  }, [refreshSession])

  useEffect(() => {
    if (!authLoading && !user && !isGuest && !isOffline) {
      logger.auth('[Dashboard] No user found, redirecting to signin')
      const timer = setTimeout(() => router.push(getLocalePath('/auth/signin')), 100)
      return () => clearTimeout(timer)
    }
  }, [authLoading, user, isGuest, isOffline, router, getLocalePath])

  const { strings } = useI18n()

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12)
      return {
        text: 'おはよう',
        translation: strings.dashboard?.greeting?.morning || 'Good morning',
      }
    if (hour < 18)
      return {
        text: 'こんにちは',
        translation: strings.dashboard?.greeting?.afternoon || 'Good afternoon',
      }
    return {
      text: 'こんばんは',
      translation: strings.dashboard?.greeting?.evening || 'Good evening',
    }
  }

  const greeting = getGreeting()
  const xpPerLevel = 100
  const currentLevel = Math.floor(totalXP / xpPerLevel) + 1
  const xpInCurrentLevel = totalXP % xpPerLevel
  const progressPercentage = (xpInCurrentLevel / xpPerLevel) * 100

  if (authLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={strings.dashboard?.loading || 'Loading your dashboard...'}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  if (!user && !isGuest) {
    return <LoadingOverlay isLoading={true} message="Redirecting..." fullScreen={true} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
          <Confetti
            width={typeof window !== 'undefined' ? window.innerWidth : 0}
            height={typeof window !== 'undefined' ? window.innerHeight : 0}
            recycle={false}
            numberOfPieces={200}
            gravity={0.1}
          />
        </div>
      )}

      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ef4444' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <Navbar user={user} showUserMenu={true} />

      <main className="container mx-auto px-4 py-2 sm:py-8 relative z-10">
        {isGuest && <GuestModeBanner className="mb-6" />}

        <div className="my-8">
          <PokedexCard isPremium={isPremium} />
        </div>

        <div className="my-8">
          <LearningVillage
            key={refreshKey}
            welcomeData={{
              userName: (() => {
                const name = user?.displayName || user?.email?.split('@')[0] || 'Learner'
                return name
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')
              })(),
              level: currentLevel,
              totalXP,
              streak: displayStreak,
              streakWarning: deadlineInfo && !deadlineInfo.isActiveToday && displayStreak > 0
                ? `${deadlineInfo.hours}h`
                : null,
              isActiveToday: deadlineInfo?.isActiveToday || false,
              gamificationEnabled,
              minXPForStreak: 150, // From streak config: src/config/gamification/streak.json
            }}
          />
        </div>
      </main>

      <StreakSaveModal
        isOpen={shouldShowStreakSaveModal}
        onClose={dismissStreakSaveModal}
        onSaveSuccess={() => {
          showToast('Your streak lives another day! 🔥', 'success', 3000)
        }}
      />
    </div>
  )
}

// Main export with Suspense wrapper
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <LoadingOverlay
          isLoading={true}
          message="Loading your dashboard..."
          showDoshi={true}
          fullScreen={true}
        />
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
