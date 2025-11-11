'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckIcon, XMarkIcon, SparklesIcon, StarIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslation } from '@/i18n/I18nContext'

interface CompetitorApp {
  name: string
  price: string
  features: string[]
  missing: string[]
  logoUrl: string
}

export default function PricingComparison() {
  const router = useRouter()
  const { strings } = useTranslation()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  // Get pricing comparison strings with fallback
  const pricingStrings = strings?.pricing?.pricingComparison || {}
  const {
    badge = "ALL FEATURES COMBINED",
    title = "One App, Every Feature",
    subtitle = "Why pay for multiple apps? Moshimoshi combines all premium features from leading Japanese learning apps at a fraction of the cost.",
    compareTitle = "Compare with Other Apps",
    competitors: competitorStrings = {},
    missingLabel = "Missing:",
    moreMissing = "+ more missing...",
    costComparison = {},
    moshimoshiPricing = {},
    allFeatures = {},
    bottomCta = {}
  } = pricingStrings

  // Competitor apps with their features and actual logos
  const competitors: CompetitorApp[] = [
    {
      name: competitorStrings.duolingo?.name || "Duolingo",
      price: competitorStrings.duolingo?.price || "£47.99/year",
      logoUrl: 'https://cdn.brandfetch.io/id4D-_pnvt/w/400/h/400/theme/dark/icon.png',
      features: competitorStrings.duolingo?.features || ["Gamification", "Basic lessons", "Streak tracking"],
      missing: competitorStrings.duolingo?.missing || ["YouTube shadowing", "AI stories", "Kanji breakdown", "News reading", "Anki export"]
    },
    {
      name: competitorStrings.heyJapan?.name || "HeyJapan",
      price: competitorStrings.heyJapan?.price || "£48.99/year",
      logoUrl: 'https://heylearning.net/assets/images/logo/heyjapan_square.png',
      features: competitorStrings.heyJapan?.features || ["Video lessons", "Grammar explanations"],
      missing: competitorStrings.heyJapan?.missing || ["Gamification", "AI features", "YouTube practice", "News reading", "Anki export"]
    },
    {
      name: competitorStrings.satoriReader?.name || "Satori Reader",
      price: competitorStrings.satoriReader?.price || "£8.49/month",
      logoUrl: 'https://www.satorireader.com/favicon.ico',
      features: competitorStrings.satoriReader?.features || ["Reading practice", "Furigana support"],
      missing: competitorStrings.satoriReader?.missing || ["Video lessons", "Gamification", "YouTube practice", "AI stories", "Anki export"]
    },
    {
      name: competitorStrings.lingoDeer?.name || "LingoDeer",
      price: competitorStrings.lingoDeer?.price || "£95.99/year",
      logoUrl: 'https://cdn.brandfetch.io/idMcZLIFKQ/w/400/h/400/theme/dark/icon.jpeg',
      features: competitorStrings.lingoDeer?.features || ["Structured lessons", "Grammar focus"],
      missing: competitorStrings.lingoDeer?.missing || ["YouTube practice", "AI stories", "News reading", "Advanced kanji tools"]
    }
  ]

  // All features moshimoshi offers
  const allFeaturesData = [
    {
      category: allFeatures.categories?.learningTools?.title || "Learning Tools",
      items: allFeatures.categories?.learningTools?.items?.map(item => `✨ ${item}`) || [
        "✨ YouTube Video Shadowing",
        "📚 AI-Generated Stories",
        "📰 Japanese News Reader",
        "🎮 Gamification & XP System",
        "🏆 Achievements & Leaderboard",
        "📝 Anki Export Integration"
      ]
    },
    {
      category: allFeatures.categories?.studyFeatures?.title || "Study Features",
      items: allFeatures.categories?.studyFeatures?.items?.map(item => `🔤 ${item}`) || [
        "🔤 Complete Hiragana/Katakana",
        "🈸 JLPT N5-N1 Kanji Browser",
        "📖 Grammar Explanations",
        "🎯 Smart SRS Algorithm",
        "📱 Offline Mode",
        "🔊 Native Audio Pronunciation"
      ]
    },
    {
      category: allFeatures.categories?.advancedTools?.title || "Advanced Tools",
      items: allFeatures.categories?.advancedTools?.items?.map(item => `🧠 ${item}`) || [
        "🧠 AI Word Explanations",
        "⚡ Conjugation Engine",
        "🎨 Kanji Stroke Order",
        "📊 Progress Analytics",
        "🎯 Custom Study Lists",
        "🌙 Dark/Light Theme"
      ]
    }
  ]

  const monthlyPrice = 8.99
  const yearlyPrice = 99.99
  const yearlyMonthly = (yearlyPrice / 12).toFixed(2)
  const savings = ((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12) * 100).toFixed(0)

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-6">
            <SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {badge}
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {subtitle}
          </p>
        </motion.div>

        {/* Competitor Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
            {compareTitle}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {competitors.map((app, index) => (
              <motion.div
                key={app.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="relative bg-white dark:bg-dark-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-dark-700"
              >
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-12 h-12 rounded-full bg-white dark:bg-gray-700 p-2 shadow-md border border-gray-200 dark:border-gray-600">
                      <Image
                        src={app.logoUrl}
                        alt={`${app.name} logo`}
                        fill
                        className="object-contain p-0.5"
                        unoptimized // Since these are external URLs
                      />
                    </div>
                    <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{app.name}</h4>
                  </div>
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{app.price}</p>
                </div>

                <div className="space-y-2 mb-4">
                  {app.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">{missingLabel}</p>
                  <div className="space-y-1">
                    {app.missing.slice(0, 3).map((missing, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-xs">
                        <XMarkIcon className="w-3 h-3 text-red-400 flex-shrink-0" />
                        <span className="text-gray-500 dark:text-gray-400 truncate">{missing}</span>
                      </div>
                    ))}
                    {app.missing.length > 3 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        +{app.missing.length - 3} {moreMissing}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Total Cost Comparison */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-6 border-2 border-red-200 dark:border-red-800"
          >
            <div className="text-center">
              <p className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                {costComparison.title || "To get all these features separately, you'd pay:"}
              </p>
              <p className="text-4xl font-bold text-red-900 dark:text-red-400">
                {costComparison.amount || "£240+ per year"}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-2">
                {costComparison.subtitle || "(Subscribing to 3-4 different apps)"}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Moshimoshi Pricing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {moshimoshiPricing.title || "Moshimoshi Pricing"}
            </h3>

            {/* Billing Toggle */}
            <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-dark-800 rounded-full">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white dark:bg-dark-700 text-indigo-600 dark:text-indigo-400 shadow-md'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {moshimoshiPricing.monthly || "Monthly"}
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-white dark:bg-dark-700 text-indigo-600 dark:text-indigo-400 shadow-md'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {moshimoshiPricing.yearly || "Yearly"}
                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                  {moshimoshiPricing.save || "Save"} {savings}%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="relative bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-700 p-8"
            >
              <div className="mb-6">
                <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {moshimoshiPricing.free?.title || "Free"}
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {moshimoshiPricing.free?.subtitle || "Start your journey"}
                </p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                    {moshimoshiPricing.free?.price || "£0"}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {moshimoshiPricing.free?.period || "/forever"}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {(moshimoshiPricing.free?.features || []).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
                {(moshimoshiPricing.free?.limitations || []).map((limitation, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <XMarkIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-400">{limitation}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => router.push('/auth/signup')}
                className="w-full bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                {moshimoshiPricing.free?.cta || "Get Started Free"}
              </Button>
            </motion.div>

            {/* Premium Tier */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-8 text-white"
            >
              {/* Most Popular Badge */}
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                  <StarIcon className="w-4 h-4" />
                  {moshimoshiPricing.premium?.badge || "BEST VALUE"}
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-2xl font-bold">
                  {moshimoshiPricing.premium?.title || "Premium"}
                </h4>
                <p className="text-indigo-100 mt-2">
                  {moshimoshiPricing.premium?.subtitle || "Everything included"}
                </p>
                <div className="mt-4">
                  {billingPeriod === 'monthly' ? (
                    <>
                      <span className="text-4xl font-bold">
                        {moshimoshiPricing.premium?.monthlyPrice || `£${monthlyPrice}`}
                      </span>
                      <span className="text-indigo-100">
                        {moshimoshiPricing.premium?.period || "/month"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">
                        {moshimoshiPricing.premium?.yearlyPrice || `£${yearlyMonthly}`}
                      </span>
                      <span className="text-indigo-100">
                        {moshimoshiPricing.premium?.period || "/month"}
                      </span>
                      <div className="text-sm text-indigo-200 mt-1">
                        {moshimoshiPricing.premium?.yearlyTotal || `£${yearlyPrice}/year`}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {(moshimoshiPricing.premium?.features || [
                  "Everything in Free, plus:",
                  "Unlimited YouTube shadowing",
                  "All JLPT levels (N5-N1)",
                  "Unlimited AI stories & explanations",
                  "Japanese news reader",
                  "Anki export & cloud sync",
                  "Priority support"
                ]).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckIcon className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                    <span className={idx === 0 ? "font-semibold" : ""}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => router.push('/auth/signup?plan=premium')}
                className="w-full bg-white text-indigo-600 hover:bg-gray-100 font-bold text-lg py-6"
              >
                {moshimoshiPricing.premium?.cta || "Start 7-Day Free Trial"}
              </Button>
              <p className="text-xs text-indigo-100 text-center mt-3">
                {moshimoshiPricing.premium?.disclaimer || "No credit card required • Cancel anytime"}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* All Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20"
        >
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
            {allFeatures.title || "Everything You Get with Premium"}
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            {allFeaturesData.map((category, index) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white dark:bg-dark-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-dark-700"
              >
                <h4 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-100">
                  {category.category}
                </h4>
                <ul className="space-y-3">
                  {category.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-gray-700 dark:text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              {bottomCta.title || "Join thousands learning Japanese the smart way"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {bottomCta.subtitle || "One app, every feature, fraction of the cost. Start your journey today!"}
            </p>
            <Button
              onClick={() => router.push('/auth/signup')}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-lg"
            >
              {bottomCta.button || "Start Free Trial"}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}