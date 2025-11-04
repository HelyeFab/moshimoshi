/**
 * Component Tests for CaptionDisplay
 * Tests smart auto-scroll, click-to-jump, and visual hierarchy
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptionDisplay, TranscriptToggle } from '../CaptionDisplay';
import type { TranscriptLine } from '@/types/youtubeShadowing';

const mockSegments: TranscriptLine[] = [
  {
    id: 'seg-1',
    text: 'こんにちは',
    startTime: 0,
    endTime: 2,
    translation: 'Hello',
  },
  {
    id: 'seg-2',
    text: '元気ですか',
    startTime: 2,
    endTime: 5,
    translation: 'How are you?',
  },
  {
    id: 'seg-3',
    text: '今日はいい天気ですね',
    startTime: 5,
    endTime: 10,
    translation: "It's nice weather today",
  },
  {
    id: 'seg-4',
    text: 'ありがとう',
    startTime: 10,
    endTime: 13,
    translation: 'Thank you',
  },
];

describe('CaptionDisplay', () => {
  const mockOnSeek = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all segments in full transcript mode', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // All segments should be rendered
      expect(screen.getByText('こんにちは')).toBeInTheDocument();
      expect(screen.getByText('元気ですか')).toBeInTheDocument();
      expect(screen.getByText('今日はいい天気ですね')).toBeInTheDocument();
      expect(screen.getByText('ありがとう')).toBeInTheDocument();
    });

    it('should render current segment in current-only mode', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={3}
          onSeekToTime={mockOnSeek}
          showFullTranscript={false}
        />
      );

      // Current segment (at time 3s) should be visible
      expect(screen.getByText('元気ですか')).toBeInTheDocument();

      // Should show LIVE indicator
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });

    it('should show coming up preview in current-only mode', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={3}
          onSeekToTime={mockOnSeek}
          showFullTranscript={false}
        />
      );

      // Should show "Coming up" section
      expect(screen.getByText(/Coming up:/i)).toBeInTheDocument();

      // Should show next 3 segments
      expect(screen.getByText('今日はいい天気ですね')).toBeInTheDocument();
      expect(screen.getByText('ありがとう')).toBeInTheDocument();
    });

    it('should show source indicator', () => {
      const { rerender } = render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          source="raw"
        />
      );

      expect(screen.getByText('Raw Transcript')).toBeInTheDocument();

      rerender(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          source="ai-enhanced"
        />
      );

      expect(screen.getByText('AI-Enhanced')).toBeInTheDocument();
    });

    it('should show empty state when no segments', () => {
      render(
        <CaptionDisplay
          segments={[]}
          currentTime={0}
          onSeekToTime={mockOnSeek}
        />
      );

      expect(screen.getByText('No transcript available')).toBeInTheDocument();
    });
  });

  describe('Click-to-Jump', () => {
    it('should call onSeekToTime when segment clicked', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // Click on second segment
      const segment = screen.getByText('元気ですか');
      fireEvent.click(segment);

      expect(mockOnSeek).toHaveBeenCalledWith(2);
    });

    it('should seek when clicking upcoming segment in current-only mode', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={3}
          onSeekToTime={mockOnSeek}
          showFullTranscript={false}
        />
      );

      // Click on upcoming segment
      const upcomingSegment = screen.getByText('今日はいい天気ですね');
      fireEvent.click(upcomingSegment);

      expect(mockOnSeek).toHaveBeenCalledWith(5);
    });
  });

  describe('Visual Hierarchy', () => {
    it('should highlight active segment', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={3}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // Active segment (time 3s = second segment)
      const activeSegment = screen.getByText('元気ですか').closest('button');
      expect(activeSegment).toHaveClass('bg-red-500/30');
      expect(activeSegment).toHaveClass('border-red-500');
    });

    it('should dim past segments', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={6}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // Past segments should be dimmed
      const pastSegment = screen.getByText('こんにちは').closest('button');
      expect(pastSegment).toHaveClass('text-white/50');
    });

    it('should show play indicator on active segment', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={3}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // Active segment should have play indicator
      const activeSegment = screen.getByText('元気ですか').closest('button');
      expect(activeSegment).toHaveTextContent('▶');
    });
  });

  describe('Translations', () => {
    it('should show translations when available', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('How are you?')).toBeInTheDocument();
    });

    it('should show translation in current segment view', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={3}
          onSeekToTime={mockOnSeek}
          showFullTranscript={false}
        />
      );

      // Current segment translation
      expect(screen.getByText('How are you?')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format time correctly', () => {
      render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // Should show formatted times
      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(screen.getByText('0:02')).toBeInTheDocument();
      expect(screen.getByText('0:05')).toBeInTheDocument();
    });
  });

  describe('Auto-Scroll Behavior', () => {
    it('should have scroll container with smooth behavior', () => {
      const { container } = render(
        <CaptionDisplay
          segments={mockSegments}
          currentTime={0}
          onSeekToTime={mockOnSeek}
          showFullTranscript={true}
        />
      );

      // Find the scroll container (has overflow-y-auto class)
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).not.toBeNull();
      expect(scrollContainer).toHaveClass('max-h-[500px]');
    });
  });
});

describe('TranscriptToggle', () => {
  it('should show correct text for full transcript mode', () => {
    const mockOnToggle = jest.fn();
    render(
      <TranscriptToggle
        showFullTranscript={true}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText('Current Only')).toBeInTheDocument();
  });

  it('should show correct text for current-only mode', () => {
    const mockOnToggle = jest.fn();
    render(
      <TranscriptToggle
        showFullTranscript={false}
        onToggle={mockOnToggle}
      />
    );

    expect(screen.getByText('Full Transcript')).toBeInTheDocument();
  });

  it('should call onToggle when clicked', () => {
    const mockOnToggle = jest.fn();
    render(
      <TranscriptToggle
        showFullTranscript={true}
        onToggle={mockOnToggle}
      />
    );

    fireEvent.click(screen.getByText('Current Only'));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });
});
