// Todo Types
// Core type definitions for todos

export interface Todo {
  id: string
  userId: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string | null          // ISO 8601 date string or null
  createdAt: string                // ISO 8601 datetime string
  updatedAt: string                // ISO 8601 datetime string
}

export interface CreateTodoInput {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string | null            // ISO 8601 date string or null
}

export interface UpdateTodoInput {
  title?: string
  description?: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string | null            // ISO 8601 date string or null
}

export interface TodosApiResponse {
  success: boolean
  data?: Todo[]
  error?: {
    code: string
    message: string
  }
  usage?: {
    current: number
    limit: number
    remaining: number
  }
}

export interface TodoApiResponse {
  success: boolean
  data?: Todo
  error?: {
    code: string
    message: string
  }
  usage?: {
    current: number
    limit: number
    remaining: number
  }
}

export interface TodosUsage {
  daily: number
  monthly: number
  total: number
}