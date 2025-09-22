'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
// import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useErrorToast } from '@/hooks/useErrorToast'
import { useTranslation } from '@/i18n/I18nContext'
import { useSubscription } from '@/hooks/useSubscription'
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus'
import { InvoiceHistory } from '@/components/subscription/InvoiceHistory'
import DoshiMascot from '@/components/ui/DoshiMascot'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay, LoadingButton } from '@/components/ui/Loading'
import Dialog from '@/components/ui/Dialog'
import Image from 'next/image'
import PageContainer from '@/components/ui/PageContainer'
import PageHeader from '@/components/ui/PageHeader'
import Section from '@/components/ui/Section'
import { PRICING_CONFIG } from '@/config/pricing'
import { PremiumBadge } from '@/components/common/PremiumBadge'
import dynamic from 'next/dynamic'
import { useAchievementStore } from '@/stores/achievement-store'
import { useStreakStore } from '@/stores/streakStore'
import logger from '@/lib/logger'

// Dynamically import Confetti to avoid SSR issues
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

interface User {
  displayName: string;
  email: string;
  photoURL: string;
  tier: string;
  emailVerified: boolean;
  isGuest?: boolean;
}

function AccountPageContent() {
  const { strings } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { showError } = useErrorToast()
  const { subscription, upgradeToPremium, isPremium } = useSubscription()
  logger.subscription('[Account Page] Subscription from hook:', subscription)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Achievement and streak stores for real statistics
  const {
    initialize: initializeAchievements,
    getTotalPoints,
    getCompletionPercentage,
    getRecentAchievements,
    getTotalLessonsCompleted,
    getCurrentLevel,
    getTotalXp,
    getUnlockedAchievements
  } = useAchievementStore()

  const { currentStreak, bestStreak, getDaysActive } = useStreakStore()
  const [updating, setUpdating] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [profileUpdated, setProfileUpdated] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Get pricing from configuration
  const monthlyPrice = PRICING_CONFIG.monthly.displayAmount
  const yearlyPrice = PRICING_CONFIG.yearly.displayAmount
  const currency = PRICING_CONFIG.currency
  const currencySymbol = PRICING_CONFIG.currencySymbol

  // Check for checkout success from URL params
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setShowConfetti(true)
      setShowCongrats(true)

      // Hide confetti after 10 seconds
      setTimeout(() => {
        setShowConfetti(false)
      }, 10000)

      // Clear URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('checkout')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()

        if (data.authenticated) {
          setUser(data.user)
          setDisplayName(data.user.displayName || '')

          // Initialize achievement store with user data
          if (data.user?.uid) {
            await initializeAchievements(data.user.uid, isPremium)
          }
        } else {
          router.push('/auth/signin')
        }
      } catch (error) {
        logger.error('Session check failed:', error)
        router.push('/auth/signin')
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [router, initializeAchievements, isPremium])

  const handleUpdateProfile = async () => {
    setUpdating(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      showToast(strings.account.toastMessages.profileUpdated, 'success')
      setProfileUpdated(true)

      // Update local state
      if (user) {
        setUser({ ...user, displayName })
      }
    } catch (error) {
      showError(error)
    } finally {
      setUpdating(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'error')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be less than 2MB', 'error')
      return
    }

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Upload failed')
      }

      // Update local state with new photo URL
      if (user) {
        setUser({ ...user, photoURL: data.photoURL })
      }

      showToast('Profile photo updated successfully', 'success')
    } catch (error) {
      logger.error('Avatar upload error:', error)
      showError(error)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true)
    try {
      const response = await fetch('/api/user/upload-avatar', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Delete failed')
      }

      // Update local state to remove photo URL
      if (user) {
        setUser({ ...user, photoURL: '' })
      }

      showToast('Profile photo removed', 'success')
    } catch (error) {
      logger.error('Avatar delete error:', error)
      showError(error)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      showToast(strings.account.toastMessages.accountDeletionRequested, 'warning')
      setDeleteModalOpen(false)
    } catch (error) {
      showError(error)
    }
  }

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={strings.account.loadingMessage}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  return (
    <PageContainer gradient="default" showPattern={true}>
      {/* Confetti for successful checkout */}
      {showConfetti && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 0}
          height={typeof window !== 'undefined' ? window.innerHeight : 0}
          recycle={false}
          numberOfPieces={500}
          gravity={0.2}
        />
      )}

      {/* Congratulations message */}
      {showCongrats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-4 shadow-2xl transform animate-bounce-in">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">
                {strings.subscription?.congratulations || 'Congratulations!'}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                {strings.subscription?.welcomePremium || 'Welcome to Premium! Enjoy all the amazing features.'}
              </p>
              <button
                onClick={() => setShowCongrats(false)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:scale-105 transition-transform"
              >
                {strings.common?.continue || 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <Navbar
        user={user || undefined}
        showUserMenu={true}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          title={strings.account.pageTitle}
          description={strings.account.pageDescription}
          showDoshi={true}
          doshiMood={profileUpdated ? 'excited' : 'happy'}
          doshiSize="medium"
        />

        <div className="space-y-6">
          {/* Profile Information */}
          <Section
            variant="glass"
            title={strings.account.sections.profileInformation}
            icon={<DoshiMascot size="xsmall" />}
          >
            
            <div className="space-y-4">
              {/* Profile Picture */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}
                  {user?.photoURL ? (
                    <>
                      <Image
                        src={user.photoURL}
                        alt="Profile"
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-full ring-4 ring-primary-400 dark:ring-primary-500 object-cover"
                      />
                      {isPremium && (
                        <div className="absolute -top-2 -right-2">
                          <PremiumBadge size="sm" />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                        {user?.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      {isPremium && (
                        <div className="absolute -top-2 -right-2">
                          <PremiumBadge size="sm" />
                        </div>
                      )}
                    </>
                  )}
                  <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full hover:bg-primary-600 transition-colors cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{strings.account.profileFields.profilePhoto}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{strings.account.profileFields.photoDescription}</p>
                  {user?.photoURL && (
                    <div className="mt-2 flex gap-2">
                      <label
                        htmlFor="avatar-upload"
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer font-medium"
                      >
                        Change photo
                      </label>
                      <span className="text-xs text-gray-400">•</span>
                      <button
                        onClick={handleRemoveAvatar}
                        disabled={uploadingAvatar}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                      >
                        Remove photo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {strings.account.profileFields.displayName}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={strings.account.profileFields.namePlaceholder}
                  className="w-full px-4 py-2 bg-white dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {strings.account.profileFields.emailAddress}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 pr-20 bg-gray-100 dark:bg-dark-900/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                  {user?.emailVerified ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {strings.account.profileFields.verified}
                    </span>
                  ) : (
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition-colors">
                      {strings.account.profileFields.verify}
                    </button>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <LoadingButton
                isLoading={updating}
                onClick={handleUpdateProfile}
                loadingText={strings.account.buttons.updating}
                className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
              >
                {strings.account.buttons.saveChanges}
              </LoadingButton>
            </div>
          </Section>

          {/* Account Stats (Hidden for Guests) */}
          {!user?.isGuest && user?.tier !== 'guest' && (
            <Section
              variant="glass"
              title={strings.account.sections.accountStatistics}
            >

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {getTotalXp ? getTotalXp() : 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.xpEarned || 'XP Earned'}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {getTotalLessonsCompleted ? getTotalLessonsCompleted() : 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.lessonsCompleted || 'Lessons Completed'}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {getUnlockedAchievements ? getUnlockedAchievements().length : 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.achievements}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {currentStreak || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.dayStreak}</div>
              </div>
            </div>

            {/* Additional Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {bestStreak || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.bestStreak || 'Best Streak'}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-lg">
                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {Math.round(getCompletionPercentage ? getCompletionPercentage() : 0)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.completion || 'Completion'}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {getCurrentLevel ? getCurrentLevel() : 'Beginner'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{strings.account.statistics.level || 'Level'}</div>
              </div>
            </div>
          </Section>
          )}

          {/* Subscription Section */}
          <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {strings.account.sections.subscription}
            </h2>
            
            {/* Current Plan Display */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {strings.account.subscription.currentPlan}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-2xl font-bold ${
                      subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly'
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {subscription?.plan === 'premium_monthly'
                        ? strings.subscription.plans.premiumMonthly
                        : subscription?.plan === 'premium_yearly'
                        ? strings.subscription.plans.premiumYearly
                        : strings.subscription.plans.free}
                    </span>
                    {(subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly') && (
                      <span className="px-2 py-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-bold rounded-full">
                        {strings.common.premium}
                      </span>
                    )}
                  </div>
                </div>
                {subscription?.plan !== 'premium_monthly' && subscription?.plan !== 'premium_yearly' && (
                  <DoshiMascot size="small" />
                )}
              </div>
            </div>

            {/* Guest User Message */}
            {(user?.isGuest || user?.tier === 'guest') && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  You're currently exploring as a guest. Sign up for a free account to save your progress and unlock premium features!
                </p>
                <a
                  href="/auth/signup"
                  className="inline-block mt-3 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
                >
                  Sign Up Free
                </a>
              </div>
            )}

            {/* Upgrade Options for Free Users (Hidden for Guests) */}
            {subscription?.plan !== 'premium_monthly' && subscription?.plan !== 'premium_yearly' && !user?.isGuest && user?.tier !== 'guest' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {strings.account.subscription.upgradeText}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Monthly Plan Card */}
                  <div className="relative border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {strings.subscription.plans.premiumMonthly}
                      </h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {currencySymbol}{monthlyPrice}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">/month</span>
                      </div>
                    </div>
                    <ul className="text-sm space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700 dark:text-gray-300">{(strings.subscription.features as any).unlimited || 'Unlimited practice sessions'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700 dark:text-gray-300">{(strings.subscription.features as any).cancelAnytime || 'Cancel anytime'}</span>
                      </li>
                    </ul>
                    <button
                      onClick={() => upgradeToPremium('premium_monthly')}
                      className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
                    >
                      {(strings.subscription.upgrade as any).selectMonthly || 'Choose Monthly'}
                    </button>
                  </div>

                  {/* Yearly Plan Card */}
                  <div className="relative border-2 border-primary-500 dark:border-primary-400 rounded-lg p-4 bg-gradient-to-br from-primary-50/50 to-transparent dark:from-primary-900/10">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-bold rounded-full">
                        {(strings.subscription as any).bestValue || 'BEST VALUE'}
                      </span>
                    </div>
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {strings.subscription.plans.premiumYearly}
                      </h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {currencySymbol}{yearlyPrice}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">/year</span>
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                        {(strings.subscription as any).savings || 'Save 25% with annual billing'}
                      </p>
                    </div>
                    <ul className="text-sm space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700 dark:text-gray-300">{(strings.subscription.features as any).unlimited || 'Unlimited practice sessions'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700 dark:text-gray-300">{strings.subscription.features.bestValue}</span>
                      </li>
                    </ul>
                    <button
                      onClick={() => upgradeToPremium('premium_yearly')}
                      className="w-full px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium rounded-lg transition-all"
                    >
                      {(strings.subscription.upgrade as any).selectYearly || 'Choose Yearly'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Premium User Status */}
            {(subscription?.plan === 'premium_monthly' || subscription?.plan === 'premium_yearly') && (
              <SubscriptionStatus showActions={true} />
            )}
          </div>

          {/* Invoice History */}
          {subscription?.stripeCustomerId && (
            <InvoiceHistory customerId={subscription.stripeCustomerId} />
          )}

          {/* Danger Zone (Hidden for Guests) */}
          {!user?.isGuest && user?.tier !== 'guest' && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              {strings.account.sections.dangerZone}
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {strings.account.dangerZone.description}
                </p>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  {strings.account.buttons.deleteAccount}
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </main>

      {/* Delete Account Dialog */}
      <Dialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title={strings.account.deleteAccountDialog.title}
        message={strings.account.deleteAccountDialog.message}
        type="danger"
        confirmText={strings.account.deleteAccountDialog.confirmText}
        cancelText={strings.account.deleteAccountDialog.cancelText}
      />
    </PageContainer>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <LoadingOverlay
        isLoading={true}
        message="Loading account..."
        showDoshi={true}
        fullScreen={true}
      />
    }>
      <AccountPageContent />
    </Suspense>
  )
}