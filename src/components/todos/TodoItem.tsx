// Individual Todo Item Component
// Beautiful, animated todo item with glass morphism and micro-interactions

'use client'

import { useState, useRef } from 'react'
import { Todo } from '@/types/todos'
import { useI18n } from '@/i18n/I18nContext'

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => Promise<void>
  onEdit: (id: string, title: string, description?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TodoItem({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const { t } = useI18n()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDescription, setEditDescription] = useState(todo.description || '')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  // Priority colors and gradients
  const priorityConfig = {
    high: {
      badge: 'bg-gradient-to-r from-red-500 to-rose-500',
      glow: 'shadow-red-500/20',
      border: 'border-red-500/30',
      icon: '🔥',
    },
    medium: {
      badge: 'bg-gradient-to-r from-amber-500 to-yellow-500',
      glow: 'shadow-amber-500/20',
      border: 'border-amber-500/30',
      icon: '⚡',
    },
    low: {
      badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      glow: 'shadow-blue-500/20',
      border: 'border-blue-500/30',
      icon: '💧',
    },
  }

  const config = priorityConfig[todo.priority]

  const handleToggle = async () => {
    setIsToggling(true)
    await onToggle(todo.id)

    if (!todo.completed) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)

      // Trigger confetti for high priority tasks
      if (todo.priority === 'high') {
        triggerConfetti()
      }
    }

    setIsToggling(false)
  }

  const handleSave = async () => {
    await onEdit(todo.id, editTitle, editDescription)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    // Animate out before deleting
    if (itemRef.current) {
      itemRef.current.style.transform = 'translateX(100%)'
      itemRef.current.style.opacity = '0'
    }
    setTimeout(async () => {
      await onDelete(todo.id)
    }, 300)
  }

  const triggerConfetti = () => {
    // Simple confetti animation
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8']
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.pointerEvents = 'none'
    container.style.zIndex = '9999'
    document.body.appendChild(container)

    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div')
      const color = colors[Math.floor(Math.random() * colors.length)]
      const size = Math.random() * 8 + 4
      const startX = Math.random() * window.innerWidth
      const startY = window.innerHeight / 2

      particle.style.position = 'absolute'
      particle.style.backgroundColor = color
      particle.style.width = `${size}px`
      particle.style.height = `${size}px`
      particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
      particle.style.left = `${startX}px`
      particle.style.top = `${startY}px`
      particle.style.transform = 'rotate(0deg)'

      container.appendChild(particle)

      // Animate particle
      particle.animate([
        {
          transform: `translate(0, 0) rotate(0deg)`,
          opacity: 1
        },
        {
          transform: `translate(${(Math.random() - 0.5) * 300}px, ${Math.random() * 300 + 100}px) rotate(${Math.random() * 360}deg)`,
          opacity: 0
        }
      ], {
        duration: 1000 + Math.random() * 1000,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      })
    }

    setTimeout(() => container.remove(), 2000)
  }

  if (isEditing) {
    return (
      <div className="p-6 bg-gradient-to-br from-soft-white/90 to-gray-50/90 dark:from-dark-800/90 dark:to-dark-900/90 backdrop-blur-lg rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
        <div className="space-y-4">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-4 py-3 text-lg font-medium border-2 border-primary-300 dark:border-primary-600 rounded-xl bg-soft-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            autoFocus
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={t('todos.form.descriptionPlaceholder')}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-soft-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
            rows={3}
          />
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg hover:shadow-green-500/25 transform hover:scale-105 transition-all duration-200 font-medium"
            >
              {t('todos.item.save')}
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditTitle(todo.title)
                setEditDescription(todo.description || '')
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:shadow-lg hover:shadow-gray-500/25 transform hover:scale-105 transition-all duration-200 font-medium"
            >
              {t('todos.item.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={itemRef}
      className={`group relative p-5 bg-gradient-to-br backdrop-blur-lg rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
        todo.completed
          ? 'from-gray-100/80 to-gray-200/80 dark:from-gray-800/80 dark:to-gray-900/80 border-gray-300/50 dark:border-gray-700/50 opacity-75'
          : `from-soft-white/95 to-gray-50/95 dark:from-dark-800/95 dark:to-dark-900/95 ${config.border} shadow-lg hover:shadow-xl hover:${config.glow}`
      } ${isDeleting ? 'transition-all duration-300' : ''}`}
      style={{
        boxShadow: todo.completed ? '' : `0 10px 40px -10px ${
          todo.priority === 'high' ? 'rgba(239, 68, 68, 0.3)' :
          todo.priority === 'medium' ? 'rgba(245, 158, 11, 0.3)' :
          'rgba(59, 130, 246, 0.3)'
        }`
      }}
    >
      {/* Priority badge */}
      <div className={`absolute -top-2 -right-2 ${config.badge} text-white text-xs font-semibold px-2 py-1 rounded-full shadow-md flex items-center gap-1 transform rotate-3 group-hover:rotate-6 transition-transform`}>
        <span className="text-sm">{config.icon}</span>
        <span className="hidden sm:inline">{t(`todos.priority.${todo.priority}`)}</span>
      </div>

      {/* Success animation overlay */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-6xl animate-bounce">✅</div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Animated checkbox */}
        <div className="relative mt-1">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={handleToggle}
            disabled={isToggling}
            className="peer sr-only"
            id={`checkbox-${todo.id}`}
          />
          <label
            htmlFor={`checkbox-${todo.id}`}
            className={`block w-7 h-7 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
              todo.completed
                ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-500 rotate-12 scale-110'
                : 'bg-soft-white dark:bg-dark-850 border-gray-400 dark:border-gray-600 hover:border-primary-500 hover:shadow-md'
            } ${isToggling ? 'animate-pulse' : ''}`}
          >
            {todo.completed && (
              <svg className="w-full h-full p-1 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </label>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-semibold transition-all duration-300 ${
            todo.completed
              ? 'text-gray-500 dark:text-gray-600 line-through'
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            {todo.title}
          </h3>
          {todo.description && (
            <p className={`mt-1.5 text-sm transition-all duration-300 ${
              todo.completed
                ? 'text-gray-400 dark:text-gray-600 line-through'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {todo.description}
            </p>
          )}
          {todo.tags && todo.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {todo.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2.5 py-1 text-xs font-medium bg-gradient-to-r from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.414L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {new Date(todo.createdAt).toLocaleDateString()}
            </span>
            {todo.dueDate && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Due: {new Date(todo.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transform hover:scale-110 transition-all duration-200"
            title={t('todos.item.edit')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/25 transform hover:scale-110 transition-all duration-200"
            title={t('todos.item.delete')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}