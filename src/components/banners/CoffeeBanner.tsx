'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Coffee, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { getDonationAmounts, DONATION_CONFIG } from '@/config/donations'

/**
 * CoffeeBanner — a small, elegant floating banner on the left side
 * that lets users support the project with a donation.
 *
 * Dismiss state is kept in React state only (resets on page reload).
 */
export default function CoffeeBanner() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { strings } = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const donationAmounts = getDonationAmounts()
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  // Close expanded card when tapping outside
  useEffect(() => {
    if (!expanded) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [expanded])

  const handleDonation = async (amount: number) => {
    if (amount < DONATION_CONFIG.minimumAmount) {
      showToast(`Minimum donation is ${DONATION_CONFIG.currencySymbol}${DONATION_CONFIG.minimumAmount / 100}`, 'error')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          userId: user?.uid,
          userEmail: user?.email,
        }),
      })

      if (!response.ok) throw new Error('Failed to create donation session')

      const { sessionUrl } = await response.json()
      if (sessionUrl) window.location.href = sessionUrl
    } catch {
      showToast('Unable to process donation. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Hide on auth pages and for unauthenticated users
  const isAuthPage = pathname?.includes('/auth/')
  if (!mounted || dismissed || isAuthPage || !user) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -60, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -60, scale: 0.9 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="fixed left-4 sm:left-6 top-24 sm:top-[5.5rem] z-40"
      >
        {/* Collapsed pill */}
        {!expanded && (
          <motion.div
            layout
            className="flex items-center gap-2 group cursor-pointer"
          >
            <button
              onClick={() => setExpanded(true)}
              className="relative flex items-center justify-center sm:gap-2.5 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full
                overflow-hidden isolate
                bg-gradient-to-r from-rose-500 via-pink-500 to-violet-500
                shadow-lg shadow-pink-500/25 dark:shadow-pink-900/40
                hover:shadow-xl hover:shadow-pink-500/35 dark:hover:shadow-pink-800/50
                transition-all duration-300 hover:scale-105"
            >
              {/* Shimmer overlay */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] animate-[shimmer_3s_ease-in-out_infinite]" />

              <span className="relative flex items-center justify-center w-5 h-5">
                <Coffee className="w-4 h-4 text-white" />
                <Heart className="absolute -top-1 -right-1.5 w-2.5 h-2.5 text-white fill-white animate-pulse" />
              </span>
              <span className="hidden sm:inline text-xs font-bold text-white tracking-wide">
                {strings.dashboard?.buyMeACoffee || 'Buy me a coffee'}
              </span>
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* Expanded card */}
        {expanded && (
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 250 }}
            className="w-[260px] rounded-2xl overflow-hidden relative isolate
              border border-white/20 dark:border-white/10
              shadow-2xl shadow-pink-500/20 dark:shadow-black/50"
          >
            {/* Background */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-500 via-pink-500 to-violet-600 dark:from-rose-600 dark:via-pink-600 dark:to-violet-700" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/10 to-transparent" />

            {/* Header */}
            <div className="relative px-4 pt-4 pb-3">
              <button
                onClick={() => setDismissed(true)}
                className="absolute top-2.5 right-2.5 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                    <Coffee className="w-4.5 h-4.5 text-white" />
                  </div>
                  <Heart className="absolute -top-1 -right-1 w-3 h-3 text-white fill-white animate-pulse drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">
                    Support Moshimoshi
                  </p>
                  <p className="text-[10px] text-white/70 leading-tight mt-0.5">
                    Help keep learning free
                  </p>
                </div>
              </div>
            </div>

            {/* Amount buttons */}
            <div className="px-3.5 pb-4">
              <div className="flex gap-2">
                {donationAmounts.map((item) => {
                  const emoji = item.value <= 500 ? '☕' : item.value <= 1000 ? '☕☕' : '☕☕☕'
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleDonation(item.value)}
                      disabled={isLoading}
                      className="flex-1 py-2.5 rounded-xl
                        bg-white/15 backdrop-blur-sm
                        border border-white/20
                        hover:bg-white/25 hover:border-white/40
                        hover:shadow-lg hover:shadow-white/10
                        transition-all duration-200 hover:-translate-y-0.5
                        disabled:opacity-50 disabled:cursor-not-allowed
                        group/btn"
                    >
                      <div className="text-center">
                        <div className="text-sm font-bold text-white group-hover/btn:text-white transition-colors">
                          {item.label}
                        </div>
                        <div className="text-[9px] mt-0.5 text-white/50">{emoji}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
