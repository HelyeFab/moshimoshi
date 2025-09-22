import { NextRequest, NextResponse } from 'next/server';
import { ttsService } from '@/lib/tts/service';
import { validateSession } from '@/lib/auth/session';
import { ttsSchemas, validateRequestBody } from '@/lib/api/validation-schemas';
import { createErrorResponse, createSuccessResponse, Errors } from '@/lib/api/error-handler';
import { createRateLimiter, getRateLimitHeaders } from '@/lib/api/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for TTS endpoint
    const rateLimiter = createRateLimiter('tts', 'synthesize');
    const rateLimitResult = await rateLimiter.check(request, {
      cost: 2, // TTS is resource-intensive
    });
    
    if (!rateLimitResult.success) {
      return createErrorResponse(
        Errors.rateLimit(rateLimitResult.retryAfter),
        {
          endpoint: '/api/tts/synthesize',
          method: 'POST',
        }
      );
    }

    // Optional: Check session if you want to restrict TTS to logged-in users
    // const session = await validateSession(request);
    // if (!session) {
    //   return createErrorResponse(
    //     Errors.unauthorized('Authentication required for TTS'),
    //     {
    //       endpoint: '/api/tts/synthesize',
    //       method: 'POST',
    //     }
    //   );
    // }

    // Validate request body
    const { data, error } = await validateRequestBody(
      request,
      ttsSchemas.synthesize
    );
    
    if (error) {
      return createErrorResponse(error, {
        endpoint: '/api/tts/synthesize',
        method: 'POST',
      });
    }

    // Synthesize or get from cache
    const result = await ttsService.synthesize(data!.text, {
      voice: data!.voice,
      speed: data!.speed,
      pitch: data!.pitch,
    });

    // Create success response with rate limit headers
    const response = createSuccessResponse(result, {
      cached: result.cached,
      provider: result.provider,
    });
    
    // Add rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  } catch (error: any) {
    console.error('TTS synthesis error:', error);
    
    // Handle TTS service specific errors
    if (error.code === 'TTS_PROVIDER_ERROR') {
      return createErrorResponse(
        new Error('TTS service temporarily unavailable'),
        {
          endpoint: '/api/tts/synthesize',
          method: 'POST',
        }
      );
    }
    
    // Generic error handling
    return createErrorResponse(error, {
      endpoint: '/api/tts/synthesize',
      method: 'POST',
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}