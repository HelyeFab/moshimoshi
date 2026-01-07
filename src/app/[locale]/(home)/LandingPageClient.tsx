'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation, useLocalePath } from '@/i18n/I18nContext'
import { strings as enStrings } from '@/i18n/locales/en/strings'
import Logo from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/FeatureCard'
import ThemeToggle from '@/components/ui/ThemeToggle'
import DoshiMascot from '@/components/ui/DoshiMascot'
import PricingComparison from '@/components/landing/PricingComparison'
import Image from 'next/image'
import {
  ArrowRightIcon,
  PlayIcon,
  CheckCircleIcon,
  SparklesIcon,
  BookOpenIcon,
  CloudArrowUpIcon,
  AcademicCapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LanguageIcon,
  NewspaperIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { usePreLaunch } from '@/hooks/usePreLaunch'
import { CountdownTimer } from '@/components/waitlist/CountdownTimer'

export default function LandingPageClient() {
  const router = useRouter()
  const { strings, language } = useTranslation()
  const { getLocalePath } = useLocalePath()
  const { isPreLaunch, launchDate } = usePreLaunch()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [currentYoutubeSlide, setCurrentYoutubeSlide] = useState(0)
  const [currentKanjiSlide, setCurrentKanjiSlide] = useState(0)
  const [currentConjugationSlide, setCurrentConjugationSlide] = useState(0)
  const [currentNewsSlide, setCurrentNewsSlide] = useState(0)
  const [currentAiStoriesSlide, setCurrentAiStoriesSlide] = useState(0)
  const [currentComicsSlide, setCurrentComicsSlide] = useState(0)
  const [currentAnkiSlide, setCurrentAnkiSlide] = useState(0)
  const [currentTextbookSlide, setCurrentTextbookSlide] = useState(0)
  const [currentLibrarySlide, setCurrentLibrarySlide] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Visibility tracking for lazy-loading below-fold carousels
  const [testimonialsVisible, setTestimonialsVisible] = useState(false)
  const [youtubeVisible, setYoutubeVisible] = useState(false)
  const [kanjiVisible, setKanjiVisible] = useState(false)
  const [conjugationVisible, setConjugationVisible] = useState(false)
  const [newsVisible, setNewsVisible] = useState(false)
  const [storiesVisible, setStoriesVisible] = useState(false)
  const [libraryVisible, setLibraryVisible] = useState(false)
  const [comicsVisible, setComicsVisible] = useState(false)
  const [ankiVisible, setAnkiVisible] = useState(false)
  const [textbookVisible, setTextbookVisible] = useState(false)

  // Refs for Intersection Observer
  const testimonialsRef = useRef<HTMLDivElement>(null)
  const youtubeRef = useRef<HTMLDivElement>(null)
  const kanjiRef = useRef<HTMLDivElement>(null)
  const conjugationRef = useRef<HTMLDivElement>(null)
  const newsRef = useRef<HTMLDivElement>(null)
  const storiesRef = useRef<HTMLDivElement>(null)
  const libraryRef = useRef<HTMLDivElement>(null)
  const comicsRef = useRef<HTMLDivElement>(null)
  const ankiRef = useRef<HTMLDivElement>(null)
  const textbookRef = useRef<HTMLDivElement>(null)

  // Mount effect - MUST be before any conditional returns
  useEffect(() => {
    setMounted(true)

    // Defer analytics tracking by 2 seconds to improve initial page load
    setTimeout(() => {
      // Check if this is a unique visitor (first time visiting landing page)
      const hasVisitedLanding = localStorage.getItem('visited_landing')
      const isUniqueVisitor = !hasVisitedLanding

      // Track landing page visit (anonymous - no auth required)
      fetch('/api/waitlist/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'landing', isUniqueVisitor }),
      }).catch((err) => console.error('Failed to track visit:', err))

      // Mark as visited for future page loads
      if (isUniqueVisitor) {
        localStorage.setItem('visited_landing', 'true')
      }
    }, 2000)
  }, [])

  // Intersection Observer for lazy-loading below-fold carousels
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Mark section as visible when it enters viewport
          if (entry.target === testimonialsRef.current) setTestimonialsVisible(true)
          else if (entry.target === youtubeRef.current) setYoutubeVisible(true)
          else if (entry.target === kanjiRef.current) setKanjiVisible(true)
          else if (entry.target === conjugationRef.current) setConjugationVisible(true)
          else if (entry.target === newsRef.current) setNewsVisible(true)
          else if (entry.target === storiesRef.current) setStoriesVisible(true)
          else if (entry.target === libraryRef.current) setLibraryVisible(true)
          else if (entry.target === comicsRef.current) setComicsVisible(true)
          else if (entry.target === ankiRef.current) setAnkiVisible(true)
          else if (entry.target === textbookRef.current) setTextbookVisible(true)
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    // Observe all carousel sections
    if (testimonialsRef.current) observer.observe(testimonialsRef.current)
    if (youtubeRef.current) observer.observe(youtubeRef.current)
    if (kanjiRef.current) observer.observe(kanjiRef.current)
    if (conjugationRef.current) observer.observe(conjugationRef.current)
    if (newsRef.current) observer.observe(newsRef.current)
    if (storiesRef.current) observer.observe(storiesRef.current)
    if (libraryRef.current) observer.observe(libraryRef.current)
    if (comicsRef.current) observer.observe(comicsRef.current)
    if (ankiRef.current) observer.observe(ankiRef.current)
    if (textbookRef.current) observer.observe(textbookRef.current)

    return () => observer.disconnect()
  }, [])

  // Auto-rotate carousel every 5 seconds - MUST be before any conditional returns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 8)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Auto-rotate testimonials every 6 seconds (only when visible)
  useEffect(() => {
    if (!testimonialsVisible) return
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 4)
    }, 6000)
    return () => clearInterval(timer)
  }, [testimonialsVisible])

  // Auto-rotate YouTube shadowing slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!youtubeVisible) return
    const timer = setInterval(() => {
      setCurrentYoutubeSlide((prev) => (prev + 1) % 5) // 5 slides: 1 placeholder + 4 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [youtubeVisible])

  // Auto-rotate Kanji Connection slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!kanjiVisible) return
    const timer = setInterval(() => {
      setCurrentKanjiSlide((prev) => (prev + 1) % 8) // 8 slides: 1 placeholder + 7 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [kanjiVisible])

  // Auto-rotate Conjugation slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!conjugationVisible) return
    const timer = setInterval(() => {
      setCurrentConjugationSlide((prev) => (prev + 1) % 6) // 6 slides: 1 placeholder + 5 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [conjugationVisible])

  // Auto-rotate News slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!newsVisible) return
    const timer = setInterval(() => {
      setCurrentNewsSlide((prev) => (prev + 1) % 7) // 7 slides: 1 placeholder + 6 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [newsVisible])

  // Auto-rotate AI Stories slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!storiesVisible) return
    const timer = setInterval(() => {
      setCurrentAiStoriesSlide((prev) => (prev + 1) % 5) // 5 slides: 1 placeholder + 4 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [storiesVisible])

  // Auto-rotate Comics slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!comicsVisible) return
    const timer = setInterval(() => {
      setCurrentComicsSlide((prev) => (prev + 1) % 5) // 5 slides: 1 placeholder + 4 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [comicsVisible])

  // Auto-rotate Anki slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!ankiVisible) return
    const timer = setInterval(() => {
      setCurrentAnkiSlide((prev) => (prev + 1) % 6) // 6 slides: 1 placeholder + 5 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [ankiVisible])

  // Auto-rotate Textbook slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!textbookVisible) return
    const timer = setInterval(() => {
      setCurrentTextbookSlide((prev) => (prev + 1) % 5) // 5 slides: 1 placeholder + 4 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [textbookVisible])

  // Auto-rotate Library slideshow every 4 seconds (only when visible)
  useEffect(() => {
    if (!libraryVisible) return
    const timer = setInterval(() => {
      setCurrentLibrarySlide((prev) => (prev + 1) % 5) // 5 slides: 1 placeholder + 4 screenshots
    }, 4000)
    return () => clearInterval(timer)
  }, [libraryVisible])

  // Always use valid landing strings with fallback to English
  const landingStrings = mounted && strings?.landing ? strings.landing : enStrings.landing

  // Locale-aware launch date labels (short and long) for badges/UI
  const launchDateShort = new Intl.DateTimeFormat(language || 'en', {
    month: 'short',
    day: 'numeric',
  }).format(launchDate)
  const launchDateLong = new Intl.DateTimeFormat(language || 'en', {
    month: 'long',
    day: 'numeric',
  }).format(launchDate)

  const badgeLabel = `${landingStrings.hero.preLaunch?.badgePrefix || 'Launching'} ${launchDateShort}`
  const badgeMobileLabel = `${landingStrings.hero.preLaunch?.badgeMobilePrefix || landingStrings.hero.preLaunch?.badgePrefix || 'Launching'} ${launchDateShort}`
  const heroBadgeLabel = `${landingStrings.hero.preLaunch?.heroBadgePrefix || landingStrings.hero.preLaunch?.badgePrefix || 'Launching'} ${launchDateLong} - ${landingStrings.hero.preLaunch?.discountSuffix || 'Get 25% Off!'}`

  const carouselSlides = [
    {
      icon: <PlayIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.shadowing,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <SparklesIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.kanji,
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <LanguageIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.conjugation,
      color: 'from-indigo-500 to-blue-500',
    },
    {
      icon: <NewspaperIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.news,
      color: 'from-teal-500 to-cyan-500',
    },
    {
      icon: <DocumentTextIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.stories,
      color: 'from-violet-500 to-fuchsia-500',
    },
    {
      icon: <BookOpenIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.library,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: <CloudArrowUpIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.anki,
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <AcademicCapIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.textbooks,
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: <ChatBubbleLeftRightIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.comics,
      color: 'from-pink-500 to-rose-500',
    },
  ]

  // YouTube Shadowing slideshow images
  const youtubeSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/youtube-shadowing/youtube-shadowing-1.png', alt: 'YouTube Shadowing - Main Interface' },
    { type: 'image' as const, src: '/images/landing/youtube-shadowing/youtube-shadowing-2.png', alt: 'YouTube Shadowing - Word Details' },
    { type: 'image' as const, src: '/images/landing/youtube-shadowing/youtube-shadowing-3.png', alt: 'YouTube Shadowing - Context View' },
    { type: 'image' as const, src: '/images/landing/youtube-shadowing/youtube-shadowing-4.png', alt: 'YouTube Shadowing - Settings' },
  ]

  // Kanji Connection slideshow images
  const kanjiSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-1.png', alt: 'Kanji Browser - JLPT Levels' },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-2.png', alt: 'Kanji Detail - Overview' },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-3.png', alt: 'Drawing Practice' },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-4.png', alt: 'Kanji Detail - Examples' },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-5.png', alt: 'Kanji Families & Radicals' },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-6.png', alt: 'Radicals & Components' },
    { type: 'image' as const, src: '/images/landing/kanji-connections/kanji-connections-7.png', alt: 'Radicals - Water Kanji' },
  ]

  // Conjugation Engine slideshow images
  const conjugationSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/conjugation/conjugation-1.png', alt: 'Conjugation - Main View' },
    { type: 'image' as const, src: '/images/landing/conjugation/conjugation-2.png', alt: 'Conjugation - Form Details' },
    { type: 'image' as const, src: '/images/landing/conjugation/conjugation-3.png', alt: 'Conjugation - Practice' },
    { type: 'image' as const, src: '/images/landing/conjugation/conjugation-4.png', alt: 'Conjugation - Examples' },
    { type: 'image' as const, src: '/images/landing/conjugation/conjugation-5.png', alt: 'Conjugation - Settings' },
  ]

  // News Articles slideshow images
  const newsSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/news/news-1.png', alt: 'News - Article List' },
    { type: 'image' as const, src: '/images/landing/news/news-2.png', alt: 'News - Reading View' },
    { type: 'image' as const, src: '/images/landing/news/news-3.png', alt: 'News - Word Lookup' },
    { type: 'image' as const, src: '/images/landing/news/news-4.png', alt: 'News - Categories' },
    { type: 'image' as const, src: '/images/landing/news/news-5.png', alt: 'News - Saved Articles' },
    { type: 'image' as const, src: '/images/landing/news/news-6.png', alt: 'News - Settings' },
  ]

  // AI Stories slideshow images
  const aiStoriesSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/ai-stories/ai-stories-1.png', alt: 'AI Stories - Story List' },
    { type: 'image' as const, src: '/images/landing/ai-stories/ai-stories-2.png', alt: 'AI Stories - Reading' },
    { type: 'image' as const, src: '/images/landing/ai-stories/ai-stories-3.png', alt: 'AI Stories - Generation' },
    { type: 'image' as const, src: '/images/landing/ai-stories/ai-stories-4.png', alt: 'AI Stories - Settings' },
  ]

  // Comics slideshow images
  const comicsSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/comics/comics-1.png', alt: 'Comics - Library' },
    { type: 'image' as const, src: '/images/landing/comics/comics-2.png', alt: 'Comics - Reading' },
    { type: 'image' as const, src: '/images/landing/comics/comics-3.png', alt: 'Comics - Word Lookup' },
    { type: 'image' as const, src: '/images/landing/comics/comics-4.png', alt: 'Comics - Progress' },
  ]

  // Anki Import slideshow images
  const ankiSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/anki/anki-1.png', alt: 'Anki - Import Start' },
    { type: 'image' as const, src: '/images/landing/anki/anki-2.png', alt: 'Anki - File Selection' },
    { type: 'image' as const, src: '/images/landing/anki/anki-3.png', alt: 'Anki - Field Mapping' },
    { type: 'image' as const, src: '/images/landing/anki/anki-4.png', alt: 'Anki - Preview' },
    { type: 'image' as const, src: '/images/landing/anki/anki-5.png', alt: 'Anki - Import Progress' },
  ]

  // Textbook Vocabulary slideshow images
  const textbookSlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/textbook/textbook-1.png', alt: 'Textbook - Course List' },
    { type: 'image' as const, src: '/images/landing/textbook/textbook-2.png', alt: 'Textbook - Vocabulary' },
    { type: 'image' as const, src: '/images/landing/textbook/textbook-3.png', alt: 'Textbook - Study Mode' },
    { type: 'image' as const, src: '/images/landing/textbook/textbook-4.png', alt: 'Textbook - Progress' },
  ]

  // Library slideshow images
  const librarySlides = [
    { type: 'placeholder' as const },
    { type: 'image' as const, src: '/images/landing/library/library-1.png', alt: 'Library - Book Collection' },
    { type: 'image' as const, src: '/images/landing/library/library-2.png', alt: 'Library - Reading View' },
    { type: 'image' as const, src: '/images/landing/library/library-3.png', alt: 'Library - Word Lookup' },
    { type: 'image' as const, src: '/images/landing/library/library-4.png', alt: 'Library - Audio Player' },
  ]

  // Show loading state while mounting (AFTER all hooks)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-x-hidden">
      {/* Header */}
      <header className="w-full px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-50 border-b border-gray-200 dark:border-gray-800 max-w-full">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href={getLocalePath('/blog')}
            className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Blog
          </Link>
          <ThemeToggle />
          {isPreLaunch ? (
            <>
              {/* Pre-launch: Show waitlist button */}
              <Button
                onClick={() => router.push(getLocalePath('/waitlist'))}
                className="bg-gradient-to-r from-primary-500 to-japanese-sakura hover:from-primary-600 hover:to-japanese-sakuraDark text-white shadow-lg"
              >
                {landingStrings.hero.preLaunch?.joinWaitlist || 'Join Waitlist'}
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              {/* Post-launch: Show normal auth buttons */}
              <Button
                onClick={() => router.push(getLocalePath('/auth/signin'))}
                className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white"
              >
                {strings?.common?.signIn || 'Sign In'}
              </Button>
              <Button
                onClick={() => router.push(getLocalePath('/auth/signup'))}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {strings?.common?.signUp || 'Sign Up'}
              </Button>
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <Image
              src="/ui/flat-icons/close-button.png"
              alt="Close menu"
              width={24}
              height={24}
              className="w-6 h-6"
            />
          ) : (
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="menuGradient" x1="12" x2="12" y1="5" y2="19" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#fd6700"/>
                  <stop offset="1" stopColor="#ffce00"/>
                </linearGradient>
              </defs>
              <path
                clipRule="evenodd"
                d="m3 6c0-.55228.44772-1 1-1h16c.5523 0 1 .44772 1 1s-.4477 1-1 1h-16c-.55228 0-1-.44772-1-1zm0 6c0-.5523.44772-1 1-1h10c.5523 0 1 .4477 1 1s-.4477 1-1 1h-10c-.55228 0-1-.4477-1-1zm0 6c0-.5523.44772-1 1-1h5c.55228 0 1 .4477 1 1s-.44772 1-1 1h-5c-.55228 0-1-.4477-1-1z"
                fill="url(#menuGradient)"
                fillRule="evenodd"
              />
            </svg>
          )}
        </button>
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
            <>
              {/* Join Waitlist Button */}
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
            </>
          ) : (
            <>
              {/* Sign In Button */}
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  router.push(getLocalePath('/auth/signin'))
                }}
                className="w-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 justify-center"
              >
                {strings?.common?.signIn || 'Sign In'}
              </Button>

              {/* Sign Up Button */}
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  router.push(getLocalePath('/auth/signup'))
                }}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white justify-center shadow-lg"
              >
                {strings?.common?.signUp || 'Sign Up'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hero Section with Carousel */}
      <section className="container mx-auto px-4 md:px-6 py-12 md:py-20">
        <div className="text-center mb-12">
          {/* Pre-launch Badge */}
          {isPreLaunch && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-100 to-japanese-sakura/20 dark:from-primary-900/30 dark:to-japanese-sakuraDark/20 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {heroBadgeLabel}
                </span>
              </div>
            </div>
          )}

          {/* Doshi Mascot for Hero */}
          <div className="flex justify-center mb-6">
            <DoshiMascot size="large" variant="animated" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent px-4">
            {landingStrings.hero.headline}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto px-4">
            {landingStrings.hero.subheadline}
          </p>

          {/* CTA Button - changes based on pre-launch status */}
          <div className="flex justify-center px-4">
            {isPreLaunch ? (
              <Button
                onClick={() => router.push(getLocalePath('/waitlist'))}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-500 to-japanese-sakura hover:from-primary-600 hover:to-japanese-sakuraDark text-white text-base sm:text-lg md:text-xl py-4 sm:py-5 md:py-6 px-6 sm:px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                {landingStrings.hero.preLaunch?.joinWaitlistDiscount || 'Join Waitlist - Get 25% Off'}
                <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
              </Button>
            ) : (
              <Button
                onClick={() => router.push(getLocalePath('/auth/signup'))}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-base sm:text-lg md:text-xl py-4 sm:py-5 md:py-6 px-6 sm:px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                {landingStrings.hero.ctaPrimary}
                <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
              </Button>
            )}
          </div>

          {/* Countdown Timer - only shown during pre-launch */}
          {isPreLaunch && (
            <div className="mt-12">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">
                {landingStrings.hero.preLaunch?.launchingIn || 'Launching In'}
              </p>
              <CountdownTimer
                targetDate={launchDate}
                labels={landingStrings.hero.preLaunch?.countdown}
              />
            </div>
          )}
        </div>

        {/* Feature Carousel */}
        <div className="relative max-w-4xl mx-auto px-4">
          <div className="relative h-48 sm:h-56 md:h-64 rounded-2xl overflow-hidden shadow-2xl">
            {carouselSlides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-700 ${
                  index === currentSlide
                    ? 'opacity-100 translate-x-0'
                    : index < currentSlide
                    ? 'opacity-0 -translate-x-full'
                    : 'opacity-0 translate-x-full'
                }`}
              >
                <div
                  className={`h-full bg-gradient-to-r ${slide.color} p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between text-white`}
                >
                  <div className="flex-1 text-center sm:text-left">
                    <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs sm:text-sm mb-2 sm:mb-4">
                      {slide.badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{slide.title}</h3>
                    <p className="text-sm sm:text-base md:text-lg text-white/90">{slide.description}</p>
                  </div>
                  <div className="hidden sm:block ml-4 md:ml-8 flex-shrink-0">{slide.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Carousel Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-8 bg-indigo-600 dark:bg-indigo-400'
                    : 'w-2 bg-gray-300 dark:bg-gray-600'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* YouTube Shadowing Section */}
      <section ref={youtubeRef} className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.shadowing.title}
              </h2>
              <p className="text-lg md:text-xl text-indigo-600 dark:text-indigo-400 mb-6">
                {landingStrings.features.shadowing.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.shadowing.description}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.shadowing.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/youtube-shadowing'))}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.shadowing.cta}
                </Button>
              </div>
            </div>
            <div className="relative">
              {/* YouTube Shadowing Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {youtubeSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentYoutubeSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <PlayIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {youtubeSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentYoutubeSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentYoutubeSlide
                        ? 'w-6 bg-blue-600 dark:bg-blue-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kanji Connection Section */}
      <section ref={kanjiRef} className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              {/* Kanji Connection Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {kanjiSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentKanjiSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <SparklesIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {kanjiSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentKanjiSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentKanjiSlide
                        ? 'w-6 bg-purple-600 dark:bg-purple-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.kanji.title}
              </h2>
              <p className="text-lg md:text-xl text-purple-600 dark:text-purple-400 mb-6">
                {landingStrings.features.kanji.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.kanji.description}
              </p>
              <ul className="space-y-3 md:space-y-4 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.kanji.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Conjugation Engine Section */}
      <section ref={conjugationRef} className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.conjugation.title}
              </h2>
              <p className="text-lg md:text-xl text-indigo-600 dark:text-indigo-400 mb-6">
                {landingStrings.features.conjugation.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.conjugation.description}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.conjugation.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/drill'))}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.conjugation.cta}
                </Button>
              </div>
            </div>
            <div className="relative">
              {/* Conjugation Engine Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {conjugationSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentConjugationSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
                        <LanguageIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {conjugationSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentConjugationSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentConjugationSlide
                        ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Articles Section */}
      <section ref={newsRef} className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              {/* News Articles Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {newsSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentNewsSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                        <NewspaperIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {newsSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentNewsSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentNewsSlide
                        ? 'w-6 bg-teal-600 dark:bg-teal-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.news.title}
              </h2>
              <p className="text-lg md:text-xl text-teal-600 dark:text-teal-400 mb-6">
                {landingStrings.features.news.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.news.description}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.news.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/news'))}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.news.cta}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Stories Section */}
      <section ref={storiesRef} className="bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.stories.title}
              </h2>
              <p className="text-lg md:text-xl text-violet-600 dark:text-violet-400 mb-6">
                {landingStrings.features.stories.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.stories.description}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.stories.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/stories'))}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.stories.cta}
                </Button>
              </div>
            </div>
            <div className="relative">
              {/* AI Stories Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {aiStoriesSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentAiStoriesSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <DocumentTextIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {aiStoriesSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentAiStoriesSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentAiStoriesSlide
                        ? 'w-6 bg-violet-600 dark:bg-violet-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reading Library Section */}
      <section ref={libraryRef} className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              {/* Library Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {librarySlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentLibrarySlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <BookOpenIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {librarySlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentLibrarySlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentLibrarySlide
                        ? 'w-6 bg-emerald-600 dark:bg-emerald-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.library?.title || 'Reading Library: Immersive Content'}
              </h2>
              <p className="text-lg md:text-xl text-emerald-600 dark:text-emerald-400 mb-6">
                {landingStrings.features.library?.subtitle || 'Books, graded readers, and condensed versions at your level'}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.library?.description || 'Explore our extensive collection of Japanese books and graded readers.'}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {landingStrings.features.library?.benefits ? (
                  Object.values(landingStrings.features.library.benefits).map(
                    (benefit, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                      </li>
                    )
                  )
                ) : null}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/library'))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.library?.cta || 'Explore Library'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Moshi Comics Section */}
      <section ref={comicsRef} className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.comics.title}
              </h2>
              <p className="text-lg md:text-xl text-pink-600 dark:text-pink-400 mb-6">
                {landingStrings.features.comics.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.comics.description}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.comics.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/comics'))}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.comics.cta}
                </Button>
              </div>
            </div>
            <div className="relative">
              {/* Comics Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {comicsSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentComicsSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                        <ChatBubbleLeftRightIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {comicsSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentComicsSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentComicsSlide
                        ? 'w-6 bg-pink-600 dark:bg-pink-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Anki Import Section */}
      <section ref={ankiRef} className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.anki.title}
              </h2>
              <p className="text-lg md:text-xl text-green-600 dark:text-green-400 mb-6">
                {landingStrings.features.anki.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6 md:mb-8">
                {landingStrings.features.anki.description}
              </p>
              <ul className="space-y-3 md:space-y-4 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.anki.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="relative">
              {/* Anki Import Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {ankiSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentAnkiSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <CloudArrowUpIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {ankiSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentAnkiSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentAnkiSlide
                        ? 'w-6 bg-green-600 dark:bg-green-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Textbook Vocabulary Section */}
      <section ref={textbookRef} className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              {/* Textbook Vocabulary Slideshow */}
              <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden">
                {textbookSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      index === currentTextbookSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {slide.type === 'placeholder' ? (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                        <BookOpenIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
                      </div>
                    ) : (
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Slideshow Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {textbookSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTextbookSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentTextbookSlide
                        ? 'w-6 bg-orange-600 dark:bg-orange-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {landingStrings.features.textbooks.title}
              </h2>
              <p className="text-lg md:text-xl text-orange-600 dark:text-orange-400 mb-6">
                {landingStrings.features.textbooks.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {landingStrings.features.textbooks.description}
              </p>
              <p className="text-base md:text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6 md:mb-8">
                {landingStrings.features.textbooks.textbookList}
              </p>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.textbooks.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <div className="flex justify-center lg:justify-start">
                <Button
                  onClick={() => router.push(getLocalePath('/textbook-vocabulary'))}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.textbooks.cta}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {landingStrings.comparison.title}
          </h2>
          <p className="text-base md:text-xl text-center text-gray-600 dark:text-gray-300 mb-8 md:mb-12">
            {landingStrings.comparison.subtitle}
          </p>

          {/* Mobile: Card-based comparison */}
          <div className="md:hidden space-y-4 max-w-md mx-auto">
            {Object.entries(landingStrings.comparison.features).map(([key, feature]) => {
              const ankiHas = key === 'customCards' || key === 'offline'
              const wanikaniHas = key === 'kanjiSystem' ? 'limited' : false
              const duolingoHas = key === 'gamification'

              return (
                <Card key={key} className="bg-white dark:bg-gray-900 p-4">
                  <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    {feature}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {landingStrings.comparison.tableHeaders.moshimoshi}
                      </span>
                      <span className="text-2xl text-green-600 dark:text-green-400">✓</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-gray-700 dark:text-gray-300">
                        {landingStrings.comparison.tableHeaders.anki}
                      </span>
                      <span className="text-xl text-gray-400">
                        {ankiHas ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-gray-700 dark:text-gray-300">
                        {landingStrings.comparison.tableHeaders.wanikani}
                      </span>
                      <span className="text-xl text-gray-400">
                        {wanikaniHas === 'limited' ? '~' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-gray-700 dark:text-gray-300">
                        {landingStrings.comparison.tableHeaders.duolingo}
                      </span>
                      <span className="text-xl text-gray-400">
                        {duolingoHas ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden md:block max-w-5xl mx-auto">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="p-4 text-left">
                      {landingStrings.comparison.tableHeaders.feature}
                    </th>
                    <th className="p-4 text-center bg-indigo-50 dark:bg-indigo-900/30">
                      {landingStrings.comparison.tableHeaders.moshimoshi}
                    </th>
                    <th className="p-4 text-center">
                      {landingStrings.comparison.tableHeaders.anki}
                    </th>
                    <th className="p-4 text-center">
                      {landingStrings.comparison.tableHeaders.wanikani}
                    </th>
                    <th className="p-4 text-center">
                      {landingStrings.comparison.tableHeaders.duolingo}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(landingStrings.comparison.features).map(([key, feature], index) => (
                    <tr
                      key={key}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        index % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''
                      }`}
                    >
                      <td className="p-4">{feature}</td>
                      <td className="p-4 text-center bg-indigo-50 dark:bg-indigo-900/30">
                        <span className="text-2xl text-green-600 dark:text-green-400">✓</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-2xl text-gray-400">
                          {key === 'customCards' || key === 'offline' ? '✓' : '✗'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-2xl text-gray-400">
                          {key === 'kanjiSystem' ? '~' : '✗'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-2xl text-gray-400">
                          {key === 'gamification' ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section ref={testimonialsRef} className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {landingStrings.socialProof.title}
          </h2>
          <p className="text-base md:text-xl text-center text-gray-600 dark:text-gray-300 mb-8 md:mb-12">
            {landingStrings.socialProof.subtitle}
          </p>

          {/* Testimonials Carousel */}
          <div className="relative max-w-4xl mx-auto mb-16">
            <div className="relative min-h-[320px] md:min-h-[260px]">
              {Object.values(landingStrings.socialProof.testimonials).map(
                (testimonial, i) => (
                  <div
                    key={i}
                    className={`absolute inset-0 transition-all duration-700 ${
                      i === currentTestimonial
                        ? 'opacity-100 translate-x-0'
                        : i < currentTestimonial
                        ? 'opacity-0 -translate-x-full'
                        : 'opacity-0 translate-x-full'
                    }`}
                  >
                    <Card className="bg-gray-50 dark:bg-gray-800 p-6 md:p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                        <DoshiMascot size="small" variant="static" className="mb-4" />
                        <p className="text-base md:text-lg mb-4 italic">
                          &ldquo;{testimonial.quote}&rdquo;
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <p className="font-bold">{testimonial.author}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {testimonial.role}
                          </p>
                        </div>
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full whitespace-nowrap">
                          {testimonial.context}
                        </span>
                      </div>
                    </Card>
                  </div>
                )
              )}
            </div>

            {/* Testimonial Navigation */}
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={() => setCurrentTestimonial((prev) => (prev - 1 + 4) % 4)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Previous testimonial"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentTestimonial
                        ? 'w-8 bg-indigo-600 dark:bg-indigo-400'
                        : 'w-2 bg-gray-300 dark:bg-gray-600'
                    }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setCurrentTestimonial((prev) => (prev + 1) % 4)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Next testimonial"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-12 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {landingStrings.faq.title}
          </h2>
          <p className="text-base md:text-xl text-center text-gray-600 dark:text-gray-300 mb-8 md:mb-12">
            {landingStrings.faq.subtitle}
          </p>
          <div className="space-y-4 md:space-y-6">
            {Object.values(landingStrings.faq.questions).map((faq, i) => (
              <details
                key={i}
                className="bg-white dark:bg-gray-900 rounded-lg p-4 md:p-6 shadow-md group"
              >
                <summary className="font-bold text-base md:text-lg cursor-pointer list-none flex justify-between items-center gap-4">
                  <span className="flex-1">{faq.question}</span>
                  <span className="text-2xl group-open:rotate-45 transition-transform flex-shrink-0">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-sm md:text-base text-gray-600 dark:text-gray-300">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Comparison Section */}
      <PricingComparison />

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 py-12 md:py-20 text-white">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="flex justify-center mb-6">
            <DoshiMascot size="medium" variant="animated" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{landingStrings.finalCta.title}</h2>
          <p className="text-base md:text-xl mb-4 md:mb-6">{landingStrings.finalCta.subtitle}</p>
          <p className="text-sm text-white/80 mb-6 md:mb-8 max-w-2xl mx-auto">{landingStrings.finalCta.features}</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-lg mx-auto">
            <Button
              onClick={() => router.push(getLocalePath('/auth/signup'))}
              className="w-full sm:w-auto bg-white text-indigo-600 hover:bg-gray-100 text-base md:text-xl py-4 md:py-6 px-6 md:px-8 rounded-lg shadow-lg"
            >
              {landingStrings.finalCta.ctaPrimary}
            </Button>
            <Button
              onClick={() => router.push(getLocalePath('/pricing'))}
              className="w-full sm:w-auto bg-transparent border-2 border-white text-white hover:bg-white/10 text-base md:text-xl py-4 md:py-6 px-6 md:px-8 rounded-lg"
            >
              {landingStrings.finalCta.ctaSecondary}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo />
              <p className="mt-4 text-sm">{landingStrings.footer.tagline}</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">
                {landingStrings.footer.sections.features}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href={getLocalePath('/youtube-shadowing')} className="hover:text-white">
                    {landingStrings.footer.links.shadowing}
                  </Link>
                </li>
                <li>
                  <Link href={getLocalePath('/kanji-connection')} className="hover:text-white">
                    {landingStrings.footer.links.kanji}
                  </Link>
                </li>
                <li>
                  <Link href={getLocalePath('/anki-import')} className="hover:text-white">
                    {landingStrings.footer.links.anki}
                  </Link>
                </li>
                <li>
                  <Link href={getLocalePath('/textbook-vocabulary')} className="hover:text-white">
                    {landingStrings.footer.links.textbooks}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">
                {landingStrings.footer.sections.company}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href={getLocalePath('/pricing')} className="hover:text-white">
                    {landingStrings.footer.links.pricing}
                  </Link>
                </li>
                <li>
                  <Link href={getLocalePath('/blog')} className="hover:text-white">
                    {landingStrings.footer.links.blog}
                  </Link>
                </li>
                <li>
                  <Link href={getLocalePath('/contact')} className="hover:text-white">
                    {landingStrings.footer.links.contact}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">
                {landingStrings.footer.sections.support}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href={getLocalePath('/privacy')} className="hover:text-white">
                    {landingStrings.footer.links.privacy}
                  </Link>
                </li>
                <li>
                  <Link href={getLocalePath('/terms')} className="hover:text-white">
                    {landingStrings.footer.links.terms}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            {landingStrings.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  )
}
