# Sheldon Service Deployment Guide

**Complete Guide for Deploying Backend Services on Sheldon for Moshimoshi**

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Deployment Process](#step-by-step-deployment-process)
4. [Testing & Verification](#testing--verification)
5. [Troubleshooting](#troubleshooting)
6. [Service Examples](#service-examples)
7. [Important Patterns & Anti-Patterns](#important-patterns--anti-patterns)

---

## Architecture Overview

### Infrastructure Stack
```
Moshimoshi (Client)
    ↓ HTTPS
Cloudflare DNS (tts.selfmind.dev)
    ↓
Cloudflare Tunnel (c325864b-4c4c-4e02-a77e-d90c01873020)
    ↓ HTTP (port 80)
Caddy Reverse Proxy (ai-gateway-caddy container)
    ↓ HTTP (internal)
Backend Service (e.g., Edge-TTS on port 8090)
```

### Key Components

**Cloudflare Tunnel Configuration**
- File: `/home/sheldon/.cloudflared/config.yml`
- Uses **wildcard routing**: All `*.selfmind.dev` → `http://localhost:80`
- Single tunnel handles all subdomains

**Caddy Configuration**
- File: `/home/sheldon/ai-gateway/caddy/Caddyfile`
- Container: `ai-gateway-caddy`
- Listens on port 80 for Cloudflare traffic
- Uses `:80 { }` section with host matchers

**Service Container/Process**
- Docker container or systemd service
- Binds to host port (e.g., 8090, 5000, 30004)
- Accessed via `172.19.0.1:PORT` from Caddy

---

## Prerequisites

### Access Requirements
- SSH access to Sheldon: `ssh tbbt-sheldon`
- Sudo password: Read from `/home/sheldon/.env.local.txt` (use with `echo 'password' | sudo -S command`)
- Cloudflare account access for DNS management

### Tools Needed
- Docker & Docker Compose (already installed)
- Caddy (already running in container)
- cloudflared (already configured)

### Existing Infrastructure
- Cloudflare Tunnel: `eb8d90fa-9acb-4993-ac6d-0b492fba548a` (OLD - not used)
- Active Tunnel: `c325864b-4c4c-4e02-a77e-d90c01873020`
- Domain: `selfmind.dev` (managed by Cloudflare)
- Network: Docker network `ai-gateway_default` (subnet: 172.19.0.0/16)

---

## Step-by-Step Deployment Process

### Phase 1: Service Deployment

#### Step 1.1: SSH into Sheldon
```bash
ssh tbbt-sheldon
```

#### Step 1.2: Verify Service is Running
```bash
# For Docker containers
docker ps | grep your-service-name

# For systemd services
systemctl status your-service-name

# Test the service directly
curl http://localhost:PORT/health
```

**Example (Edge-TTS):**
```bash
docker ps | grep edge-tts
# Output: edge-tts running on 0.0.0.0:8090->8090/tcp

curl http://localhost:8090/health
# Output: {"status":"healthy","service":"edge-tts"}
```

#### Step 1.3: Verify Service Network Configuration
```bash
# For Docker containers - get the port binding
docker inspect SERVICE_NAME --format='{{json .NetworkSettings.Ports}}' | python3 -m json.tool

# For Docker containers - get the IP address
docker inspect SERVICE_NAME --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Verify Caddy can reach the service
docker exec ai-gateway-caddy wget -qO- http://172.19.0.1:PORT/health
```

---

### Phase 2: Caddy Configuration

#### Step 2.1: Backup Current Caddyfile
```bash
cd /home/sheldon/ai-gateway
cp caddy/Caddyfile caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
```

#### Step 2.2: Add Service Configuration to :80 Section

**CRITICAL: Do NOT add a standalone `service.selfmind.dev {}` block**

Edit `/home/sheldon/ai-gateway/caddy/Caddyfile`:

```caddyfile
:80 {
    # Your New Service
    @yourservice host yourservice.selfmind.dev
    handle @yourservice {
        reverse_proxy 172.19.0.1:PORT {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # ... existing services ...
}
```

**Example (Edge-TTS):**
```caddyfile
:80 {
    # Edge-TTS Service
    @tts host tts.selfmind.dev
    handle @tts {
        reverse_proxy 172.19.0.1:8090 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # ... other services ...
}
```

#### Step 2.3: Validate Caddy Configuration
```bash
docker exec ai-gateway-caddy caddy validate --config /etc/caddy/Caddyfile
# Expected: "Valid configuration"
```

#### Step 2.4: Reload Caddy
```bash
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile
# Check for errors in output
```

#### Step 2.5: Test Internal Routing
```bash
# Test from Sheldon host
curl -H 'Host: yourservice.selfmind.dev' http://localhost:80/health

# Should return the service response (not a redirect!)
```

**Expected Result:**
- Status: 200 OK
- Body: Service health response (e.g., `{"status":"healthy"}`)

**If you get a 308 redirect, you have a standalone block causing issues - remove it!**

---

### Phase 3: DNS Configuration

#### Step 3.1: Log into Cloudflare Dashboard
Navigate to: `https://dash.cloudflare.com` → Select `selfmind.dev` domain

#### Step 3.2: Add DNS Record
**Settings:**
- **Type**: `CNAME`
- **Name**: `yourservice` (e.g., `tts`)
- **Target**: `c325864b-4c4c-4e02-a77e-d90c01873020.cfargotunnel.com`
- **Proxy status**: ✅ **Proxied** (orange cloud icon)
- **TTL**: Auto

#### Step 3.3: Wait for DNS Propagation
```bash
# Check DNS resolution (wait 1-2 minutes)
nslookup yourservice.selfmind.dev

# Expected output:
# Name: yourservice.selfmind.dev
# Addresses: 172.67.189.64, 104.21.9.121 (Cloudflare IPs)
```

---

### Phase 4: Cloudflare Tunnel Verification

The Cloudflare Tunnel is already configured with wildcard routing, so no changes needed:

```bash
# Verify tunnel configuration (FYI only)
cat /home/sheldon/.cloudflared/config.yml
```

**Current Configuration:**
```yaml
tunnel: c325864b-4c4c-4e02-a77e-d90c01873020
credentials-file: /etc/cloudflared/c325864b-4c4c-4e02-a77e-d90c01873020.json

ingress:
  - hostname: "*.selfmind.dev"
    service: http://localhost:80
  - hostname: selfmind.dev
    service: http://localhost:80
  - service: http_status:404
```

**The wildcard `*.selfmind.dev` automatically routes all subdomains to Caddy port 80.**

---

## Testing & Verification

### Test 1: Health Check from External
```bash
curl -s https://yourservice.selfmind.dev/health
```

**Expected:**
- Status: 200 OK
- Response: Service-specific health response (JSON)

**If Empty or 308 Redirect:**
- Check for standalone Caddy block (remove it)
- Verify :80 section configuration
- Check Caddy logs: `docker logs --tail 50 ai-gateway-caddy`

### Test 2: Functional Endpoint
```bash
# Example: POST request with JSON body
curl -X POST https://yourservice.selfmind.dev/endpoint \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}' \
  --output response.bin
```

### Test 3: From Moshimoshi App
```typescript
// In your Next.js API route or client component
const response = await fetch('https://yourservice.selfmind.dev/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'your-data' })
});

const result = await response.json();
console.log('Service response:', result);
```

### Test 4: Verify End-to-End Path
```bash
# On Sheldon, watch logs while making request
docker logs -f SERVICE_CONTAINER_NAME &
docker logs -f ai-gateway-caddy &

# From another terminal, make request
curl https://yourservice.selfmind.dev/health

# You should see:
# 1. Request hit Caddy
# 2. Caddy proxy to backend
# 3. Backend service logs the request
```

---

## Troubleshooting

### Issue 1: 308 Permanent Redirect Loop

**Symptoms:**
- `curl https://yourservice.selfmind.dev/health` returns HTTP 308
- Response body is empty
- Cloudflare returns redirect loop error

**Cause:**
Standalone `yourservice.selfmind.dev {}` block in Caddyfile triggers automatic HTTPS redirect when Cloudflare sends HTTP traffic.

**Solution:**
```bash
# Remove the standalone block
# Keep ONLY the :80 section matcher

# Find and remove lines like:
yourservice.selfmind.dev {
    reverse_proxy 172.19.0.1:PORT {
        # ... config ...
    }
}

# Validate and reload
docker exec ai-gateway-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile
```

### Issue 2: Empty Response Body (200 OK but no data)

**Symptoms:**
- HTTP 200 OK status
- Content-Length: 0
- No response body

**Possible Causes:**
1. Request not reaching backend service
2. Backend returning empty response
3. Caddy not proxying response body

**Debug Steps:**
```bash
# Test backend directly
curl http://localhost:PORT/health

# Test through Caddy internally
curl -H 'Host: yourservice.selfmind.dev' http://localhost:80/health

# Check if request reaches backend
docker logs --tail 20 SERVICE_CONTAINER

# Check Caddy logs
docker logs --tail 50 ai-gateway-caddy | grep yourservice
```

### Issue 3: 502 Bad Gateway

**Symptoms:**
- HTTP 502 error from Cloudflare

**Possible Causes:**
1. Caddy container is down/restarting
2. Backend service is down
3. Network connectivity issue

**Debug Steps:**
```bash
# Check Caddy status
docker ps | grep caddy

# If restarting, check logs
docker logs ai-gateway-caddy

# Check backend service
docker ps | grep SERVICE_NAME
systemctl status SERVICE_NAME  # for systemd services

# Test connectivity from Caddy container
docker exec ai-gateway-caddy wget -qO- http://172.19.0.1:PORT/health
```

### Issue 4: DNS Not Resolving

**Symptoms:**
- `nslookup yourservice.selfmind.dev` returns "Non-existent domain"

**Solution:**
1. Verify DNS record in Cloudflare dashboard
2. Wait 1-2 minutes for propagation
3. Clear local DNS cache:
   ```bash
   # On Windows
   ipconfig /flushdns

   # On Linux
   sudo systemd-resolve --flush-caches

   # On macOS
   sudo dscacheutil -flushcache
   ```
4. Test with Cloudflare DNS directly:
   ```bash
   nslookup yourservice.selfmind.dev 1.1.1.1
   ```

### Issue 5: UTF-8 Encoding Issues (Japanese text)

**Symptoms:**
- Japanese text works internally but fails through HTTPS
- "NoAudioReceived" or similar encoding errors

**Solution:**
This is usually a client-side encoding issue, not infrastructure. Verify:

```bash
# Test from Sheldon with proper UTF-8 file
cat > /tmp/test.json << 'EOF'
{"text":"こんにちは","key":"value"}
EOF

curl -X POST https://yourservice.selfmind.dev/endpoint \
  -H 'Content-Type: application/json' \
  -d @/tmp/test.json
```

If this works, the issue is with your client's terminal encoding, not the service.

---

## Service Examples

### Example 1: Edge-TTS (Docker Container)

**Service Details:**
- Container: `edge-tts`
- Port: `8090`
- Endpoints: `/health`, `/speak`

**Caddy Configuration:**
```caddyfile
:80 {
    @tts host tts.selfmind.dev
    handle @tts {
        reverse_proxy 172.19.0.1:8090 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

**DNS Record:**
- Name: `tts`
- Target: `c325864b-4c4c-4e02-a77e-d90c01873020.cfargotunnel.com`

**Public Endpoint:** `https://tts.selfmind.dev`

**Usage from Moshimoshi:**
```typescript
const synthesize = async (text: string) => {
  const response = await fetch('https://tts.selfmind.dev/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      voice: 'ja-JP-NanamiNeural'
    })
  });

  const audioBlob = await response.blob();
  return URL.createObjectURL(audioBlob);
};
```

### Example 2: Transcript Service (Systemd Service)

**Service Details:**
- Service: `transcript-service` (systemd)
- Port: `5000`
- Technology: Gunicorn + Flask

**Caddy Configuration:**
```caddyfile
:80 {
    @transcript host transcript.selfmind.dev
    handle @transcript {
        reverse_proxy 172.19.0.1:5000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

**Public Endpoint:** `https://transcript.selfmind.dev`

### Example 3: NHK Easy API (Docker Container)

**Service Details:**
- Container: Running on port `30004`
- Type: News scraping API

**Caddy Configuration:**
```caddyfile
:80 {
    @nhk host nhk.selfmind.dev
    handle @nhk {
        reverse_proxy 172.19.0.1:30004 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

**Public Endpoint:** `https://nhk.selfmind.dev`

---

## Important Patterns & Anti-Patterns

### ✅ Correct Patterns

#### 1. Use :80 Section Matchers Only
```caddyfile
:80 {
    @service host service.selfmind.dev
    handle @service {
        reverse_proxy 172.19.0.1:PORT { }
    }
}
```

#### 2. Always Backup Before Changes
```bash
cp caddy/Caddyfile caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
```

#### 3. Validate Before Reload
```bash
docker exec ai-gateway-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile
```

#### 4. Test Internal Routing First
```bash
# Test direct
curl http://localhost:PORT/health

# Test through Caddy
curl -H 'Host: service.selfmind.dev' http://localhost:80/health

# Then test HTTPS
curl https://service.selfmind.dev/health
```

#### 5. Use Cloudflare Proxied DNS
Always enable the orange cloud (Proxied) in Cloudflare DNS for:
- DDoS protection
- SSL/TLS termination
- Caching
- Analytics

### ❌ Anti-Patterns

#### 1. DON'T Add Standalone Blocks for Cloudflare Services
```caddyfile
# ❌ WRONG - Causes 308 redirect loop
service.selfmind.dev {
    reverse_proxy 172.19.0.1:PORT { }
}
```

Why: Standalone blocks trigger automatic HTTPS redirect. Cloudflare Tunnel sends HTTP traffic to port 80, creating a redirect loop.

#### 2. DON'T Modify Cloudflare Tunnel Config
The wildcard configuration already handles all subdomains:
```yaml
# ✅ Existing config (don't touch)
ingress:
  - hostname: "*.selfmind.dev"
    service: http://localhost:80
```

No need to add individual hostname entries.

#### 3. DON'T Use Direct IP Addresses in DNS
```
# ❌ WRONG
Type: A
Name: service
Target: 93.44.82.233 (your public IP)
```

Why: Your IP can change, and you lose Cloudflare protection.

```
# ✅ CORRECT
Type: CNAME
Name: service
Target: c325864b-4c4c-4e02-a77e-d90c01873020.cfargotunnel.com
```

#### 4. DON'T Restart Caddy Without Validating
```bash
# ❌ WRONG
docker compose restart caddy  # May fail to start with bad config

# ✅ CORRECT
docker exec ai-gateway-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile
```

#### 5. DON'T Forget to Test End-to-End
Always test from Moshimoshi's perspective:
```bash
# From your development machine
curl https://service.selfmind.dev/health
```

Not just internal testing on Sheldon.

---

## Quick Reference Commands

### Service Management
```bash
# Check Docker container
docker ps | grep SERVICE_NAME
docker logs --tail 50 SERVICE_NAME
docker restart SERVICE_NAME

# Check systemd service
systemctl status SERVICE_NAME
sudo systemctl restart SERVICE_NAME
journalctl -u SERVICE_NAME -f
```

### Caddy Management
```bash
# Validate configuration
docker exec ai-gateway-caddy caddy validate --config /etc/caddy/Caddyfile

# Reload (graceful, no downtime)
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile

# View logs
docker logs --tail 100 ai-gateway-caddy

# Check if Caddy is running
docker ps | grep caddy
```

### Cloudflare Tunnel
```bash
# Check tunnel status
systemctl status cloudflared

# Restart tunnel (requires sudo)
echo 'beano' | sudo -S systemctl restart cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f
```

### Network Testing
```bash
# Test service directly
curl http://localhost:PORT/health

# Test through Caddy (internal)
curl -H 'Host: service.selfmind.dev' http://localhost:80/health

# Test through HTTPS (external)
curl https://service.selfmind.dev/health

# Test from Caddy container to service
docker exec ai-gateway-caddy wget -qO- http://172.19.0.1:PORT/health
```

### DNS Testing
```bash
# Check DNS resolution
nslookup service.selfmind.dev

# Check with specific DNS server
nslookup service.selfmind.dev 1.1.1.1

# Trace DNS path
dig service.selfmind.dev +trace
```

---

## Deployment Checklist

Use this checklist for each new service:

- [ ] **Service is running** (verified with direct curl)
- [ ] **Port is accessible from Caddy container** (tested with docker exec)
- [ ] **Caddyfile backed up** (timestamped backup created)
- [ ] **:80 section updated** (matcher and handler added)
- [ ] **NO standalone block added** (critical - causes redirect loop)
- [ ] **Caddyfile validated** (caddy validate command passed)
- [ ] **Caddy reloaded** (caddy reload command passed)
- [ ] **Internal routing tested** (curl with Host header works)
- [ ] **DNS record created** (CNAME pointing to tunnel)
- [ ] **DNS propagated** (nslookup returns Cloudflare IPs)
- [ ] **HTTPS health check works** (curl https://service.selfmind.dev/health)
- [ ] **Functional endpoint tested** (POST/GET with actual data)
- [ ] **Tested from Moshimoshi** (dev environment verified)
- [ ] **Documentation updated** (CLAUDE.md on Sheldon updated)

---

## Cost Analysis

### Traditional Approach (ElevenLabs Example)
- Service: ElevenLabs TTS
- Pricing: $0.30/1K characters (Turbo v2.5)
- Moshimoshi Usage Estimate: 550K characters/month
- Monthly Cost: **$165**
- Annual Cost: **$1,980**

### Sheldon Self-Hosted Approach
- Service: Edge-TTS (Microsoft)
- Infrastructure: Already paid for (Sheldon server)
- API Cost: **$0** (free Microsoft service)
- Bandwidth: Included in Cloudflare free tier
- **Annual Savings: $1,980**

### Additional Benefits
- ✅ Full control over infrastructure
- ✅ No rate limits (within reason)
- ✅ Data privacy (never leaves your infrastructure)
- ✅ Low latency (direct connection)
- ✅ Can deploy unlimited services using same pattern

---

## Future Service Deployment

When deploying additional services, simply follow the same pattern:

1. Deploy service on Sheldon (Docker or systemd)
2. Add `:80` section matcher in Caddyfile
3. Create CNAME DNS record in Cloudflare
4. Test end-to-end

**No Cloudflare Tunnel config changes needed** - wildcard routing handles everything!

---

## Support & Maintenance

### Documentation Locations
- **This Guide**: `moshimoshi/docs/SHELDON_SERVICE_DEPLOYMENT_GUIDE.md`
- **Sheldon Context**: `/home/sheldon/ai-gateway/CLAUDE.md`
- **Sheldon Deployment Guide**: `/home/sheldon/ai-gateway/DEPLOY_NEW_APP.md`

### Key Files to Monitor
- `/home/sheldon/ai-gateway/caddy/Caddyfile` - Reverse proxy config
- `/home/sheldon/.cloudflared/config.yml` - Tunnel config
- `/home/sheldon/ai-gateway/docker-compose.yml` - Container definitions

### Regular Maintenance
- Backup Caddyfile before any changes
- Monitor Caddy logs for errors: `docker logs ai-gateway-caddy`
- Check Cloudflare Analytics for traffic patterns
- Verify SSL certificates are auto-renewing (Cloudflare handles this)

---

## Success Metrics

A successful deployment means:
- ✅ Health endpoint returns 200 OK with expected response
- ✅ Functional endpoints work as expected
- ✅ No 308 redirects or redirect loops
- ✅ Service logs show incoming requests
- ✅ Moshimoshi can access service without CORS issues
- ✅ Latency is acceptable (<500ms for most requests)
- ✅ No errors in Caddy or service logs

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Author**: Claude Code (Moshimoshi AI Assistant)
**Maintained By**: Future agents working on Moshimoshi ↔ Sheldon integration

---

## Appendix: Edge-TTS Deployment (Complete Example)

This section documents the actual deployment of Edge-TTS service that was completed on 2025-11-12.

### Service Setup
```bash
# Service was already running via docker-compose
cd /home/sheldon/ai-gateway
docker ps | grep edge-tts
# Output: edge-tts running on 0.0.0.0:8090->8090/tcp (healthy)
```

### Caddy Configuration Applied
```bash
# Backed up Caddyfile
cp caddy/Caddyfile caddy/Caddyfile.backup-20251112-182732

# Added to :80 section
cat >> caddy/Caddyfile << 'EOF'
    # Edge-TTS Service
    @tts host tts.selfmind.dev
    handle @tts {
        reverse_proxy 172.19.0.1:8090 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
EOF

# Validated and reloaded
docker exec ai-gateway-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec ai-gateway-caddy caddy reload --config /etc/caddy/Caddyfile
```

### DNS Configuration
- **Type**: CNAME
- **Name**: tts
- **Target**: c325864b-4c4c-4e02-a77e-d90c01873020.cfargotunnel.com
- **Proxy**: Enabled (orange cloud)

### Testing Results
```bash
# Health check
curl https://tts.selfmind.dev/health
# Response: {"status":"healthy","service":"edge-tts"}

# Synthesis test (Japanese)
curl -X POST https://tts.selfmind.dev/speak \
  -H 'Content-Type: application/json' \
  -d '{"text":"こんにちは世界","voice":"ja-JP-NanamiNeural"}' \
  --output test.mp3
# Result: 13KB MP3 file generated successfully
```

### Lessons Learned
1. **Standalone block issue**: Initially added both standalone `tts.selfmind.dev {}` block and `:80` matcher. The standalone block caused 308 redirects. Removing it fixed the issue.
2. **UTF-8 encoding**: Windows terminal had issues with Japanese characters in curl. Testing from Sheldon with proper UTF-8 file confirmed service works correctly.
3. **Container restart helped**: Restarting the Edge-TTS container cleared any stale state.
4. **Validation is critical**: Always validate Caddyfile before reload to avoid downtime.

This deployment is now serving Moshimoshi with **$0 cost** Japanese TTS at `https://tts.selfmind.dev`.
