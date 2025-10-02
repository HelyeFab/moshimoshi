'use client'

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
  className = ''
}: PageHeaderProps) {
  const { resolvedTheme } = useTheme()

  const isLightTheme = resolvedTheme === 'light'

  const headerClasses = isLightTheme
    ? `relative overflow-hidden ${className}`
    : `bg-gray-50/80 dark:bg-dark-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-dark-700 ${className}`

  const titleClasses = isLightTheme
    ? 'text-white [text-shadow:_1px_1px_3px_rgb(0_0_0_/_40%)]'
    : 'bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent'

  const descriptionClasses = isLightTheme ? 'text-white/95 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]' : 'text-gray-600 dark:text-gray-400'
  const subtitleClasses = isLightTheme ? 'text-white/90 [text-shadow:_1px_1px_2px_rgb(0_0_0_/_35%)]' : 'text-gray-500 dark:text-gray-500'

  return (
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
  )
}
