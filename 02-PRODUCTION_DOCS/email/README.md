# Email System

**Status:** ACTIVE
**Last Updated:** 2026-01-30

## Overview

Moshimoshi's email system handles transactional emails, marketing campaigns, and administrative notifications using Resend. It includes template management, bounce handling, suppression lists, and email analytics.

## Quick Start

1. **Email templates**: See `EMAIL_TEMPLATES.md` for creating new templates
2. **Admin notifications**: Configure alerts in `EMAIL_NOTIFICATIONS.md`
3. **Bounce handling**: Review `EMAIL_SUPPRESSION_SYSTEM.md` for delivery issues
4. **Send emails**: Use the email service API for programmatic sending

## Documentation

| Document | Description |
|----------|-------------|
| [EMAIL_TEMPLATES.md](./EMAIL_TEMPLATES.md) | Complete guide to creating and managing email templates |
| [EMAIL_NOTIFICATIONS.md](./EMAIL_NOTIFICATIONS.md) | Admin notification system for alerts |
| [EMAIL_SUPPRESSION_SYSTEM.md](./EMAIL_SUPPRESSION_SYSTEM.md) | Bounce and unsubscribe handling |

## Key Topics

- **Email templates** - HTML structure, components, variables
- **Resend integration** - Email delivery service
- **Admin notifications** - System alerts and monitoring
- **Bounce handling** - Failed delivery tracking
- **Suppression lists** - Unsubscribe and hard bounce management
- **Email analytics** - Open rates, click tracking, delivery stats

## Architecture

```
Email System
├── Templates
│   ├── Transactional (Welcome, reset password)
│   ├── Marketing (Newsletters, announcements)
│   └── Admin (Alerts, reports)
├── Sending Service
│   ├── Resend API
│   ├── Queue management
│   └── Rate limiting
├── Tracking
│   ├── Delivery status
│   ├── Opens and clicks
│   └── Bounce/complaint handling
└── Suppression
    ├── Unsubscribe lists
    ├── Hard bounces
    └── Complaint addresses
```

## Key Files

- `src/lib/email/templates/` - Email template components
- `src/lib/email/send.ts:67` - Email sending service
- `src/app/api/email/send/route.ts:34` - Send email API endpoint
- `src/app/api/webhooks/resend/route.ts:45` - Webhook handler for delivery events

## Email Types

### Transactional Emails
- Welcome emails for new users
- Password reset requests
- Payment confirmations
- Feature access notifications

### Marketing Emails
- Weekly newsletters
- Feature announcements
- Learning tips and resources
- Special offers and promotions

### Admin Notifications
- System error alerts
- Payment failures
- User support requests
- Daily/weekly reports

## Template System

Templates use React components with:
- **Responsive design** - Mobile-friendly layouts
- **Variable substitution** - Dynamic content insertion
- **Component library** - Reusable UI elements
- **Inline CSS** - Email client compatibility
- **Preview mode** - Test before sending

## Bounce Handling

The system automatically:
1. Tracks delivery status via webhooks
2. Identifies hard bounces (permanent failures)
3. Adds to suppression list
4. Retries soft bounces (temporary failures)
5. Reports to admin dashboard

## Best Practices

- Test all templates in multiple email clients
- Keep suppression lists updated
- Monitor bounce rates (< 2% is healthy)
- Respect unsubscribe requests immediately
- Use clear subject lines and preview text
- Include plain text versions

---

*For template creation guide, see [EMAIL_TEMPLATES.md](./EMAIL_TEMPLATES.md)*
