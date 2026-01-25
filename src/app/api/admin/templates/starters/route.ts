/**
 * Admin Template Starters API
 *
 * GET - List all available starter templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { getStarterTemplates } from '@/lib/email/templates/starters'

/**
 * GET - List all starter templates
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    const starters = getStarterTemplates()

    // Convert to array format for easier consumption
    const templates = Object.entries(starters).map(([key, template]) => ({
      id: key,
      name: template.name,
      description: template.description,
      subject: template.subject,
      html: template.html,
      text: template.text,
    }))

    return NextResponse.json({
      success: true,
      templates,
    })
  } catch (error: any) {
    console.error('[API /admin/templates/starters] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to fetch starter templates',
        },
      },
      { status: 500 }
    )
  }
})
