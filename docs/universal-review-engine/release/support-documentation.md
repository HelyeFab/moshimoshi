# Support Documentation - Moshimoshi v1.0.0

## Overview

This document provides comprehensive support information for the Moshimoshi Japanese learning platform. It covers common issues, troubleshooting steps, and escalation procedures.

## Quick Reference

- **Version**: 1.0.0
- **Support Email**: support@moshimoshi.app
- **Status Page**: https://status.moshimoshi.app
- **Documentation**: https://docs.moshimoshi.app
- **Response Time SLA**: 
  - Critical: 1 hour
  - High: 4 hours
  - Medium: 24 hours
  - Low: 48 hours

## Common Issues and Solutions

### 1. Login/Authentication Issues

#### Problem: User cannot login
**Symptoms**: Login button doesn't work, wrong password error, account locked

**Solutions**:
1. Verify email address is correct
2. Reset password via "Forgot Password" link
3. Clear browser cache and cookies
4. Try incognito/private browsing mode
5. Check if account is locked (5 failed attempts)

**Backend Check**:
```bash
# Check user status
npm run admin:user:status -- --email=user@example.com

# Unlock account
npm run admin:user:unlock -- --email=user@example.com

# Reset password manually
npm run admin:user:reset-password -- --email=user@example.com
```

#### Problem: Session expires too quickly
**Solutions**:
1. Check "Remember Me" during login
2. Ensure stable internet connection
3. Disable aggressive browser privacy settings

### 2. Review System Issues

#### Problem: Reviews not loading
**Symptoms**: Spinning loader, empty queue, error messages

**Solutions**:
1. Check internet connection
2. Refresh the page (F5)
3. Log out and log back in
4. Clear browser cache
5. Try different browser

**Backend Check**:
```bash
# Check queue generation for user
npm run admin:queue:check -- --user=<userId>

# Regenerate queue
npm run admin:queue:regenerate -- --user=<userId>

# Check SRS calculations
npm run admin:srs:verify -- --user=<userId>
```

#### Problem: Progress not saving
**Symptoms**: Reviews reset, statistics not updating

**Solutions**:
1. Ensure online connection when completing reviews
2. Wait for sync indicator (if offline)
3. Don't close browser immediately after reviews
4. Check browser's IndexedDB storage

**Backend Check**:
```bash
# Check sync status
npm run admin:sync:status -- --user=<userId>

# Force sync
npm run admin:sync:force -- --user=<userId>

# Verify database writes
npm run admin:db:verify-writes -- --user=<userId>
```

### 3. Payment/Subscription Issues

#### Problem: Payment failed
**Symptoms**: Card declined, payment error, subscription not activated

**Solutions**:
1. Verify card details are correct
2. Ensure sufficient funds
3. Contact bank for authorization
4. Try different payment method
5. Check for regional restrictions

**Backend Check**:
```bash
# Check Stripe customer
npm run admin:stripe:customer -- --email=user@example.com

# Verify webhook received
npm run admin:stripe:webhook:verify -- --payment=<paymentId>

# Manual subscription activation
npm run admin:subscription:activate -- --user=<userId>
```

#### Problem: Premium features not accessible
**Solutions**:
1. Log out and log back in
2. Verify payment was successful
3. Check subscription status in settings
4. Wait 5 minutes for activation

### 4. Performance Issues

#### Problem: App is slow
**Symptoms**: Long load times, lag, unresponsive UI

**Solutions**:
1. Check internet speed (minimum 1 Mbps recommended)
2. Close unnecessary browser tabs
3. Disable browser extensions
4. Clear browser cache
5. Update browser to latest version
6. Try different browser
7. Restart device

#### Problem: Offline mode not working
**Solutions**:
1. Ensure PWA is installed
2. Visit site while online first
3. Check browser supports service workers
4. Clear cache and reinstall PWA
5. Check available storage space

### 5. Display/UI Issues

#### Problem: Text not displaying correctly
**Symptoms**: Squares instead of Japanese, broken layout

**Solutions**:
1. Install Japanese language pack
2. Enable Japanese fonts in browser
3. Update browser
4. Check system locale settings

#### Problem: Dark mode issues
**Solutions**:
1. Toggle dark mode off and on
2. Check system dark mode settings
3. Clear browser cache
4. Update browser

## Troubleshooting Tools

### Browser Diagnostics

```javascript
// Run in browser console

// Check browser compatibility
console.log('Service Worker:', 'serviceWorker' in navigator);
console.log('IndexedDB:', 'indexedDB' in window);
console.log('Web Storage:', 'localStorage' in window);

// Check connection
console.log('Online:', navigator.onLine);
console.log('Connection:', navigator.connection);

// Check storage
navigator.storage.estimate().then(estimate => {
  console.log('Storage used:', (estimate.usage / 1024 / 1024).toFixed(2), 'MB');
  console.log('Storage available:', (estimate.quota / 1024 / 1024).toFixed(2), 'MB');
});

// Check PWA install
window.matchMedia('(display-mode: standalone)').matches ? 
  console.log('PWA installed') : console.log('Not installed as PWA');
```

### Admin Commands

```bash
# User Management
npm run admin:user:list -- --limit=10
npm run admin:user:info -- --email=user@example.com
npm run admin:user:reset -- --email=user@example.com

# System Health
npm run admin:health:check
npm run admin:health:detailed
npm run admin:metrics:current

# Database
npm run admin:db:check
npm run admin:db:repair -- --table=<table>
npm run admin:db:backup

# Cache
npm run admin:cache:status
npm run admin:cache:clear -- --pattern=<pattern>
npm run admin:cache:warm

# Monitoring
npm run admin:logs:tail -- --lines=100
npm run admin:errors:recent -- --hours=24
npm run admin:alerts:list
```

## Escalation Procedures

### Level 1: Support Team
- Handle common issues using this guide
- Response time: < 4 hours
- Escalate if: Technical issue, payment problem, data loss

### Level 2: Technical Team
- Handle technical issues, bugs, integration problems
- Response time: < 2 hours for critical
- Escalate if: Security issue, data breach, system down

### Level 3: Engineering Lead
- Handle system-wide issues, architecture decisions
- Response time: < 1 hour for critical
- Escalate if: Major outage, security breach

### Level 4: CTO/Emergency
- Handle critical business-impacting issues
- Response time: < 30 minutes
- Use only for: Complete system failure, data breach, legal issues

## User Communication Templates

### Planned Maintenance
```
Subject: Scheduled Maintenance - [Date] [Time]

Dear User,

We will be performing scheduled maintenance on [Date] from [Start Time] to [End Time] [Timezone].

During this time, the service may be temporarily unavailable. Your data is safe and will be available when maintenance is complete.

We apologize for any inconvenience.

Best regards,
Moshimoshi Support Team
```

### Service Disruption
```
Subject: Service Disruption Notice

Dear User,

We are currently experiencing technical difficulties affecting [affected feature].

Our team is working to resolve this issue as quickly as possible. 

Current status: [Investigating/Identified/Fixing/Monitoring]
Estimated resolution: [Time]

Updates available at: https://status.moshimoshi.app

We apologize for the inconvenience.

Best regards,
Moshimoshi Support Team
```

### Issue Resolved
```
Subject: Issue Resolved - Service Restored

Dear User,

The issue affecting [affected feature] has been resolved.

All services are now operating normally. If you continue to experience problems, please contact support@moshimoshi.app.

Thank you for your patience.

Best regards,
Moshimoshi Support Team
```

## FAQ

### General

**Q: What browsers are supported?**
A: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

**Q: Is there a mobile app?**
A: Moshimoshi is a Progressive Web App (PWA) that can be installed on mobile devices.

**Q: How do I install the PWA?**
A: Visit the site in Chrome/Safari, tap the menu, select "Add to Home Screen"

**Q: Can I use Moshimoshi offline?**
A: Yes, after initial setup, core features work offline and sync when reconnected.

### Account

**Q: How do I delete my account?**
A: Go to Settings → Account → Delete Account. This action is irreversible.

**Q: Can I change my email?**
A: Yes, go to Settings → Account → Change Email

**Q: Is my data secure?**
A: Yes, we use encryption, secure servers, and follow GDPR compliance.

### Subscription

**Q: How do I cancel my subscription?**
A: Settings → Subscription → Manage → Cancel Subscription

**Q: Will I lose my data if I cancel?**
A: No, your data is retained but premium features become inaccessible.

**Q: Can I get a refund?**
A: Refunds are available within 7 days of purchase. Contact support@moshimoshi.app

### Technical

**Q: Why is the app slow?**
A: Check internet connection, clear cache, or try a different browser.

**Q: How much storage does it use?**
A: Approximately 50-100MB for offline functionality.

**Q: Can I export my data?**
A: Yes, Settings → Data → Export Data (JSON format)

## Monitoring and Alerts

### Key Metrics to Monitor
- Error rate: Should be < 0.1%
- Response time: Should be < 200ms (p95)
- Active users: Normal range varies by time
- Queue generation time: Should be < 50ms
- Sync success rate: Should be > 99%

### Alert Thresholds
- **Critical**: Error rate > 5%, Response time > 1s, System down
- **High**: Error rate > 1%, Response time > 500ms, Payment failures
- **Medium**: Error rate > 0.5%, Response time > 300ms
- **Low**: Any degradation from baseline

## Support Tools Access

### Internal Tools
- Admin Dashboard: https://admin.moshimoshi.app
- Monitoring: https://monitor.moshimoshi.app
- Logs: https://logs.moshimoshi.app
- Metrics: https://metrics.moshimoshi.app

### External Tools
- Stripe Dashboard: https://dashboard.stripe.com
- Sentry: https://sentry.io/organizations/moshimoshi
- Firebase Console: https://console.firebase.google.com
- Upstash Console: https://console.upstash.com

## Contact Information

### Internal Contacts
- Support Team Lead: [Email/Slack]
- Engineering On-Call: [PagerDuty]
- Database Admin: [Email/Slack]
- Security Team: [Email/Slack]

### External Contacts
- Stripe Support: support@stripe.com
- Firebase Support: https://firebase.google.com/support
- Upstash Support: support@upstash.com

---

**Document Version**: 1.0.0  
**Last Updated**: [Date]  
**Next Review**: [Date + 1 month]

**Remember**: Always be empathetic, document issues thoroughly, and escalate when in doubt.