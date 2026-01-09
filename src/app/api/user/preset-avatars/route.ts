// Preset avatars API endpoint
// Returns list of available preset profile images

import { NextRequest, NextResponse } from 'next/server'
import { getSecurityHeaders } from '@/lib/auth/validation'
import fs from 'fs'
import path from 'path'

// Cache the avatar list to avoid repeated file system reads
let cachedAvatars: string[] | null = null

export async function GET(request: NextRequest) {
  try {
    // Return cached avatars if available
    if (cachedAvatars) {
      return NextResponse.json(
        {
          success: true,
          avatars: cachedAvatars,
        },
        {
          status: 200,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Read preset avatar directories
    const publicDir = path.join(process.cwd(), 'public', 'usr_profile')
    const collections = fs.readdirSync(publicDir)

    const avatars: string[] = []

    // Iterate through each collection
    for (const collection of collections) {
      const svgDir = path.join(publicDir, collection, 'svg')

      // Check if svg directory exists
      if (fs.existsSync(svgDir)) {
        const files = fs.readdirSync(svgDir)

        // Add all SVG files with their public path
        files
          .filter(file => file.endsWith('.svg'))
          .forEach(file => {
            avatars.push(`/usr_profile/${collection}/svg/${file}`)
          })
      }
    }

    // Sort alphabetically for consistent ordering
    avatars.sort()

    // Cache the results
    cachedAvatars = avatars

    console.log(`[API /user/preset-avatars] Found ${avatars.length} preset avatars`)

    return NextResponse.json(
      {
        success: true,
        avatars,
      },
      {
        status: 200,
        headers: getSecurityHeaders(),
      }
    )

  } catch (error: any) {
    console.error('[API /user/preset-avatars] Error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch preset avatars',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}
