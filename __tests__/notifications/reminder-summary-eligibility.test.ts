import { describe, expect, it } from '@jest/globals'
import {
  computeEligibleFeaturesForUser,
  getFeatureForPath,
} from '@/lib/notifications/reminder-summary/eligibility'

describe('Reminder summary eligibility', () => {
  it('maps known paths to feature buckets', () => {
    expect(getFeatureForPath('/learn/hiragana')?.key).toBe('kana')
    expect(getFeatureForPath('/en/tools/kanji-mastery/practice')?.key).toBe('kanji_mastery')
    expect(getFeatureForPath('/review/session')?.key).toBe('flashcards_srs')
    expect(getFeatureForPath('/unknown/path')).toBeNull()
  })

  it('marks feature eligible when used yesterday but not today in user timezone', () => {
    const now = new Date('2026-02-12T18:00:00.000Z')
    const result = computeEligibleFeaturesForUser({
      now,
      timezone: 'Asia/Tokyo',
      visits: [
        {
          userId: 'u1',
          path: '/learn/hiragana',
          startedAt: new Date('2026-02-12T03:00:00.000Z'),
        },
      ],
      preferences: {},
    })

    expect(result.features).toHaveLength(1)
    expect(result.features[0].featureKey).toBe('kana')
  })

  it('excludes feature when user also used the same feature today', () => {
    const now = new Date('2026-02-12T18:00:00.000Z')
    const result = computeEligibleFeaturesForUser({
      now,
      timezone: 'UTC',
      visits: [
        {
          userId: 'u1',
          path: '/review',
          startedAt: new Date('2026-02-11T08:00:00.000Z'),
        },
        {
          userId: 'u1',
          path: '/review',
          startedAt: new Date('2026-02-12T01:00:00.000Z'),
        },
      ],
      preferences: {},
    })

    expect(result.features).toHaveLength(0)
  })

  it('respects global and per-feature toggles', () => {
    const now = new Date('2026-02-12T18:00:00.000Z')
    const result = computeEligibleFeaturesForUser({
      now,
      timezone: 'UTC',
      visits: [
        {
          userId: 'u1',
          path: '/stories/abc',
          startedAt: new Date('2026-02-11T09:00:00.000Z'),
        },
      ],
      preferences: {
        feature_reminders: {
          enabled: true,
          features: {
            stories: false,
          },
        },
      },
    })

    expect(result.features).toHaveLength(0)
  })

  it('uses the most recent yesterday path as feature URL when available', () => {
    const now = new Date('2026-02-12T18:00:00.000Z')
    const result = computeEligibleFeaturesForUser({
      now,
      timezone: 'UTC',
      visits: [
        {
          userId: 'u1',
          path: '/stories/older-story',
          startedAt: new Date('2026-02-11T09:00:00.000Z'),
        },
        {
          userId: 'u1',
          path: '/stories/newer-story',
          startedAt: new Date('2026-02-11T10:00:00.000Z'),
        },
      ],
      preferences: {},
    })

    expect(result.features).toHaveLength(1)
    expect(result.features[0].featureKey).toBe('stories')
    expect(result.features[0].featureUrl).toBe('/stories/newer-story')
  })
})
