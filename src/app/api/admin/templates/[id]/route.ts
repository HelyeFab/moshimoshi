/**
 * Admin Template API - Single Template Operations
 *
 * GET - Get single template by ID
 * PUT - Update template
 * DELETE - Delete template
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { UpdateTemplateRequest } from '@/lib/email/templates/types'

// Validation schema for template variable
const templateVariableSchema = z.object({
  name: z.string().min(1).max(50).regex(/^\w+$/, 'Variable name must be alphanumeric with underscores'),
  label: z.string().min(1).max(100),
  type: z.enum(['string', 'url', 'date', 'number']),
  defaultValue: z.string().optional(),
  required: z.boolean(),
})

// Validation schema for updating a template
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  subject: z.string().min(1).max(200).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().min(1).optional(),
  variables: z.array(templateVariableSchema).optional(),
  category: z.enum(['marketing', 'transactional', 'notification', 'custom']).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
})

/**
 * GET - Get single template by ID
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const templateId = context.params?.id
    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'Template ID is required' },
        },
        { status: 400 }
      )
    }

    const templateDoc = await adminFirestore
      .collection('email_templates')
      .doc(templateId)
      .get()

    if (!templateDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        },
        { status: 404 }
      )
    }

    const data = templateDoc.data()
    const template = {
      id: templateDoc.id,
      ...data,
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
    }

    return NextResponse.json({
      success: true,
      template,
    })
  } catch (error: any) {
    console.error('[API /admin/templates/[id]] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to fetch template',
        },
      },
      { status: 500 }
    )
  }
})

/**
 * PUT - Update template
 */
export const PUT = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const templateId = context.params?.id
    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'Template ID is required' },
        },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate input
    let validatedData: UpdateTemplateRequest
    try {
      validatedData = updateTemplateSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.issues[0]?.message || 'Invalid template data',
              issues: error.issues,
            },
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Check if template exists
    const templateRef = adminFirestore.collection('email_templates').doc(templateId)
    const templateDoc = await templateRef.get()

    if (!templateDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        },
        { status: 404 }
      )
    }

    // If slug is being changed, check uniqueness
    if (validatedData.slug) {
      const existingSlug = await adminFirestore
        .collection('email_templates')
        .where('slug', '==', validatedData.slug)
        .limit(1)
        .get()

      if (!existingSlug.empty && existingSlug.docs[0].id !== templateId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_SLUG',
              message: `A template with slug "${validatedData.slug}" already exists`,
            },
          },
          { status: 400 }
        )
      }
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, any> = {
      updatedBy: context.user.uid,
      updatedAt: Timestamp.now(),
    }

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.slug !== undefined) updateData.slug = validatedData.slug
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.subject !== undefined) updateData.subject = validatedData.subject
    if (validatedData.htmlContent !== undefined) updateData.htmlContent = validatedData.htmlContent
    if (validatedData.textContent !== undefined) updateData.textContent = validatedData.textContent
    if (validatedData.variables !== undefined) updateData.variables = validatedData.variables
    if (validatedData.category !== undefined) updateData.category = validatedData.category
    if (validatedData.status !== undefined) updateData.status = validatedData.status

    await templateRef.update(updateData)

    console.log(
      `[API /admin/templates/[id]] Template updated: ${templateId} by ${context.user.email}`
    )

    return NextResponse.json({
      success: true,
      message: 'Template updated successfully',
    })
  } catch (error: any) {
    console.error('[API /admin/templates/[id]] PUT Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to update template',
        },
      },
      { status: 500 }
    )
  }
})

/**
 * DELETE - Delete template
 * Only allowed for draft/archived templates not in use by campaigns
 */
export const DELETE = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    const templateId = context.params?.id
    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'Template ID is required' },
        },
        { status: 400 }
      )
    }

    // Check if template exists
    const templateRef = adminFirestore.collection('email_templates').doc(templateId)
    const templateDoc = await templateRef.get()

    if (!templateDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        },
        { status: 404 }
      )
    }

    const templateData = templateDoc.data()

    // Prevent deletion of active templates
    if (templateData?.status === 'active') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANNOT_DELETE_ACTIVE',
            message: 'Cannot delete an active template. Archive it first.',
          },
        },
        { status: 400 }
      )
    }

    // Check if template is in use by any campaigns
    const campaignsUsingTemplate = await adminFirestore
      .collection('email_campaigns')
      .where('templateId', '==', templateId)
      .limit(1)
      .get()

    if (!campaignsUsingTemplate.empty) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_IN_USE',
            message: 'Cannot delete template that is used by existing campaigns',
          },
        },
        { status: 400 }
      )
    }

    // Delete the template
    await templateRef.delete()

    console.log(
      `[API /admin/templates/[id]] Template deleted: ${templateId} by ${context.user.email}`
    )

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error: any) {
    console.error('[API /admin/templates/[id]] DELETE Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to delete template',
        },
      },
      { status: 500 }
    )
  }
})
