'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAdmin } from '@/hooks/useAdmin'
import { useAdminLearningVillageConfig } from '@/hooks/useLearningVillageConfig'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { StallConfig, STALL_IDS, StallId, DEFAULT_CONFIG } from '@/config/learning-village-types'
import {
  GripVertical,
  Star,
  StarOff,
  Save,
  RotateCcw,
  Download,
  Upload,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'

// Stall display names for better UX
const STALL_NAMES: Record<StallId, string> = {
  'hiragana': 'Hiragana',
  'katakana': 'Katakana',
  'drill': 'Drill Practice',
  'vocabulary': 'Vocabulary',
  'my-lists': 'My Lists',
  'kanji-browser': 'Kanji Browser',
  'kanji-mastery': 'Kanji Mastery',
  'kanji-connections': 'Kanji Connections',
  'mood-boards': 'Mood Boards',
  'conjugation': 'Conjugation',
  'textbook-vocab': 'Textbook Vocab',
  'stories': 'AI Stories',
  'news': 'NHK News',
  'library': 'Library',
  'comics': 'Moshi Comics',
  'youtube-shadowing': 'YouTube Shadowing',
  'popular-videos': 'Popular Videos',
  'youtube-series': 'YouTube Series',
  'my-videos': 'My Videos',
  'flashcards': 'Flashcards',
  'games': 'Games',
  'review-hub': 'Review Hub',
  'achievements': 'Achievements',
  'leaderboard': 'Leaderboard',
  'resources': 'Resources',
  'blog': 'Blog',
  'todos': 'Task Manager',
  'qa': 'Q&A'
}

// Sortable Item Component
function SortableStallItem({
  stall,
  onTogglePopular,
  onToggleEnabled
}: {
  stall: StallConfig
  onTogglePopular: (id: StallId) => void
  onToggleEnabled: (id: StallId) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stall.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-lg border
        ${stall.enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600 opacity-60'}
        ${isDragging ? 'shadow-lg' : 'shadow-sm'}
        transition-shadow duration-200`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Order Number */}
      <span className="w-8 text-sm font-mono text-gray-400">
        #{stall.order + 1}
      </span>

      {/* Stall Name */}
      <span className={`flex-1 font-medium ${stall.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
        {STALL_NAMES[stall.id] || stall.id}
      </span>

      {/* Popular Badge Toggle */}
      <button
        onClick={() => onTogglePopular(stall.id)}
        className={`p-2 rounded-lg transition-colors ${
          stall.isPopular
            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
        title={stall.isPopular ? 'Remove Popular badge' : 'Add Popular badge'}
      >
        {stall.isPopular ? (
          <Star className="w-5 h-5 fill-current" />
        ) : (
          <StarOff className="w-5 h-5" />
        )}
      </button>

      {/* Enabled Toggle */}
      <button
        onClick={() => onToggleEnabled(stall.id)}
        className={`p-2 rounded-lg transition-colors ${
          stall.enabled
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
        }`}
        title={stall.enabled ? 'Hide stall' : 'Show stall'}
      >
        {stall.enabled ? (
          <Eye className="w-5 h-5" />
        ) : (
          <EyeOff className="w-5 h-5" />
        )}
      </button>
    </div>
  )
}

export default function LearningVillageAdminPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const { config, loading: configLoading, saving, updateConfig, resetToDefaults } = useAdminLearningVillageConfig()
  const { showToast } = useToast()

  const [localStalls, setLocalStalls] = useState<StallConfig[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize local state from config
  useEffect(() => {
    if (config?.stalls) {
      setLocalStalls([...config.stalls].sort((a, b) => a.order - b.order))
      setHasChanges(false)
    }
  }, [config])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalStalls((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)

        // Update order values
        return newItems.map((item, index) => ({
          ...item,
          order: index
        }))
      })
      setHasChanges(true)
    }
  }, [])

  // Toggle popular badge
  const handleTogglePopular = useCallback((id: StallId) => {
    setLocalStalls((items) =>
      items.map((item) =>
        item.id === id ? { ...item, isPopular: !item.isPopular } : item
      )
    )
    setHasChanges(true)
  }, [])

  // Toggle enabled state
  const handleToggleEnabled = useCallback((id: StallId) => {
    setLocalStalls((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    )
    setHasChanges(true)
  }, [])

  // Save changes
  const handleSave = async () => {
    const success = await updateConfig(localStalls)
    if (success) {
      showToast('Configuration saved successfully', 'success')
      setHasChanges(false)
    } else {
      showToast('Failed to save configuration', 'error')
    }
  }

  // Reset to defaults
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset to default configuration? This cannot be undone.')) {
      return
    }

    const success = await resetToDefaults()
    if (success) {
      showToast('Configuration reset to defaults', 'success')
      setHasChanges(false)
    } else {
      showToast('Failed to reset configuration', 'error')
    }
  }

  // Export config as JSON
  const handleExport = () => {
    const exportData = {
      ...config,
      stalls: localStalls,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `learning-village-config-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Configuration exported', 'success')
  }

  // Import config from JSON
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!data.stalls || !Array.isArray(data.stalls)) {
          throw new Error('Invalid configuration file')
        }

        // Validate stall IDs
        const validIds = new Set(STALL_IDS)
        const importedStalls = data.stalls.filter((s: StallConfig) => validIds.has(s.id))

        if (importedStalls.length === 0) {
          throw new Error('No valid stalls found in configuration')
        }

        setLocalStalls(importedStalls.map((s: StallConfig, i: number) => ({ ...s, order: i })))
        setHasChanges(true)
        showToast('Configuration imported. Click Save to apply.', 'success')
      } catch (err) {
        showToast('Failed to import configuration', 'error')
        console.error('Import error:', err)
      }
    }
    input.click()
  }

  // Loading state
  if (adminLoading || configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          You need admin privileges to access this page.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Learning Village Configuration
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Drag to reorder stalls, toggle the star to add/remove the Popular badge,
          and use the eye icon to show/hide stalls.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${hasChanges
              ? 'bg-primary-500 hover:bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>

        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium
            bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
            hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>

        <div className="flex-1" />

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium
            bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
            hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <button
          onClick={handleImport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium
            bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
            hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-yellow-800 dark:text-yellow-200 font-medium">
            You have unsaved changes. Click "Save Changes" to apply them.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {localStalls.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Stalls</p>
        </div>
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {localStalls.filter(s => s.isPopular).length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Popular Badges</p>
        </div>
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {localStalls.filter(s => s.enabled).length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Visible Stalls</p>
        </div>
      </div>

      {/* Sortable List */}
      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localStalls.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {localStalls.map((stall) => (
              <SortableStallItem
                key={stall.id}
                stall={stall}
                onTogglePopular={handleTogglePopular}
                onToggleEnabled={handleToggleEnabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Last Updated Info */}
      {config?.updatedAt && (
        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {new Date(config.updatedAt).toLocaleString()}
          {config.updatedBy && config.updatedBy !== 'system' && (
            <> by {config.updatedBy}</>
          )}
        </div>
      )}
    </div>
  )
}
