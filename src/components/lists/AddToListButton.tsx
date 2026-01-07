'use client'

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useSessionRefresh } from '@/hooks/useSessionRefresh'
import { listManager } from '@/lib/lists/ListManager'
import { hasRequiredMetadata } from '@/lib/lists/validation'
import { useToast } from '@/components/ui/Toast/ToastContext'
import CreateListModal from './CreateListModal'
import type { UserList, ListType } from '@/types/userLists'
import { motion, AnimatePresence } from 'framer-motion'
import { ListPlus, Bookmark, Plus, Check } from 'lucide-react'

interface AddToListButtonProps {
  content: string
  type: ListType
  metadata?: {
    reading?: string
    meaning?: string
    notes?: string
    jlptLevel?: number
  }
  className?: string
  variant?: 'icon' | 'button' | 'bookmark'
  size?: 'small' | 'medium' | 'large'
  onAdded?: (listId: string) => void
}

export default function AddToListButton({
  content,
  type,
  metadata,
  className = '',
  variant = 'icon',
  size = 'medium',
  onAdded,
}: AddToListButtonProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { isPremium, isLoading: subscriptionLoading, subscription } = useSubscription()
  const { refreshSession } = useSessionRefresh()
  const { showToast } = useToast()

  const [showMenu, setShowMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [userLists, setUserLists] = useState<UserList[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [addedToLists, setAddedToLists] = useState<Set<string>>(new Set())

  // Load user lists when menu opens
  useEffect(() => {
    if (showMenu && user) {
      loadUserLists()
    }
  }, [showMenu, user])

  const loadUserLists = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // Use false as fallback if subscription is still loading
      const lists = await listManager.getLists(user.uid, isPremium ?? false)
      // Filter to matching type lists
      const filteredLists = lists.filter(list => list.type === type)
      setUserLists(filteredLists)
    } catch (error) {
      console.error('Error loading lists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToList = async (listId: string) => {
    if (!user) {
      showToast(t('lists.errors.signInRequired'), 'error')
      return
    }

    try {
      // Check for session mismatch and refresh if needed
      const sessionData = await fetch('/api/auth/session-check').then(r => r.json())
      if (sessionData.needsRefresh) {
        await refreshSession()
        // Retry after session refresh
        return handleAddToList(listId)
      }

      // Ensure isPremium is boolean before passing
      const item = await listManager.addItemToList(
        listId,
        content,
        metadata,
        user.uid,
        isPremium ?? false
      )

      if (item) {
        setAddedToLists(prev => new Set(prev).add(listId))

        // Show contextual success message based on metadata
        if (hasRequiredMetadata(metadata)) {
          showToast(t('lists.addedToList'), 'success')
        } else {
          showToast(t('lists.addedToList') + ' - ' + t('lists.validation.requireMetadata'), 'warning')
        }

        onAdded?.(listId)

        // Reload lists to get updated item counts
        await loadUserLists()

        // Close menu after a short delay
        setTimeout(() => {
          setShowMenu(false)
        }, 1500)
      }
    } catch (error: any) {
      // Check if it's a duplicate error - this is expected validation, not an error
      if (error.message?.includes('already exists')) {
        console.log('Item already exists in list:', content)
        showToast(
          t('lists.errors.duplicateItem') || 'This item already exists in the list',
          'warning'
        )
      } else {
        // Only log actual errors
        console.error('Error adding to list:', error)
        showToast(t('lists.errors.addFailed'), 'error')
      }
    }
  }

  const handleListCreated = async (listId: string) => {
    // Wait a bit for Firebase to commit the write before reloading
    // This prevents race conditions where the list isn't returned yet
    console.log('[AddToListButton] List created, waiting 500ms before reload...')
    await new Promise(resolve => setTimeout(resolve, 500))
    await loadUserLists()
    onAdded?.(listId)
  }

  // These hooks MUST be declared before any conditional returns
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null)
  const buttonRef = React.useRef<HTMLDivElement>(null)

  // Update button position when menu opens - must be before conditional return
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect())
    }
  }, [showMenu])

  const getSizeClasses = () => {
    const sizeMap = {
      small: 'w-8 h-8 text-sm',
      medium: 'w-10 h-10 text-base',
      large: 'w-12 h-12 text-lg',
    }
    return sizeMap[size]
  }

  const renderButton = () => {
    if (variant === 'bookmark') {
      return (
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700
            transition-all group ${className}`}
          aria-label={t('lists.addToList')}
        >
          <Bookmark
            className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-500
            transition-colors"
          />
          {addedToLists.size > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
          )}
        </button>
      )
    }

    if (variant === 'button') {
      return (
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600
            transition-all font-medium flex items-center gap-2 ${className}`}
        >
          <ListPlus className="w-5 h-5" />
          {t('lists.addToList')}
        </button>
      )
    }

    // Icon variant (default)
    return (
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`relative ${getSizeClasses()} rounded-full bg-primary-100 dark:bg-primary-900/20
          hover:bg-primary-200 dark:hover:bg-primary-800/30 flex items-center justify-center
          transition-all group ${className}`}
        aria-label={t('lists.addToList')}
      >
        <ListPlus className="w-5 h-5 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
        {addedToLists.size > 0 && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
        )}
      </button>
    )
  }

  if (!user) {
    // Show disabled state for non-authenticated users
    return (
      <div className="relative inline-block">
        <div className="opacity-50 cursor-not-allowed">{renderButton()}</div>
      </div>
    )
  }

  return (
    <>
      <div className="relative inline-block" ref={buttonRef}>
        {renderButton()}
      </div>

      {/* Portal for dropdown menu */}
      {typeof window !== 'undefined' &&
        ReactDOM.createPortal(
          <AnimatePresence>
            {showMenu && buttonRect && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />

                {/* Menu - centered on mobile, positioned near button on desktop */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="fixed w-64 bg-white dark:bg-dark-800 rounded-xl
                  shadow-xl border border-gray-200 dark:border-dark-600 overflow-hidden
                  z-[101] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2
                  sm:translate-x-0 sm:translate-y-0 sm:left-auto sm:top-auto"
                  style={{
                    // On desktop (sm+), use button-relative positioning
                    ...(window.innerWidth >= 640
                      ? {
                          top: buttonRect.bottom + 8,
                          right: Math.max(16, window.innerWidth - buttonRect.right),
                          left: 'auto',
                          transform: 'none',
                        }
                      : {}),
                  }}
                >
                  <div className="p-3 border-b border-gray-100 dark:border-dark-700">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('lists.selectList')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{content}</div>
                  </div>

                  <div className="max-h-64 overflow-y-auto scrollbar-hide">
                    {isLoading ? (
                      <div className="p-4 text-center">
                        <div
                          className="w-6 h-6 border-2 border-primary-500 border-t-transparent
                        rounded-full animate-spin mx-auto"
                        />
                      </div>
                    ) : userLists.length > 0 ? (
                      <div className="p-2">
                        {userLists.map(list => (
                          <button
                            key={list.id}
                            onClick={() => handleAddToList(list.id)}
                            disabled={addedToLists.has(list.id)}
                            className={`w-full text-left p-3 rounded-lg hover:bg-gray-50
                            dark:hover:bg-dark-700 transition-all flex items-center gap-3
                            ${addedToLists.has(list.id) ? 'opacity-50' : ''}`}
                          >
                            <span className="text-xl">{list.emoji}</span>
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {list.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {list.items.length} {t('lists.items')}
                              </div>
                            </div>
                            {addedToLists.has(list.id) && (
                              <Check className="w-5 h-5 text-green-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t('lists.noLists')}
                      </div>
                    )}
                  </div>

                  <div className="p-2 border-t border-gray-100 dark:border-dark-700">
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowCreateModal(true)
                      }}
                      className="w-full p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20
                      hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all
                      flex items-center justify-center gap-2 text-primary-600 dark:text-primary-400
                      font-medium text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      {t('lists.createNew')}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleListCreated}
        initialType={type}
        initialContent={content}
        initialMetadata={metadata}
      />
    </>
  )
}
