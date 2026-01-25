import { kanjiService } from '@/services/kanjiService'
import type { Kanji } from '@/types/kanji'

describe('kanjiService.loadKanjiByGrade', () => {
  beforeEach(() => {
    const cache = (kanjiService as any).gradeCache
    if (cache?.clear) {
      cache.clear()
    }
  })

  it('returns secondary grade (S) kanji when requested', async () => {
    const n5: Kanji[] = [
      {
        kanji: '人',
        meaning: 'person',
        meanings: ['person'],
        onyomi: [],
        kunyomi: [],
        jlpt: 'N5',
        strokeCount: 2,
        grade: 1
      }
    ]
    const n4: Kanji[] = [
      {
        kanji: '鋳',
        meaning: 'cast',
        meanings: ['cast'],
        onyomi: [],
        kunyomi: [],
        jlpt: 'N4',
        strokeCount: 15,
        grade: 'S'
      }
    ]

    const spy = jest.spyOn(kanjiService, 'loadAllKanji').mockResolvedValue({
      N5: n5,
      N4: n4,
    })

    const result = await kanjiService.loadKanjiByGrade('S')

    expect(result).toHaveLength(1)
    expect(result[0].kanji).toBe('鋳')

    spy.mockRestore()
  })
})
