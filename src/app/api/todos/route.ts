// Todo API Routes
// Handles todo CRUD operations with entitlements checking and dual storage

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase/admin'
import { evaluate, getTodayBucket } from '@/lib/entitlements/evaluator'
import { EvalContext } from '@/types/entitlements'
import { z } from 'zod'
import { CreateTodoInput, UpdateTodoInput, Todo } from '@/types/todos'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

// Validation schemas
const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueDate: z.string().nullable().optional(),
})

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
})

/**
 * GET /api/todos
 * Get all todos for the authenticated user
 * Note: GET is read-only, available for all authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await requireAuth()

    // 2. Check storage decision for this user
    const storageDecision = await getStorageDecision(session)

    // 3. Get todos based on user tier
    let todos: Todo[] = []

    if (storageDecision.shouldWriteToFirebase) {
      // Premium users: read from Firebase
      const todosSnapshot = await adminDb
        .collection('users')
        .doc(session.uid)
        .collection('todos')
        .orderBy('createdAt', 'desc')
        .get()

      todos = todosSnapshot.docs.map(doc => ({
        id: doc.id,
        userId: session.uid,
        title: doc.data().title,
        description: doc.data().description,
        completed: doc.data().completed || false,
        priority: doc.data().priority || 'medium',
        dueDate: doc.data().dueDate?.toDate() || null,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      }))
    }
    // Free users will load from IndexedDB on client side

    return createStorageResponse(todos, storageDecision)
  } catch (error: any) {
    console.error('Error fetching todos:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch todos' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/todos
 * Create a new todo with entitlements checking
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await requireAuth()

    // 2. Parse and validate request body
    const body = await request.json()
    const validationResult = CreateTodoSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid todo data',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const todoInput = validationResult.data

    // 3. Get FRESH user data (NEVER use session.tier!)
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'

    // 4. Get current usage for today
    const nowUtcISO = new Date().toISOString()
    const bucket = getTodayBucket(nowUtcISO)
    const usageRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(bucket)

    const usageDoc = await usageRef.get()
    const currentUsage = usageDoc.data()?.todos || 0

    // 5. Build evaluation context
    const evalContext: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: { todos: currentUsage },
      nowUtcISO: nowUtcISO
    }

    // 6. Check entitlements
    const decision = evaluate('todos', evalContext)

    if (!decision.allow) {
      return NextResponse.json({
        error: {
          code: 'LIMIT_REACHED',
          message: decision.reason === 'limit_reached'
            ? `Daily todo limit reached (${decision.limit} todos per day)`
            : 'Access denied',
        },
        limit: decision.limit,
        remaining: decision.remaining,
        usage: {
          current: currentUsage,
          limit: decision.limit,
          remaining: decision.remaining
        }
      }, { status: 429 })
    }

    // 7. Check storage decision (premium vs free)
    const storageDecision = await getStorageDecision(session)

    // Generate a consistent ID for both storage types
    const todoId = adminDb.collection('_').doc().id

    const todoData = {
      title: todoInput.title,
      description: todoInput.description || '',
      completed: false,
      priority: todoInput.priority || 'medium',
      dueDate: todoInput.dueDate ? Timestamp.fromDate(new Date(todoInput.dueDate)) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }

    // Only write to Firebase for premium users
    if (storageDecision.shouldWriteToFirebase) {
      console.log(`[Storage] Premium user ${session.uid} - writing todo to Firebase`)

      const batch = adminDb.batch()

      // Create the todo in Firebase
      const todoRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('todos')
        .doc(todoId)

      batch.set(todoRef, todoData)

      // Update usage tracking in Firebase
      batch.set(usageRef, {
        todos: currentUsage + 1,
        lastUpdated: Timestamp.now()
      }, { merge: true })

      // Commit the batch
      await batch.commit()
    } else {
      console.log(`[Storage] Free user ${session.uid} - todo will be stored locally only`)
      // Free users: usage is still tracked locally for entitlements
      // But the todo itself is NOT written to Firebase
    }

    // 8. Return the created todo with storage location
    const newTodo: Todo = {
      id: todoId,
      userId: session.uid,
      title: todoData.title,
      description: todoData.description,
      completed: todoData.completed,
      priority: todoData.priority as 'low' | 'medium' | 'high',
      dueDate: todoData.dueDate?.toDate() || null,
      createdAt: todoData.createdAt.toDate(),
      updatedAt: todoData.updatedAt.toDate(),
    }

    return createStorageResponse(newTodo, storageDecision, {
      usage: {
        current: currentUsage + 1,
        limit: decision.limit,
        remaining: decision.remaining - 1
      }
    })

  } catch (error: any) {
    console.error('Error creating todo:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create todo' } },
      { status: 500 }
    )
  }
}