// Todo List Container Component

'use client'

import { useState } from 'react'
import { TodoItem } from './TodoItem'
import { CreateTodoForm } from './CreateTodoForm'
import { TodoHeatmap } from './TodoHeatmap'
import { useTodos } from '@/hooks/useTodos'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import Dropdown from '@/components/ui/Dropdown'

export function TodoList() {
  const { t } = useI18n()
  const { user, isAuthenticated } = useAuth()
  const {
    todos,
    loading,
    error,
    remaining,
    limit,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleComplete,
    refreshTodos,
  } = useTodos()

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date')

  // Filter todos
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  // Sort todos
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (sortBy === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    // Sort by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleToggle = async (id: string) => {
    await toggleComplete(id)
  }

  const handleEdit = async (id: string, title: string, description?: string) => {
    await updateTodo(id, { title, description })
  }

  const handleDelete = async (id: string) => {
    await deleteTodo(id)
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('todos.signInRequired')}
        </p>
      </div>
    )
  }

  if (loading) {
    return <LoadingOverlay />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">
          {t('todos.errorLoading')}
        </p>
        <button
          onClick={refreshTodos}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Todo Heatmap - shows due dates */}
      <TodoHeatmap todos={todos} />

      {/* Create new todo */}
      {remaining === 0 && limit !== -1 ? (
        <div className="mb-8 p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl shadow-xl shadow-yellow-500/10">
          <div className="flex items-center gap-3">
            <span className="text-4xl animate-bounce">⚠️</span>
            <div>
              <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">
                {t('todos.limitReached')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <CreateTodoForm onCreateTodo={createTodo} />
      )}

      {/* Filters and sorting with glass morphism */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8 p-4 bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-dark-800/50 dark:to-dark-900/50 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="grid grid-cols-3 sm:flex gap-2 flex-1">
          {(['all', 'active', 'completed'] as const).map((f) => {
            const count = f === 'all' ? todos.length :
                         f === 'active' ? todos.filter(t => !t.completed).length :
                         todos.filter(t => t.completed).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium transition-all duration-300 ${
                  filter === f
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25'
                    : 'bg-soft-white dark:bg-dark-850 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700'
                }`}
              >
                <span className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-base">
                  <span className="text-lg sm:text-base">
                    {f === 'all' && '📋'}
                    {f === 'active' && '⏳'}
                    {f === 'completed' && '✅'}
                  </span>
                  <span className="hidden sm:inline">{t(`todos.filter.${f}`)}</span>
                  <span className="sm:hidden">
                    {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Done'}
                  </span>
                  <span className="px-1.5 py-0.5 bg-white/20 dark:bg-black/20 rounded-full text-xs">
                    {count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <Dropdown
          value={sortBy}
          onChange={(value) => setSortBy(value as 'date' | 'priority')}
          options={[
            { value: 'date', label: t('todos.sort.date') },
            { value: 'priority', label: t('todos.sort.priority') },
          ]}
        />
      </div>

      {/* Todo list with staggered animation */}
      {sortedTodos.length === 0 ? (
        <div className="relative overflow-hidden text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-800 dark:to-dark-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-purple-500/5 to-pink-500/5 animate-pulse" />
          <div className="relative z-10">
            <div className="text-6xl mb-4">
              {filter === 'all' ? '📝' : filter === 'active' ? '⏰' : '🎉'}
            </div>
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
              {filter === 'all'
                ? t('todos.noTodos')
                : filter === 'active'
                ? t('todos.noActiveTodos')
                : t('todos.noCompletedTodos')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTodos.map((todo, index) => (
            <div
              key={todo.id}
              style={{
                animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both`
              }}
            >
              <TodoItem
                todo={todo}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}