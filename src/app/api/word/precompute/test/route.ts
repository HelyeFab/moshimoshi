import { NextResponse } from 'next/server'
import { adminFirestore } from '@/lib/firebase/admin'

export const runtime = 'nodejs'

/**
 * Test endpoint to diagnose word precompute issues
 * GET /api/word/precompute/test
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: []
  }

  try {
    // Check 1: Firebase Admin
    diagnostics.checks.firebaseAdmin = !!adminFirestore
    if (!adminFirestore) {
      diagnostics.errors.push('Firebase Admin Firestore not initialized')
    }

    // Check 2: Kuromoji dictionary
    const fs = require('fs')
    const path = require('path')
    const dictPath = path.join(process.cwd(), 'node_modules/kuromoji/dict')
    const dictExists = fs.existsSync(dictPath)
    diagnostics.checks.kuromojiDict = dictExists
    if (!dictExists) {
      diagnostics.errors.push(`Kuromoji dictionary not found at: ${dictPath}`)
    } else {
      const files = fs.readdirSync(dictPath)
      diagnostics.checks.kuromojiDictFiles = files.length
    }

    // Check 3: Environment variables
    diagnostics.checks.env = {
      FIREBASE_ADMIN_PROJECT_ID: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
      FIREBASE_ADMIN_CLIENT_EMAIL: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      FIREBASE_ADMIN_PRIVATE_KEY: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GOOGLE_AI_API_KEY: !!process.env.GOOGLE_AI_API_KEY,
    }

    // Check 4: Test kuromoji tokenizer
    try {
      const kuromoji = require('kuromoji')
      const tokenizerPath = path.join(process.cwd(), 'node_modules/kuromoji/dict')

      await new Promise((resolve, reject) => {
        kuromoji
          .builder({ dicPath: tokenizerPath })
          .build((err: any, tokenizer: any) => {
            if (err || !tokenizer) {
              diagnostics.checks.kuromojiTokenizer = false
              diagnostics.errors.push('Kuromoji tokenizer build failed: ' + (err?.message || 'Unknown error'))
              reject(err)
            } else {
              // Test tokenization
              const tokens = tokenizer.tokenize('こんにちは')
              diagnostics.checks.kuromojiTokenizer = true
              diagnostics.checks.kuromojiTokenCount = tokens.length
              resolve(true)
            }
          })
      })
    } catch (error) {
      diagnostics.checks.kuromojiTokenizer = false
      diagnostics.errors.push('Kuromoji test failed: ' + (error instanceof Error ? error.message : String(error)))
    }

    // Overall health
    diagnostics.healthy = diagnostics.errors.length === 0

    return NextResponse.json(diagnostics, {
      status: diagnostics.healthy ? 200 : 500
    })

  } catch (error) {
    diagnostics.errors.push('Unexpected error: ' + (error instanceof Error ? error.message : String(error)))
    diagnostics.healthy = false

    return NextResponse.json(diagnostics, { status: 500 })
  }
}
