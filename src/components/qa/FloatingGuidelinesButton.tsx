'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TeaHouseGuidelines from './TeaHouseGuidelines'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { cn } from '@/lib/utils'

/**
 * Guidelines Button
 * Opens full guidelines in a modal
 */
export default function FloatingGuidelinesButton() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const isLightTheme = resolvedTheme === 'light'

  return (
    <>
      {/* Guidelines Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'p-2 transition-transform hover:scale-110',
          isLightTheme
            ? 'text-white [text-shadow:_1px_1px_2px_rgb(0_0_0_/_40%)]'
            : 'text-gray-700 dark:text-gray-300'
        )}
        aria-label={t('teaHouse.guidelines.viewGuidelines')}
        title={t('teaHouse.guidelines.viewGuidelines')}
      >
        <FileText className="w-5 h-5" />
      </button>

      {/* Modal with full guidelines - Rendered via Portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-3xl bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div className="sticky top-0 bg-white dark:bg-dark-800 z-10 p-6 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('teaHouse.guidelines.title')}
              </h2>
            </div>

            <div className="p-6">
              <TeaHouseGuidelines />
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-dark-800 z-10 p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </>
  )
}
