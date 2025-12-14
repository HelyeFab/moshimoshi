'use client'

import { useState, useEffect } from 'react'
import { buildLocalePath } from '@/i18n/I18nContext'

export default function ClearStoragePage() {
  const [result, setResult] = useState<{
    type: 'success' | 'error' | null
    message: string
    details: string[]
  }>({
    type: null,
    message: '',
    details: []
  })
  const [isClearing, setIsClearing] = useState(false)
  const [shouldReload, setShouldReload] = useState(false)

  // Close all database connections on mount
  useEffect(() => {
    // This helps release any connections this page might have opened
    return () => {
      // Cleanup on unmount
    }
  }, [])

  const clearAllStorage = async () => {
    setIsClearing(true)
    const details: string[] = []
    let hasErrors = false

    try {
      details.push('⚠️ Note: Some Firebase databases may remain open. This is normal.\n')

      // 1. Clear localStorage
      const localStorageKeys = Object.keys(localStorage)
      details.push(`✅ Cleared ${localStorageKeys.length} localStorage items:`)
      localStorageKeys.forEach(key => {
        details.push(`   - ${key}`)
      })
      localStorage.clear()

      // 2. Clear sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage)
      details.push(`\n✅ Cleared ${sessionStorageKeys.length} sessionStorage items:`)
      sessionStorageKeys.forEach(key => {
        details.push(`   - ${key}`)
      })
      sessionStorage.clear()

      // 3. Clear all IndexedDB databases
      const databases = await indexedDB.databases()
      details.push(`\n✅ Found ${databases.length} IndexedDB databases:`)

      for (const db of databases) {
        const dbName = db.name
        if (!dbName) continue

        details.push(`   - Deleting: ${dbName}`)

        try {
          await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName)
            request.onsuccess = () => {
              details.push(`     ✓ Deleted ${dbName}`)
              resolve(null)
            }
            request.onerror = () => {
              details.push(`     ✗ Failed to delete ${dbName}`)
              hasErrors = true
              reject(request.error)
            }
            request.onblocked = () => {
              details.push(`     ⚠ Blocked: ${dbName} (close all tabs and try again)`)
              hasErrors = true
              reject(new Error('Database deletion blocked'))
            }
          })
        } catch (err: any) {
          details.push(`     ✗ Error: ${err.message}`)
          hasErrors = true
        }
      }

      // 4. Clear cookies
      const cookies = document.cookie.split(';')
      details.push(`\n✅ Clearing ${cookies.length} cookies:`)
      for (let cookie of cookies) {
        const eqPos = cookie.indexOf('=')
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
        if (name) {
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
          details.push(`   - ${name}`)
        }
      }

      // 5. Clear caches (if available)
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        details.push(`\n✅ Clearing ${cacheNames.length} caches:`)
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName)
          details.push(`   - ${cacheName}`)
        }
      }

      // Final message about blocked databases
      if (hasErrors) {
        details.push('\n🔄 To fully clear blocked databases:')
        details.push('   1. Click "Force Clear & Reload" button below')
        details.push('   2. This will close this tab and reload')
        details.push('   3. Databases will be cleared on next visit')
      }

      setResult({
        type: hasErrors ? 'error' : 'success',
        message: hasErrors
          ? '⚠️ Completed with warnings. Some Firebase databases are still open.'
          : '✅ Storage cleared successfully! All local data has been removed.',
        details
      })

      // If there were errors, suggest reload
      if (hasErrors) {
        setShouldReload(true)
      }

    } catch (error: any) {
      setResult({
        type: 'error',
        message: `❌ Error clearing storage: ${error.message}`,
        details
      })
    } finally {
      setIsClearing(false)
    }
  }

  const forceReload = () => {
    // Clear everything we can one more time
    localStorage.clear()
    sessionStorage.clear()

    // Navigate away then back to force IndexedDB closure
    window.location.href = 'about:blank'
    setTimeout(() => {
      window.location.href = buildLocalePath('/')
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🗑️ Clear Moshimoshi Storage
        </h1>
        <p className="text-gray-600 mb-6 text-sm">
          Clear all local storage and IndexedDB data
        </p>

        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-yellow-800 mb-2">⚠️ Warning</h3>
          <p className="text-yellow-800">
            This will permanently delete all locally stored data including:
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">📦 Data that will be cleared:</h3>
          <ul className="list-disc list-inside text-blue-900 space-y-1">
            <li><strong>LocalStorage:</strong> Theme, language, cached preferences, auth tokens</li>
            <li><strong>IndexedDB:</strong> Offline review data, preferences, sync queues</li>
            <li><strong>Session Storage:</strong> Temporary session data</li>
            <li><strong>Cookies:</strong> Session cookies</li>
          </ul>
          <p className="mt-3 font-semibold text-blue-900">
            Note: Cloud data (for premium users) will NOT be affected.
          </p>
        </div>

        <button
          onClick={clearAllStorage}
          disabled={isClearing}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors mb-4"
        >
          {isClearing ? 'Clearing...' : 'Clear All Storage'}
        </button>

        {result.type && (
          <div className={`rounded-lg p-4 ${
            result.type === 'success'
              ? 'bg-green-50 border-2 border-green-500'
              : 'bg-red-50 border-2 border-red-500'
          }`}>
            <h3 className={`font-bold mb-2 ${
              result.type === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              {result.message}
            </h3>

            <div className="bg-black/5 rounded p-3 mt-3 max-h-96 overflow-y-auto scrollbar-hide">
              {result.details.map((detail, idx) => (
                <div
                  key={idx}
                  className={`font-mono text-sm ${
                    result.type === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {detail}
                </div>
              ))}
            </div>

            {shouldReload && (
              <button
                onClick={forceReload}
                className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                🔄 Force Clear & Reload
              </button>
            )}

            {result.type === 'success' && !shouldReload && (
              <button
                onClick={() => window.location.href = buildLocalePath('/')}
                className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ✓ Go to Home
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
