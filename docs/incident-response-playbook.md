# Incident Response Playbook

## 🚨 Emergency Response Procedures

### Immediate Actions (0-15 minutes)

#### 1. Assess the Situation
```bash
# Check system status
curl https://moshimoshi.example.com/api/health

# Check recent errors
kubectl logs -n moshimoshi deployment/moshimoshi-blue --tail=100

# Check security alerts
# Review Sentry dashboard for security events
```

#### 2. Classify Incident Severity

| Severity | Criteria | Response Time | Escalation |
|----------|----------|---------------|------------|
| **P1 - Critical** | Data breach, complete outage, auth bypass | < 15 min | Immediate to CTO |
| **P2 - High** | Partial outage, performance degradation >50% | < 1 hour | Engineering Manager |
| **P3 - Medium** | Feature failure, performance issue <50% | < 4 hours | Team Lead |
| **P4 - Low** | Minor issues, cosmetic bugs | < 24 hours | Standard process |

#### 3. Activate Response Team

**P1/P2 Incidents:**
1. Page on-call engineer
2. Create incident channel (#incident-YYYYMMDD-HHMM)
3. Assign roles:
   - Incident Commander (IC)
   - Technical Lead
   - Communications Lead
   - Scribe

### Security Incident Types

## 🔓 1. Data Breach Response

### Detection Indicators
- Unauthorized data access logs
- Unusual database queries
- Large data exports
- Suspicious user activity patterns

### Response Steps

```bash
# 1. Isolate affected systems
kubectl cordon node <affected-node>

# 2. Revoke compromised credentials
./scripts/security/revoke-credentials.sh <user-id>

# 3. Enable enhanced logging
kubectl set env deployment/moshimoshi-blue LOG_LEVEL=DEBUG -n moshimoshi

# 4. Capture forensic data
kubectl exec -n moshimoshi <pod-name> -- tar -czf /tmp/forensics.tar.gz /app/logs
kubectl cp moshimoshi/<pod-name>:/tmp/forensics.tar.gz ./forensics/

# 5. Check for data exfiltration
grep -r "export\|download\|transfer" /var/log/nginx/
```

### Containment
1. Block suspicious IPs at WAF level
2. Disable affected user accounts
3. Rotate all potentially compromised credentials
4. Enable read-only mode if necessary

### Communication Template
```
Subject: [Security Incident] Data Breach Detected

Severity: P1
Time Detected: [TIMESTAMP]
Systems Affected: [LIST]
Data Potentially Affected: [DESCRIPTION]
Current Status: [Investigating/Contained/Resolved]
Next Update: [TIME]

Actions Taken:
- [ACTION 1]
- [ACTION 2]

Customer Impact: [DESCRIPTION or None]
```

## 🚫 2. DDoS Attack Response

### Detection
- Spike in request rate
- Increased error rates
- Memory/CPU exhaustion
- Network saturation

### Mitigation Steps

```bash
# 1. Enable DDoS protection
curl -X PATCH https://api.cloudflare.com/client/v4/zones/[ZONE_ID]/settings/security_level \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -d '{"value":"under_attack"}'

# 2. Increase rate limiting
kubectl patch configmap moshimoshi-config -n moshimoshi \
  --type merge -p '{"data":{"RATE_LIMIT_MULTIPLIER":"0.5"}}'

# 3. Scale up resources
kubectl scale deployment moshimoshi-blue --replicas=10 -n moshimoshi

# 4. Enable emergency caching
redis-cli SET emergency_cache_enabled true EX 3600
```

### Traffic Analysis
```bash
# Identify attack patterns
tail -f /var/log/nginx/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# Block malicious IPs
while read ip; do
  iptables -A INPUT -s $ip -j DROP
done < malicious_ips.txt
```

## 💉 3. Code Injection Attack

### Detection
- Unusual process execution
- Unexpected file modifications
- Suspicious database queries
- Error logs showing injection attempts

### Response

```bash
# 1. Immediate containment
kubectl delete pod -n moshimoshi -l version=blue

# 2. Review recent code changes
git log --since="2 hours ago" --oneline

# 3. Scan for malicious code
grep -r "eval\|exec\|system\|passthru" /app/

# 4. Check for backdoors
find /app -type f -name "*.php" -o -name "*.jsp" -o -name "*.asp"

# 5. Validate file integrity
md5sum -c /app/checksums.txt
```

## 🔑 4. Authentication Bypass

### Detection
- Admin actions from non-admin users
- Session hijacking indicators
- Unusual authentication patterns

### Response

```bash
# 1. Invalidate all sessions
redis-cli FLUSHDB

# 2. Force re-authentication
kubectl set env deployment/moshimoshi-blue \
  FORCE_REAUTH=true -n moshimoshi

# 3. Rotate JWT secrets
kubectl delete secret jwt-secret -n moshimoshi
kubectl create secret generic jwt-secret \
  --from-literal=secret=$(openssl rand -base64 32) -n moshimoshi

# 4. Audit recent authentication
SELECT user_id, ip_address, timestamp 
FROM auth_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

## 📊 5. Data Integrity Compromise

### Detection
- Unexpected data modifications
- Checksum mismatches
- Replication inconsistencies

### Response

```bash
# 1. Enable read-only mode
kubectl set env deployment/moshimoshi-blue \
  READ_ONLY_MODE=true -n moshimoshi

# 2. Verify data integrity
./scripts/verify-data-integrity.sh

# 3. Restore from backup if needed
./scripts/restore-from-backup.sh --timestamp="2024-01-15 10:00:00"

# 4. Reconcile data
./scripts/data-reconciliation.sh
```

## 📝 Post-Incident Procedures

### 1. Evidence Collection
```bash
# Collect all logs
mkdir incident-$(date +%Y%m%d-%H%M%S)
cd incident-*

# System logs
kubectl logs -n moshimoshi --all-containers=true --since=24h > k8s-logs.txt

# Database logs
pg_dump audit_logs > audit_backup.sql

# Network logs
tcpdump -i any -w network.pcap -G 3600 -W 1

# Application logs
docker logs moshimoshi-app > app-logs.txt
```

### 2. Root Cause Analysis Template

```markdown
# Incident Post-Mortem: [INCIDENT-ID]

## Summary
- **Date:** [DATE]
- **Duration:** [START] - [END]
- **Impact:** [DESCRIPTION]
- **Severity:** [P1-P4]

## Timeline
- [TIME]: Event started
- [TIME]: Detection
- [TIME]: Response initiated
- [TIME]: Mitigation applied
- [TIME]: Resolution confirmed

## Root Cause
[Detailed explanation of what caused the incident]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## Resolution
[How the incident was resolved]

## Impact
- Users affected: [NUMBER]
- Data affected: [DESCRIPTION]
- Financial impact: [AMOUNT]
- Reputation impact: [ASSESSMENT]

## Lessons Learned
### What went well
- [Item 1]
- [Item 2]

### What went poorly
- [Item 1]
- [Item 2]

### Where we got lucky
- [Item 1]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | [Name] | [Date] | [Status] |
| [Action 2] | [Name] | [Date] | [Status] |

## Supporting Documents
- [Link to logs]
- [Link to graphs]
- [Link to communication]
```

### 3. Communication Templates

#### Customer Notification
```
Subject: [Service Name] Security Update

Dear Customer,

We are writing to inform you of a security incident that occurred on [DATE]. 

**What Happened:**
[Brief, clear description]

**Information Involved:**
[Specific data types affected]

**What We've Done:**
- [Action 1]
- [Action 2]
- [Action 3]

**What You Should Do:**
- [Recommendation 1]
- [Recommendation 2]

**Additional Information:**
[Contact information and resources]

We take the security of your information seriously and apologize for any inconvenience.

Sincerely,
[Security Team]
```

#### Internal Update
```
Subject: [P1] Incident Update - [INCIDENT-ID]

Status: [Investigating/Mitigating/Resolved]
Commander: [Name]
Duration: [TIME] (ongoing/resolved)

Current Situation:
[2-3 sentences on current status]

Actions Taken:
- [Completed action 1]
- [Completed action 2]

Next Steps:
- [Planned action 1]
- [Planned action 2]

Customer Impact:
[Description or "None identified"]

Next Update: [TIME]
```

## 🔧 Recovery Procedures

### System Recovery Checklist
- [ ] Verify threat eliminated
- [ ] Restore from clean backup if needed
- [ ] Apply security patches
- [ ] Reset all credentials
- [ ] Verify system integrity
- [ ] Test all functionality
- [ ] Monitor for recurrence
- [ ] Update security rules
- [ ] Document changes

### Rollback Procedure
```bash
# Quick rollback to previous version
./scripts/rollback.sh

# Manual rollback steps
kubectl set image deployment/moshimoshi-blue \
  moshimoshi=registry/moshimoshi:previous-version \
  -n moshimoshi

# Verify rollback
kubectl rollout status deployment/moshimoshi-blue -n moshimoshi
```

## 📞 Escalation Matrix

| Role | Name | Phone | Email | Escalate When |
|------|------|-------|-------|---------------|
| On-Call Engineer | Rotation | PagerDuty | - | First response |
| Team Lead | [Name] | [Phone] | [Email] | P3+ incidents |
| Engineering Manager | [Name] | [Phone] | [Email] | P2+ incidents |
| CTO | [Name] | [Phone] | [Email] | P1 incidents |
| CEO | [Name] | [Phone] | [Email] | Data breach |
| Legal Counsel | [Name] | [Phone] | [Email] | Legal implications |
| PR Team | [Name] | [Phone] | [Email] | Public disclosure |

## 🛠️ Tools and Resources

### Monitoring Dashboards
- Sentry: https://sentry.io/organizations/moshimoshi
- CloudFlare: https://dash.cloudflare.com
- Kubernetes: https://k8s.moshimoshi.internal
- Metrics: https://moshimoshi.example.com/admin/monitoring

### Useful Commands
```bash
# Check current attack status
curl https://api.cloudflare.com/client/v4/zones/[ZONE]/analytics/dashboard

# Emergency shutdown
kubectl scale deployment --all --replicas=0 -n moshimoshi

# Emergency cache clear
redis-cli FLUSHALL

# Block all traffic except admin
iptables -A INPUT -s [ADMIN_IP] -j ACCEPT
iptables -A INPUT -j DROP
```

### External Resources
- AWS Security Response: 1-866-300-0299
- CloudFlare Support: support@cloudflare.com
- Firebase Support: https://firebase.google.com/support

---

**Document Version:** 1.0.0  
**Last Updated:** Week 3, 2024  
**Last Drill:** [DATE]  
**Next Review:** Monthly

Remember: In an incident, speed matters but accuracy matters more. Take a breath, follow the playbook, and communicate clearly.