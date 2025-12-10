/**
 * Tests for Repeat State Machine
 *
 * Ported from shadowingPlayer with additional edge case coverage.
 */

import {
  nextOnSegmentEnd,
  onRepeatCountChange,
  clampRepeatCount,
  type RepeatState,
} from '../repeat';

const baseState: RepeatState = {
  repeatCount: 6,
  currentRepeat: 2,
  segmentIndex: 0,
  totalSegments: 3,
};

describe('repeat logic', () => {
  describe('nextOnSegmentEnd', () => {
    it('repeats the same segment until the repeat count is reached', () => {
      const result = nextOnSegmentEnd(baseState);

      expect(result.segmentIndex).toBe(0);
      expect(result.currentRepeat).toBe(3);
      expect(result.didAdvanceSegment).toBe(false);
    });

    it('advances to the next segment when repeat quota is met', () => {
      const result = nextOnSegmentEnd({
        ...baseState,
        currentRepeat: 6,
      });

      expect(result.segmentIndex).toBe(1);
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(true);
    });

    it('stays on last segment when already at end', () => {
      const result = nextOnSegmentEnd({
        ...baseState,
        segmentIndex: 2,
        currentRepeat: 6,
      });

      expect(result.segmentIndex).toBe(2); // Stays on last
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(false); // No advance possible
    });

    it('handles single segment video', () => {
      const result = nextOnSegmentEnd({
        repeatCount: 3,
        currentRepeat: 3,
        segmentIndex: 0,
        totalSegments: 1,
      });

      expect(result.segmentIndex).toBe(0); // Can't advance
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(false);
    });

    it('handles repeatCount=1 (immediate advance)', () => {
      const result = nextOnSegmentEnd({
        repeatCount: 1,
        currentRepeat: 1,
        segmentIndex: 0,
        totalSegments: 3,
      });

      expect(result.segmentIndex).toBe(1);
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(true);
    });
  });

  describe('onRepeatCountChange', () => {
    it('keeps current segment when lowering repeat count mid-loop but not past limit', () => {
      const result = onRepeatCountChange(baseState, 4);

      expect(result.segmentIndex).toBe(0);
      expect(result.currentRepeat).toBe(2);
      expect(result.didAdvanceSegment).toBe(false);
    });

    it('advances immediately when repeat count drops below current progress', () => {
      const result = onRepeatCountChange(
        { ...baseState, currentRepeat: 4 },
        2,
      );

      expect(result.segmentIndex).toBe(1);
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(true);
    });

    it('allows extending repeat count mid-segment', () => {
      const result = onRepeatCountChange(baseState, 8);

      expect(result.segmentIndex).toBe(0);
      expect(result.currentRepeat).toBe(2);
      expect(result.didAdvanceSegment).toBe(false);
    });

    it('advances when repeat count equals current repeat', () => {
      const result = onRepeatCountChange(
        { ...baseState, currentRepeat: 3 },
        3,
      );

      expect(result.segmentIndex).toBe(1);
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(true);
    });

    it('stays on last segment when cannot advance', () => {
      const result = onRepeatCountChange(
        { ...baseState, segmentIndex: 2, currentRepeat: 4 },
        2,
      );

      expect(result.segmentIndex).toBe(2); // Last segment
      expect(result.currentRepeat).toBe(1);
      expect(result.didAdvanceSegment).toBe(false); // Can't advance
    });
  });

  describe('clampRepeatCount', () => {
    it('clamps values below minimum to 1', () => {
      expect(clampRepeatCount(0)).toBe(1);
      expect(clampRepeatCount(-5)).toBe(1);
    });

    it('clamps values above maximum to 20', () => {
      expect(clampRepeatCount(25)).toBe(20);
      expect(clampRepeatCount(100)).toBe(20);
    });

    it('rounds floating point values down', () => {
      expect(clampRepeatCount(3.7)).toBe(3);
      expect(clampRepeatCount(5.9)).toBe(5);
    });

    it('handles NaN by returning 1', () => {
      expect(clampRepeatCount(NaN)).toBe(1);
    });

    it('preserves valid values', () => {
      expect(clampRepeatCount(1)).toBe(1);
      expect(clampRepeatCount(10)).toBe(10);
      expect(clampRepeatCount(20)).toBe(20);
    });
  });
});
