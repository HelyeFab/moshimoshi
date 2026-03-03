'use client'

import React from 'react'
import Drawer from '@/components/ui/Drawer'
import {
  PieChart,
  CheckSquare,
  Square,
  Plus,
  RefreshCw,
  Download,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react'

interface MenuItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  hidden?: boolean
  disabled?: boolean
  description?: string
}

interface FlashcardsMenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: MenuItem[]
  t: (key: string, params?: Record<string, string | number>) => string
}

export default function FlashcardsMenuDrawer({
  isOpen,
  onClose,
  items,
  t,
}: FlashcardsMenuDrawerProps) {
  const visibleItems = items.filter(item => !item.hidden)

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return
    item.onClick()
    onClose()
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title=""
      position="right"
      size="medium"
      className="!bg-white dark:!bg-dark-850 !rounded-l-2xl overflow-hidden flex flex-col"
    >
      {/* ── Custom header ── */}
      <div className="-mx-4 -mt-4 px-5 pt-5 pb-4 bg-gradient-to-br from-primary-500/10 via-primary-400/5 to-transparent dark:from-primary-600/15 dark:via-primary-500/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/15 dark:bg-primary-400/15">
            <SlidersHorizontal className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t('flashcards.menu.title')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('flashcards.menu.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Menu items ── */}
      <div className="py-3 space-y-1">
        {visibleItems.map((item, i) => (
          <button
            key={i}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={`
              w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all duration-200
              ${item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-50 dark:hover:bg-dark-700/60 active:scale-[0.98]'
              }
            `}
          >
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-xl transition-colors
              ${item.disabled
                ? 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500'
                : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              }
            `}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`block text-sm font-semibold ${
                item.disabled
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {item.label}
              </span>
              {item.description && (
                <span className="block text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed mt-0.5">
                  {item.description}
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 flex-shrink-0 ${
                item.disabled
                  ? 'text-gray-300 dark:text-gray-600'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </Drawer>
  )
}
