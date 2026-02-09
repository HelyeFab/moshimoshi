'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { cn } from '@/lib/utils'
import TeaHouseGuidelines from './TeaHouseGuidelines'
import { useTeaHouseGuidelines } from '@/hooks/useTeaHouseGuidelines'

interface TeaHouseAcknowledgmentModalProps {
  isOpen: boolean
  onClose: () => void
  onAcknowledged: () => void
}

/**
 * Acknowledgment Modal for Tea House
 * Requires user to read and agree to guidelines before posting
 * Saves acknowledgment to Firebase
 */
export default function TeaHouseAcknowledgmentModal({
  isOpen,
  onClose,
  onAcknowledged,
}: TeaHouseAcknowledgmentModalProps) {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { acknowledgeGuidelines } = useTeaHouseGuidelines()

  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAcknowledge = async () => {
    if (!agreed) {
      showToast(t('teaHouse.guidelines.mustAgree'), 'error')
      return
    }

    setIsSubmitting(true)

    try {
      await acknowledgeGuidelines()
      showToast(t('teaHouse.guidelines.acknowledged'), 'success')
      onAcknowledged()
    } catch (error) {
      console.error('Failed to acknowledge guidelines:', error)
      showToast(t('teaHouse.guidelines.acknowledgeFailed'), 'error')
    } finally {
      setIsSubmitting(false)
    }
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
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="relative p-6 pb-4 border-b border-gray-200 dark:border-dark-700 flex-shrink-0">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 pr-8">
                    {t('teaHouse.guidelines.beforeYouPost')}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('teaHouse.guidelines.pleaseReadAndAgree')}
                  </p>
                </div>

                {/* Content - Full Guidelines (scrollable) */}
                <div className="p-6 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
                  <TeaHouseGuidelines />
                </div>

                {/* Agreement Checkbox */}
                <div className="px-6 pb-4 flex-shrink-0">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className={cn(
                        'mt-1 w-5 h-5 rounded border-2 cursor-pointer transition-all',
                        'border-gray-300 dark:border-gray-600',
                        'checked:bg-primary-500 checked:border-primary-500',
                        'focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                      )}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                      {t('teaHouse.guidelines.iAgree')}
                    </span>
                  </label>
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-gray-200 dark:border-dark-700 flex justify-end items-center gap-4 flex-shrink-0">
                  <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleAcknowledge}
                    disabled={!agreed || isSubmitting}
                    className={cn(
                      'bg-primary-500 hover:bg-primary-600 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('teaHouse.guidelines.continueToPost')
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
