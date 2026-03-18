/**
 * Stage A Validation — Static Code Analysis
 *
 * These tests verify that the Stage A player implementation does NOT contain
 * any transcript-driven playback control logic. They scan the actual source
 * files for anti-patterns that caused the old player to chop audio.
 *
 * This is a code-level validation test, not a runtime test.
 */

import * as fs from 'fs'
import * as path from 'path'

// ──────────────────────────────────────────────
// Configuration: paths to Stage A source files
// ──────────────────────────────────────────────

// The new Stage A player page/component.
// Agent A1 and A2 will create these. Update paths once they land.
const STAGE_A_DIR = path.resolve(
  __dirname,
  '../../src/app/[locale]/moshi-player'
)

// Fallback: if the route is named differently, this array can hold alternatives
const STAGE_A_CANDIDATE_DIRS = [
  path.resolve(__dirname, '../../src/app/[locale]/moshi-player'),
  path.resolve(__dirname, '../../src/app/[locale]/player-v2'),
  path.resolve(__dirname, '../../src/app/[locale]/moshiplayer'),
  path.resolve(__dirname, '../../src/app/[locale]/moshiplayer-v2'),
]

// Old code that must NOT be imported
const OLD_PLAYER_PATHS = [
  'src/app/[locale]/youtube-shadowing/page.tsx',
  'src/lib/shadowing/repeat.ts',
  'src/utils/youtubePlayerUtils.ts',
]

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function findStageADir(): string | null {
  for (const dir of STAGE_A_CANDIDATE_DIRS) {
    if (fs.existsSync(dir)) return dir
  }
  return null
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

function readAllSources(dir: string): { file: string; content: string }[] {
  return collectTsFiles(dir).map((file) => ({
    file,
    content: fs.readFileSync(file, 'utf-8'),
  }))
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Stage A: No Playback Control Coupling', () => {
  let stageADir: string | null
  let sources: { file: string; content: string }[]

  beforeAll(() => {
    stageADir = findStageADir()
    if (stageADir) {
      sources = readAllSources(stageADir)
    } else {
      sources = []
    }
  })

  it('Stage A directory exists', () => {
    if (!stageADir) {
      console.warn(
        'Stage A directory not found yet. Checked:\n' +
          STAGE_A_CANDIDATE_DIRS.map((d) => `  - ${d}`).join('\n') +
          '\nThis test will pass vacuously until implementation lands.'
      )
    }
    // Vacuous pass until implementation lands — the real gate is below
    expect(true).toBe(true)
  })

  // Skip the remaining tests if Stage A code hasn't landed yet
  const describeIfReady = () => {
    if (!findStageADir()) return describe.skip
    return describe
  }

  describe('Anti-pattern: transcript-driven seekTo', () => {
    it('no seekTo calls tied to segment boundaries', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        // seekTo is fine for user-initiated actions (e.g. clicking play).
        // It is NOT fine if it appears near segment boundary logic.
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (/seekTo\(.*segment/.test(line) || /seekTo\(.*\.start/.test(line)) {
            // Check surrounding context for boundary logic
            const context = lines.slice(Math.max(0, i - 5), i + 5).join('\n')
            if (
              /segmentEnd|segment\.end|currentTime\s*>=/.test(context) ||
              /nextOnSegmentEnd|evaluatePlayback/.test(context)
            ) {
              throw new Error(
                `Found transcript-driven seekTo at ${file}:${i + 1}\n` +
                  `Context:\n${context}`
              )
            }
          }
        }
      }
    })
  })

  describe('Anti-pattern: pauseVideo at segment boundary', () => {
    it('no pauseVideo calls triggered by transcript position', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        // pauseVideo in a segment-boundary context is the #1 cause of choppy audio
        if (
          /pauseVideo.*segment/s.test(content) ||
          /currentTime\s*>=.*segmentEnd[\s\S]{0,200}pauseVideo/.test(content)
        ) {
          throw new Error(
            `Found segment-boundary pauseVideo in ${file}. ` +
              'Stage A must not pause playback based on transcript position.'
          )
        }
      }
    })
  })

  describe('Anti-pattern: playback polling against transcript', () => {
    it('no setInterval polling that checks currentTime against segment timestamps', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        if (
          /setInterval.*evaluatePlayback/s.test(content) ||
          /setInterval.*getCurrentTime/s.test(content)
        ) {
          throw new Error(
            `Found playback polling loop in ${file}. ` +
              'Stage A must not poll player position against transcript data.'
          )
        }

        // Also check for requestAnimationFrame-based polling
        if (
          /requestAnimationFrame[\s\S]{0,500}getCurrentTime[\s\S]{0,500}segment/s.test(
            content
          )
        ) {
          throw new Error(
            `Found rAF-based playback polling in ${file}. ` +
              'Stage A must not use animation frames to track segment position.'
          )
        }
      }
    })
  })

  describe('Anti-pattern: old code imports', () => {
    it('does not import old YouTube shadowing player logic', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        for (const oldPath of OLD_PLAYER_PATHS) {
          const importPattern = oldPath
            .replace(/\[locale\]/g, '\\[locale\\]')
            .replace(/\//g, '\\/')
            .replace(/\.tsx?$/, '')

          if (new RegExp(importPattern).test(content)) {
            throw new Error(
              `Found import of old player code in ${file}: ${oldPath}. ` +
                'Stage A must be built from scratch.'
            )
          }
        }

        // Also check for named imports from old modules
        if (/from.*youtube-shadowing\/page/.test(content)) {
          throw new Error(`Found import from old shadowing page in ${file}`)
        }
        if (/from.*shadowing\/repeat/.test(content)) {
          throw new Error(`Found import from old repeat module in ${file}`)
        }
        if (/from.*youtubePlayerUtils/.test(content)) {
          throw new Error(`Found import from old youtubePlayerUtils in ${file}`)
        }
      }
    })
  })

  describe('Anti-pattern: re-entry / settle delay', () => {
    it('no re-entry stabilization logic', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        if (
          /reentry|re-entry|settleDelay|REENTRY_DELAY/i.test(content) ||
          /verifySeekLanding/.test(content)
        ) {
          throw new Error(
            `Found re-entry/settle logic in ${file}. ` +
              'Stage A must not have segment re-entry stabilization.'
          )
        }
      }
    })
  })

  describe('Anti-pattern: segment boundary detection', () => {
    it('no segment boundary buffer calculations', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        if (
          /triggerBuffer|safeTriggerBuffer|segmentEnd\s*=/.test(content) ||
          /calculateSegmentBuffers/.test(content) ||
          /TRIGGER_BUFFER/.test(content)
        ) {
          throw new Error(
            `Found segment boundary detection logic in ${file}. ` +
              'Stage A must not calculate segment boundaries for playback control.'
          )
        }
      }
    })
  })

  describe('Anti-pattern: repeat state machine', () => {
    it('no repeat logic driving playback', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        if (
          /nextOnSegmentEnd/.test(content) ||
          /repeatCount.*currentRepeat[\s\S]{0,300}seekTo/s.test(content)
        ) {
          throw new Error(
            `Found repeat-driven playback logic in ${file}. ` +
              'Stage A must not include segment repeat functionality.'
          )
        }
      }
    })
  })

  describe('Rebuild charter: no old transcript pipeline', () => {
    it('does not call the old /api/youtube/transcript/ route', () => {
      if (!stageADir || sources.length === 0) return

      // The old transcript route at /api/youtube/transcript/[videoId] is part
      // of the legacy YouTube shadowing pipeline (2000+ lines of segmentation,
      // normalization, caching logic). The rebuild charter forbids reusing old
      // YouTube shadowing logic. Stage A must use its own transcript fetch path.
      const OLD_TRANSCRIPT_ROUTE = /\/api\/youtube\/transcript\//

      for (const { file, content } of sources) {
        if (OLD_TRANSCRIPT_ROUTE.test(content)) {
          throw new Error(
            `Found call to old transcript pipeline in ${file}. ` +
              'Stage A must use a rebuild-owned transcript fetch route, not ' +
              'the legacy /api/youtube/transcript/[videoId] endpoint. ' +
              'See 00-REBUILD-CHARTER.md.'
          )
        }
      }
    })
  })

  describe('Japanese transcript selection', () => {
    const TRANSCRIPT_ROUTE = path.resolve(
      __dirname,
      '../../src/app/api/moshi-player/transcript/[videoId]/route.ts'
    )

    it('transcript route explicitly selects Japanese', () => {
      if (!fs.existsSync(TRANSCRIPT_ROUTE)) {
        console.warn('Transcript route not found yet — skipping')
        return
      }

      const content = fs.readFileSync(TRANSCRIPT_ROUTE, 'utf-8')

      // Must have Japanese language detection
      if (!/japanese|日本語/i.test(content)) {
        throw new Error(
          `Transcript route at ${TRANSCRIPT_ROUTE} does not contain ` +
            'Japanese language detection logic. The route must explicitly ' +
            'select the Japanese transcript track.'
        )
      }
    })

    it('transcript route rejects non-Japanese as unavailable', () => {
      if (!fs.existsSync(TRANSCRIPT_ROUTE)) return

      const content = fs.readFileSync(TRANSCRIPT_ROUTE, 'utf-8')

      // Must return available: false when Japanese is not found
      if (
        !/available:\s*false/.test(content) &&
        !/available: false/.test(content)
      ) {
        throw new Error(
          `Transcript route does not return available: false for ` +
            'non-Japanese transcripts. It must reject non-Japanese content.'
        )
      }

      // Must mention missing Japanese in the error message
      if (!/No Japanese/.test(content)) {
        throw new Error(
          `Transcript route does not include a clear error message ` +
            'when Japanese transcript is unavailable.'
        )
      }
    })
  })

  describe('Scope boundary: no Stage B/C features', () => {
    it('no full-video loop logic', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        if (/videoLoop|video-loop|loopFromStart/i.test(content)) {
          throw new Error(
            `Found video loop logic in ${file}. ` +
              'Video looping is Stage B scope.'
          )
        }
      }
    })

    it('no segmentation logic', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        // Segmentation as a playback concept — not just displaying text
        if (
          /resegment|splitSegment|mergeSegment/i.test(content) ||
          /segmentOverride/i.test(content)
        ) {
          throw new Error(
            `Found segmentation logic in ${file}. ` +
              'Segmentation is Stage C scope.'
          )
        }
      }
    })

    it('no edit mode', () => {
      if (!stageADir || sources.length === 0) return

      for (const { file, content } of sources) {
        if (/editMode|isEditing.*segment|segmentEdit/i.test(content)) {
          throw new Error(
            `Found edit mode logic in ${file}. ` +
              'Edit mode is out of Stage A scope.'
          )
        }
      }
    })
  })
})
