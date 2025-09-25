// Individual Todo API Routes
// Handles update and delete operations for specific todos

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, Timestamp } from '@/lib/firebase/admin'
import { z } from 'zod'
import { Todo } from '@/types/todos'

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
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate
    const session = await requireAuth()

    // 2. Get the todo
    const todoDoc = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc(params.id)
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
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate
    const session = await requireAuth()

    // 2. Parse and validate request body
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

    // 3. Check if todo exists and belongs to user
    const todoRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc(params.id)

    const todoDoc = await todoRef.get()

    if (!todoDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Todo not found' } },
        { status: 404 }
      )
    }

    // 4. Build update object
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

    // 5. Update the todo
    await todoRef.update(updateData)

    // 6. Get updated todo
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

    return NextResponse.json({
      success: true,
      data: todo,
    })

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
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate
    const session = await requireAuth()

    // 2. Check if todo exists and belongs to user
    const todoRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('todos')
      .doc(params.id)

    const todoDoc = await todoRef.get()

    if (!todoDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Todo not found' } },
        { status: 404 }
      )
    }

    // 3. Delete the todo
    await todoRef.delete()

    return NextResponse.json({
      success: true,
      message: 'Todo deleted successfully',
    })

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