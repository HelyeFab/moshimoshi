/**
 * Admin Template Preview API
 *
 * POST - Render template with sample variables
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { z } from 'zod'
import { substituteVariables, buildPreviewContext } from '@/lib/email/templates/variables'
import type { EmailTemplate, PreviewTemplateResponse } from '@/lib/email/templates/types'

// Validation schema for preview request
const previewRequestSchema = z.object({
  variables: z.record(z.string(), z.string()).optional().default({}),
})

/**
 * POST - Render template with sample variables
 */
export const POST = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
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

    // Parse and validate request body
    let body: { variables?: Record<string, string> } = {}
    try {
      const rawBody = await request.text()
      if (rawBody) {
        body = JSON.parse(rawBody)
      }
    } catch {
      // Empty body is allowed
    }

    let validatedData: { variables: Record<string, string> }
    try {
      validatedData = previewRequestSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.issues[0]?.message || 'Invalid preview data',
              issues: error.issues,
            },
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Get template
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

    const template = templateDoc.data() as EmailTemplate

    // Build preview context with sample data
    const variableContext = buildPreviewContext(
      template.variables || [],
      validatedData.variables
    )

    // Render template with variables
    const renderedHtml = substituteVariables(template.htmlContent, variableContext)
    const renderedText = substituteVariables(template.textContent, variableContext)
    const renderedSubject = substituteVariables(template.subject, variableContext)

    const preview: PreviewTemplateResponse = {
      html: renderedHtml,
      text: renderedText,
      subject: renderedSubject,
    }

    return NextResponse.json({
      success: true,
      preview,
      variablesUsed: variableContext,
    })
  } catch (error: any) {
    console.error('[API /admin/templates/[id]/preview] POST Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to preview template',
        },
      },
      { status: 500 }
    )
  }
})
