'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import DoshiMascot from '@/components/ui/DoshiMascot'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay } from '@/components/ui/Loading'
import Tooltip from '@/components/ui/Tooltip'
import LearningVillage from '@/components/dashboard/LearningVillage'
import BuyMeACoffeeButton from '@/components/common/BuyMeACoffeeButton'
import PokedexCard from '@/components/pokedex/PokedexCard'
import { useSubscription } from '@/hooks/useSubscription'
import GuestModeBanner from '@/components/ui/GuestModeBanner'
import { useAuth } from '@/hooks/useAuth'
import { useGamification } from '@/hooks/useGamification'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { useAutoSync } from '@/hooks/useAutoSync'
import { DrillProgressManager } from '@/lib/review-engine/progress/DrillProgressManager'
import logger from '@/lib/logger'
import Modal from '@/components/ui/Modal'

// Dynamically import Confetti to avoid SSR issues
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// Learning stats will be dynamic based on achievement data

// Dashboard content component that uses searchParams
function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { user, loading: authLoading, isGuest, isAuthenticated } = useAuth()
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [hasCheckedFirstVisit, setHasCheckedFirstVisit] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isWelcomeExpanded, setIsWelcomeExpanded] = useState(false)

  // Subscription state
  const { subscription, isPremium } = useSubscription()

  // Background auto-sync on dashboard load (throttled to 5 min)
  useAutoSync()

  // Gamification data from hook
  const {
    totalXP,
    currentLevel,
    currentStreak,
    bestStreak,
    unlockedAchievements,
    sessionCount,
    lastActivityDate,
    loading: gamificationLoading,
    isEnabled: gamificationEnabled
  } = useGamification()

  // Learning progress from drill mastery (Bunpro multi-track approach)
  const { overall: learningProgress, categories: learningCategories, loading: learningProgressLoading } = useLearningProgress()

  // Debug: Log learning progress
  useEffect(() => {
    if (!learningProgressLoading) {
      console.log('[Dashboard] Learning Progress:', {
        progressPercentage: learningProgress.progressPercentage,
        categoriesStarted: learningProgress.categoriesStarted,
        drillCategory: learningCategories.drills
      })
    }
  }, [learningProgressLoading, learningProgress, learningCategories])

  // Drill stats
  const [drillStats, setDrillStats] = useState<any>(null)
  const [loadingDrillStats, setLoadingDrillStats] = useState(false)

  // Modal for stat details
  const [selectedStat, setSelectedStat] = useState<string | null>(null)
  const [isStatModalOpen, setIsStatModalOpen] = useState(false)

  // Calculate drill-related stats (needed in both getStatBreakdown and getLearningStats)
  const drillAccuracy = drillStats ? Math.round(drillStats.accuracy || 0) : 0
  const drillCount = drillStats?.totalDrills || 0
  const drillMastery = learningProgress?.progressPercentage
    ? Math.round(learningProgress.progressPercentage)
    : 0

  // Helper function to get stat calculation breakdown
  const getStatBreakdown = (statLabel: string) => {
    switch (statLabel) {
      case strings.dashboard?.stats?.streak || 'Current Streak':
        const streakModal = strings.dashboard?.statModals?.streak
        const lastActivityFormatted = lastActivityDate
          ? new Date(lastActivityDate).toLocaleDateString()
          : 'Never'
        return {
          title: streakModal?.title || 'Daily Streak',
          description: streakModal?.description || 'Your streak shows how many consecutive days you\'ve practiced Japanese',
          formula: streakModal?.formula || 'Consecutive days with ≥10 XP earned',
          whatItMeans: streakModal?.whatItMeans,
          howToImprove: streakModal?.howToImprove,
          goalNote: streakModal?.goalNote,
          breakdown: [
            { label: streakModal?.breakdown?.current || 'Current streak', value: `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}` },
            { label: streakModal?.breakdown?.longest || 'Longest streak', value: `${bestStreak} ${bestStreak === 1 ? 'day' : 'days'}` },
            { label: streakModal?.breakdown?.lastActive || 'Last activity', value: lastActivityFormatted },
            { label: streakModal?.breakdown?.minXP || 'Min XP per day', value: '10 XP' }
          ]
        }

      case strings.dashboard?.stats?.xpEarned || 'XP Earned':
        const xpModal = strings.dashboard?.statModals?.xpEarned
        const currentLevel = Math.floor(totalXP / 100) + 1
        const xpToNextLevel = (currentLevel * 100) - totalXP
        return {
          title: xpModal?.title || 'XP Earned',
          description: xpModal?.description || 'Experience Points measure your learning activity and achievement',
          formula: xpModal?.formula || 'Base XP + Bonuses',
          whatItMeans: xpModal?.whatItMeans,
          howToImprove: xpModal?.howToImprove,
          goalNote: xpModal?.goalNote,
          bonuses: xpModal?.bonuses,
          breakdown: [
            { label: xpModal?.breakdown?.total || 'Total XP', value: `${totalXP} XP` },
            { label: xpModal?.breakdown?.currentLevel || 'Current level', value: `Level ${currentLevel}` },
            { label: xpModal?.breakdown?.nextLevel || 'XP to next level', value: `${xpToNextLevel} XP` },
            { label: xpModal?.breakdown?.dailyCap || 'Daily cap', value: '500 XP' }
          ]
        }

      case strings.dashboard?.stats?.progress || 'Progress':
        const achievementCompletion = gamificationEnabled && unlockedAchievements.length > 0
          ? Math.round((unlockedAchievements.length / 10) * 100)
          : 0
        const progressModal = strings.dashboard?.statModals?.achievementProgress
        return {
          title: progressModal?.title || 'Achievement Progress',
          description: progressModal?.description || 'Track your journey by unlocking achievements',
          formula: progressModal?.formula || '(Unlocked / Total) × 100',
          whatItMeans: progressModal?.whatItMeans,
          howToImprove: progressModal?.howToImprove,
          breakdown: [
            { label: progressModal?.breakdown?.unlocked || 'Unlocked achievements', value: `${unlockedAchievements.length}` },
            { label: progressModal?.breakdown?.total || 'Total available', value: '10' },
            { label: progressModal?.breakdown?.completion || 'Completion rate', value: `${achievementCompletion}%` }
          ]
        }

      case strings.dashboard?.stats?.achievements || 'Achievements':
        const achievementsModal = strings.dashboard?.statModals?.achievements
        return {
          title: achievementsModal?.title || 'Achievements Unlocked',
          description: achievementsModal?.description || 'Achievements are rewards for reaching milestones',
          formula: achievementsModal?.formula || 'Count of unlocked achievements',
          whatItMeans: achievementsModal?.whatItMeans,
          howToImprove: achievementsModal?.howToImprove,
          tips: achievementsModal?.tips,
          breakdown: [
            { label: achievementsModal?.breakdown?.unlocked || 'Unlocked', value: `${unlockedAchievements.length}` },
            { label: achievementsModal?.breakdown?.available || 'Available', value: '10 total' },
            { label: achievementsModal?.breakdown?.earnMore || 'How to earn more', value: 'Complete drills, maintain streaks, practice regularly' }
          ]
        }

      case strings.drill?.stats?.totalDrills || 'Drills':
      case strings.dashboard?.stats?.drillsCompleted || 'Drills Completed':
        const drillsModal = strings.dashboard?.statModals?.drillsCompleted
        const perfectDrills = learningCategories.drills?.totalDrills ? Math.round((learningCategories.drills.totalDrills * drillAccuracy) / 100) : 0
        return {
          title: drillsModal?.title || 'Drills Completed',
          description: drillsModal?.description || 'Every drill session helps build your conjugation skills',
          formula: drillsModal?.formula || 'Total finished drill sessions',
          whatItMeans: drillsModal?.whatItMeans,
          howToImprove: drillsModal?.howToImprove,
          breakdown: [
            { label: drillsModal?.breakdown?.total || 'Total drills', value: `${drillCount}` },
            { label: drillsModal?.breakdown?.perfect || 'Perfect drills', value: `${perfectDrills}` },
            { label: drillsModal?.breakdown?.types || 'Types', value: 'Conjugation practice' }
          ]
        }

      case strings.dashboard?.stats?.drillAccuracy || 'Drill Accuracy':
        const accuracyModal = strings.dashboard?.statModals?.drillAccuracy
        return {
          title: accuracyModal?.title || 'Drill Accuracy',
          description: accuracyModal?.description || 'Your accuracy reflects how well you understand conjugations',
          formula: accuracyModal?.formula || '(Correct / Total) × 100',
          whatItMeans: accuracyModal?.whatItMeans,
          example: accuracyModal?.example,
          howToImprove: accuracyModal?.howToImprove,
          goalNote: accuracyModal?.goalNote,
          breakdown: [
            { label: accuracyModal?.breakdown?.current || 'Current accuracy', value: `${drillAccuracy}%` },
            { label: accuracyModal?.breakdown?.total || 'Total drills', value: `${drillCount}` },
            { label: accuracyModal?.breakdown?.goal || 'Goal', value: '80% or higher' }
          ]
        }

      case strings.drill?.stats?.mastery || 'Drill Mastery':
        const masteryModal = strings.dashboard?.statModals?.drillMastery
        return {
          title: masteryModal?.title || 'Drill Mastery Score',
          description: masteryModal?.description || 'Comprehensive quality score (0-100)',
          formula: masteryModal?.formula || '4-factor weighted calculation',
          whatItMeans: masteryModal?.whatItMeans,
          factors: masteryModal?.factors,
          howToImprove: masteryModal?.howToImprove,
          masterLevels: masteryModal?.masterLevels,
          breakdown: learningCategories.drills ? [
            {
              label: masteryModal?.breakdown?.volume || 'Volume (30 pts)',
              value: `${Math.min(30, (learningCategories.drills.totalDrills || 0) * 0.3).toFixed(1)} pts`,
              detail: `${learningCategories.drills.totalDrills} ${masteryModal?.breakdown?.volumeDetail || 'drills completed'}`
            },
            {
              label: masteryModal?.breakdown?.accuracy || 'Accuracy (40 pts)',
              value: `${((drillAccuracy / 100) * 40).toFixed(1)} pts`,
              detail: `${drillAccuracy}% ${masteryModal?.breakdown?.accuracyDetail || 'average accuracy'}`
            },
            {
              label: masteryModal?.breakdown?.perfectRatio || 'Perfect Ratio (20 pts)',
              value: `${((learningCategories.drills.totalDrills || 0) > 0 ? ((learningCategories.drills.totalDrills || 0) * (drillAccuracy / 100) / (learningCategories.drills.totalDrills || 1)) * 20 : 0).toFixed(1)} pts`,
              detail: masteryModal?.breakdown?.perfectDetail || '100% accurate sessions'
            },
            {
              label: masteryModal?.breakdown?.total || 'Total Score',
              value: `${drillMastery}/100`,
              detail: 'Overall mastery level'
            }
          ] : []
        }

      default:
        return null
    }
  }

  // Check for donation success from URL params
  useEffect(() => {
    if (searchParams.get('donation') === 'success') {
      setShowConfetti(true)
      showToast('Thank you for your support! ☕❤️', 'success', 5000)

      // Hide confetti after 10 seconds
      setTimeout(() => {
        setShowConfetti(false)
      }, 10000)

      // Clear URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('donation')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, showToast])

  // Handle auth state and redirects
  useEffect(() => {
    // Only process after auth has loaded
    if (authLoading) return

    if (isGuest) {
      // Show guest-specific welcome message
      if (!sessionStorage.getItem('guest_welcomed')) {
        showToast('Welcome! You\'re trying Moshimoshi as a guest. Sign up anytime to save your progress! 🌟', 'info', 8000)
        sessionStorage.setItem('guest_welcomed', 'true')
      }
    } else if (user && !hasCheckedFirstVisit) {
      // User is authenticated
      const hasVisited = localStorage.getItem('dashboard_visited')
      if (!hasVisited) {
        setIsFirstVisit(true)
        localStorage.setItem('dashboard_visited', 'true')
        showToast('Welcome to Moshimoshi! Doshi is excited to learn with you! 🎉', 'success', 5000)
      }
      setHasCheckedFirstVisit(true)
    }
    // Remove the redirect logic - let the page render for authenticated users
  }, [authLoading, isGuest, user, showToast, hasCheckedFirstVisit])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  
  // Gamification removed - no need to initialize achievements

  // Load drill stats
  useEffect(() => {
    const loadDrillStats = async () => {
      if (!user?.uid) return

      setLoadingDrillStats(true)
      try {
        const drillManager = DrillProgressManager.getInstance()
        const stats = await drillManager.getDrillStats(user.uid, isPremium || false)
        console.log('[Dashboard] Loaded drill stats:', stats)
        setDrillStats(stats)
      } catch (error) {
        logger.error('[Dashboard] Failed to load drill stats:', error)
      } finally {
        setLoadingDrillStats(false)
      }
    }

    loadDrillStats()
  }, [user?.uid, isPremium])




  // Handle redirect if no user after auth has loaded
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      logger.auth('[Dashboard] No user found after auth loaded, redirecting to signin')
      const timer = setTimeout(() => {
        router.push('/auth/signin')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [authLoading, user, isGuest, router])

  const { strings } = useI18n()

  logger.debug('[Dashboard] User object:', user)
  logger.debug('[Dashboard] IsGuest:', isGuest)
  logger.debug('[Dashboard] IsAuthenticated:', isAuthenticated)

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return { text: 'おはよう', translation: strings.dashboard?.greeting?.morning || 'Good morning' }
    if (hour < 18) return { text: 'こんにちは', translation: strings.dashboard?.greeting?.afternoon || 'Good afternoon' }
    return { text: 'こんばんは', translation: strings.dashboard?.greeting?.evening || 'Good evening' }
  }

  const greeting = getGreeting()
  
  // Dynamic learning stats from gamification system
  const getLearningStats = () => {
    // Use real gamification data if enabled, otherwise use zeros
    const xpPoints = gamificationEnabled ? totalXP : 0
    // Learning Progress = Achievement completion % (same as account page)
    const completionPercentage = gamificationEnabled && unlockedAchievements.length > 0
      ? Math.round((unlockedAchievements.length / 10) * 100)
      : 0
    const streakValue = gamificationEnabled ? currentStreak : 0
    const achievementCount = gamificationEnabled ? unlockedAchievements.length : 0

    // Safely extract string values from i18n objects
    // Check if the value is an object with label/unit properties
    const streakData = strings.dashboard?.stats?.streak
    const streakLabel = (typeof streakData === 'object' && streakData !== null && 'label' in streakData)
      ? String(streakData.label)
      : String(streakData || 'Streak')
    const streakUnit = (typeof streakData === 'object' && streakData !== null && 'unit' in streakData)
      ? String(streakData.unit)
      : 'days'

    const xpData = strings.dashboard?.stats?.xpEarned
    const xpLabel = (typeof xpData === 'object' && xpData !== null && 'label' in xpData)
      ? String(xpData.label)
      : String(xpData || 'XP Earned')
    const xpUnit = (typeof xpData === 'object' && xpData !== null && 'unit' in xpData)
      ? String(xpData.unit)
      : 'points'

    const progressData = strings.dashboard?.stats?.progress
    const progressLabel = (typeof progressData === 'object' && progressData !== null && 'label' in progressData)
      ? String(progressData.label)
      : String(progressData || 'Progress')
    const progressUnit = (typeof progressData === 'object' && progressData !== null && 'unit' in progressData)
      ? String(progressData.unit)
      : '%'

    const achievementsData = strings.dashboard?.stats?.achievements
    const achievementsLabel = (typeof achievementsData === 'object' && achievementsData !== null && 'label' in achievementsData)
      ? String(achievementsData.label)
      : String(achievementsData || 'Achievements')
    const achievementsUnit = (typeof achievementsData === 'object' && achievementsData !== null && 'unit' in achievementsData)
      ? String(achievementsData.unit)
      : 'unlocked'

    console.log('[Dashboard] Stats card values:', {
      drillCount,
      drillAccuracy,
      drillMastery,
      learningProgressPercentage: learningProgress?.progressPercentage
    })

    return [
      { label: String(streakLabel || 'Streak'), value: streakValue.toString(), unit: String(streakUnit || 'days'), color: 'from-orange-400 to-red-500' },
      { label: String(xpLabel || 'XP Earned'), value: xpPoints.toString(), unit: String(xpUnit || 'points'), color: 'from-blue-400 to-purple-500' },
      { label: String(progressLabel || 'Progress'), value: Math.round(completionPercentage).toString(), unit: String(progressUnit || '%'), color: 'from-green-400 to-teal-500' },
      { label: String(achievementsLabel || 'Achievements'), value: achievementCount.toString(), unit: String(achievementsUnit || 'unlocked'), color: 'from-pink-400 to-rose-500' },
      { label: strings.drill?.stats?.totalDrills || 'Drills', value: drillCount.toString(), unit: strings.drill?.stats?.drillsUnit || 'completed', color: 'from-indigo-400 to-blue-500' },
      { label: strings.drill?.stats?.accuracy || 'Drill Accuracy', value: drillAccuracy.toString(), unit: '%', color: 'from-teal-400 to-green-500' },
      { label: strings.drill?.stats?.mastery || 'Drill Mastery', value: drillMastery.toString(), unit: '%', color: 'from-purple-400 to-indigo-500' },
    ]
  }

  const learningStats = getLearningStats()

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={strings.dashboard?.loading || "Loading your dashboard..."}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  // If no user after auth has loaded, show loading while redirecting
  if (!user && !isGuest) {
    return (
      <LoadingOverlay
        isLoading={true}
        message="Redirecting..."
        showDoshi={false}
        fullScreen={true}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800 transition-colors duration-500">
      {/* Confetti for successful donation */}
      {showConfetti && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 0}
          height={typeof window !== 'undefined' ? window.innerHeight : 0}
          recycle={false}
          numberOfPieces={200}
          gravity={0.1}
        />
      )}

      {/* Animated background pattern */}
      <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ef4444' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Navbar */}
      <Navbar user={user} showUserMenu={true} />
      

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Guest Mode Banner */}
        {isGuest && (
          <GuestModeBanner className="mb-6" />
        )}

        {/* Welcome Section - Mobile Collapsible, Desktop Full */}
        <div className="mb-8">
          {/* Mobile Version - Collapsible */}
          <div className="sm:hidden">
            <div className="bg-gradient-to-br from-white/70 to-white/50 dark:from-dark-800/70 dark:to-dark-800/50 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 dark:border-dark-700/30 relative">
              {/* Compact Doshi Card with Moshimoshi Logo */}
              <div className="relative p-6 flex items-center justify-center gap-4">
                <DoshiMascot
                  size="medium"
                  variant="animated"
                  onClick={() => showToast('Doshi says: がんばって! (Good luck!)', 'success')}
                  className="hover:scale-105 transition-transform duration-300"
                  priority={true}
                />
                <MoshimoshiLogo size="small" animated={true} />

                {/* Expand/Collapse Button - Bottom Right */}
                <button
                  onClick={() => setIsWelcomeExpanded(!isWelcomeExpanded)}
                  className="absolute bottom-2 right-4 p-2 bg-white/50 dark:bg-dark-700/50 backdrop-blur rounded-full shadow-md hover:bg-white/70 dark:hover:bg-dark-700/70 transition-all"
                  aria-label={isWelcomeExpanded ? "Collapse" : "Expand"}
                >
                  <motion.div
                    animate={{ rotate: isWelcomeExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                </button>
              </div>

              {/* Expandable Content with Animation */}
              <AnimatePresence mode="wait">
                {isWelcomeExpanded && (
                  <motion.div
                    initial={{
                      height: 0,
                      opacity: 0,
                      scale: 0.95
                    }}
                    animate={{
                      height: 'auto',
                      opacity: 1,
                      scale: 1,
                      transition: {
                        height: {
                          type: "spring",
                          damping: 20,
                          stiffness: 100,
                          duration: 1.2
                        },
                        opacity: {
                          duration: 0.8,
                          ease: "easeOut"
                        },
                        scale: {
                          type: "spring",
                          damping: 15,
                          stiffness: 150,
                          delay: 0.2
                        }
                      }
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      scale: 0.95,
                      transition: {
                        height: {
                          type: "spring",
                          damping: 25,
                          stiffness: 300,
                          duration: 0.4
                        },
                        opacity: {
                          duration: 0.2,
                          ease: "easeIn"
                        },
                        scale: {
                          duration: 0.2
                        }
                      }
                    }}
                    className="overflow-hidden"
                  >
                    <motion.div
                      className="px-6 pb-6 space-y-4"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: {
                          transition: {
                            staggerChildren: 0.15,
                            delayChildren: 0.4
                          }
                        },
                        hidden: {}
                      }}
                    >
                      {/* Greeting Section */}
                      <motion.div
                        className="text-center space-y-2"
                        variants={{
                          hidden: { y: 20, opacity: 0 },
                          visible: {
                            y: 0,
                            opacity: 1,
                            transition: {
                              type: "spring",
                              damping: 18,
                              stiffness: 150,
                              duration: 0.8
                            }
                          }
                        }}
                      >
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 tracking-wider">
                            {greeting.translation}
                          </span>
                          <span className="text-4xl font-black bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 dark:from-primary-400 dark:via-primary-500 dark:to-primary-600 bg-clip-text text-transparent animate-gradient tracking-tight leading-none">
                            {greeting.text}
                          </span>
                        </div>

                        <h1 className="flex items-baseline justify-center flex-wrap">
                          <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                            {(() => {
                              const name = user?.displayName || user?.email?.split('@')[0] || 'Learner';
                              return name.split(' ').map(word => {
                                if (word.length === 0) return '';
                                if (word.includes("'")) {
                                  const parts = word.split("'");
                                  return parts.map(part =>
                                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                                  ).join("'");
                                }
                                if (word.toLowerCase().startsWith('mc')) {
                                  return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
                                }
                                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                              }).join(' ');
                            })()}
                          </span>
                          <span className="text-xl font-medium text-gray-600 dark:text-gray-400 ml-2">
                            さん
                          </span>
                        </h1>
                      </motion.div>

                      {/* Streak Badge */}
                      {currentStreak > 0 && (
                        <motion.div
                          className="flex justify-center"
                          variants={{
                            hidden: { scale: 0, opacity: 0 },
                            visible: {
                              scale: 1,
                              opacity: 1,
                              transition: {
                                type: "spring",
                                damping: 12,
                                stiffness: 150,
                                bounce: 0.4,
                                duration: 1
                              }
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                            <span className="text-lg animate-pulse">🔥</span>
                            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                              {currentStreak} {currentStreak === 1 ? 'day' : 'days'} streak · Keep it up!
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Stats Grid - First 4 stats for mobile */}
                      <motion.div
                        className="grid grid-cols-2 gap-3"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.12,
                              delayChildren: 0.1
                            }
                          }
                        }}
                      >
                        {learningStats.map((stat, index) => (
                          <motion.div
                            key={stat.label}
                            className="bg-white/50 dark:bg-dark-700/50 backdrop-blur-sm rounded-xl p-3 shadow-md cursor-pointer border-l-4 border-primary-500 dark:border-primary-400"
                            variants={{
                              hidden: {
                                opacity: 0,
                                y: 20,
                                scale: 0.8
                              },
                              visible: {
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                transition: {
                                  type: "spring",
                                  damping: 15,
                                  stiffness: 120,
                                  duration: 0.8
                                }
                              }
                            }}
                            whileHover={{
                              scale: 1.05,
                              transition: { duration: 0.2 }
                            }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSelectedStat(stat.label)
                              setIsStatModalOpen(true)
                            }}
                          >
                            <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                              {stat.value}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{String(stat.unit || '')}</div>
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">
                              {String(stat.label || '')}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>

                      {/* Pokedex Card in Expandable Section */}
                      <motion.div
                        variants={{
                          hidden: {
                            opacity: 0,
                            y: 30,
                            scale: 0.9,
                            rotateX: -15
                          },
                          visible: {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            rotateX: 0,
                            transition: {
                              type: "spring",
                              damping: 14,
                              stiffness: 100,
                              delay: 0.3,
                              duration: 1
                            }
                          }
                        }}
                        style={{ transformPerspective: 1000 }}
                      >
                        <PokedexCard isPremium={false} />
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop Version - Original Layout */}
          <div className="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Welcome Section with Doshi - Takes 2 columns on desktop */}
            <div className="lg:col-span-2 bg-gradient-to-br from-white/70 to-white/50 dark:from-dark-800/70 dark:to-dark-800/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-xl border border-white/20 dark:border-dark-700/30">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <DoshiMascot
                  size="large"
                  variant="animated"
                  onClick={() => showToast('Doshi says: がんばって! (Good luck!)', 'success')}
                  className="flex-shrink-0 hover:scale-105 transition-transform duration-300"
                  priority={true}
                />

                <div className="flex-1 text-center sm:text-left space-y-3">
                  {/* Japanese Greeting with Furigana-style Translation */}
                  <div className="inline-flex flex-col items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mb-1 tracking-wider">
                      {greeting.translation}
                    </span>
                    <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 dark:from-primary-400 dark:via-primary-500 dark:to-primary-600 bg-clip-text text-transparent animate-gradient tracking-tight leading-none">
                      {greeting.text}
                    </span>
                  </div>

                  {/* User Name with San - Improved Typography */}
                  <h1 className="flex items-baseline justify-center sm:justify-start flex-wrap">
                    <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                      {(() => {
                        const name = user?.displayName || user?.email?.split('@')[0] || 'Learner';
                        return name.split(' ').map(word => {
                          if (word.length === 0) return '';
                          if (word.includes("'")) {
                            const parts = word.split("'");
                            return parts.map(part =>
                              part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                            ).join("'");
                          }
                          if (word.toLowerCase().startsWith('mc')) {
                            return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
                          }
                          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                        }).join(' ');
                      })()}
                    </span>
                    <span className="text-2xl sm:text-3xl font-medium text-gray-600 dark:text-gray-400 ml-2">
                      さん
                    </span>
                  </h1>

                  {/* Welcome Message */}
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed font-light">
                    {isFirstVisit
                      ? strings.dashboard?.welcome?.firstVisit || "Welcome to your Japanese learning adventure! Doshi is here to guide you."
                      : strings.dashboard?.welcome?.returning || "Ready to continue your journey? Your dedication is inspiring!"}
                  </p>

                  {/* Optional Motivational Tagline - Enhanced */}
                  {gamificationEnabled && currentStreak > 0 && (
                    <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                        <span className="text-xl animate-pulse">🔥</span>
                        <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                          {currentStreak} {currentStreak === 1 ? 'day' : 'days'} streak · Keep it up!
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid - 2x4 grid (7 cards: 2 rows of 3, 1 row of 1) in 1 column on desktop */}
            <div className="lg:col-span-1 grid grid-cols-2 gap-3 h-full">
              {learningStats.map((stat, index) => (
                <div
                  key={stat.label}
                  onClick={() => {
                    setSelectedStat(stat.label)
                    setIsStatModalOpen(true)
                  }}
                  className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer flex flex-col justify-center border-l-4 border-primary-500 dark:border-primary-400"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`text-xl lg:text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{String(stat.unit || '')}</div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">
                    {String(stat.label || '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pokedex Card - Desktop only (mobile shows in expandable welcome) */}
        <div className="hidden sm:block mb-8">
          <PokedexCard isPremium={false} />
        </div>

        {/* Learning Village - The stunning navigation system */}
        <div className="mb-8 -mx-4 sm:mx-0">
          <LearningVillage />
        </div>

      </main>

      {/* Achievement Toast Notifications */}
      {/* Buy Me a Coffee Button - Floating (Optional) */}
      {!isGuest && user && (
        <BuyMeACoffeeButton variant="floating" />
      )}

      {/* Stat Details Modal */}
      <Modal
        isOpen={isStatModalOpen}
        onClose={() => {
          setIsStatModalOpen(false)
          setSelectedStat(null)
        }}
        title={selectedStat ? getStatBreakdown(selectedStat)?.title : ''}
        size="md"
      >
        {selectedStat && getStatBreakdown(selectedStat) && (
          <div className="space-y-5">
            {/* Description */}
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {getStatBreakdown(selectedStat)?.description}
            </p>

            {/* Formula */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-100 dark:border-primary-900/30">
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-2 flex items-center gap-2">
                📐 {strings.dashboard?.statModals?.formulaLabel || 'Formula'}
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-dark-800 px-3 py-2 rounded">
                {getStatBreakdown(selectedStat)?.formula}
              </p>
            </div>

            {/* What It Means */}
            {getStatBreakdown(selectedStat)?.whatItMeans && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  💡 What it means
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {getStatBreakdown(selectedStat)?.whatItMeans}
                </p>
              </div>
            )}

            {/* Example (for accuracy) */}
            {getStatBreakdown(selectedStat)?.example && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-100 dark:border-amber-900/30">
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                  📝 Example
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {getStatBreakdown(selectedStat)?.example}
                </p>
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                📊 {strings.dashboard?.statModals?.breakdownLabel || 'Breakdown'}
              </h3>
              {getStatBreakdown(selectedStat)?.breakdown.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-start p-3 bg-gray-50 dark:bg-dark-700 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {item.label}
                    </p>
                    {item.detail && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.detail}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-primary-600 dark:text-primary-400 ml-4">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* XP Bonuses (for XP stat) */}
            {getStatBreakdown(selectedStat)?.bonuses && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-100 dark:border-amber-900/30">
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-2">
                  ⚡ Available Bonuses
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>• {getStatBreakdown(selectedStat)?.bonuses?.accuracy}</p>
                  <p>• {getStatBreakdown(selectedStat)?.bonuses?.speed}</p>
                  <p>• {getStatBreakdown(selectedStat)?.bonuses?.streak}</p>
                </div>
              </div>
            )}

            {/* Mastery Levels (for mastery stat) */}
            {getStatBreakdown(selectedStat)?.masterLevels && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-100 dark:border-purple-900/30">
                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                  🏆 Mastery Levels
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>• {getStatBreakdown(selectedStat)?.masterLevels?.beginner}</p>
                  <p>• {getStatBreakdown(selectedStat)?.masterLevels?.developing}</p>
                  <p>• {getStatBreakdown(selectedStat)?.masterLevels?.proficient}</p>
                  <p>• {getStatBreakdown(selectedStat)?.masterLevels?.expert}</p>
                </div>
              </div>
            )}

            {/* How to Improve */}
            {getStatBreakdown(selectedStat)?.howToImprove && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-900/30">
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                  🎯 How to improve
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {getStatBreakdown(selectedStat)?.howToImprove}
                </p>
              </div>
            )}

            {/* Tips (for achievements) */}
            {getStatBreakdown(selectedStat)?.tips && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900/30">
                <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-2">
                  💫 Pro tip
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {getStatBreakdown(selectedStat)?.tips}
                </p>
              </div>
            )}

            {/* Goal Note (for accuracy) */}
            {getStatBreakdown(selectedStat)?.goalNote && (
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 border border-teal-100 dark:border-teal-900/30">
                <p className="text-sm text-teal-700 dark:text-teal-300 font-medium">
                  🎓 {getStatBreakdown(selectedStat)?.goalNote}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsStatModalOpen(false)
                  setSelectedStat(null)
                }}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                {strings.dashboard?.statModals?.close || 'Got it!'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Main export with Suspense wrapper
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <LoadingOverlay
        isLoading={true}
        message="Loading your dashboard..."
        showDoshi={true}
        fullScreen={true}
      />
    }>
      <DashboardContent />
    </Suspense>
  )
}