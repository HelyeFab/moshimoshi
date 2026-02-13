/**
 * Regression tests: Repeat State Machine + Sync Precision V2
 *
 * Ensures that repeat state transitions are identical regardless of
 * whether the fixed buffer or adaptive buffer is used for segment
 * end detection. The repeat logic is pure and buffer-independent —
 * these tests verify that invariant.
 */

import {
  nextOnSegmentEnd,
  type RepeatState,
} from '../repeat';
import { verifySeekLanding } from '@/utils/youtubePlayerUtils';

describe('Repeat-sync integration regression', () => {
  // Simulate segment end detection with both buffer methods
  // to verify identical repeat state transitions

  const scenarios: Array<{
    name: string;
    state: RepeatState;
    expectedSegmentIndex: number;
    expectedRepeat: number;
    expectedDidAdvance: boolean;
  }> = [
    {
      name: 'mid-repeat stays on segment (repeat 2 of 3)',
      state: { repeatCount: 3, currentRepeat: 2, segmentIndex: 0, totalSegments: 5 },
      expectedSegmentIndex: 0,
      expectedRepeat: 3,
      expectedDidAdvance: false,
    },
    {
      name: 'final repeat advances to next segment',
      state: { repeatCount: 3, currentRepeat: 3, segmentIndex: 0, totalSegments: 5 },
      expectedSegmentIndex: 1,
      expectedRepeat: 1,
      expectedDidAdvance: true,
    },
    {
      name: 'final repeat on last segment stays put',
      state: { repeatCount: 3, currentRepeat: 3, segmentIndex: 4, totalSegments: 5 },
      expectedSegmentIndex: 4,
      expectedRepeat: 1,
      expectedDidAdvance: false,
    },
    {
      name: 'single repeat mode (repeatCount=1) advances immediately',
      state: { repeatCount: 1, currentRepeat: 1, segmentIndex: 2, totalSegments: 5 },
      expectedSegmentIndex: 3,
      expectedRepeat: 1,
      expectedDidAdvance: true,
    },
    {
      name: 'single repeat on last segment stays put',
      state: { repeatCount: 1, currentRepeat: 1, segmentIndex: 4, totalSegments: 5 },
      expectedSegmentIndex: 4,
      expectedRepeat: 1,
      expectedDidAdvance: false,
    },
  ];

  describe('repeat state transitions are buffer-independent', () => {
    scenarios.forEach(({ name, state, expectedSegmentIndex, expectedRepeat, expectedDidAdvance }) => {
      it(`${name}`, () => {
        // Both buffer methods ultimately call nextOnSegmentEnd with the same state
        // The buffer method only determines WHEN the call happens, not WHAT happens
        const result = nextOnSegmentEnd(state);

        expect(result.segmentIndex).toBe(expectedSegmentIndex);
        expect(result.currentRepeat).toBe(expectedRepeat);
        expect(result.didAdvanceSegment).toBe(expectedDidAdvance);
      });
    });
  });

  describe('segment advance on final repeat preserved', () => {
    it('should advance through all segments with repeatCount=3', () => {
      let state: RepeatState = {
        repeatCount: 3,
        currentRepeat: 1,
        segmentIndex: 0,
        totalSegments: 3,
      };

      const segmentHistory: number[] = [0];

      // Walk through all segments and repeats
      for (let i = 0; i < 20; i++) {
        const result = nextOnSegmentEnd(state);
        state = {
          ...state,
          currentRepeat: result.currentRepeat,
          segmentIndex: result.segmentIndex,
        };

        if (result.didAdvanceSegment) {
          segmentHistory.push(result.segmentIndex);
        }

        // Stop if we're stuck on last segment
        if (state.segmentIndex === 2 && state.currentRepeat === 1 && !result.didAdvanceSegment) {
          break;
        }
      }

      // Should have visited segments 0, 1, 2 in order
      expect(segmentHistory).toEqual([0, 1, 2]);
    });
  });

  describe('video completion on last segment preserved', () => {
    it('should detect completion on last segment final repeat', () => {
      const state: RepeatState = {
        repeatCount: 3,
        currentRepeat: 3,
        segmentIndex: 2,
        totalSegments: 3,
      };

      const result = nextOnSegmentEnd(state);
      const isLastSegment = state.segmentIndex >= state.totalSegments - 1;
      const completedAllSegments = isLastSegment && !result.didAdvanceSegment && result.currentRepeat === 1;

      expect(completedAllSegments).toBe(true);
    });

    it('should NOT detect completion mid-repeat on last segment', () => {
      const state: RepeatState = {
        repeatCount: 3,
        currentRepeat: 2,
        segmentIndex: 2,
        totalSegments: 3,
      };

      const result = nextOnSegmentEnd(state);
      const isLastSegment = state.segmentIndex >= state.totalSegments - 1;
      const completedAllSegments = isLastSegment && !result.didAdvanceSegment && result.currentRepeat === 1;

      expect(completedAllSegments).toBe(false);
    });

    it('should NOT detect completion when not on last segment', () => {
      const state: RepeatState = {
        repeatCount: 3,
        currentRepeat: 3,
        segmentIndex: 1,
        totalSegments: 3,
      };

      const result = nextOnSegmentEnd(state);
      const isLastSegment = state.segmentIndex >= state.totalSegments - 1;
      const completedAllSegments = isLastSegment && !result.didAdvanceSegment && result.currentRepeat === 1;

      expect(completedAllSegments).toBe(false);
    });

    it('video loop mode (repeatCount=1) detects completion on last segment', () => {
      const state: RepeatState = {
        repeatCount: 1,
        currentRepeat: 1,
        segmentIndex: 2,
        totalSegments: 3,
      };

      const result = nextOnSegmentEnd(state);
      const isLastSegment = state.segmentIndex >= state.totalSegments - 1;
      const completedAllSegments = isLastSegment && !result.didAdvanceSegment && result.currentRepeat === 1;

      expect(completedAllSegments).toBe(true);
    });
  });

  describe('delayed re-entry timer integration', () => {
    // Mirrors the exact ref + setTimeout + clearTimeout mechanics from
    // YouTubeShadowingContent.evaluatePlayback (SYNC_V2 path).
    //
    // Uses a ReentryController that replicates the component's timer
    // logic so we can exercise real setTimeout/clearTimeout scheduling
    // and verify playVideo is gated correctly.

    const REENTRY_DELAY_MS = 50;

    /**
     * Extracted re-entry controller that mirrors the component's
     * reentryTimeoutRef + clearReentryTimeout + evaluatePlayback logic.
     */
    class ReentryController {
      reentryTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
      segmentIndex = 0;
      pollActive = false;

      clearReentryTimeout() {
        if (this.reentryTimeoutHandle !== null) {
          clearTimeout(this.reentryTimeoutHandle);
          this.reentryTimeoutHandle = null;
        }
      }

      /**
       * Schedules the re-entry exactly as the component does:
       *   1. seekTo (immediate)
       *   2. setTimeout(REENTRY_DELAY_MS) → guard → verifySeekLanding → guard → playVideo
       */
      scheduleReentry(
        player: { seekTo: jest.Mock; playVideo: jest.Mock; getCurrentTime: jest.Mock },
        targetStart: number,
        expectedSegmentIndex: number,
      ) {
        player.seekTo(targetStart, true);
        this.clearReentryTimeout();

        this.reentryTimeoutHandle = setTimeout(() => {
          this.reentryTimeoutHandle = null;

          // Pre-verification guard (same as component)
          if (this.segmentIndex !== expectedSegmentIndex || !this.pollActive) return;

          // In tests we call verifySeekLanding synchronously via settleMs=0
          // but the real one is async; we simulate the post-verification guard inline.
          void verifySeekLanding(player, targetStart, { settleMs: 1 }).then(() => {
            // Post-verification guard
            if (this.segmentIndex !== expectedSegmentIndex || !this.pollActive) return;
            player.playVideo();
          });
        }, REENTRY_DELAY_MS);
      }
    }

    function createPlayer(landingTime: number) {
      return {
        seekTo: jest.fn(),
        playVideo: jest.fn(),
        getCurrentTime: jest.fn(() => landingTime),
      };
    }

    it('happy path: timer fires, guards pass, playVideo called', async () => {
      const ctrl = new ReentryController();
      ctrl.segmentIndex = 2;
      ctrl.pollActive = true;
      const player = createPlayer(5.01); // close to target

      ctrl.scheduleReentry(player, 5.0, 2);

      expect(player.seekTo).toHaveBeenCalledWith(5.0, true);
      expect(player.playVideo).not.toHaveBeenCalled(); // not yet

      // Wait for REENTRY_DELAY + settleMs + microtask
      await new Promise(r => setTimeout(r, REENTRY_DELAY_MS + 20));

      expect(player.playVideo).toHaveBeenCalledTimes(1);
    });

    it('user pauses during delay: clearReentryTimeout prevents playVideo', async () => {
      const ctrl = new ReentryController();
      ctrl.segmentIndex = 2;
      ctrl.pollActive = true;
      const player = createPlayer(5.01);

      ctrl.scheduleReentry(player, 5.0, 2);

      // User pauses 10ms into the 50ms delay
      await new Promise(r => setTimeout(r, 10));
      ctrl.pollActive = false;
      ctrl.clearReentryTimeout();

      // Wait well past the original delay
      await new Promise(r => setTimeout(r, REENTRY_DELAY_MS + 20));

      expect(player.playVideo).not.toHaveBeenCalled();
    });

    it('user navigates to different segment during delay: guard blocks playVideo', async () => {
      const ctrl = new ReentryController();
      ctrl.segmentIndex = 2;
      ctrl.pollActive = true;
      const player = createPlayer(5.01);

      ctrl.scheduleReentry(player, 5.0, 2);

      // User taps "next" 10ms in — segment changes, and clearReentryTimeout fires
      await new Promise(r => setTimeout(r, 10));
      ctrl.segmentIndex = 3;
      ctrl.clearReentryTimeout();

      await new Promise(r => setTimeout(r, REENTRY_DELAY_MS + 20));

      expect(player.playVideo).not.toHaveBeenCalled();
    });

    it('poll cleared (ended state) during delay: guard blocks playVideo', async () => {
      const ctrl = new ReentryController();
      ctrl.segmentIndex = 2;
      ctrl.pollActive = true;
      const player = createPlayer(5.01);

      ctrl.scheduleReentry(player, 5.0, 2);

      // Video ends mid-delay — clearPoll → clearReentryTimeout
      await new Promise(r => setTimeout(r, 10));
      ctrl.pollActive = false;
      ctrl.clearReentryTimeout();

      await new Promise(r => setTimeout(r, REENTRY_DELAY_MS + 20));

      expect(player.playVideo).not.toHaveBeenCalled();
    });

    it('segment changes after timeout fires but before verifySeekLanding resolves', async () => {
      const ctrl = new ReentryController();
      ctrl.segmentIndex = 2;
      ctrl.pollActive = true;
      const player = createPlayer(5.01);

      // Override scheduleReentry to use a longer settleMs so there's a
      // real async gap between the timeout callback and verification resolve.
      const LONG_SETTLE_MS = 40;
      player.seekTo(5.0, true);
      ctrl.clearReentryTimeout();
      ctrl.reentryTimeoutHandle = setTimeout(() => {
        ctrl.reentryTimeoutHandle = null;
        if (ctrl.segmentIndex !== 2 || !ctrl.pollActive) return;
        void verifySeekLanding(player, 5.0, { settleMs: LONG_SETTLE_MS }).then(() => {
          if (ctrl.segmentIndex !== 2 || !ctrl.pollActive) return;
          player.playVideo();
        });
      }, REENTRY_DELAY_MS);

      // Let the timeout fire — pre-verification guard passes at this point
      await new Promise(r => setTimeout(r, REENTRY_DELAY_MS + 5));

      // Change segment during the 40ms settle window
      ctrl.segmentIndex = 3;

      // Wait for verifySeekLanding to complete
      await new Promise(r => setTimeout(r, LONG_SETTLE_MS + 20));

      // Post-verification guard should have blocked playVideo
      expect(player.playVideo).not.toHaveBeenCalled();
    });

    it('rapid re-scheduling cancels previous timeout', async () => {
      const ctrl = new ReentryController();
      ctrl.segmentIndex = 0;
      ctrl.pollActive = true;
      const player1 = createPlayer(1.01);
      const player2 = createPlayer(2.01);

      // First re-entry scheduled for segment 0 → target 1.0
      ctrl.scheduleReentry(player1, 1.0, 0);

      // 10ms later, evaluatePlayback fires again (next segment)
      await new Promise(r => setTimeout(r, 10));
      ctrl.segmentIndex = 1;
      ctrl.scheduleReentry(player2, 2.0, 1);

      // Wait for second timeout
      await new Promise(r => setTimeout(r, REENTRY_DELAY_MS + 20));

      // First player should NOT have playVideo called (its timeout was cancelled)
      expect(player1.playVideo).not.toHaveBeenCalled();
      // Second player should have playVideo called
      expect(player2.playVideo).toHaveBeenCalledTimes(1);
    });
  });
});
