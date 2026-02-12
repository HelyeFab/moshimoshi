import { NextRequest, NextResponse } from 'next/server'
import { runReminderSummaryDailyJob } from '@/lib/notifications/reminder-summary/job'

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

function parseMaxUsers(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.floor(parsed)
}

function parseDryRun(value: string | null): boolean {
  return value === '1' || value === 'true'
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dryRun = parseDryRun(searchParams.get('dryRun'))
    const maxUsers = parseMaxUsers(searchParams.get('maxUsers'))

    const result = await runReminderSummaryDailyJob({ dryRun, maxUsers })
    return NextResponse.json({
      success: true,
      dryRun,
      result,
    })
  } catch (error) {
    console.error('[Reminder Summary Job] GET failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean; maxUsers?: number }
    const dryRun = body.dryRun === true
    const maxUsers =
      typeof body.maxUsers === 'number' && Number.isFinite(body.maxUsers) && body.maxUsers > 0
        ? Math.floor(body.maxUsers)
        : undefined

    const result = await runReminderSummaryDailyJob({ dryRun, maxUsers })
    return NextResponse.json({
      success: true,
      dryRun,
      result,
    })
  } catch (error) {
    console.error('[Reminder Summary Job] POST failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
