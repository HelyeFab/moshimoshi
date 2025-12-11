'use client'

// Force dynamic rendering to avoid SSR issues with i18n context
export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { strings as enStrings } from '@/i18n/locales/en/strings'
import Logo from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/FeatureCard'
import ThemeToggle from '@/components/ui/ThemeToggle'
import {
  ArrowRightIcon,
  PlayIcon,
  CheckCircleIcon,
  SparklesIcon,
  BookOpenIcon,
  CloudArrowUpIcon,
  AcademicCapIcon,
  LanguageIcon,
  NewspaperIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

const LandingPage = () => {
  const router = useRouter()
  const { strings } = useI18n()
  const [currentSlide, setCurrentSlide] = useState(0)

  // Use landing strings, with proper fallback to English
  const landingStrings = (strings && strings.landing) ? strings.landing : enStrings.landing

  const carouselSlides = [
    {
      icon: <PlayIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.shadowing || enStrings.landing.hero.carousel.shadowing),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <SparklesIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.kanji || enStrings.landing.hero.carousel.kanji),
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <LanguageIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.conjugation || enStrings.landing.hero.carousel.conjugation),
      color: 'from-indigo-500 to-blue-500',
    },
    {
      icon: <NewspaperIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.news || enStrings.landing.hero.carousel.news),
      color: 'from-teal-500 to-cyan-500',
    },
    {
      icon: <DocumentTextIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.stories || enStrings.landing.hero.carousel.stories),
      color: 'from-violet-500 to-fuchsia-500',
    },
    {
      icon: <CloudArrowUpIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.anki || enStrings.landing.hero.carousel.anki),
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <AcademicCapIcon className="w-12 h-12" />,
      ...(landingStrings?.hero?.carousel?.textbooks || enStrings.landing.hero.carousel.textbooks),
      color: 'from-orange-500 to-red-500',
    },
  ]

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [carouselSlides.length])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Header */}
      <header className="container mx-auto px-6 py-4 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-50">
        <Logo />
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          <Button
            onClick={() => router.push('/auth/signin')}
            className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white"
          >
            {strings?.common?.signIn || 'Sign In'}
          </Button>
        </nav>
      </header>

      {/* Hero Section with Carousel */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            {landingStrings.hero.headline}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            {landingStrings.hero.subheadline}
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => router.push('/auth/signup')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-6 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              {landingStrings.hero.ctaPrimary}
              <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
            </Button>
            <Button
              onClick={() => router.push('/youtube-shadowing')}
              className="bg-white dark:bg-gray-800 border-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 text-xl py-6 px-8 rounded-lg hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all"
            >
              {landingStrings.hero.ctaSecondary}
            </Button>
          </div>
        </div>

        {/* Feature Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <div className="relative h-64 rounded-2xl overflow-hidden shadow-2xl">
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
                  className={`h-full bg-gradient-to-r ${slide.color} p-8 flex items-center justify-between text-white`}
                >
                  <div className="flex-1">
                    <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm mb-4">
                      {slide.badge}
                    </span>
                    <h3 className="text-3xl font-bold mb-2">{slide.title}</h3>
                    <p className="text-lg text-white/90">{slide.description}</p>
                  </div>
                  <div className="ml-8">{slide.icon}</div>
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
      <section className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.shadowing.title}
              </h2>
              <p className="text-xl text-indigo-600 dark:text-indigo-400 mb-6">
                {landingStrings.features.shadowing.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {landingStrings.features.shadowing.description}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.shadowing.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/youtube-shadowing')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.shadowing.cta}
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <PlayIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kanji Connection Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <SparklesIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.kanji.title}
              </h2>
              <p className="text-xl text-purple-600 dark:text-purple-400 mb-6">
                {landingStrings.features.kanji.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {landingStrings.features.kanji.description}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.kanji.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/kanji-connection')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.kanji.cta}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Conjugation Engine Section */}
      <section className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.conjugation.title}
              </h2>
              <p className="text-xl text-indigo-600 dark:text-indigo-400 mb-6">
                {landingStrings.features.conjugation.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {landingStrings.features.conjugation.description}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.conjugation.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/drill')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.conjugation.cta}
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <LanguageIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Articles Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="aspect-square bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <NewspaperIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.news.title}
              </h2>
              <p className="text-xl text-teal-600 dark:text-teal-400 mb-6">
                {landingStrings.features.news.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {landingStrings.features.news.description}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.news.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/news')}
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.news.cta}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Stories Section */}
      <section className="bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-gray-800 dark:to-gray-900 py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.stories.title}
              </h2>
              <p className="text-xl text-violet-600 dark:text-violet-400 mb-6">
                {landingStrings.features.stories.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {landingStrings.features.stories.description}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.stories.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/stories')}
                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.stories.cta}
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <DocumentTextIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Anki Import Section */}
      <section className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.anki.title}
              </h2>
              <p className="text-xl text-green-600 dark:text-green-400 mb-6">
                {landingStrings.features.anki.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {landingStrings.features.anki.description}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.anki.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/anki-import')}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.anki.cta}
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <CloudArrowUpIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Textbook Vocabulary Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="aspect-square bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-2xl flex items-center justify-center">
                <BookOpenIcon className="w-24 h-24 text-white opacity-80" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl font-bold mb-4">
                {landingStrings.features.textbooks.title}
              </h2>
              <p className="text-xl text-orange-600 dark:text-orange-400 mb-6">
                {landingStrings.features.textbooks.subtitle}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {landingStrings.features.textbooks.description}
              </p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-8">
                {landingStrings.features.textbooks.textbookList}
              </p>
              <ul className="space-y-4 mb-8">
                {Object.values(landingStrings.features.textbooks.benefits).map(
                  (benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  )
                )}
              </ul>
              <Button
                onClick={() => router.push('/textbook-vocabulary')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg"
              >
                {landingStrings.features.textbooks.cta}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4">
            {landingStrings.comparison.title}
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-12">
            {landingStrings.comparison.subtitle}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="p-4 text-left">{landingStrings.comparison.tableHeaders.feature}</th>
                  <th className="p-4 text-center bg-indigo-50 dark:bg-indigo-900/30">
                    {landingStrings.comparison.tableHeaders.moshimoshi}
                  </th>
                  <th className="p-4 text-center">{landingStrings.comparison.tableHeaders.anki}</th>
                  <th className="p-4 text-center">{landingStrings.comparison.tableHeaders.wanikani}</th>
                  <th className="p-4 text-center">{landingStrings.comparison.tableHeaders.duolingo}</th>
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
                      <span className="text-2xl text-green-600 dark:text-green-400">
                        {landingStrings.comparison.values.yes}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-2xl text-gray-400">
                        {key === 'customCards' || key === 'offline'
                          ? landingStrings.comparison.values.yes
                          : landingStrings.comparison.values.no}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-2xl text-gray-400">
                        {key === 'kanjiSystem'
                          ? landingStrings.comparison.values.limited
                          : landingStrings.comparison.values.no}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-2xl text-gray-400">
                        {key === 'gamification'
                          ? landingStrings.comparison.values.yes
                          : landingStrings.comparison.values.no}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4">
            {landingStrings.socialProof.title}
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-12">
            {landingStrings.socialProof.subtitle}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {Object.values(landingStrings.socialProof.testimonials).map(
              (testimonial, i) => (
                <Card key={i} className="bg-gray-50 dark:bg-gray-800 p-6">
                  <p className="text-lg mb-4 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{testimonial.author}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {testimonial.role}
                      </p>
                    </div>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">
                      {testimonial.context}
                    </span>
                  </div>
                </Card>
              )
            )}
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
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="text-4xl font-bold text-center mb-4">
            {landingStrings.faq.title}
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-12">
            {landingStrings.faq.subtitle}
          </p>
          <div className="space-y-6">
            {Object.values(landingStrings.faq.questions).map((faq, i) => (
              <details
                key={i}
                className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md group"
              >
                <summary className="font-bold text-lg cursor-pointer list-none flex justify-between items-center">
                  {faq.question}
                  <span className="text-2xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-gray-600 dark:text-gray-300">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 py-20 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">{landingStrings.finalCta.title}</h2>
          <p className="text-xl mb-6">{landingStrings.finalCta.subtitle}</p>
          <p className="text-sm text-white/80 mb-8">{landingStrings.finalCta.features}</p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => router.push('/auth/signup')}
              className="bg-white text-indigo-600 hover:bg-gray-100 text-xl py-6 px-8 rounded-lg shadow-lg"
            >
              {landingStrings.finalCta.ctaPrimary}
            </Button>
            <Button
              onClick={() => router.push('/pricing')}
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-xl py-6 px-8 rounded-lg"
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
                  <Link href="/anki-import" className="hover:text-white">
                    {landingStrings.footer.links.anki}
                  </Link>
                </li>
                <li>
                  <Link href="/textbook-vocabulary" className="hover:text-white">
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
                  <Link href="/pricing" className="hover:text-white">
                    {landingStrings.footer.links.pricing}
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-white">
                    {landingStrings.footer.links.blog}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white">
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
                  <Link href="/privacy" className="hover:text-white">
                    {landingStrings.footer.links.privacy}
                  </Link>
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

export default LandingPage
