'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import DoshiMascot from '@/components/ui/DoshiMascot'
import Drawer from '@/components/ui/Drawer'
import { useTranslation } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
// import { useAuth } from '@/hooks/useAuth' // Temporarily disabled - using session API directly

export default function HomePage() {
  const { strings } = useTranslation()
  const router = useRouter()
  const { showToast } = useToast()
  // const { user } = useAuth() // Temporarily disabled - using session API directly
  const [user, setUser] = useState<any>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showDoshiModal, setShowDoshiModal] = useState(false)

  useEffect(() => {
    setMounted(true)
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      // Check if this is a guest
      const isGuest = sessionStorage.getItem('isGuestUser') === 'true'

      if (isGuest) {
        // Don't show user menu for guests on homepage
        console.log('[HomePage] Guest mode detected')
        return
      }

      // Check for authenticated user
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      if (data.authenticated) {
        console.log('[HomePage] User session found:', data.user)
        setUser(data.user)
      } else {
        console.log('[HomePage] No session found')
      }
    } catch (error) {
      console.error('[HomePage] Session check failed:', error)
    }
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-background-light to-japanese-mizu/20 dark:from-dark-850 dark:to-dark-900 overflow-hidden">
      {/* Decorative elements - hidden on mobile for better performance */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute top-20 left-10 w-32 h-32 bg-japanese-sakura/30 dark:bg-japanese-sakuraDark/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-60 right-20 w-40 h-40 bg-japanese-matcha/30 dark:bg-japanese-matchaDark/20 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-40 left-1/3 w-36 h-36 bg-japanese-zen/30 dark:bg-japanese-zenDark/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Navbar */}
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-4 sm:py-8 relative z-10">

        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center mt-8 sm:mt-16">
          <div className="mb-6 sm:mb-8 relative inline-block">
            <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 bg-japanese-zen text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-bold animate-bounce">
              {strings.landing.hero.badge}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {strings.landing.hero.title}
            </h1>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary-500 to-japanese-sakura bg-clip-text text-transparent">
              {strings.landing.hero.subtitle} 
              {mounted && (
                <span 
                  className="inline-block ml-1 sm:ml-2 text-3xl sm:text-4xl lg:text-5xl cursor-pointer transform transition-transform"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  style={{ transform: isHovered ? 'rotate(20deg) scale(1.2)' : 'rotate(0deg) scale(1)' }}
                >
                  🎌
                </span>
              )}
            </h2>
          </div>
          
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
            {strings.landing.hero.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 px-4">
            <button
              onClick={() => {
                // Simply mark as guest and navigate to dashboard
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('isGuestUser', 'true');
                }
                showToast('Welcome! Exploring as a guest...', 'info');
                router.push('/dashboard');
              }}
              className="group px-6 py-4 sm:px-8 sm:py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl sm:rounded-2xl hover:from-primary-600 hover:to-primary-700 transition-all font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 text-center cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                {strings.landing.hero.primaryCta}
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </button>
            <Link 
              href="/auth/signin"
              className="px-6 py-4 sm:px-8 sm:py-5 bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-dark-600 rounded-xl sm:rounded-2xl hover:border-primary-400 dark:hover:border-primary-500 transition-all font-bold text-base sm:text-lg shadow-md hover:shadow-lg text-center"
            >
              {strings.landing.hero.secondaryCta}
            </Link>
          </div>

          {/* Character Mascots */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 justify-center max-w-lg sm:max-w-none mx-auto mb-12 sm:mb-16 px-4">
            <div className="group cursor-pointer flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-japanese-sakura to-pink-400 rounded-full flex items-center justify-center text-4xl sm:text-5xl shadow-lg group-hover:scale-110 transition-transform">
                🌸
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">{strings.landing.mascots.sakura}</p>
            </div>
            <div className="group cursor-pointer flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-japanese-matcha to-green-400 rounded-full flex items-center justify-center text-4xl sm:text-5xl shadow-lg group-hover:scale-110 transition-transform">
                🍵
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">{strings.landing.mascots.matcha}</p>
            </div>
            <div className="group cursor-pointer flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-japanese-mizu to-blue-400 rounded-full flex items-center justify-center text-4xl sm:text-5xl shadow-lg group-hover:scale-110 transition-transform">
                🗾
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">{strings.landing.mascots.fuji}</p>
            </div>
            <div className="group cursor-pointer flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-japanese-zen to-yellow-400 rounded-full flex items-center justify-center text-4xl sm:text-5xl shadow-lg group-hover:scale-110 transition-transform">
                ⛩️
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">{strings.landing.mascots.torii}</p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto px-4">
            <div className="group p-6 bg-white dark:bg-surface-dark rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-primary-400 dark:hover:border-primary-500">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto group-hover:scale-110 transition-transform">
                🎯
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                {strings.landing.features.personalizedLearning.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {strings.landing.features.personalizedLearning.description}
              </p>
            </div>
            
            <div className="group p-6 bg-white dark:bg-surface-dark rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-japanese-matcha dark:hover:border-japanese-matchaDark">
              <div className="w-16 h-16 bg-gradient-to-br from-japanese-matcha to-green-500 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto group-hover:scale-110 transition-transform">
                🏆
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                {strings.landing.features.stayMotivated.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {strings.landing.features.stayMotivated.description}
              </p>
            </div>
            
            <div className="group p-6 bg-white dark:bg-surface-dark rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-japanese-mizu dark:hover:border-japanese-mizuDark">
              <div className="w-16 h-16 bg-gradient-to-br from-japanese-mizu to-blue-500 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto group-hover:scale-110 transition-transform">
                📚
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                {strings.landing.features.smartReview.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {strings.landing.features.smartReview.description}
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-16 sm:mt-20 p-6 sm:p-8 bg-gradient-to-r from-primary-50 to-japanese-sakura/20 dark:from-dark-700 dark:to-dark-800 rounded-2xl sm:rounded-3xl mx-4 sm:mx-0">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 sm:mb-8">
              {strings.landing.stats.title}
            </h3>
            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-600 dark:text-primary-400">{strings.landing.stats.activeLearners.number}</div>
                <div className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">{strings.landing.stats.activeLearners.label}</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-japanese-matcha dark:text-japanese-matchaDark">{strings.landing.stats.lessons.number}</div>
                <div className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">{strings.landing.stats.lessons.label}</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-japanese-mizu dark:text-japanese-mizuDark">{strings.landing.stats.successRate.number}</div>
                <div className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400">{strings.landing.stats.successRate.label}</div>
              </div>
            </div>
          </div>

          {/* Progress Preview */}
          <div className="mt-12 sm:mt-16 max-w-2xl mx-auto px-4">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">
              {strings.landing.progressPreview.title}
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100">{strings.landing.progressPreview.stage1.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{strings.landing.progressPreview.stage1.description}</p>
                </div>
                <div className="text-2xl">✨</div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-white/50 dark:bg-surface-dark/50 rounded-xl">
                <div className="w-12 h-12 bg-gray-200 dark:bg-dark-600 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold">
                  2
                </div>
                <div className="flex-1 text-left opacity-60">
                  <h4 className="font-bold text-gray-700 dark:text-gray-300">{strings.landing.progressPreview.stage2.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{strings.landing.progressPreview.stage2.description}</p>
                </div>
                <div className="text-2xl opacity-30">⭐</div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-white/30 dark:bg-surface-dark/30 rounded-xl">
                <div className="w-12 h-12 bg-gray-200 dark:bg-dark-600 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold">
                  3
                </div>
                <div className="flex-1 text-left opacity-40">
                  <h4 className="font-bold text-gray-700 dark:text-gray-300">{strings.landing.progressPreview.stage3.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{strings.landing.progressPreview.stage3.description}</p>
                </div>
                <div className="text-2xl opacity-30">⭐</div>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-16 sm:mt-20 text-center px-4">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
              {strings.landing.finalCta.title}
            </h3>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
              {strings.landing.finalCta.description}
            </p>
            <Link 
              href="/auth/signup"
              className="group inline-block px-6 py-4 sm:px-10 sm:py-6 bg-gradient-to-r from-primary-500 via-primary-600 to-japanese-sakura text-white rounded-2xl sm:rounded-3xl hover:from-primary-600 hover:via-primary-700 hover:to-japanese-sakuraDark transition-all font-bold text-lg sm:text-xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-2"
            >
              <span className="flex items-center justify-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl animate-bounce">🚀</span>
                {strings.landing.finalCta.buttonText}
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* About Doshi Modal */}
      <Drawer
        isOpen={showDoshiModal}
        onClose={() => {
          setShowDoshiModal(false)
        }}
        title="About Moshimoshi"
        position="bottom"
        size="large"
      >
        <div className="px-4 sm:px-6 py-4 sm:py-6 pb-8">
          <div className="flex flex-col items-center space-y-4">
            {/* Red Panda Mascot Animation */}
            <div className="flex flex-col items-center gap-4">
              <DoshiMascot
                variant="animated"
                size="large"
                priority
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                Meet Doshi, our adorable red panda mascot!
              </p>
            </div>
            
            {/* Profile Picture */}
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-200 dark:border-primary-700 shadow-lg">
              <Image
                src="/doshi-emma.JPG"
                alt="Emmanuel - Creator of Moshimoshi"
                width={96}
                priority
                height={96}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Description */}
            <div className="text-center space-y-4 text-gray-600 dark:text-gray-400 max-w-md">
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                Hi, I'm Emmanuel — and I love learning Japanese.
              </p>
              <p>
                But learning a language isn't always easy. I've been there — bouncing between apps, flashcards, grammar charts, and never feeling fully immersed.
              </p>
              <p>
                Moshimoshi is the app I always dreamed of: one space to read, listen, practise, and grow. It's made with care, for people who love Japanese and want to learn it their way.
              </p>
              <p>
                I hope it brings you joy, confidence, and a sense of flow. 🌱
              </p>
              <p className="text-sm italic pt-4 border-t border-gray-200 dark:border-gray-700">
                "Moshimoshi" (もしもし) is what you say when answering the phone in Japanese — it's our way of saying "hello" to your Japanese learning journey!
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                Welcome to Moshimoshi!
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowDoshiModal(false)}
              className="mt-4 px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
            >
              Got it! ✨
            </button>
          </div>
        </div>
      </Drawer>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left side - Brand and Copyright */}
            <div className="text-center md:text-left">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                © 2025 Moshimoshi. All rights reserved.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Made with ❤️ for Japanese learners
              </p>
            </div>

            {/* Right side - Links */}
            <div className="flex flex-wrap justify-center gap-6">
              <Link
                href="/privacy"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/contact"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              >
                Contact Us
              </Link>
              <a
                href="mailto:support@moshimoshi.app"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}