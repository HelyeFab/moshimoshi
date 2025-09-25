// Individual Todo API Routes
// Handles update and delete operations for specific todos

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, Timestamp } from '@/lib/firebase/admin'
import { z } from 'zod'
import { Todo } from '@/types/todos'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

// Validation schema for updates
const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
})

/**
 * GET /api/todos/[id]
 * Get a specific todo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Authenticate
    const session = await requireAuth()

    // 2. Check storage decision
    const decision = await getStorageDecision(session)

    // For free users, return not found (they should use local storage)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json(
        {
          error: {
            code: 'LOCAL_STORAGE',
            message: 'Free users should use local storage'
          },
          storage: { location: 'local' }
        },
        { status: 200 }
      )
    }

    // 3. Get the todo from Firebase (premium only)
    const todoDoc = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc(id)
      .get()

    if (!todoDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Todo not found' } },
        { status: 404 }
      )
    }

    const todoData = todoDoc.data()
    const todo: Todo = {
      id: todoDoc.id,
      userId: session.uid,
      title: todoData!.title,
      description: todoData!.description,
      completed: todoData!.completed || false,
      priority: todoData!.priority || 'medium',
      dueDate: todoData!.dueDate?.toDate() || null,
      createdAt: todoData!.createdAt?.toDate() || new Date(),
      updatedAt: todoData!.updatedAt?.toDate() || new Date(),
    }

    return NextResponse.json({
      success: true,
      data: todo,
    })
  } catch (error: any) {
    console.error('Error fetching todo:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch todo' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/todos/[id]
 * Update a specific todo
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Authenticate
    const session = await requireAuth()

    // 2. Check storage decision
    const decision = await getStorageDecision(session)

    // For free users, return success without Firebase update
    if (!decision.shouldWriteToFirebase) {
      console.log(`[Storage] Free user ${session.uid} - todo update will be handled locally`)
      // Return empty data - client will handle local update
      return createStorageResponse({ id, message: 'Update locally' }, decision)
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateTodoSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // 4. Check if todo exists and belongs to user
    const todoRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc(id)

    const todoDoc = await todoRef.get()

    if (!todoDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Todo not found' } },
        { status: 404 }
      )
    }

    // 5. Build update object
    const updateData: any = {
      updatedAt: Timestamp.now()
    }

    if (updates.title !== undefined) {
      updateData.title = updates.title
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description
    }
    if (updates.completed !== undefined) {
      updateData.completed = updates.completed
    }
    if (updates.priority !== undefined) {
      updateData.priority = updates.priority
    }
    if (updates.dueDate !== undefined) {
      updateData.dueDate = updates.dueDate ? Timestamp.fromDate(new Date(updates.dueDate)) : null
    }

    // 6. Update the todo (premium only)
    console.log(`[Storage] Premium user ${session.uid} - updating todo in Firebase`)
    await todoRef.update(updateData)

    // 7. Get updated todo
    const updatedDoc = await todoRef.get()
    const updatedData = updatedDoc.data()

    const todo: Todo = {
      id: updatedDoc.id,
      userId: session.uid,
      title: updatedData!.title,
      description: updatedData!.description,
      completed: updatedData!.completed || false,
      priority: updatedData!.priority || 'medium',
      dueDate: updatedData!.dueDate?.toDate() || null,
      createdAt: updatedData!.createdAt?.toDate() || new Date(),
      updatedAt: updatedData!.updatedAt?.toDate() || new Date(),
    }

    return createStorageResponse(todo, decision)

  } catch (error: any) {
    console.error('Error updating todo:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update todo' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/todos/[id]
 * Delete a specific todo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Authenticate
    const session = await requireAuth()

    // 2. Check storage decision
    const storageDecision = await getStorageDecision(session)

    // For free users, return success without Firebase deletion
    if (!storageDecision.shouldWriteToFirebase) {
      console.log(`[Storage] Free user ${session.uid} - todo deletion will be handled locally`)
      return createStorageResponse({ id, message: 'Delete from local storage' }, storageDecision)
    }

    // 3. Check if todo exists and belongs to user
    const todoRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc(id)

    const todoDoc = await todoRef.get()

    if (!todoDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Todo not found' } },
        { status: 404 }
      )
    }

    // 4. Delete the todo (premium only)
    console.log(`[Storage] Premium user ${session.uid} - deleting todo from Firebase`)
    await todoRef.delete()

    return createStorageResponse({ id, message: 'Todo deleted successfully' }, storageDecision)

  } catch (error: any) {
    console.error('Error deleting todo:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete todo' } },
      { status: 500 }
    )
  }
}