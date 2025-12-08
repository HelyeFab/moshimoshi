'use client'

import { useI18n } from '@/i18n/I18nContext'
import { motion, AnimatePresence } from 'framer-motion'
import { DoshiLoading } from './DoshiMascot'

interface LoadingOverlayProps {
  /** Text message to display below the loader */
  message?: string
  /** Controls visibility (preferred over isVisible) */
  isLoading?: boolean
  /** Legacy prop for visibility */
  isVisible?: boolean
  /** Whether to show the Doshi mascot instead of the spinner */
  showDoshi?: boolean
  /** Whether the overlay should cover the entire screen (fixed) or just the parent container (absolute) */
  fullScreen?: boolean
}

export function LoadingOverlay({
  message,
  isLoading,
  isVisible = true,
  showDoshi = false,
  fullScreen = true,
}: LoadingOverlayProps) {
  const { t } = useI18n()

  // Determine visibility: isLoading takes precedence if defined
  const shouldShow = isLoading !== undefined ? isLoading : isVisible

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${
            fullScreen ? 'fixed' : 'absolute'
          } inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm`}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl p-8 max-w-sm mx-4"
          >
            <div className="flex flex-col items-center text-center">
              {/* Spinner or Mascot */}
              <div className="mb-4 flex items-center justify-center">
                {showDoshi ? (
                  <DoshiLoading size="medium" />
                ) : (
                  <div className="w-12 h-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 border-t-primary-500 rounded-full"
                    />
                  </div>
                )}
              </div>

              {/* Message */}
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {message || t('common.loading')}
              </p>

              {/* Animated dots */}
              <div className="flex space-x-1 justify-center">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-2 h-2 bg-primary-500 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
