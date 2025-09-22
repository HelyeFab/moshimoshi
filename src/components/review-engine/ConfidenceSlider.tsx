'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfidenceSliderProps {
  value: number // 0-1 range
  onChange: (value: number) => void
  disabled?: boolean
  showPercentage?: boolean
  className?: string
}

export default function ConfidenceSlider({
  value,
  onChange,
  disabled = false,
  showPercentage = true,
  className = ''
}: ConfidenceSliderProps) {
  const { t } = useI18n()
  const [showTooltip, setShowTooltip] = useState(false)

  const percentage = Math.round(value * 100)

  // Get color based on confidence level
  const getSliderColor = () => {
    if (percentage < 33) return 'bg-red-500'
    if (percentage < 67) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Label with help icon */}
      <label className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
        <div className="flex items-center gap-2">
          <span>{t('review.confidence')}</span>

          {/* Help icon with tooltip */}
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="inline-flex items-center justify-center w-4 h-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full border border-gray-400 hover:border-gray-600 dark:hover:border-gray-300 transition-colors"
            aria-label={t('review.confidenceHelp')}
          >
            ?
          </button>

          {/* Tooltip */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-0 top-8 z-50 w-72 p-3 bg-soft-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700"
              >
                <div className="text-xs text-gray-700 dark:text-gray-300 space-y-2">
                  <p className="font-semibold">{t('review.confidenceTooltip.title')}</p>
                  <p>{t('review.confidenceTooltip.description')}</p>
                  <ul className="space-y-1 ml-3">
                    <li>• {t('review.confidenceTooltip.high')}</li>
                    <li>• {t('review.confidenceTooltip.medium')}</li>
                    <li>• {t('review.confidenceTooltip.low')}</li>
                  </ul>
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    {t('review.confidenceTooltip.tip')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Percentage display */}
        {showPercentage && (
          <span className={`font-medium ${
            percentage < 33 ? 'text-red-500' :
            percentage < 67 ? 'text-yellow-500' :
            'text-green-500'
          }`}>
            {percentage}%
          </span>
        )}
      </label>

      {/* Slider container */}
      <div className="relative">
        {/* Track background */}
        <div className="absolute inset-0 h-2 bg-gray-200 dark:bg-gray-700 rounded-full top-1/2 -translate-y-1/2" />

        {/* Filled track */}
        <div
          className={`absolute left-0 h-2 ${getSliderColor()} rounded-full top-1/2 -translate-y-1/2 transition-all duration-200`}
          style={{ width: `${percentage}%` }}
        />

        {/* HTML Range Input (styled to be invisible but functional) */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="relative w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          aria-label={t('review.confidenceLevel')}
        />
      </div>

      {/* Optional confidence level indicators */}
      <div className="flex justify-between mt-1 text-xs text-gray-400 dark:text-gray-500">
        <span>{t('review.confidenceLow')}</span>
        <span>{t('review.confidenceMedium')}</span>
        <span>{t('review.confidenceHigh')}</span>
      </div>
    </div>
  )
}