# JWT Secret Rotation Guide

## ⚠️ CRITICAL SECURITY PROCEDURE

This guide outlines the process for rotating the JWT_SECRET in production to maintain security.

## When to Rotate

- **Immediately** if secret is compromised or exposed
- **Monthly** as a best practice for high-security applications
- **Before production launch** if using development placeholder

## Current Status

- **Old Secret**: Development placeholder (needs immediate replacement)
- **Security Risk**: HIGH - Current secret is documented in codebase comments
- **Action Required**: Generate new secret before production deployment

## Rotation Procedure

### Step 1: Generate New Secret

```bash
# Generate cryptographically secure 512-bit secret
openssl rand -base64 64
```

### Step 2: Update Environment Variables

**Production (.env.production or hosting platform):**
```env
JWT_SECRET=<new-secret-here>
```

**DO NOT commit secrets to repository!**

### Step 3: Dual-Key Grace Period (Optional, Recommended)

To prevent mass logout, implement dual-key validation for 24 hours:

1. Keep both old and new secrets in environment
2. Verify tokens against both secrets
3. Issue new tokens with new secret
4. After 24 hours, remove old secret

**Implementation:**
```typescript
// In jwt.ts verification function
try {
  return jwt.verify(token, NEW_SECRET)
} catch (err) {
  // Fallback to old secret during grace period
  if (OLD_SECRET && Date.now() < GRACE_PERIOD_END) {
    return jwt.verify(token, OLD_SECRET)
  }
  throw err
}
```

### Step 4: Deployment Strategy

1. **Announce maintenance**: Email users 24 hours in advance
2. **Schedule timing**: Low-traffic hours (2-4 AM PST recommended)
3. **Deploy with dual-key**: Minimize user disruption
4. **Monitor error rates**: Watch authentication failures for 48 hours
5. **Remove old secret**: After grace period expires

### Step 5: Verification

```bash
# Test authentication endpoints
curl -H "Authorization: Bearer <valid-token>" https://app.com/api/user/profile

# Should return user data, not 401
```

### Step 6: Post-Rotation Cleanup

1. Clear Redis sessions (optional, if not using grace period)
2. Monitor Sentry for auth-related errors
3. Document rotation in changelog
4. Schedule next rotation (30-90 days)

## Emergency Rollback

If rotation causes critical auth failures:

```bash
# 1. Restore old secret immediately
export JWT_SECRET=<old-secret>

# 2. Redeploy application
npm run build && pm2 restart app

# 3. Investigate issue
# 4. Plan re-rotation with fixes
```

## Security Best Practices

### ✅ DO:
- Store secrets in environment variables only
- Use secrets management service (AWS Secrets Manager, Vault)
- Rotate regularly (monthly/quarterly)
- Generate with cryptographic tools (openssl, crypto.randomBytes)
- Minimum 256 bits (32 bytes) length
- Use different secrets for dev/staging/production

### ❌ DON'T:
- Commit secrets to Git
- Use predictable patterns
- Share secrets via Slack/email
- Reuse secrets across projects
- Use development placeholder in production

## Secret Storage Recommendations

### Development
```env
# .env.local (gitignored)
JWT_SECRET=<dev-secret>
```

### Production Options

**Option 1: Vercel/Netlify Environment Variables**
- Settings → Environment Variables
- Add JWT_SECRET
- Redeploy to apply

**Option 2: Docker Secrets**
```bash
echo "<secret>" | docker secret create jwt_secret -
```

**Option 3: Kubernetes Secrets**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: jwt-secret
type: Opaque
data:
  JWT_SECRET: <base64-encoded-secret>
```

**Option 4: AWS Secrets Manager**
```bash
aws secretsmanager create-secret \
  --name moshimoshi/jwt-secret \
  --secret-string "<secret>"
```

## Monitoring

After rotation, monitor these metrics:

- **Authentication success rate**: Should remain >99%
- **Session creation rate**: May spike after rotation
- **Error logs**: Watch for JWT verification failures
- **User support tickets**: Auth-related issues

## Checklist

- [ ] New secret generated (512 bits minimum)
- [ ] Secrets never committed to Git
- [ ] Environment variables updated
- [ ] Dual-key grace period configured (optional)
- [ ] Users notified of maintenance window
- [ ] Deployment scheduled for low-traffic hours
- [ ] Monitoring dashboard ready
- [ ] Rollback procedure tested
- [ ] Post-rotation verification completed
- [ ] Documentation updated

## Contact

For questions or issues during rotation:
- **Security Team**: security@moshimoshi.app
- **On-Call Engineer**: Check PagerDuty
- **Emergency Rollback**: Follow procedure above

---

**Last Updated**: 2025-01-08
**Next Rotation Due**: (Set after first production rotation)
