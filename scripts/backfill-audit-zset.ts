import { redis } from '../src/lib/redis/client'

const DAYS_DEFAULT = 30
const args = process.argv.slice(2)
const daysArgIndex = args.findIndex((arg) => arg === '--days')
const days = daysArgIndex !== -1 ? Number(args[daysArgIndex + 1]) : DAYS_DEFAULT

if (!Number.isFinite(days) || days <= 0) {
  console.error('Usage: tsx scripts/backfill-audit-zset.ts --days 30')
  process.exit(1)
}

async function backfillForDate(dateKey: string) {
  const dailyHashKey = `audit_daily:${dateKey}`
  const dailyZsetKey = `audit_daily_zset:${dateKey}`

  const hashType = await redis.type(dailyHashKey)
  if (hashType !== 'hash') return { dateKey, added: 0 }

  const idToKeyMap = await redis.hgetall(dailyHashKey)
  const keys = Object.values(idToKeyMap || {}) as string[]
  if (keys.length === 0) return { dateKey, added: 0 }

  let added = 0
  for (const key of keys) {
    const logData = await redis.get(key)
    if (!logData) continue
    const log = JSON.parse(logData as string)
    const score = new Date(log.timestamp).getTime()
    if (!Number.isFinite(score)) continue
    await redis.zadd(dailyZsetKey, score, key)
    added++
  }

  if (added > 0) {
    await redis.expire(dailyZsetKey, 2592000)
  }

  return { dateKey, added }
}

async function main() {
  const now = new Date()
  const results: Array<{ dateKey: string; added: number }> = []

  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setUTCDate(now.getUTCDate() - i)
    const dateKey = date.toISOString().slice(0, 10)
    results.push(await backfillForDate(dateKey))
  }

  const total = results.reduce((sum, item) => sum + item.added, 0)
  console.log(`Backfill complete. Days processed: ${results.length}. Entries added: ${total}.`)
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
