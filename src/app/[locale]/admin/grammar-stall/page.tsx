'use client'

import { useAdmin } from '@/hooks/useAdmin'

export default function GrammarStallAdminPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You do not have admin privileges.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-primary-50 dark:from-dark-850 dark:to-dark-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Grammar Stall Admin</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage grammar content, exercises, and review sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Content Overview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Dashboard components will appear here once the grammar content pipeline is wired.
            </p>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Exercise Health
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track exercise coverage, validation quality, and review performance.
            </p>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              URE Sessions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Monitor review sessions and XP events for grammar practice.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
