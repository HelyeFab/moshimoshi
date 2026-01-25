/**
 * Admin Templates API
 *
 * POST - Create new email template
 * GET - List all templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { CreateTemplateRequest, TemplateVariable } from '@/lib/email/templates/types'

// Validation schema for template variable
const templateVariableSchema = z.object({
  name: z.string().min(1).max(50).regex(/^\w+$/, 'Variable name must be alphanumeric with underscores'),
  label: z.string().min(1).max(100),
  type: z.enum(['string', 'url', 'date', 'number']),
  defaultValue: z.string().optional(),
  required: z.boolean(),
})

// Validation schema for creating a template
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  subject: z.string().min(1, 'Subject is required').max(200),
  htmlContent: z.string().min(1, 'HTML content is required'),
  textContent: z.string().min(1, 'Text content is required'),
  variables: z.array(templateVariableSchema).optional().default([]),
  category: z.enum(['marketing', 'transactional', 'notification', 'custom']),
  status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
})

/**
 * POST - Create new email template
 */
export const POST = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const body = await request.json()

      // Validate input
      let validatedData: CreateTemplateRequest
      try {
        validatedData = createTemplateSchema.parse(body)
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

      // Check if slug is unique
      const existingSlug = await adminFirestore
        .collection('email_templates')
        .where('slug', '==', validatedData.slug)
        .limit(1)
        .get()

      if (!existingSlug.empty) {
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

      // Create template document
      const now = Timestamp.now()
      const templateRef = await adminFirestore.collection('email_templates').add({
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description || '',
        subject: validatedData.subject,
        htmlContent: validatedData.htmlContent,
        textContent: validatedData.textContent,
        variables: validatedData.variables || [],
        category: validatedData.category,
        status: validatedData.status || 'draft',
        createdBy: context.user.uid,
        createdAt: now,
        updatedBy: context.user.uid,
        updatedAt: now,
      })

      console.log(
        `[API /admin/templates] Template created: ${templateRef.id} by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        templateId: templateRef.id,
        message: 'Template created successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/templates] POST Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to create template',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * GET - List all templates
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    // Get status filter from query params
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Build query
    let query: FirebaseFirestore.Query = adminFirestore.collection('email_templates')

    if (statusFilter && ['draft', 'active', 'archived'].includes(statusFilter)) {
      query = query.where('status', '==', statusFilter)
    }

    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc').limit(100)

    const snapshot = await query.get()

    const templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Timestamps to ISO strings for JSON serialization
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }))

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    })
  } catch (error: any) {
    console.error('[API /admin/templates] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to fetch templates',
        },
      },
      { status: 500 }
    )
  }
})
