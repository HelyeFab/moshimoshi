import fs from 'fs'
import path from 'path'
import { z } from 'zod'

const CONFIG_PATH = path.join(
  process.cwd(),
  'src',
  'config',
  'gamification',
  'streak.json'
)

export const streakConfigSchema = z
  .object({
    version: z.string(),
    minXPForStreak: z.number().nonnegative(),
    gracePeriodHours: z.number().nonnegative(),
    resetTime: z.string(),
    timezone: z.string(),
    streakFreeze: z
      .object({
        enabled: z.boolean(),
        requiresPremium: z.boolean().optional(),
        maxFreezes: z.number().nonnegative(),
        freezeDurationDays: z.number().nonnegative(),
        description: z.string().optional()
      })
      .optional(),
    streakSave: z
      .object({
        enabled: z.boolean(),
        costMode: z.enum(['fixed', 'dynamic']),
        baseCost: z.number().nonnegative(),
        surgePricing: z.boolean(),
        surgeMultiplier: z.number().nonnegative(),
        maxSaveWindow: z.number().int().positive(),
        requiresPremium: z.boolean(),
        description: z.string().optional()
      })
      .optional(),
    notifications: z
      .object({
        enabled: z.boolean(),
        reminderHours: z.array(z.number().int().min(0).max(23)),
        description: z.string().optional()
      })
      .optional()
  })
  .strict()

export type StreakConfig = z.infer<typeof streakConfigSchema>

let cachedConfig: StreakConfig | null = null
let cachedMtimeMs: number | null = null

function loadConfigFromDisk(): { config: StreakConfig; mtimeMs: number } {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
  const parsed = streakConfigSchema.parse(JSON.parse(raw))
  const stats = fs.statSync(CONFIG_PATH)

  return {
    config: parsed,
    mtimeMs: stats.mtimeMs
  }
}

export function getStreakConfig(forceReload = false): StreakConfig {
  if (!cachedConfig || forceReload) {
    const { config, mtimeMs } = loadConfigFromDisk()
    cachedConfig = config
    cachedMtimeMs = mtimeMs
    return config
  }

  const stats = fs.statSync(CONFIG_PATH)
  if (cachedMtimeMs === null || stats.mtimeMs !== cachedMtimeMs) {
    const { config, mtimeMs } = loadConfigFromDisk()
    cachedConfig = config
    cachedMtimeMs = mtimeMs
  }

  return cachedConfig
}

export function writeStreakConfig(configInput: unknown): StreakConfig {
  const parsed = streakConfigSchema.parse(configInput)
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(parsed, null, 2), 'utf-8')
  const stats = fs.statSync(CONFIG_PATH)
  cachedConfig = parsed
  cachedMtimeMs = stats.mtimeMs
  return parsed
}

export function refreshStreakConfig(): StreakConfig {
  const { config, mtimeMs } = loadConfigFromDisk()
  cachedConfig = config
  cachedMtimeMs = mtimeMs
  return config
}

export function getStreakConfigPath(): string {
  return CONFIG_PATH
}
