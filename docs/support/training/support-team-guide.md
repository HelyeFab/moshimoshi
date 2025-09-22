# Support Team Training Guide - Moshimoshi Launch

## Overview

This guide prepares support team members for the Moshimoshi 1.0 launch. Review all sections before Thursday's deployment.

## Platform Overview

### What is Moshimoshi?
- Japanese learning platform using spaced repetition (SRS)
- Web-based with PWA capabilities
- Free tier + Premium subscription model
- Works offline with sync capabilities

### Key Features
1. **Review System**: Daily reviews based on SRS algorithm
2. **Progress Tracking**: Statistics and analytics
3. **Offline Mode**: Full functionality without internet
4. **Cross-Device Sync**: Learn on any device
5. **Premium Features**: Unlimited reviews, advanced stats

## Common Issues & Solutions

### 🔴 Priority 1: Critical Issues

#### User Cannot Login
**Symptoms**: Login button not working, incorrect password, account locked

**Resolution Steps**:
1. Verify email is correct (common typos: gmail vs gmai)
2. Check if account locked (5 failed attempts = 15 min lock)
3. Send password reset link
4. Clear browser cache/cookies
5. Try incognito mode
6. Escalate if: Database connection issues suspected

**Canned Response**:
```
I understand you're having trouble logging in. Let's fix this:

1. Please verify your email address is correct
2. Try resetting your password: [reset link]
3. Clear your browser cache and cookies
4. Try using incognito/private mode

If you're still having issues, I can manually reset your account. Please provide your registered email address.
```

#### Payment Failed
**Symptoms**: Card declined, subscription not activated, error during checkout

**Resolution Steps**:
1. Check Stripe dashboard for transaction
2. Verify card details entered correctly
3. Suggest contacting bank
4. Try alternative payment method
5. Manual activation if payment confirmed

**Canned Response**:
```
I see you're experiencing payment issues. Here's what we can try:

1. Please verify your card details are correct
2. Ensure you have sufficient funds
3. Your bank may be blocking the transaction - please contact them
4. Try using a different card or payment method

If the payment went through but your subscription isn't active, please provide your transaction ID and I'll activate it manually.
```

### 🟡 Priority 2: Functionality Issues

#### Reviews Not Loading
**Resolution Steps**:
1. Check user's internet connection
2. Verify browser compatibility
3. Clear cache and reload
4. Check if queue is actually empty
5. Regenerate queue if needed

#### Progress Not Syncing
**Resolution Steps**:
1. Ensure logged into same account
2. Check internet connection
3. Force sync from settings
4. Clear local storage
5. Re-login on all devices

### 🟢 Priority 3: Questions/Feature Requests

#### How to Install PWA
**Canned Response**:
```
To install Moshimoshi on your phone:

**iPhone/iPad:**
1. Open moshimoshi.app in Safari
2. Tap the Share button (square with arrow)
3. Select "Add to Home Screen"
4. Tap "Add"

**Android:**
1. Open moshimoshi.app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen"
4. Tap "Add"

You'll then have an app icon on your home screen!
```

## Escalation Matrix

| Issue Type | Level 1 (You) | Level 2 (Tech) | Level 3 (Engineering) |
|------------|---------------|----------------|----------------------|
| Login Issues | Basic troubleshooting | Account unlock, manual reset | Database issues |
| Payment | Verify transaction | Manual activation | Stripe integration |
| Sync Problems | Clear cache, re-login | Force sync | Sync service issues |
| Performance | Browser troubleshooting | Server load check | Infrastructure scaling |
| Data Loss | Check backups | Restore from backup | Data recovery |

## Launch Day Procedures

### Thursday Schedule
- **6:00 AM**: Support team ready
- **7:00 AM**: Final briefing
- **8:00 AM**: Deployment begins (expect increased tickets)
- **10:00 AM**: Full production
- **12:00 PM**: Lunch rotation (maintain coverage)
- **5:00 PM**: End of day handoff

### Monitoring During Launch
1. Watch #support-alerts channel
2. Check status page every 30 mins
3. Track ticket volume
4. Flag patterns to team lead
5. Document new issues

## Communication Guidelines

### Tone & Style
- **Friendly**: "I'd be happy to help!"
- **Empathetic**: "I understand how frustrating this must be"
- **Professional**: Clear, concise responses
- **Positive**: "Let's get this sorted out for you"

### Response Time SLAs
- Critical (login/payment): 1 hour
- High (functionality): 4 hours
- Medium (questions): 24 hours
- Low (feedback): 48 hours

### Do's and Don'ts

**DO:**
- Acknowledge the issue quickly
- Set expectations for resolution
- Follow up even if escalated
- Document unusual issues
- Ask for clarification when needed

**DON'T:**
- Make promises about features
- Share internal information
- Blame the user
- Guess at technical details
- Close tickets prematurely

## Canned Responses Library

### Welcome/Greeting
```
Thank you for contacting Moshimoshi support! I'm [Name] and I'll be helping you today. I've reviewed your issue and I'm here to get this resolved for you.
```

### Investigating Issue
```
I'm looking into this for you right now. This should just take a few minutes. I'll update you as soon as I have more information.
```

### Escalation
```
I've escalated this to our technical team who can better assist with this specific issue. They'll respond within [timeframe]. Your ticket number is #[number] for reference.
```

### Resolution
```
Great news! The issue has been resolved. [Explain what was done]. Please let me know if you experience any other problems - I'm here to help!
```

### Follow-up
```
I wanted to check in and make sure everything is working properly for you now. If you're still experiencing issues or have any questions, please don't hesitate to let me know.
```

### Feature Request
```
Thank you for the suggestion! I've passed this along to our product team who reviews all feature requests. While I can't promise implementation, we truly value feedback like yours as it helps shape Moshimoshi's future.
```

## Tools & Resources

### Support Tools
- **Helpdesk**: [support.moshimoshi.app/admin]
- **Stripe Dashboard**: [dashboard.stripe.com]
- **Status Page Admin**: [status.moshimoshi.app/admin]
- **User Lookup**: [admin.moshimoshi.app/users]
- **Monitoring**: [monitor.moshimoshi.app]

### Quick Links
- FAQ: docs.moshimoshi.app/faq
- Knowledge Base: docs.moshimoshi.app/kb
- API Status: status.moshimoshi.app
- Escalation: #support-escalation (Slack)

### Admin Commands
```bash
# Unlock user account
npm run admin:user:unlock -- --email=user@example.com

# Check user subscription
npm run admin:subscription:check -- --email=user@example.com

# Force sync for user
npm run admin:sync:force -- --email=user@example.com

# Regenerate review queue
npm run admin:queue:regenerate -- --email=user@example.com
```

## Launch Week Special Situations

### Expected Issues
1. **Higher than normal traffic**: Response times may be slower
2. **New user confusion**: More "how to" questions
3. **Migration questions**: Existing users adapting to changes
4. **Premium activation delays**: Payment processing backlogs

### Premium Launch Offer
- Code: LAUNCH2024
- Discount: 20% off first year
- Limit: First 100 users
- Valid until: [Date + 7 days]

### How to Apply Discount
1. User goes to Settings → Subscription
2. Click "Upgrade to Premium"
3. Enter code LAUNCH2024
4. Discount automatically applied

## Quality Checklist

Before closing any ticket:
- [ ] Issue actually resolved
- [ ] User confirmed satisfaction
- [ ] Ticket properly categorized
- [ ] Resolution documented
- [ ] Follow-up scheduled if needed

## Emergency Contacts

- **Support Lead**: [Name] - [Phone/Slack]
- **Tech Lead**: [Name] - [Phone/Slack]
- **Engineering On-Call**: [PagerDuty]
- **Product Manager**: [Name] - [Email]
- **CEO** (critical only): [Name] - [Email]

## Post-Launch Review

After your shift:
1. Log unusual issues
2. Note common questions
3. Suggest FAQ updates
4. Share customer feedback
5. Update response templates

## Remember

- You're the face of Moshimoshi to our users
- Every interaction matters
- When in doubt, escalate
- Document everything
- Take breaks to avoid burnout

---

**Training Completed By**: ________________  
**Date**: ________________  
**Supervisor Sign-off**: ________________

*Good luck with the launch! You've got this! 🚀*