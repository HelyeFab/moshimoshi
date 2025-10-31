'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/I18nContext'
import { strings as enStrings } from '@/i18n/locales/en/strings'
import Logo from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/FeatureCard'
import ThemeToggle from '@/components/ui/ThemeToggle'
import DoshiMascot from '@/components/ui/DoshiMascot'
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
} from '@heroicons/react/24/outline'

export default function HomePage() {
  const router = useRouter()
  const { strings } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Mount effect - MUST be before any conditional returns
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-rotate carousel every 5 seconds - MUST be before any conditional returns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 4)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Auto-rotate testimonials every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 4)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  // Always use valid landing strings with fallback to English
  const landingStrings = mounted && strings?.landing ? strings.landing : enStrings.landing

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
      icon: <CloudArrowUpIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.anki,
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <AcademicCapIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.textbooks,
      color: 'from-orange-500 to-red-500',
    },
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
          <ThemeToggle />
          <Button
            onClick={() => router.push('/auth/signin')}
            className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white"
          >
            {strings?.common?.signIn || 'Sign In'}
          </Button>
          <Button
            onClick={() => router.push('/auth/signup')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {strings?.common?.signUp || 'Sign Up'}
          </Button>
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
          {/* Theme Toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
            <ThemeToggle />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

          {/* Sign In Button */}
          <Button
            onClick={() => {
              setMobileMenuOpen(false)
              router.push('/auth/signin')
            }}
            className="w-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 justify-center"
          >
            {strings?.common?.signIn || 'Sign In'}
          </Button>

          {/* Sign Up Button */}
          <Button
            onClick={() => {
              setMobileMenuOpen(false)
              router.push('/auth/signup')
            }}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white justify-center shadow-lg"
          >
            {strings?.common?.signUp || 'Sign Up'}
          </Button>
        </div>
      </div>

      {/* Hero Section with Carousel */}
      <section className="container mx-auto px-4 md:px-6 py-12 md:py-20">
        <div className="text-center mb-12">
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
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Button
              onClick={() => router.push('/auth/signup')}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-base sm:text-lg md:text-xl py-4 sm:py-5 md:py-6 px-6 sm:px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              {landingStrings.hero.ctaPrimary}
              <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
            </Button>
            <Button
              onClick={() => router.push('/youtube-shadowing')}
              className="w-full sm:w-auto bg-white dark:bg-gray-800 border-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 text-base sm:text-lg md:text-xl py-4 sm:py-5 md:py-6 px-6 sm:px-8 rounded-lg hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all"
            >
              {landingStrings.hero.ctaSecondary}
            </Button>
          </div>
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
      <section className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
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
                  onClick={() => router.push('/youtube-shadowing')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.shadowing.cta}
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <PlayIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kanji Connection Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <SparklesIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
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
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.kanji.benefits).map(
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
                  onClick={() => router.push('/kanji-connection')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.kanji.cta}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Anki Import Section */}
      <section className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 py-12 md:py-20">
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
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-left max-w-md mx-auto lg:mx-0">
                {Object.values(landingStrings.features.anki.benefits).map(
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
                  onClick={() => router.push('/anki-import')}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg"
                >
                  {landingStrings.features.anki.cta}
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <CloudArrowUpIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Textbook Vocabulary Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="aspect-square bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <BookOpenIcon className="w-16 md:w-24 h-16 md:h-24 text-white opacity-80" />
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
                  onClick={() => router.push('/textbook-vocabulary')}
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
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {landingStrings.socialProof.title}
          </h2>
          <p className="text-base md:text-xl text-center text-gray-600 dark:text-gray-300 mb-8 md:mb-12">
            {landingStrings.socialProof.subtitle}
          </p>

          {/* Testimonials Carousel */}
          <div className="relative max-w-4xl mx-auto mb-16">
            <div className="relative min-h-[280px] md:min-h-[200px]">
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

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {Object.values(landingStrings.socialProof.stats).map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                  {i === 0 ? '1+' : i === 1 ? '2,136' : i === 2 ? '5+' : '6'}
                </div>
                <div className="text-gray-600 dark:text-gray-400">{stat}</div>
              </div>
            ))}
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
              onClick={() => router.push('/auth/signup')}
              className="w-full sm:w-auto bg-white text-indigo-600 hover:bg-gray-100 text-base md:text-xl py-4 md:py-6 px-6 md:px-8 rounded-lg shadow-lg"
            >
              {landingStrings.finalCta.ctaPrimary}
            </Button>
            <Button
              onClick={() => router.push('/pricing')}
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
                  <a href="/youtube-shadowing" className="hover:text-white">
                    {landingStrings.footer.links.shadowing}
                  </a>
                </li>
                <li>
                  <a href="/kanji-connection" className="hover:text-white">
                    {landingStrings.footer.links.kanji}
                  </a>
                </li>
                <li>
                  <a href="/anki-import" className="hover:text-white">
                    {landingStrings.footer.links.anki}
                  </a>
                </li>
                <li>
                  <a href="/textbook-vocabulary" className="hover:text-white">
                    {landingStrings.footer.links.textbooks}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">
                {landingStrings.footer.sections.company}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/pricing" className="hover:text-white">
                    {landingStrings.footer.links.pricing}
                  </a>
                </li>
                <li>
                  <a href="/blog" className="hover:text-white">
                    {landingStrings.footer.links.blog}
                  </a>
                </li>
                <li>
                  <a href="/contact" className="hover:text-white">
                    {landingStrings.footer.links.contact}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">
                {landingStrings.footer.sections.support}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/privacy" className="hover:text-white">
                    {landingStrings.footer.links.privacy}
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-white">
                    {landingStrings.footer.links.terms}
                  </a>
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
