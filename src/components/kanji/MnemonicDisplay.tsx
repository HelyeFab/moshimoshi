'use client'

import { LoadingSpinner } from '@/components/ui/Loading'
import { KanjiMnemonic, RegenerationLimit } from '@/services/kanjiService'

interface MnemonicDisplayProps {
  mnemonic: KanjiMnemonic | null
  loading: boolean
  /** Regeneration controls - only shown when user is authenticated */
  regeneration?: {
    limit: RegenerationLimit | null
    inProgress: boolean
    onRegenerate: () => void
  }
}

/**
 * Displays AI-generated or Koohii community mnemonics
 * Includes optional regeneration controls for authenticated users
 */
export default function MnemonicDisplay({
  mnemonic,
  loading,
  regeneration,
}: MnemonicDisplayProps) {
  // Loading state
  if (loading) {
    return (
      <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <LoadingSpinner size="small" />
          <span className="text-sm">Generating memory aid...</span>
        </div>
      </div>
    )
  }

  // Empty state
  if (!mnemonic) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Memory aid not available yet
        </p>
      </div>
    )
  }

  // Mnemonic display
  return (
    <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl">
      {/* Main mnemonic text */}
      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
        {mnemonic.mnemonic}
      </p>

      {/* Component breakdown */}
      {mnemonic.components && mnemonic.components.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-700/30">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
            Components:
          </p>
          <div className="flex flex-wrap gap-2">
            {mnemonic.components.map((comp, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 rounded"
              >
                {comp.part} = {comp.meaning}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Koohii community attribution */}
      {mnemonic.provider === 'koohii' && mnemonic.author && (
        <div className="mt-3 pt-2 border-t border-amber-200/30 dark:border-amber-700/20">
          <p className="text-xs text-amber-500/70 dark:text-amber-400/50">
            Story by <span className="font-medium">{mnemonic.author}</span>
            {mnemonic.votes !== undefined && mnemonic.votes > 0 && (
              <span className="ml-1">({mnemonic.votes} votes)</span>
            )}
            {' · '}
            <a
              href={`https://kanji.koohii.com/study/kanji/${mnemonic.kanji}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-600 dark:hover:text-amber-300 underline"
            >
              Kanji Koohii
            </a>
          </p>
        </div>
      )}

      {/* Regeneration controls */}
      {regeneration && (
        <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-700/30 flex items-center justify-between">
          <span className="text-xs text-amber-600/70 dark:text-amber-400/50">
            {regeneration.limit
              ? `${regeneration.limit.remaining} regeneration${regeneration.limit.remaining !== 1 ? 's' : ''} left today`
              : 'Loading...'}
          </span>
          <button
            onClick={regeneration.onRegenerate}
            disabled={regeneration.inProgress || !regeneration.limit?.allowed}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              regeneration.inProgress || !regeneration.limit?.allowed
                ? 'bg-gray-200 dark:bg-dark-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50'
            }`}
          >
            {regeneration.inProgress ? (
              <LoadingSpinner size="small" />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}
