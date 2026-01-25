'use client'

import { useState, useEffect } from 'react'
import { LoadingSpinner } from '@/components/ui/Loading'
import { UserMnemonic } from '@/services/kanjiService'

interface MnemonicEditorProps {
  /** Existing user mnemonic, if any */
  mnemonic: UserMnemonic | null
  /** Called when user saves their mnemonic */
  onSave: (text: string) => Promise<void>
  /** Called when user deletes their mnemonic */
  onDelete: () => Promise<void>
  /** Maximum character length */
  maxLength?: number
}

/**
 * Editor for user-created mnemonics
 * Handles view, edit, and empty states
 */
export default function MnemonicEditor({
  mnemonic,
  onSave,
  onDelete,
  maxLength = 1000,
}: MnemonicEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sync text state when mnemonic changes
  useEffect(() => {
    setText(mnemonic?.mnemonic || '')
  }, [mnemonic])

  const handleSave = async () => {
    if (!text.trim() || isSaving) return

    setIsSaving(true)
    try {
      await onSave(text.trim())
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    try {
      await onDelete()
      setText('')
      setIsEditing(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    setText(mnemonic?.mnemonic || '')
    setIsEditing(false)
  }

  const handleStartEditing = () => {
    setText(mnemonic?.mnemonic || '')
    setIsEditing(true)
  }

  // Edit mode
  if (isEditing) {
    return (
      <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your own mnemonic to remember this kanji..."
          maxLength={maxLength}
          className="w-full p-3 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-dark-700 border border-purple-200 dark:border-purple-700/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500"
          rows={4}
          autoFocus
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-purple-500/70 dark:text-purple-400/50">
            {text.length}/{maxLength}
          </span>
          <div className="flex gap-2">
            {mnemonic && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !text.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                isSaving || !text.trim()
                  ? 'bg-gray-200 dark:bg-dark-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
            >
              {isSaving && <LoadingSpinner size="small" />}
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  // View mode - has mnemonic
  if (mnemonic) {
    return (
      <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl">
        <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
          {mnemonic.mnemonic}
        </p>
        <div className="mt-3 pt-3 border-t border-purple-200/50 dark:border-purple-700/30 flex items-center justify-end">
          <button
            onClick={handleStartEditing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-800/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 rounded-lg transition-colors"
          >
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </button>
        </div>
      </div>
    )
  }

  // Empty state - no mnemonic yet
  return (
    <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl">
      <div className="text-center py-4">
        <p className="text-sm text-purple-600/70 dark:text-purple-400/50 mb-3">
          Create your own mnemonic to help you remember this kanji
        </p>
        <button
          onClick={handleStartEditing}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Write Mnemonic
        </button>
      </div>
    </div>
  )
}
