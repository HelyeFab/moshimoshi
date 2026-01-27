'use client'

import React, { useState, useEffect } from 'react'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { listManager } from '@/lib/lists/ListManager'
import CreateListModal from '@/components/lists/CreateListModal'
import EditListModal from '@/components/lists/EditListModal'
import type { UserList } from '@/types/userLists'
import { motion, AnimatePresence } from 'framer-motion'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Dialog from '@/components/ui/Dialog'
import Modal from '@/components/ui/Modal'
import Dropdown from '@/components/ui/Dropdown'
import { Pencil, FileJson, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useFeature } from '@/hooks/useFeature'
import MultiTabNotifier from '@/components/lists/MultiTabNotifier'
import StorageWarning from '@/components/flashcards/StorageWarning'
import ListSyncStatusIndicator from '@/components/lists/ListSyncStatusIndicator'
import { DesktopCircularIndicator, MobileBarIndicator } from '@/components/entitlements/FeatureUsageIndicator'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

// Loading skeleton component for list cards
function ListCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="relative rounded-2xl p-5 sm:p-6 bg-gray-100 dark:bg-dark-800 shadow-lg min-h-[180px] flex flex-col animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Emoji placeholder */}
      <div className="mb-4 pr-20">
        <div className="mb-3">
          <div className="w-12 h-12 bg-gray-200 dark:bg-dark-700 rounded-lg"></div>
        </div>
        {/* Title placeholder */}
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/2"></div>
        </div>
      </div>

      {/* Date placeholder at bottom */}
      <div className="mt-auto">
        <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-24"></div>
      </div>

      {/* Action buttons placeholder */}
      <div className="absolute top-2 right-2 flex gap-1">
        <div className="w-7 h-7 bg-white/20 dark:bg-white/10 rounded-lg"></div>
        <div className="w-7 h-7 bg-white/20 dark:bg-white/10 rounded-lg"></div>
        <div className="w-7 h-7 bg-white/20 dark:bg-white/10 rounded-lg"></div>
        <div className="w-7 h-7 bg-white/20 dark:bg-white/10 rounded-lg"></div>
      </div>
    </div>
  )
}

export default function MyListsPage() {
  const { t, strings } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { user, loading: authLoading } = useAuth()
  const { isPremium, isLoading: subscriptionLoading } = useSubscription()
  const router = useRouter()
  const { showToast } = useToast()
  const { checkOnly, lastDecision, remaining, refresh } = useFeature('custom_lists')

  const [lists, setLists] = useState<UserList[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedList, setSelectedList] = useState<UserList | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState('')
  const [importFormat, setImportFormat] = useState<'csv' | 'json' | 'text'>('text')
  const [editingList, setEditingList] = useState<UserList | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingList, setDeletingList] = useState<UserList | null>(null)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  useEffect(() => {
    // Only load lists after both auth and subscription have loaded
    if (!authLoading && !subscriptionLoading) {
      loadLists()
    }
  }, [user, authLoading, isPremium, subscriptionLoading])

  useEffect(() => {
    checkOnly({ failOpen: true })
  }, [checkOnly])

  const loadLists = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      console.log('[MyListsPage] Loading lists with isPremium:', isPremium)

      const userLists = await listManager.getLists(user.uid, isPremium || false)
      setLists(userLists)
    } catch (error) {
      console.error('Error loading lists:', error)
      showToast(t('lists.errors.loadFailed'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateList = async () => {
    console.log('[MyListsPage] Checking custom_lists quota...')
    const decision = await checkOnly({ failOpen: false })
    console.log('[MyListsPage] Quota check result:', decision.allow)

    if (decision.allow) {
      setShowCreateModal(true)
    } else {
      const isPremiumUser = isPremium === true
      if (decision.reason === 'no_permission') {
        showToast(
          t('entitlements.messages.upgradeRequired'),
          'error',
          5000,
          {
            label: t('subscription.actions.viewPlans'),
            onClick: () => router.push('/pricing')
          }
        )
      } else if (decision.reason === 'limit_reached') {
        const toastAction = !isPremiumUser ? {
          label: t('subscription.actions.upgrade'),
          onClick: () => router.push('/pricing')
        } : undefined
        showToast(t('lists.errors.limitReached'), 'warning', 5000, toastAction)
      } else {
        showToast(t('entitlements.messages.featureUnavailable'), 'info')
      }
      console.log('[MyListsPage] Quota exceeded, modal will not open')
    }
  }

  const handleDeleteList = async () => {
    console.log('[handleDeleteList] Starting delete operation')
    console.log('[handleDeleteList] deletingList:', deletingList)
    console.log('[handleDeleteList] user:', user)
    console.log('[handleDeleteList] isPremium:', isPremium)

    if (!user || !deletingList) {
      console.log('[handleDeleteList] Missing user or deletingList, aborting')
      return
    }
    const listToDelete = deletingList
    setDeletingList(null)

    try {
      console.log('[handleDeleteList] Calling listManager.deleteList with:', {
        listId: listToDelete.id,
        userId: user.uid,
        isPremium: isPremium || false,
      })

      // Use the version with isPremium parameter
      const success = await listManager.deleteList(listToDelete.id, user.uid, isPremium || false)

      console.log('[handleDeleteList] Delete result:', success)

      if (success) {
        await loadLists()
        await refresh()
        showToast(t('lists.success.deleted'), 'success')
      } else {
        showToast(t('lists.errors.deleteFailed'), 'error')
      }
    } catch (error) {
      console.error('[handleDeleteList] Error deleting list:', error)
      showToast(t('lists.errors.deleteFailed'), 'error')
    }
  }

  const handleDeleteAllLists = async () => {
    if (!user || lists.length === 0) return

    setIsDeletingAll(true)

    try {
      let successCount = 0
      let failCount = 0

      // Delete each list sequentially to avoid overwhelming the server
      for (const list of lists) {
        try {
          const success = await listManager.deleteList(list.id, user.uid, isPremium || false)
          if (success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          console.error(`[handleDeleteAllLists] Failed to delete list ${list.id}:`, error)
          failCount++
        }
      }

      // Reload lists and refresh quota
      await loadLists()
      await refresh()

      if (failCount === 0) {
        showToast(t('lists.success.allDeleted') || `Successfully deleted ${successCount} lists`, 'success')
      } else {
        showToast(
          t('lists.errors.someDeleteFailed') || `Deleted ${successCount} lists, ${failCount} failed`,
          'warning'
        )
      }
    } catch (error) {
      console.error('[handleDeleteAllLists] Error:', error)
      showToast(t('lists.errors.deleteFailed'), 'error')
    } finally {
      setIsDeletingAll(false)
      setShowDeleteAllDialog(false)
    }
  }

  const handleExportList = async (list: UserList, format: 'csv' | 'json') => {
    try {
      const data = await listManager.exportList(list.id, format)
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' })
      const filename = `${list.name.replace(/[^a-z0-9]/gi, '_')}.${format}`

      // Use browser API for download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      showToast(t('common.success'), 'success')
    } catch (error) {
      console.error('Error exporting list:', error)
      showToast(t('common.error'), 'error')
    }
  }

  const handleEditList = (list: UserList) => {
    setEditingList(list)
    setShowEditModal(true)
  }

  const handleListUpdated = (updatedList: UserList) => {
    // Update the list in our local state
    setLists(lists.map(list => (list.id === updatedList.id ? updatedList : list)))
    setShowEditModal(false)
    setEditingList(null)
  }

  const handleImport = async () => {
    if (!user || !importData.trim()) return

    try {
      const listName = prompt(t('lists.fields.name'))
      if (!listName) return

      const list = await listManager.importList(
        listName,
        'word', // Default type
        importData,
        importFormat,
        user.uid,
        isPremium || false
      )

      if (list) {
        await loadLists()
        await refresh()
        setShowImportModal(false)
        setImportData('')
        showToast(t('lists.success.created'), 'success')
      }
    } catch (error) {
      console.error('Error importing list:', error)
      showToast(t('common.error'), 'error')
    }
  }

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      primary: 'bg-primary-500 dark:bg-primary-600',
      ocean: 'bg-blue-500 dark:bg-blue-600',
      matcha: 'bg-green-500 dark:bg-green-600',
      sunset: 'bg-orange-500 dark:bg-orange-600',
      lavender: 'bg-purple-500 dark:bg-purple-600',
      monochrome: 'bg-gray-500 dark:bg-gray-600',
    }
    return colorMap[color] || colorMap.primary
  }

  if (authLoading || isLoading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
      >
        {/* Desktop Navbar */}
        <div className="hidden sm:block">
          <Navbar user={user} showUserMenu={true} />
        </div>

        <div className="container mx-auto px-4 py-8 pb-24">
          <PageHeader
            title={t('lists.title')}
            description={t('lists.pageDescription')}
          />

          {/* Loading message */}
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('common.loading')}
            </p>
          </div>

          {/* Skeleton loaders with staggered animation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <ListCardSkeleton delay={0} />
            <ListCardSkeleton delay={150} />
            <ListCardSkeleton delay={300} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
        dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
      >
        {/* Navigation is now global - rendered in root layout */}
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">
              {t('lists.errors.signInRequired')}
            </h2>
            <button
              onClick={() => router.push(getLocalePath('/auth/signin'))}
              className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600
                transition-all font-medium"
            >
              {t('common.signIn')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const limitCount = lastDecision?.limit ?? 0
  const isUnlimited = limitCount === -1
  const usedCount = typeof lastDecision?.usageBefore === 'number'
    ? lastDecision.usageBefore
    : Math.max(0, limitCount - (remaining ?? 0))
  const hasUsageData = !!lastDecision && !isUnlimited

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50
      dark:from-dark-900 dark:via-dark-850 dark:to-dark-800"
    >
      {/* Multi-tab coordination notifier */}
      <MultiTabNotifier />

      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <div className="container mx-auto px-4 py-8 pb-24">
        <PageHeader
          title={t('lists.title')}
          description={t('lists.pageDescription')}
          actions={
            hasUsageData ? (
              <DesktopCircularIndicator
                remaining={remaining ?? 0}
                limitCount={limitCount}
                usedCount={usedCount}
                color={usedCount >= limitCount ? 'red' : usedCount >= limitCount * 0.8 ? 'yellow' : 'green'}
              />
            ) : null
          }
        />

        {hasUsageData && (
          <MobileBarIndicator
            remaining={remaining ?? 0}
            limitCount={limitCount}
          />
        )}

        {/* Actions bar */}
        <div className="flex flex-wrap gap-3 mb-6 mt-6">
          <button
            onClick={handleCreateList}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
              transition-all font-medium flex items-center gap-2"
          >
            <span>➕</span>
            {t('lists.createNew')}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200
              dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700
              transition-all font-medium flex items-center gap-2"
          >
            <span>📥</span>
            {t('common.import')}
          </button>

          {/* Delete All button - only show when there are lists */}
          {lists.length > 0 && (
            <button
              onClick={() => setShowDeleteAllDialog(true)}
              className="px-4 py-2 bg-white dark:bg-dark-800 border border-red-200
                dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20
                transition-all font-medium flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              {t('lists.actions.deleteAll') || 'Delete All'}
            </button>
          )}
        </div>

        {/* Lists grid */}
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-4">
              {t('lists.empty.noLists')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-center">
              {t('lists.empty.getStarted')}
            </p>
            <button
              onClick={handleCreateList}
              className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl
                hover:bg-primary-600 transition-all font-medium"
            >
              {t('lists.actions.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {lists.map(list => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  className="relative group"
                >
                  <div
                    className={`${getColorClasses(list.color)} rounded-2xl p-5 sm:p-6 text-white
                    shadow-lg hover:shadow-xl transition-all cursor-pointer min-h-[180px] flex flex-col`}
                    onClick={() => router.push(`/lists/${list.id}`)}
                  >
                    {/* Emoji and name stacked vertically on the left */}
                    <div className="mb-4 pr-20">
                      <div className="mb-3">
                        <span className="text-4xl leading-none">{list.emoji}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg sm:text-xl mb-2 break-words leading-tight">
                          {list.name}
                        </h3>
                        <p className="text-xs sm:text-sm opacity-90">
                          {t(`lists.types.${list.type}.short`)} • {list.items.length}{' '}
                          {t('lists.items')}
                        </p>
                      </div>
                    </div>

                    {/* Quick stats at bottom */}
                    <div className="text-xs sm:text-sm opacity-90 mt-auto">
                      <span>{new Date(list.updatedAt).toLocaleDateString()}</span>
                    </div>

                    {/* Actions - always visible */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleEditList(list)
                        }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                        title={t('lists.actions.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleExportList(list, 'json')
                        }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                        title={t('lists.actions.exportJson')}
                      >
                        <FileJson className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleExportList(list, 'csv')
                        }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                        title={t('lists.actions.exportCsv')}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setDeletingList(list)
                        }}
                        className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-all"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={async () => {
          // Wait a bit for Firebase to commit the write before reloading
          console.log('[MyListsPage] List created, waiting 500ms before reload...')
          await new Promise(resolve => setTimeout(resolve, 500))
          await loadLists()
          await refresh()
        }}
      />

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('lists.importModal.title')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Dropdown
              label={t('lists.importModal.format')}
              value={importFormat}
              onChange={(value) => setImportFormat(value as any)}
              options={[
                { value: 'text', label: t('lists.importModal.formatText') },
                { value: 'csv', label: t('lists.importModal.formatCsv') },
                { value: 'json', label: t('lists.importModal.formatJson') },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('lists.importModal.data')}
            </label>
            <textarea
              value={importData}
              onChange={e => setImportData(e.target.value)}
              placeholder={
                importFormat === 'text'
                  ? t('lists.importModal.dataPlaceholderText')
                  : t('lists.importModal.dataPlaceholder')
              }
              className="w-full h-48 px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600
                bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100
                dark:hover:bg-dark-700 rounded-lg transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleImport}
              disabled={!importData.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {t('lists.importModal.import')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit List Modal */}
      <EditListModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingList(null)
        }}
        onUpdated={handleListUpdated}
        list={editingList}
      />

      {/* Delete Confirmation Dialog */}
      {deletingList && (
        <Dialog
          isOpen={true}
          onClose={() => setDeletingList(null)}
          onConfirm={handleDeleteList}
          title={t('lists.deleteDialog.title') || 'Delete List'}
          message={`Are you sure you want to delete "${deletingList.name}"? This action cannot be undone.`}
          confirmText={t('common.delete') || 'Delete'}
          cancelText={t('common.cancel') || 'Cancel'}
          type="danger"
        />
      )}

      {/* Delete All Confirmation Dialog */}
      <Dialog
        isOpen={showDeleteAllDialog}
        onClose={() => !isDeletingAll && setShowDeleteAllDialog(false)}
        onConfirm={handleDeleteAllLists}
        title={t('lists.deleteAllDialog.title') || 'Delete All Lists'}
        message={
          t('lists.deleteAllDialog.message', { count: lists.length }) ||
          `Are you sure you want to delete all ${lists.length} lists? This action cannot be undone and all items within these lists will be permanently removed.`
        }
        confirmText={t('lists.deleteAllDialog.confirm', { count: lists.length }) || `Delete All (${lists.length})`}
        cancelText={t('common.cancel') || 'Cancel'}
        type="danger"
        isLoading={isDeletingAll}
      />

      <StorageWarning
        warningMessage="Storage running low. Consider deleting unused lists or clearing old data."
        criticalMessage="Storage critically low! Please delete unused lists to free up space and continue using the app."
      />
      <ListSyncStatusIndicator />
      <MobileNavSpacer />
    </div>
  )
}
