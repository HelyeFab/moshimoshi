// Todo Hook
// Client-side hook for managing todos with entitlements

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useFeature } from '@/hooks/useFeature'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { Todo, CreateTodoInput, UpdateTodoInput, TodosApiResponse, TodoApiResponse } from '@/types/todos'

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
  const { checkAndTrack, checkOnly, remaining, limit } = useFeature('todos')
  const { showToast } = useToast()

  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch todos from server
  const fetchTodos = useCallback(async () => {
    if (!isAuthenticated) {
      setTodos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/todos', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch todos')
      }

      const data: TodosApiResponse = await response.json()

      if (data.success && data.data) {
        setTodos(data.data)
      }
    } catch (err: any) {
      console.error('Error fetching todos:', err)
      setError(err.message)
      showToast('Failed to load todos', 'error')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, showToast])

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

      const data: TodoApiResponse = await response.json()

      if (response.status === 429) {
        showToast(data.error?.message || 'Daily todo limit reached', 'warning')
        return null
      }

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create todo')
      }

      if (data.success && data.data) {
        setTodos(prev => [data.data!, ...prev])
        showToast('Todo created successfully', 'success')

        // Show usage if available
        if (data.usage) {
          showToast(`${data.usage.remaining} todos remaining today`, 'info')
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

      const data: TodoApiResponse = await response.json()

      if (data.success && data.data) {
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

      if (!response.ok) {
        throw new Error('Failed to delete todo')
      }

      setTodos(prev => prev.filter(todo => todo.id !== id))
      showToast('Todo deleted successfully', 'success')
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