'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useTheme } from '@/lib/theme/ThemeContext'

interface PageHeaderProps {
  // Header content
  title: string
  description: string
  subtitle?: string

  // Customization
  mascot?: 'doshi' | 'none'
  className?: string
}

export default function PageHeader({
  title,
  description,
  subtitle,
  mascot = 'doshi',
  className = '',
  children
}: PageHeaderProps) {
  const { resolvedTheme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)

  const isLightTheme = resolvedTheme === 'light'

  const headerClasses = isLightTheme
    ? `relative overflow-hidden ${className}`
    : `bg-gray-50/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700 ${className}`

  const titleClasses = isLightTheme
    ? 'text-white [text-shadow:_1px_1px_3px_rgb(0_0_0_/_40%)]'
    : 'bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent'

  const descriptionClasses = isLightTheme ? 'text-white/95 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]' : 'text-gray-600 dark:text-gray-400'
  const subtitleClasses = isLightTheme ? 'text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]' : 'text-gray-500 dark:text-gray-500'

  return (<>
    {/* Mobile Version - Collapsible */}
    <div className="sm:hidden">
    <div
      className={headerClasses}
      style={isLightTheme ? {
        background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`
      } : undefined}
    >
      {/* Beautiful background pattern for light theme - only primary colors */}
      {isLightTheme && (
        <>
          {/* Semi-transparent overlay for better text readability */}
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top left,
                rgba(var(--palette-primary-500), 0.15) 0%,
                transparent 50%)`
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at bottom right,
                rgba(var(--palette-primary-700), 0.1) 0%,
                transparent 50%)`
            }}
          />
        </>
      )}
      <div className="container mx-auto px-4 py-4 relative z-10">
        {/* Compact Header */}
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className={`text-2xl font-bold ${titleClasses}`}>
                {title}
              </h1>
            </div>

            {/* Expand/Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2 rounded-full shadow-md transition-all ${
                isLightTheme
                  ? 'bg-white/50 hover:bg-white/70 backdrop-blur'
                  : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'
              }`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className={`w-5 h-5 ${
                  isLightTheme ? 'text-gray-700' : 'text-gray-700 dark:text-gray-300'
                }`} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Expandable Content */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{
                height: 0,
                opacity: 0,
                scale: 0.95
              }}
              animate={{
                height: 'auto',
                opacity: 1,
                scale: 1,
                transition: {
                  height: {
                    type: "spring",
                    damping: 20,
                    stiffness: 100,
                    duration: 1.2
                  },
                  opacity: {
                    duration: 0.8,
                    ease: "easeOut"
                  },
                  scale: {
                    type: "spring",
                    damping: 15,
                    stiffness: 150,
                    delay: 0.2
                  }
                }
              }}
              exit={{
                height: 0,
                opacity: 0,
                scale: 0.95,
                transition: {
                  height: {
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                    duration: 0.4
                  },
                  opacity: {
                    duration: 0.2,
                    ease: "easeIn"
                  },
                  scale: {
                    duration: 0.2
                  }
                }
              }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-2">
                <p className={`text-base ${descriptionClasses}`}>
                  {description}
                </p>
                {subtitle && (
                  <p className={`text-sm ${subtitleClasses}`}>
                    {subtitle}
                  </p>
                )}
                {/* Render children if provided */}
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </div>

    {/* Desktop Version - Original Full Layout */}
    <div className="hidden sm:block">
    <div
      className={headerClasses}
      style={isLightTheme ? {
        background: `linear-gradient(135deg,
          rgb(var(--palette-primary-200)) 0%,
          rgb(var(--palette-primary-50)) 50%,
          rgb(var(--palette-primary-100)) 100%)`
      } : undefined}
    >
      {/* Beautiful background pattern for light theme - only primary colors */}
      {isLightTheme && (
        <>
          {/* Semi-transparent overlay for better text readability */}
          <div className="absolute inset-0 bg-black/10" />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top left,
                rgba(var(--palette-primary-500), 0.15) 0%,
                transparent 50%)`
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at bottom right,
                rgba(var(--palette-primary-700), 0.1) 0%,
                transparent 50%)`
            }}
          />
        </>
      )}
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {mascot === 'doshi' && (
              <DoshiMascot
                size="large"
                variant="animated"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 text-center sm:text-left">
              <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${titleClasses}`}>
                {title}
              </h1>
              <p className={`text-lg ${descriptionClasses}`}>
                {description}
              </p>
              {subtitle && (
                <p className={`text-sm mt-2 ${subtitleClasses}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </>
  )
}
