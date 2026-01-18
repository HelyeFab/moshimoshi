'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import DoshiMascot from './DoshiMascot'
import PillBackButton from '@/components/common/PillBackButton'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'

interface PageHeaderProps {
  // Header content
  title: string
  description?: string
  subtitle?: string

  // Doshi mascot options
  showDoshi?: boolean
  doshiMood?:
    | 'happy'
    | 'excited'
    | 'thinking'
    | 'curious'
    | 'sleepy'
    | 'sad'
    | 'celebrating'
    | 'studying'
    | 'loading'
  doshiSize?: 'xsmall' | 'small' | 'medium' | 'large'

  // Slots
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
  children?: React.ReactNode

  // Customization
  className?: string
  minimal?: boolean

  // Navigation
  backHref?: string
  alwaysUseBackHref?: boolean
}

/**
 * PageHeader - A unified page header component
 * Features collapsible mobile view, theme-aware styling, optional Doshi mascot
 */
export default function PageHeader({
  title,
  description,
  subtitle,
  showDoshi = false,
  doshiMood = 'happy',
  doshiSize = 'large',
  actions,
  breadcrumb,
  children,
  className = '',
  minimal = false,
  backHref = '/dashboard',
  alwaysUseBackHref = false,
}: PageHeaderProps) {
  const { resolvedTheme } = useTheme()
  const { language } = useI18n()
  const [isExpanded, setIsExpanded] = useState(false)

  // Add locale prefix to backHref if it doesn't have one
  const localizedBackHref = backHref.startsWith(`/${language}`) ? backHref : `/${language}${backHref}`

  const isLightTheme = resolvedTheme === 'light'

  const headerClasses = isLightTheme
    ? `relative overflow-hidden ${className}`
    : `${className}`

  const titleClasses = isLightTheme
    ? 'text-white [text-shadow:_1px_1px_3px_rgb(0_0_0_/_40%)]'
    : 'bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent'

  const descriptionClasses = isLightTheme
    ? 'text-white/95 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]'
    : 'text-gray-600 dark:text-gray-400'

  const subtitleClasses = isLightTheme
    ? 'text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]'
    : 'text-gray-500 dark:text-gray-500'

  const buttonClasses = isLightTheme
    ? 'bg-white/50 hover:bg-white/70 backdrop-blur'
    : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'

  const iconClasses = isLightTheme ? 'text-gray-700' : 'text-gray-700 dark:text-gray-300'

  // Background gradient for light theme
  const gradientStyle = isLightTheme
    ? {
        background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`,
      }
    : undefined

  return (
    <>
      {/* Breadcrumb - shown above header on both mobile and desktop */}
      {breadcrumb && <div className="container mx-auto px-4 pt-4">{breadcrumb}</div>}

      {/* Mobile Version - Collapsible */}
      <div className="sm:hidden mb-6">
        <div className={headerClasses} style={gradientStyle}>
          {/* Background pattern for light theme */}
          {isLightTheme && !minimal && (
            <>
              <div className="absolute inset-0 bg-black/10" />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at top left,
                    rgba(var(--palette-primary-500), 0.15) 0%,
                    transparent 50%)`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at bottom right,
                    rgba(var(--palette-primary-700), 0.1) 0%,
                    transparent 50%)`,
                }}
              />
            </>
          )}

          <div className="container mx-auto px-4 py-4 relative z-10">
            {/* Compact Header */}
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h1 className={`text-2xl font-bold truncate ${titleClasses}`}>{title}</h1>
              </div>

              {/* Actions slot - mobile */}
              {actions && <div className="flex-shrink-0">{actions}</div>}

              {/* Expand/Collapse Button - only if there's content to expand */}
              {(description || subtitle || children) && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`p-2 rounded-full shadow-md transition-all flex-shrink-0 ${buttonClasses}`}
                  aria-label={isExpanded ? 'Collapse header details' : 'Expand header details'}
                  aria-expanded={isExpanded}
                  aria-controls="page-header-expandable-content"
                >
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className={`w-5 h-5 ${iconClasses}`} />
                  </motion.div>
                </button>
              )}

              {/* Back Button - Mobile */}
              <PillBackButton fallbackHref={localizedBackHref} alwaysUseFallback={alwaysUseBackHref} />
            </div>

            {/* Expandable Content */}
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.div
                  id="page-header-expandable-content"
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{
                    height: 'auto',
                    opacity: 1,
                    scale: 1,
                    transition: {
                      height: { type: 'spring', damping: 20, stiffness: 100, duration: 1.2 },
                      opacity: { duration: 0.8, ease: 'easeOut' },
                      scale: { type: 'spring', damping: 15, stiffness: 150, delay: 0.2 },
                    },
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    scale: 0.95,
                    transition: {
                      height: { type: 'spring', damping: 25, stiffness: 300, duration: 0.4 },
                      opacity: { duration: 0.2, ease: 'easeIn' },
                      scale: { duration: 0.2 },
                    },
                  }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-2">
                    {description && (
                      <p className={`text-base ${descriptionClasses}`}>{description}</p>
                    )}
                    {subtitle && <p className={`text-sm ${subtitleClasses}`}>{subtitle}</p>}
                    {children}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Desktop Version - Full Layout (pt-16 accounts for fixed navbar) */}
      <div className="hidden sm:block mb-6 pt-16">
        <div className={headerClasses} style={gradientStyle}>
          {/* Background pattern for light theme */}
          {isLightTheme && !minimal && (
            <>
              <div className="absolute inset-0 bg-black/10" />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at top left,
                    rgba(var(--palette-primary-500), 0.15) 0%,
                    transparent 50%)`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at bottom right,
                    rgba(var(--palette-primary-700), 0.1) 0%,
                    transparent 50%)`,
                }}
              />
            </>
          )}

          <div className="container mx-auto px-4 py-6 relative z-10">
            {/* Top row: back button and actions */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <PillBackButton fallbackHref={localizedBackHref} alwaysUseFallback={alwaysUseBackHref} />
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>

            {/* Main content */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {showDoshi && (
                <DoshiMascot
                  size={doshiSize}
                  mood={doshiMood}
                  variant="animated"
                  className="flex-shrink-0"
                />
              )}
              <div className="flex-1 text-center sm:text-left">
                <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${titleClasses}`}>{title}</h1>
                {description && <p className={`text-lg ${descriptionClasses}`}>{description}</p>}
                {subtitle && <p className={`text-sm mt-2 ${subtitleClasses}`}>{subtitle}</p>}
                {children && <div className="mt-4">{children}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Breadcrumb - A simple breadcrumb component for navigation
 */
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-dark-400">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          {item.href ? (
            <a
              href={item.href}
              className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-gray-900 dark:text-dark-100">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
