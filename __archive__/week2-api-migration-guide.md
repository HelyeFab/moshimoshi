# API Hardening Migration Guide - Week 2
## Agent 2: API Hardening Engineer

### Executive Summary

This guide provides step-by-step instructions for migrating existing API endpoints to use the new hardened API infrastructure implemented during Week 2 of the production hardening sprint.

### What's New

#### 1. Centralized Validation Schemas
- All API endpoints now have standardized Zod validation schemas
- Located in `/src/lib/api/validation-schemas.ts`
- Type-safe request validation with detailed error messages

#### 2. Standardized Error Handling
- Consistent error response format across all endpoints
- Centralized error handler in `/src/lib/api/error-handler.ts`
- Comprehensive error codes and structured error responses

#### 3. Advanced Rate Limiting
- Adaptive rate limiting with request fingerprinting
- Tier-based limits (guest, free, premium, admin)
- Suspicious behavior detection
- Located in `/src/lib/api/rate-limiter.ts`

#### 4. API Versioning
- Default version: `v1`
- Version can be specified via path, header, or query parameter
- Automatic version validation and deprecation warnings

#### 5. Enhanced Security
- Request fingerprinting for tracking
- Security headers automatically applied
- CORS configuration for API endpoints
- Input sanitization utilities

### Migration Steps

#### Step 1: Update Import Statements

Replace old imports with new centralized utilities:

```typescript
// Old
import { NextRequest, NextResponse } from 'next/server'

// New
import { NextRequest, NextResponse } from 'next/server'
import { validateRequestBody, validateSearchParams } from '@/lib/api/validation-schemas'
import { createErrorResponse, createSuccessResponse, Errors } from '@/lib/api/error-handler'
import { createRateLimiter, getRateLimitHeaders } from '@/lib/api/rate-limiter'
```

#### Step 2: Add Validation Schema

Define or use existing validation schema for your endpoint:

```typescript
// For existing schemas
import { userSchemas, ttsSchemas, adminSchemas } from '@/lib/api/validation-schemas'

// For custom schemas
const mySchema = z.object({
  field1: z.string().min(1),
  field2: z.number().optional(),
})
```

#### Step 3: Implement Rate Limiting

Add rate limiting at the beginning of your handler:

```typescript
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimiter = createRateLimiter('category', 'endpoint')
  const rateLimitResult = await rateLimiter.check(request, {
    tier: 'free', // optional: based on user tier
    cost: 1,      // optional: request cost multiplier
  })
  
  if (!rateLimitResult.success) {
    return createErrorResponse(
      Errors.rateLimit(rateLimitResult.retryAfter),
      { endpoint: '/api/your/endpoint', method: 'POST' }
    )
  }
  
  // ... rest of handler
}
```

#### Step 4: Validate Request Data

Replace manual validation with schema validation:

```typescript
// Old
const body = await request.json()
if (!body.field1) {
  return NextResponse.json({ error: 'Missing field1' }, { status: 400 })
}

// New
const { data, error } = await validateRequestBody(request, mySchema)
if (error) {
  return createErrorResponse(error, {
    endpoint: '/api/your/endpoint',
    method: 'POST',
  })
}
```

#### Step 5: Standardize Error Responses

Replace custom error responses with standardized ones:

```typescript
// Old
return NextResponse.json(
  { error: 'Not found' },
  { status: 404 }
)

// New
return createErrorResponse(
  Errors.notFound('Resource'),
  { endpoint: '/api/your/endpoint', method: 'GET' }
)
```

#### Step 6: Standardize Success Responses

Use consistent success response format:

```typescript
// Old
return NextResponse.json({ data: result })

// New
const response = createSuccessResponse(result, {
  message: 'Operation successful',
  count: result.length,
})

// Add rate limit headers
const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)
Object.entries(rateLimitHeaders).forEach(([key, value]) => {
  response.headers.set(key, value)
})

return response
```

### Complete Migration Example

#### Before Migration

```typescript
// src/app/api/example/route.ts (OLD)
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.text || body.text.length > 1000) {
      return NextResponse.json(
        { error: 'Invalid text' },
        { status: 400 }
      )
    }
    
    const result = await processText(body.text)
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
```

#### After Migration

```typescript
// src/app/api/example/route.ts (NEW)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { validateRequestBody } from '@/lib/api/validation-schemas'
import { createErrorResponse, createSuccessResponse, Errors } from '@/lib/api/error-handler'
import { createRateLimiter, getRateLimitHeaders } from '@/lib/api/rate-limiter'

// Define validation schema
const processTextSchema = z.object({
  text: z.string().min(1).max(1000),
  options: z.object({
    format: z.enum(['plain', 'html']).optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const rateLimiter = createRateLimiter('example', 'process')
  const rateLimitResult = await rateLimiter.check(request)
  
  if (!rateLimitResult.success) {
    return createErrorResponse(
      Errors.rateLimit(rateLimitResult.retryAfter),
      { endpoint: '/api/example', method: 'POST' }
    )
  }
  
  try {
    // 2. Validate request
    const { data, error } = await validateRequestBody(
      request,
      processTextSchema
    )
    
    if (error) {
      return createErrorResponse(error, {
        endpoint: '/api/example',
        method: 'POST',
      })
    }
    
    // 3. Process request
    const result = await processText(data!.text, data!.options)
    
    // 4. Return success response with headers
    const response = createSuccessResponse(result, {
      message: 'Text processed successfully',
    })
    
    // 5. Add rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
  } catch (error) {
    // 6. Handle errors consistently
    return createErrorResponse(error, {
      endpoint: '/api/example',
      method: 'POST',
    })
  }
}
```

### API Versioning Usage

#### Specifying API Version

Clients can specify the API version in three ways:

1. **Path-based** (Recommended):
   ```
   GET /api/v1/user/profile
   ```

2. **Header-based**:
   ```
   GET /api/user/profile
   X-API-Version: v1
   ```

3. **Query parameter**:
   ```
   GET /api/user/profile?api_version=v1
   ```

#### Version Response Headers

All API responses include version information:
```
X-API-Version: v1
X-API-Deprecation: true (if deprecated)
X-API-Deprecation-Date: 2024-06-01 (if set)
```

### Rate Limiting Configuration

#### Rate Limit Tiers

- **Guest**: 1x base limit
- **Free**: 2x base limit
- **Premium**: 5x base limit
- **Admin**: 10x base limit

#### Endpoint Categories

```typescript
// Authentication: Strict limits
auth.signin: 5 requests / 15 minutes
auth.signup: 3 requests / hour

// User: Moderate limits
user.profile: 30 requests / minute
user.updateProfile: 10 requests / 5 minutes

// Review: Generous limits
review.queue: 60 requests / minute
review.answer: 300 requests / minute

// TTS: Resource-intensive
tts.synthesize: 30 requests / minute (cost: 2)
tts.batch: 5 requests / minute (cost: 10)
```

### Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}, // Optional additional details
    "timestamp": "2024-01-20T12:00:00Z",
    "requestId": "req_1234567890_abc"
  }
}
```

### Success Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": {}, // The actual response data
  "meta": {   // Optional metadata
    "message": "Operation successful",
    "count": 10,
    "cached": false
  },
  "timestamp": "2024-01-20T12:00:00Z"
}
```

### Testing the Migration

#### 1. Validation Testing

```bash
# Test missing required field
curl -X POST http://localhost:3000/api/v1/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 with validation error details
```

#### 2. Rate Limiting Testing

```bash
# Send multiple requests quickly
for i in {1..35}; do
  curl -X GET http://localhost:3000/api/v1/user/profile &
done

# Expected: 429 Too Many Requests after limit
```

#### 3. Version Testing

```bash
# Test with version header
curl -X GET http://localhost:3000/api/user/profile \
  -H "X-API-Version: v1"

# Test with unsupported version
curl -X GET http://localhost:3000/api/v99/user/profile
# Expected: 400 Invalid API version
```

### Rollback Plan

If issues arise during migration:

1. **Partial Rollback**: Keep new utilities but revert individual endpoint changes
2. **Full Rollback**: 
   - Revert middleware.ts changes
   - Revert individual endpoint changes
   - Keep new utility files for future use

### Monitoring & Alerts

After migration, monitor:

1. **Error Rates**: Check for increased 4xx/5xx responses
2. **Rate Limit Hits**: Monitor 429 responses
3. **Performance**: Check response times
4. **Validation Failures**: Track validation error patterns

### Support & Resources

- **Documentation**: `/week2-api-audit.md`
- **Example Implementation**: `/src/app/api/tts/synthesize/route.ts`
- **Utility Files**:
  - `/src/lib/api/validation-schemas.ts`
  - `/src/lib/api/error-handler.ts`
  - `/src/lib/api/rate-limiter.ts`

### Timeline

- **Day 1-2**: Core infrastructure implementation ✅
- **Day 3**: Rate limiting and security ✅
- **Day 4**: Testing and refinement ✅
- **Day 5**: Documentation and migration guide ✅

### Next Steps

1. Migrate remaining endpoints to new system
2. Update client SDK to handle new response format
3. Configure monitoring dashboards
4. Train support team on new error codes
5. Plan deprecation of old response formats

### Success Metrics

Post-migration targets:
- API error rate < 0.1%
- Rate limit effectiveness > 99%
- Validation coverage = 100%
- Response time < 100ms (p95)
- Zero security vulnerabilities