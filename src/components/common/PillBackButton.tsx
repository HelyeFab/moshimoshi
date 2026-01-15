'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useTheme } from '@/lib/theme/ThemeContext'
import { cn } from '@/lib/utils'

interface PillBackButtonProps {
  /** Fallback URL if there's no history to go back to */
  fallbackHref?: string
  /** Additional classes */
  className?: string
}

/**
 * Pill-shaped back button with smart navigation.
 * Uses browser history (router.back()) by default, falls back to provided URL.
 */
export default function PillBackButton({
  fallbackHref = '/dashboard',
  className,
}: PillBackButtonProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isLightTheme = resolvedTheme === 'light'

  const handleClick = () => {
    // Check if we have history to go back to
    // window.history.length > 1 means there's somewhere to go back
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        // Base styles - pill shape
        'p-2 rounded-full',
        'transition-all duration-200',
        'shadow-lg hover:scale-105 active:scale-95',
        // Theme-aware styles
        isLightTheme
          ? 'bg-white/30 backdrop-blur text-white hover:bg-white/40'
          : 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/30 hover:shadow-primary-500/50',
        className
      )}
      aria-label="Go back"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
  )
}
