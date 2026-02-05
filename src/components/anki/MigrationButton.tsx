'use client'

import { useState } from 'react'
import { fixBracketFuriganaInExistingDecks } from '@/lib/anki/migrations/fixBracketFurigana'
import { useToast } from '@/components/ui/Toast/ToastContext'

/**
 * Development utility to fix bracket notation furigana in existing Anki decks
 * Can be removed after migration is complete
 */
export function MigrationButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { showToast } = useToast()

  const handleMigration = async () => {
    if (running) return

    const confirmed = window.confirm(
      'This will update all existing Anki decks to use proper furigana display.\n\n' +
      'This is safe and can be run multiple times.\n\n' +
      'Continue?'
    )

    if (!confirmed) return

    setRunning(true)
    setResult(null)

    try {
      console.log('Starting furigana migration...')
      const migrationResult = await fixBracketFuriganaInExistingDecks()

      setResult(migrationResult)

      if (migrationResult.success && migrationResult.cardsUpdated > 0) {
        showToast(
          `✓ Migration complete! Updated ${migrationResult.cardsUpdated} cards in ${migrationResult.decksProcessed} decks.`,
          'success'
        )

        // Suggest page reload to see changes
        setTimeout(() => {
          if (window.confirm('Reload the page to see the changes?')) {
            window.location.reload()
          }
        }, 1000)
      } else if (migrationResult.cardsUpdated === 0) {
        showToast('No cards needed updating. Your decks already have proper furigana!', 'info')
      } else {
        showToast('Migration completed with errors. Check console for details.', 'warning')
      }
    } catch (error) {
      console.error('Migration error:', error)
      showToast(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      )
      setResult({ success: false, errors: [String(error)] })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-yellow-400 dark:border-yellow-600 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/10">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">🔧</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Furigana Migration Utility
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Fix bracket notation furigana in existing Anki decks.
            Converts <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">兀[じょう]</code> to
            proper ruby tags for display.
          </p>

          <button
            onClick={handleMigration}
            disabled={running}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400
                     text-white font-medium rounded-lg transition-colors
                     disabled:cursor-not-allowed"
          >
            {running ? 'Migrating...' : 'Run Migration'}
          </button>

          {result && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <div className="text-sm space-y-1">
                <div className="font-medium">
                  {result.success ? '✓ Success' : '✗ Failed'}
                </div>
                <div>Decks processed: {result.decksProcessed}</div>
                <div>Cards updated: {result.cardsUpdated}</div>
                {result.errors && result.errors.length > 0 && (
                  <div className="text-red-600 dark:text-red-400">
                    Errors: {result.errors.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
