import { NextResponse } from 'next/server'

export async function GET() {
  // Only show in development or for admin debugging
  const isDev = process.env.NODE_ENV === 'development'

  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID ? '✅ Set' : '❌ Missing',
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? '✅ Set' : '❌ Missing',
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? `✅ Set (${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length} chars)` : '❌ Missing',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Missing',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Missing',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
    SESSION_SECRET: process.env.SESSION_SECRET ? '✅ Set' : '❌ Missing',
  }

  if (isDev) {
    // In dev, show more details
    return NextResponse.json({
      ...envCheck,
      FIREBASE_ADMIN_PROJECT_ID_VALUE: process.env.FIREBASE_ADMIN_PROJECT_ID,
      FIREBASE_ADMIN_CLIENT_EMAIL_VALUE: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      PRIVATE_KEY_PREVIEW: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.substring(0, 50) + '...',
    })
  }

  return NextResponse.json(envCheck)
}