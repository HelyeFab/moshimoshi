// Todo Types
// Core type definitions for todos

import { Timestamp } from 'firebase/firestore'

export interface Todo {
  id: string
  userId: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: Date | null
  createdAt: Date | Timestamp
  updatedAt: Date | Timestamp
}

export interface CreateTodoInput {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: Date | null
}

export interface UpdateTodoInput {
  title?: string
  description?: string
  completed?: boolean
  priority?: 'low' | 'medium' | 'high'
  dueDate?: Date | null
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