'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocalePath } from '@/i18n/I18nContext'
import Logo from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

interface NavigationProps {
  isPreLaunch: boolean
  landingStrings: any
  locale: string
}

export default function Navigation({ isPreLaunch, landingStrings, locale }: NavigationProps) {
  const router = useRouter()
  const { getLocalePath } = useLocalePath()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 shadow-sm">
        <nav className="container mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Logo />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href={getLocalePath('/blog')}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
            >
              Blog
            </Link>

            <ThemeToggle />

            {isPreLaunch ? (
              <Button
                onClick={() => router.push(getLocalePath('/waitlist'))}
                className="bg-gradient-to-r from-primary-500 to-japanese-sakura hover:from-primary-600 hover:to-japanese-sakuraDark text-white shadow-lg"
              >
                {landingStrings.hero.preLaunch?.joinWaitlistDiscount || 'Join Waitlist - Get 25% Off'}
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <>
                <Link href={getLocalePath('/auth/signin')}>
                  <Button variant="ghost">
                    {landingStrings.hero.cta?.signIn || 'Sign In'}
                  </Button>
                </Link>
                <Link href={getLocalePath('/auth/signup')}>
                  <Button className="bg-gradient-to-r from-primary-500 to-japanese-sakura hover:from-primary-600 hover:to-japanese-sakuraDark text-white shadow-lg">
                    {landingStrings.hero.cta?.getStarted || 'Get Started'}
                    <ArrowRightIcon className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Dropdown */}
      <div className={`md:hidden fixed top-20 right-4 w-64 bg-white dark:bg-gray-900 shadow-2xl z-50 transition-transform duration-300 ease-out border border-gray-200 dark:border-gray-800 rounded-2xl ${
        mobileMenuOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}>
        <div className="flex flex-col p-4 space-y-3">
          {/* Blog Link */}
          <Link
            href={getLocalePath('/blog')}
            onClick={() => setMobileMenuOpen(false)}
            className="py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Blog
          </Link>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
            <ThemeToggle />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

          {isPreLaunch ? (
            <Button
              onClick={() => {
                setMobileMenuOpen(false)
                router.push(getLocalePath('/waitlist'))
              }}
              className="w-full bg-gradient-to-r from-primary-500 to-japanese-sakura hover:from-primary-600 hover:to-japanese-sakuraDark text-white justify-center shadow-lg"
            >
              {landingStrings.hero.preLaunch?.joinWaitlistDiscount || 'Join Waitlist - Get 25% Off'}
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  router.push(getLocalePath('/auth/signin'))
                }}
                variant="ghost"
                className="w-full justify-center"
              >
                {landingStrings.hero.cta?.signIn || 'Sign In'}
              </Button>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  router.push(getLocalePath('/auth/signup'))
                }}
                className="w-full bg-gradient-to-r from-primary-500 to-japanese-sakura hover:from-primary-600 hover:to-japanese-sakuraDark text-white justify-center shadow-lg"
              >
                {landingStrings.hero.cta?.getStarted || 'Get Started'}
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
