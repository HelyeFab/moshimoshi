import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, category, message, to } = await request.json()

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Determine recipient based on category
    const recipient = to || 'support@moshimoshi.app'

    // Format the email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: white; margin: 0;">New Contact Form Submission</h2>
        </div>

        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1f2937; margin-top: 0;">Contact Details</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px;">
            <h3 style="color: #1f2937; margin-top: 0;">Message</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>

          <div style="margin-top: 20px; padding: 15px; background: #e5e7eb; border-radius: 8px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              This message was sent from the Moshimoshi contact form.
              Category: ${category}
            </p>
          </div>
        </div>
      </div>
    `

    // Send email using Resend
    if (!resend) {
      console.warn('Resend API key not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 503 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: 'Moshimoshi Contact <noreply@moshimoshi.app>',
      to: recipient,
      replyTo: email,
      subject: `[${category.toUpperCase()}] ${subject}`,
      html: emailContent,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }

    // Send confirmation email to the user
    const confirmationContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0;">Thank You for Contacting Moshimoshi!</h2>
        </div>

        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px;">
            <p>Dear ${name},</p>

            <p>Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Your message details:</strong></p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
            </div>

            <p>We typically respond within 24-48 hours. If your inquiry is urgent, please don't hesitate to reach out again.</p>

            <p>Best regards,<br>
            The Moshimoshi Team</p>
          </div>

          <div style="margin-top: 20px; padding: 15px; background: #e5e7eb; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">
              This is an automated confirmation email. Please do not reply to this email.
            </p>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              For support: support@moshimoshi.app | For privacy: privacy@moshimoshi.app
            </p>
          </div>
        </div>
      </div>
    `

    // Send confirmation email
    if (resend) {
      await resend.emails.send({
        from: 'Moshimoshi <noreply@moshimoshi.app>',
        to: email,
        subject: 'Thank you for contacting Moshimoshi',
        html: confirmationContent,
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}