'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import TeaHouseGuidelines from './TeaHouseGuidelines'

interface TeaHouseWelcomeModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Welcome Modal for Tea House
 * Shows condensed guidelines on first visit
 * Uses localStorage to track if shown
 */
export default function TeaHouseWelcomeModal({ isOpen, onClose }: TeaHouseWelcomeModalProps) {
  const { t } = useI18n()
  const [showFullGuidelines, setShowFullGuidelines] = useState(false)

  const handleViewFull = () => {
    setShowFullGuidelines(true)
  }

  const handleBack = () => {
    setShowFullGuidelines(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-3xl"
            >
              <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-dark-800 z-10 p-6 pb-4 border-b border-gray-200 dark:border-dark-700">
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6">
                  <TeaHouseGuidelines compact={!showFullGuidelines} />
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-dark-800 z-10 p-4 sm:p-6 pt-4 border-t border-gray-200 dark:border-dark-700">
                  {!showFullGuidelines ? (
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={onClose}
                        size="lg"
                        className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-6 text-lg font-semibold w-full"
                      >
                        {t('common.gotIt')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleViewFull}
                        className="text-base text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-700 border-2 border-gray-300 dark:border-gray-600 w-full py-3"
                      >
                        {t('teaHouse.guidelines.viewFullGuidelines')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={onClose}
                        size="lg"
                        className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-6 text-lg font-semibold w-full"
                      >
                        {t('common.gotIt')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="text-base text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-700 border-2 border-gray-300 dark:border-gray-600 w-full py-3"
                      >
                        {t('common.back')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
