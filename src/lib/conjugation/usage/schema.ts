import { z } from 'zod'

export const UsageRegisterSchema = z.enum([
  'neutral',
  'casual',
  'polite',
  'written',
  'spoken',
  'mixed',
])

export const UsageAudienceLevelSchema = z.enum(['beginner', 'intermediate'])

export const ConjugationUsageNoteSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(220),
  useCases: z.array(z.string().min(1).max(120)).min(1).max(4),
  nuance: z.string().min(1).max(220).optional(),
  register: UsageRegisterSchema.optional(),
  level: UsageAudienceLevelSchema.optional(),
  aliases: z.array(z.string().min(1).max(60)).max(5).optional(),
  reviewed: z.boolean(),
  version: z.number().int().positive(),
})

export const ConjugationUsageByTypeSchema = z.object({
  default: ConjugationUsageNoteSchema,
  overrides: z
    .object({
      Ichidan: ConjugationUsageNoteSchema.optional(),
      Godan: ConjugationUsageNoteSchema.optional(),
      Irregular: ConjugationUsageNoteSchema.optional(),
      'i-adjective': ConjugationUsageNoteSchema.optional(),
      'na-adjective': ConjugationUsageNoteSchema.optional(),
    })
    .optional(),
})

export type ConjugationUsageNote = z.infer<typeof ConjugationUsageNoteSchema>
export type ConjugationUsageByType = z.infer<typeof ConjugationUsageByTypeSchema>

