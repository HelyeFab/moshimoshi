// Todo API Routes
// Handles todo CRUD operations with entitlements checking

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase/admin'
import { evaluate, getTodayBucket } from '@/lib/entitlements/evaluator'
import { EvalContext } from '@/types/entitlements'
import { z } from 'zod'
import { CreateTodoInput, UpdateTodoInput, Todo } from '@/types/todos'

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
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await requireAuth()

    // 2. Get user's todos from Firestore
    const todosSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .orderBy('createdAt', 'desc')
      .get()

    const todos: Todo[] = todosSnapshot.docs.map(doc => ({
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

    return NextResponse.json({
      success: true,
      data: todos,
    })
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

    // 7. Create todo with atomic usage update
    const batch = adminDb.batch()

    // Create the todo
    const todoRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc()

    const todoData = {
      title: todoInput.title,
      description: todoInput.description || '',
      completed: false,
      priority: todoInput.priority || 'medium',
      dueDate: todoInput.dueDate ? Timestamp.fromDate(new Date(todoInput.dueDate)) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }

    batch.set(todoRef, todoData)

    // Update usage tracking
    batch.set(usageRef, {
      todos: currentUsage + 1,
      lastUpdated: Timestamp.now()
    }, { merge: true })

    // Commit the batch
    await batch.commit()

    // 8. Return the created todo
    const newTodo: Todo = {
      id: todoRef.id,
      userId: session.uid,
      title: todoData.title,
      description: todoData.description,
      completed: todoData.completed,
      priority: todoData.priority as 'low' | 'medium' | 'high',
      dueDate: todoData.dueDate?.toDate() || null,
      createdAt: todoData.createdAt.toDate(),
      updatedAt: todoData.updatedAt.toDate(),
    }

    return NextResponse.json({
      success: true,
      data: newTodo,
      usage: {
        current: currentUsage + 1,
        limit: decision.limit,
        remaining: decision.remaining - 1
      }
    }, { status: 201 })

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