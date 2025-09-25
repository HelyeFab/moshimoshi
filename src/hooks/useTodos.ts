// Todo Hook
// Client-side hook for managing todos with entitlements

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeature'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Todo, CreateTodoInput, UpdateTodoInput, TodosApiResponse, TodoApiResponse } from '@/types/todos'
import { todoStorage } from '@/lib/todos/TodoStorage'

interface UseTodosReturn {
  todos: Todo[]
  loading: boolean
  error: string | null
  remaining: number | null
  limit: number | null
  createTodo: (input: CreateTodoInput) => Promise<Todo | null>
  updateTodo: (id: string, input: UpdateTodoInput) => Promise<Todo | null>
  deleteTodo: (id: string) => Promise<boolean>
  toggleComplete: (id: string) => Promise<Todo | null>
  refreshTodos: () => Promise<void>
}

export function useTodos(): UseTodosReturn {
  const { user, isAuthenticated } = useAuth()
  const { isPremium } = useSubscription()
  const { checkAndTrack, checkOnly, remaining, limit } = useFeature('todos')
  const { showToast } = useToast()

  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch todos from server or local storage
  const fetchTodos = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setTodos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Try to fetch from server first
      const response = await fetch('/api/todos', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch todos')
      }

      const data: TodosApiResponse & { storage?: { location: string } } = await response.json()

      if (data.storage?.location === 'local') {
        // Free user - load from IndexedDB
        console.log('[useTodos] Free user - loading from IndexedDB')
        const localTodos = await todoStorage.getTodos(user.id)
        setTodos(localTodos)
      } else if (data.success && data.data) {
        // Premium user - sync from Firebase
        console.log('[useTodos] Premium user - syncing from Firebase')
        await todoStorage.syncFromServer(data.data, user.id, 'both')
        setTodos(data.data)
      }
    } catch (err: any) {
      console.error('Error fetching todos:', err)
      // Fallback to local storage on error
      if (user) {
        const localTodos = await todoStorage.getTodos(user.id)
        setTodos(localTodos)
        console.log('[useTodos] Using cached todos from IndexedDB')
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  // Create a new todo
  const createTodo = useCallback(async (input: CreateTodoInput): Promise<Todo | null> => {
    if (!isAuthenticated) {
      showToast('Please sign in to create todos', 'warning')
      return null
    }

    // Check entitlements first (client-side pre-check)
    const allowed = await checkAndTrack({
      showUI: true,
      skipTracking: true, // Server will handle the actual tracking
    })

    if (!allowed) {
      return null
    }

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      })

      const data: TodoApiResponse & { storage?: { location: string } } = await response.json()

      if (response.status === 429) {
        showToast(data.error?.message || 'Daily todo limit reached', 'warning')
        return null
      }

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create todo')
      }

      if (data.success && data.data) {
        // Save to IndexedDB regardless of storage location
        await todoStorage.saveTodo(data.data)
        setTodos(prev => [data.data!, ...prev])
        showToast('Todo created successfully', 'success')

        // Show usage if available
        if (data.usage) {
          showToast(`${data.usage.remaining} todos remaining today`, 'info')
        }

        // Log storage location
        if (data.storage?.location === 'local') {
          console.log('[useTodos] Free user - todo saved locally only')
        } else if (data.storage?.location === 'both') {
          console.log('[useTodos] Premium user - todo synced to cloud')
        }

        return data.data
      }

      return null
    } catch (err: any) {
      console.error('Error creating todo:', err)
      showToast(err.message || 'Failed to create todo', 'error')
      return null
    }
  }, [isAuthenticated, checkAndTrack, showToast])

  // Update a todo
  const updateTodo = useCallback(async (id: string, input: UpdateTodoInput): Promise<Todo | null> => {
    if (!isAuthenticated) {
      return null
    }

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        throw new Error('Failed to update todo')
      }

      const data: TodoApiResponse & { storage?: { location: string } } = await response.json()

      if (data.storage?.location === 'local') {
        // Free user - update locally only
        await todoStorage.updateTodo(id, input)
        const todo = todos.find(t => t.id === id)
        if (todo) {
          const updated = { ...todo, ...input, updatedAt: new Date() }
          setTodos(prev => prev.map(t => t.id === id ? updated : t))
          return updated
        }
      } else if (data.success && data.data) {
        // Premium user - sync from server
        await todoStorage.saveTodo(data.data)
        setTodos(prev => prev.map(todo =>
          todo.id === id ? data.data! : todo
        ))
        return data.data
      }

      return null
    } catch (err: any) {
      console.error('Error updating todo:', err)
      showToast('Failed to update todo', 'error')
      return null
    }
  }, [isAuthenticated, showToast])

  // Toggle todo completion
  const toggleComplete = useCallback(async (id: string): Promise<Todo | null> => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return null

    return updateTodo(id, { completed: !todo.completed })
  }, [todos, updateTodo])

  // Delete a todo
  const deleteTodo = useCallback(async (id: string): Promise<boolean> => {
    if (!isAuthenticated) {
      return false
    }

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error('Failed to delete todo')
      }

      // Delete from IndexedDB
      await todoStorage.deleteTodo(id)
      setTodos(prev => prev.filter(todo => todo.id !== id))
      showToast('Todo deleted successfully', 'success')

      // Log storage handling
      if (data.storage?.location === 'local') {
        console.log('[useTodos] Free user - deleted locally')
      } else {
        console.log('[useTodos] Premium user - deleted from cloud')
      }

      return true
    } catch (err: any) {
      console.error('Error deleting todo:', err)
      showToast('Failed to delete todo', 'error')
      return false
    }
  }, [isAuthenticated, showToast])

  // Refresh todos
  const refreshTodos = useCallback(async () => {
    await fetchTodos()
  }, [fetchTodos])

  // Load todos on mount and auth change
  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  return {
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
  }
}