import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { formatUserAgentForEmail } from '@/hooks/useUserAgent'
import type { UserAgentInfo } from '@/hooks/useUserAgent'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    const {
      feedback,
      category,
      userId,
      userEmail,
      timestamp,
      url,
      userAgent,
    } = await request.json()

    // Validate required fields
    if (!feedback || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Determine recipient based on category
    const emailMap: Record<string, string> = {
      general: 'feedback@moshimoshi.app',
      bug: 'feedback@moshimoshi.app',
      feature: 'feedback@moshimoshi.app',
      performance: 'feedback@moshimoshi.app',
      payment: 'support@moshimoshi.app',
      other: 'feedback@moshimoshi.app',
    }

    const recipient = emailMap[category] || 'feedback@moshimoshi.app'

    // Format the email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: white; margin: 0;">New Feedback Submission</h2>
        </div>

        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1f2937; margin-top: 0;">Feedback Details</h3>
            <p><strong>Category:</strong> ${category.toUpperCase()}</p>
            ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
            ${userEmail ? `<p><strong>User Email:</strong> ${userEmail}</p>` : '<p><em>Anonymous feedback</em></p>'}
            <p><strong>Submitted:</strong> ${new Date(timestamp || Date.now()).toLocaleString('en-US', {
              dateStyle: 'full',
              timeStyle: 'long',
            })}</p>
            ${url ? `<p><strong>Page URL:</strong> <a href="${url}" style="color: #3b82f6;">${url}</a></p>` : ''}
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1f2937; margin-top: 0;">Feedback Message</h3>
            <p style="white-space: pre-wrap;">${feedback}</p>
          </div>

          ${userAgent ? formatUserAgentForEmail(userAgent as UserAgentInfo) : ''}

          <div style="margin-top: 20px; padding: 15px; background: #e5e7eb; border-radius: 8px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              This feedback was sent from the Moshimoshi Feedback Widget.
              Category: ${category}
            </p>
          </div>
        </div>
      </div>
    `

    // Send email using Resend
    if (!resend) {
      console.warn('[Feedback API] Resend API key not configured')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    }

    const { data, error } = await resend.emails.send({
      from: 'Moshimoshi Feedback <noreply@moshimoshi.app>',
      to: recipient,
      replyTo: userEmail || undefined,
      subject: `[FEEDBACK - ${category.toUpperCase()}] ${feedback.substring(0, 50)}${feedback.length > 50 ? '...' : ''}`,
      html: emailContent,
    })

    if (error) {
      console.error('[Feedback API] Failed to send email:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    console.log('[Feedback API] Feedback email sent successfully:', {
      category,
      userId: userId || 'anonymous',
      emailId: data?.id,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[Feedback API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
