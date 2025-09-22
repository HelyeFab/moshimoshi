'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import DoshiMascot from '@/components/ui/DoshiMascot'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay } from '@/components/ui/Loading'
import Tooltip from '@/components/ui/Tooltip'
import LearningVillage from '@/components/dashboard/LearningVillage'
import AchievementDisplay from '@/components/dashboard/AchievementDisplay'
import StreakCounter from '@/components/layout/StreakCounter'
import AchievementToast from '@/components/notifications/AchievementToast'
import SRSProgress from '@/components/dashboard/SRSProgress'
import QueueInsights from '@/components/dashboard/QueueInsights'
import LeechManager from '@/components/dashboard/LeechManager'
import SessionStats from '@/components/dashboard/SessionStats'
import { useAchievementStore } from '@/stores/achievement-store'
import { useStreakStore } from '@/stores/streakStore'
import { loadStreakFromFirestore, subscribeToStreakFromFirestore } from '@/lib/sync/streakSync'
import BuyMeACoffeeButton from '@/components/common/BuyMeACoffeeButton'
import PokedexCard from '@/components/pokedex/PokedexCard'
import { useSubscription } from '@/hooks/useSubscription'
import GuestModeBanner from '@/components/ui/GuestModeBanner'
import { useAuth } from '@/hooks/useAuth'
import { useReviewData } from '@/hooks/useReviewData'
import { useReviewStats } from '@/hooks/useReviewStats'
import logger from '@/lib/logger'

// Dynamically import Confetti to avoid SSR issues
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

// Learning stats will be dynamic based on achievement data


export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { user, loading: authLoading, isGuest, isAuthenticated } = useAuth()
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'insights'>('overview')
  const [hasCheckedFirstVisit, setHasCheckedFirstVisit] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // Subscription state
  const { subscription, isPremium } = useSubscription()

  // Achievement store
  const {
    initialize: initializeAchievements,
    getTotalPoints,
    getCompletionPercentage,
    getRecentAchievements
  } = useAchievementStore()

  // Streak store
  const { currentStreak } = useStreakStore()

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
  
  // Initialize achievements when user and subscription are loaded
  useEffect(() => {
    if (user?.uid && subscription !== null) {
      initializeAchievements(user.uid, isPremium)
    }
  }, [user?.uid, isPremium, subscription, initializeAchievements])

  // Initialize streak data from Firebase
  useEffect(() => {
    if (!user?.uid || subscription === null) return

    // Load initial streak data
    if (isPremium) {
      loadStreakFromFirestore()
    }

    // Don't set up subscription here - it's handled by StreakCounter component
  }, [user?.uid, isPremium, subscription])




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
  
  // Dynamic learning stats
  const getLearningStats = () => {
    const totalPoints = getTotalPoints() || 0
    const completionPercentage = getCompletionPercentage() || 0
    const recentAchievements = getRecentAchievements() || []
    const streakValue = currentStreak || 0

    return [
      { label: strings.dashboard?.stats?.streak || 'Streak', value: streakValue.toString(), unit: strings.dashboard?.stats?.days || 'days', color: 'from-orange-400 to-red-500' },
      { label: strings.dashboard?.stats?.xp || 'XP Earned', value: totalPoints.toString(), unit: strings.dashboard?.stats?.points || 'points', color: 'from-blue-400 to-purple-500' },
      { label: strings.dashboard?.stats?.progress || 'Progress', value: Math.round(completionPercentage).toString(), unit: '%', color: 'from-green-400 to-teal-500' },
      { label: strings.dashboard?.stats?.achievements || 'Achievements', value: recentAchievements.length.toString(), unit: strings.dashboard?.stats?.recent || 'recent', color: 'from-pink-400 to-rose-500' },
    ]
  }

  const learningStats = getLearningStats()

  // Fetch real review data using custom hooks
  const {
    srsItems,
    queueItems,
    sessions,
    currentSession,
    leeches,
    loading: reviewDataLoading,
    error: reviewDataError
  } = useReviewData()

  const {
    stats: reviewStats,
    loading: statsLoading,
    error: statsError
  } = useReviewStats()

  // Transform queue items for QueueInsights component
  const formattedQueueItems = queueItems.map((item: any) => ({
    id: item.id,
    content: {
      primaryDisplay: item.primaryDisplay || item.content,
      contentType: item.contentType || item.type,
      source: item.source || 'Review Queue'
    },
    priority: item.priority || calculatePriority(item),
    priorityBreakdown: item.priorityBreakdown || {
      overdue: item.dueIn < 0 ? Math.abs(item.dueIn) * 10 : 0,
      learning: item.state === 'learning' ? 20 : 0,
      lowSuccess: item.successRate < 0.6 ? 40 : 0,
      newItem: item.state === 'new' ? 30 : 0
    },
    nextReviewDate: item.nextReviewDate || new Date(),
    successRate: item.successRate || 0,
    failureCount: item.failureCount || 0,
    state: item.state || 'new'
  }))

  // Helper function to calculate priority
  const calculatePriority = (item: any) => {
    let priority = 0
    if (item.dueIn < 0) priority += Math.min(100, Math.abs(item.dueIn) * 10)
    if (item.state === 'learning') priority += 20
    if (item.successRate < 0.6) priority += 40
    if (item.state === 'new') priority += 30
    return Math.min(100, priority)
  }

  // Show loading state while auth or review data is loading
  if (authLoading || reviewDataLoading || statsLoading) {
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

        {/* Welcome Section and Stats in Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
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
                      // Properly capitalize each word
                      return name.split(' ').map(word => {
                        if (word.length === 0) return '';
                        // Handle special cases like "O'Connor" or "McDonald"
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
                {currentStreak > 0 && (
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

          {/* Stats Grid - 2x2 grid in 1 column on desktop */}
          <div className="lg:col-span-1 grid grid-cols-2 gap-4 h-full">
            {learningStats.map((stat, index) => (
              <div
                key={stat.label}
                className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer flex flex-col justify-center"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`text-2xl lg:text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{stat.unit}</div>
                <div className="text-xs lg:text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pokedex Card - Shows only if Pokemon caught */}
        <div className="mb-8">
          <PokedexCard isPremium={false} />
        </div>

        {/* Learning Village - The stunning navigation system */}
        <div className="mb-8 -mx-4 sm:mx-0">
          <LearningVillage />
        </div>

        {/* Achievement Display */}
        <div className="mb-8">
          <AchievementDisplay maxItems={12} />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-2 bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'overview' 
                ? 'bg-primary-500 text-white shadow-lg' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {strings.dashboard?.tabs?.overview || 'Overview'}
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'progress' 
                ? 'bg-primary-500 text-white shadow-lg' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {strings.dashboard?.tabs?.progress || 'SRS Progress'}
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'insights' 
                ? 'bg-primary-500 text-white shadow-lg' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
            }`}
          >
            {strings.dashboard?.tabs?.insights || 'Queue & Leeches'}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Progress Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Goal */}
          <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">{strings.dashboard?.dailyGoal?.title || 'Daily Goal'}</h3>
              <Tooltip content={strings.dashboard?.dailyGoal?.tooltip || "Complete 30 minutes of study each day"}>
                <DoshiMascot size="xsmall" />
              </Tooltip>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{strings.dashboard?.dailyGoal?.progress || 'Progress'}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">0/30 {strings.dashboard?.dailyGoal?.minutes || 'min'}</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {strings.dashboard?.dailyGoal?.startPractice || 'Start your daily practice to reach your goal!'}
              </p>
            </div>
          </div>

          {/* Recent Achievement */}
          <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">{strings.dashboard?.achievements?.latest || 'Latest Achievement'}</h3>
              <DoshiMascot size="xsmall" />
            </div>
            {(() => {
              const recentAchievements = getRecentAchievements() || []
              return recentAchievements.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">{recentAchievements[0]?.icon || '🎯'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {recentAchievements[0]?.name || strings.dashboard?.achievements?.unlocked || 'Achievement Unlocked!'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {recentAchievements[0]?.description || strings.dashboard?.achievements?.keepLearning || 'Keep learning to unlock more!'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      +{recentAchievements[0]?.points || 0} points
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{strings.dashboard?.achievements?.readyToStart || 'Ready to Start!'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strings.dashboard?.achievements?.completeFirst || 'Complete your first lesson to earn achievements'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{strings.dashboard?.achievements?.journeyBegins || 'Your journey begins now'}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
          </>
        )}

        {/* SRS Progress Tab */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <SRSProgress
              items={srsItems}
              showLabels={true}
            />

            {/* Session Statistics */}
            <SessionStats />
          </div>
        )}

        {/* Queue & Leeches Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            <QueueInsights
              items={formattedQueueItems}
              showTitle={true}
              maxItems={5}
            />

            <div className="border-t border-gray-200 dark:border-gray-700 my-8" />

            <LeechManager
              leeches={leeches}
              onResetItem={(id) => showToast(`Reset item ${id} to new`, 'success')}
              onAdjustDifficulty={(id, diff) => showToast(`Adjusted difficulty for ${id}`, 'success')}
              onAddToSpecialPractice={(id) => showToast(`Added ${id} to practice list`, 'success')}
              showTitle={true}
            />
          </div>
        )}

        {/* Account Info (Redesigned) */}
        <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">{strings.dashboard?.account?.title || 'Account Details'}</h3>
            <div className="flex items-center gap-2">
              {user?.tier === 'premium.monthly' || user?.tier === 'premium.yearly' ? (
                <>
                  <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg">
                    PREMIUM
                  </span>
                  <DoshiMascot size="xsmall" />
                </>
              ) : (
                <>
                  <span className="px-3 py-1 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full">
                    {user?.tier === 'guest' ? 'GUEST' : 'FREE'}
                  </span>
                  <Tooltip content={strings.dashboard?.account?.upgradeTooltip || "Upgrade to Premium for unlimited lessons!"}>
                    <Link href="/pricing" className="text-primary-500 hover:text-primary-600 transition-colors">
                      <span className="text-sm">{strings.dashboard?.account?.upgrade || 'Upgrade'} →</span>
                    </Link>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{strings.dashboard?.account?.email || 'Email'}</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{user?.email}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">{strings.dashboard?.account?.memberSince || 'Member Since'}</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {user?.metadata?.creationTime ? 
                  new Date(user.metadata.creationTime).toLocaleDateString() : 
                  strings.dashboard?.account?.recentlyJoined || 'Recently joined'}
              </p>
            </div>
            {user?.emailVerified !== undefined && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">{strings.dashboard?.account?.emailStatus || 'Email Status'}</span>
                <p className={`font-medium ${user.emailVerified ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {user.emailVerified ? `✓ ${strings.dashboard?.account?.verified || 'Verified'}` : `⚠ ${strings.dashboard?.account?.pendingVerification || 'Pending Verification'}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dev Notes (Styled) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-300 dark:border-yellow-700">
            <div className="flex items-start gap-3">
              <DoshiMascot size="xsmall" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                  {strings.dashboard?.devMode || 'Developer Mode'}
                </p>
                <Link 
                  href="/auth-test"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  → Auth Test Page
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Achievement Toast Notifications */}
      <AchievementToast />
      {/* Buy Me a Coffee Button - Floating (Optional) */}
      {!isGuest && user && (
        <BuyMeACoffeeButton variant="floating" />
      )}
    </div>
  )
}