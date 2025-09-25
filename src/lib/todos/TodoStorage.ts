/**
 * TodoStorage - Handles dual storage for todos (IndexedDB for all, Firebase for premium)
 */

import { Todo } from '@/types/todos'
import { openDB, IDBPDatabase } from 'idb'

interface TodoDB {
  todos: Todo
  syncQueue: {
    id: string
    action: 'create' | 'update' | 'delete'
    data: any
    timestamp: number
  }
}

export class TodoStorage {
  private db: IDBPDatabase<TodoDB> | null = null

  // Initialize IndexedDB
  private async initDB(): Promise<IDBPDatabase<TodoDB>> {
    if (this.db) return this.db

    this.db = await openDB<TodoDB>('TodosDB', 1, {
      upgrade(db) {
        // Todos store
        if (!db.objectStoreNames.contains('todos')) {
          const todoStore = db.createObjectStore('todos', { keyPath: 'id' })
          todoStore.createIndex('userId', 'userId')
          todoStore.createIndex('completed', 'completed')
          todoStore.createIndex('createdAt', 'createdAt')
        }

        // Sync queue for tracking changes
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          syncStore.createIndex('timestamp', 'timestamp')
        }
      }
    })

    return this.db
  }

  /**
   * Get all todos for a user
   */
  async getTodos(userId: string): Promise<Todo[]> {
    const db = await this.initDB()
    const todos = await db.getAllFromIndex('todos', 'userId', userId)
    return todos.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  /**
   * Save todos from server response
   * @param todos - Todos from server
   * @param userId - User ID
   * @param storageLocation - Where data is stored ('local' or 'both')
   */
  async syncFromServer(
    todos: Todo[],
    userId: string,
    storageLocation: 'local' | 'both' | 'none'
  ): Promise<void> {
    const db = await this.initDB()

    if (storageLocation === 'local') {
      // Free users - IndexedDB is their primary storage
      console.log('[TodoStorage] Free user - IndexedDB is primary storage')
      // Don't clear existing todos for free users
    } else if (storageLocation === 'both') {
      // Premium users - sync from Firebase
      console.log('[TodoStorage] Premium user - syncing from Firebase to IndexedDB')

      // Clear existing todos for this user (Firebase is source of truth)
      const tx = db.transaction('todos', 'readwrite')
      const existingKeys = await tx.store.index('userId').getAllKeys(userId)
      for (const key of existingKeys) {
        await tx.store.delete(key)
      }
      await tx.done
    }

    // Add/update todos in IndexedDB
    if (todos.length > 0) {
      const tx = db.transaction('todos', 'readwrite')
      for (const todo of todos) {
        await tx.store.put(todo)
      }
      await tx.done
      console.log(`[TodoStorage] Stored ${todos.length} todos in IndexedDB`)
    }
  }

  /**
   * Save a single todo locally
   */
  async saveTodo(todo: Todo): Promise<void> {
    const db = await this.initDB()
    await db.put('todos', todo)
    console.log('[TodoStorage] Saved todo to IndexedDB:', todo.id)
  }

  /**
   * Update a todo locally
   */
  async updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
    const db = await this.initDB()
    const existing = await db.get('todos', id)
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date() }
      await db.put('todos', updated)
      console.log('[TodoStorage] Updated todo in IndexedDB:', id)
    }
  }

  /**
   * Delete a todo locally
   */
  async deleteTodo(id: string): Promise<void> {
    const db = await this.initDB()
    await db.delete('todos', id)
    console.log('[TodoStorage] Deleted todo from IndexedDB:', id)
  }

  /**
   * Clear all todos for a user (used when switching accounts)
   */
  async clearUserTodos(userId: string): Promise<void> {
    const db = await this.initDB()
    const tx = db.transaction('todos', 'readwrite')
    const keys = await tx.store.index('userId').getAllKeys(userId)
    for (const key of keys) {
      await tx.store.delete(key)
    }
    await tx.done
    console.log('[TodoStorage] Cleared all todos for user:', userId)
  }
}

// Singleton instance
export const todoStorage = new TodoStorage()