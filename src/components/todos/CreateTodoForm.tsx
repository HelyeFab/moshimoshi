// Create Todo Form Component
// Beautiful animated form with glass morphism and micro-interactions

'use client'

import { useState, useEffect } from 'react'
import { CreateTodoInput } from '@/types/todos'
import { useI18n } from '@/i18n/I18nContext'

interface CreateTodoFormProps {
  onCreateTodo: (input: CreateTodoInput) => Promise<any>
}

export function CreateTodoForm({ onCreateTodo }: CreateTodoFormProps) {
  const { t } = useI18n()
  const [isExpanded, setIsExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY'>('MM/DD/YYYY')
  const [isCreating, setIsCreating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Load date format preference from localStorage
  useEffect(() => {
    const savedFormat = localStorage.getItem('todoDateFormat') as 'MM/DD/YYYY' | 'DD/MM/YYYY'
    if (savedFormat) {
      setDateFormat(savedFormat)
    } else {
      // Try to detect locale preference
      const locale = navigator.language || 'en-US'
      const defaultFormat = locale.startsWith('en-US') ? 'MM/DD/YYYY' : 'DD/MM/YYYY'
      setDateFormat(defaultFormat)
      localStorage.setItem('todoDateFormat', defaultFormat)
    }
  }, [])

  // Save format preference when changed
  const handleDateFormatChange = (format: 'MM/DD/YYYY' | 'DD/MM/YYYY') => {
    setDateFormat(format)
    localStorage.setItem('todoDateFormat', format)
  }

  const priorityConfig = {
    high: { color: 'from-red-500 to-rose-500', icon: '🔥', glow: 'shadow-red-500/30' },
    medium: { color: 'from-amber-500 to-yellow-500', icon: '⚡', glow: 'shadow-amber-500/30' },
    low: { color: 'from-blue-500 to-cyan-500', icon: '💧', glow: 'shadow-blue-500/30' },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) return

    setIsCreating(true)

    try {
      await onCreateTodo({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        tags: tags.length > 0 ? tags : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      })

      // Success animation
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)

      // Reset form with animation
      setTimeout(() => {
        setTitle('')
        setDescription('')
        setPriority('medium')
        setTags([])
        setDueDate('')
        setIsExpanded(false)
      }, 500)
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // Format date display based on user preference
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()

    return dateFormat === 'DD/MM/YYYY' ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`
  }

  // Parse date input based on format preference
  const parseDateInput = (input: string): string => {
    const parts = input.split('/')
    if (parts.length !== 3) return ''

    const [first, second, year] = parts
    const month = dateFormat === 'MM/DD/YYYY' ? first : second
    const day = dateFormat === 'MM/DD/YYYY' ? second : first

    // Validate and create ISO string
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (isNaN(date.getTime())) return ''

    return date.toISOString().split('T')[0]
  }

  if (!isExpanded) {
    return (
      <div className="mb-8">
        <button
          onClick={() => setIsExpanded(true)}
          className="group w-full p-6 bg-gradient-to-br from-primary-500/10 to-primary-600/10 dark:from-primary-500/20 dark:to-primary-600/20 border-2 border-dashed border-primary-400/50 dark:border-primary-500/50 rounded-2xl hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-xl hover:shadow-primary-500/20 transition-all duration-300 transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-2xl group-hover:rotate-90 transition-transform duration-500">
              +
            </div>
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {t('todos.form.addButton')}
            </span>
          </div>
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative mb-8 p-8 bg-gradient-to-br from-soft-white/95 to-gray-50/95 dark:from-dark-800/95 dark:to-dark-900/95 backdrop-blur-lg rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl transition-all duration-500 ${
        showSuccess ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
      }`}
    >
      {/* Success overlay */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-2xl z-10">
          <div className="text-6xl animate-bounce">✨</div>
        </div>
      )}

      <div className="space-y-6">
        {/* Title input with floating label */}
        <div className="relative">
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="peer w-full px-4 py-3 text-lg font-medium border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-soft-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder-transparent"
            placeholder={t('todos.form.titlePlaceholder')}
            autoFocus
            disabled={isCreating}
            required
          />
          <label
            htmlFor="title"
            className="absolute left-4 -top-2.5 bg-soft-white dark:bg-dark-850 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-500"
          >
            {t('todos.form.titlePlaceholder')}
          </label>
        </div>

        {/* Description with character count */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('todos.form.descriptionPlaceholder')}
            </label>
            <span className="text-xs text-gray-500">
              {description.length}/1000
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-soft-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
            placeholder={t('todos.form.descriptionPlaceholder')}
            rows={3}
            maxLength={1000}
            disabled={isCreating}
          />
        </div>

        {/* Priority selector with visual feedback */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('todos.priority.label')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['low', 'medium', 'high'] as const).map((p) => {
              const config = priorityConfig[p]
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  disabled={isCreating}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                    priority === p
                      ? `bg-gradient-to-r ${config.color} text-white border-transparent shadow-lg ${config.glow} scale-105`
                      : 'bg-soft-white dark:bg-dark-850 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    <span className="text-sm font-medium">
                      {t(`todos.priority.${p}`)}
                    </span>
                  </div>
                  {priority === p && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-white dark:bg-dark-850 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tags input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('todos.tagsLabel')}
          </label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gradient-to-r from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium flex items-center gap-1"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-primary-500 hover:text-primary-700 dark:hover:text-primary-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-soft-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              placeholder={t('todos.tagPlaceholder')}
              disabled={isCreating}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || isCreating}
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {t('todos.addTag')}
            </button>
          </div>
        </div>

        {/* Due date with calendar icon */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="dueDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('todos.dueDateLabel')}
            </label>
            {/* Date format toggle */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleDateFormatChange('MM/DD/YYYY')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  dateFormat === 'MM/DD/YYYY'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                MM/DD
              </button>
              <button
                type="button"
                onClick={() => handleDateFormatChange('DD/MM/YYYY')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  dateFormat === 'DD/MM/YYYY'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                DD/MM
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 pl-12 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-soft-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              min={new Date().toISOString().split('T')[0]}
              disabled={isCreating}
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          {/* Format helper text */}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('todos.dateFormatHelper', { format: dateFormat })}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={!title.trim() || isCreating}
            className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-300 transform ${
              !title.trim() || isCreating
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-xl hover:shadow-primary-500/25 hover:scale-105'
            }`}
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {t('todos.creating')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('todos.form.addButton')}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            disabled={isCreating}
            className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:shadow-lg hover:shadow-gray-500/25 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('todos.item.cancel')}
          </button>
        </div>
      </div>
    </form>
  )
}