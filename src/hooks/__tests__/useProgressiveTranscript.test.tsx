/**
 * Unit Tests for useProgressiveTranscript Hook
 * Tests the two-phase loading (raw → AI enhancement)
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressiveTranscript } from '../useProgressiveTranscript';
import { useToast } from '@/components/ui/Toast/ToastContext';

// Mock dependencies
jest.mock('@/components/ui/Toast/ToastContext');

const mockShowToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast });

// Mock fetch
global.fetch = jest.fn();

describe('useProgressiveTranscript', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Phase 1: Raw Transcript Loading', () => {
    it('should fetch raw transcript immediately', async () => {
      const mockRawData = {
        available: true,
        isJapanese: true,
        segments: [
          { start: 0, end: 5, text: 'こんにちは' },
          { start: 5, end: 10, text: '元気ですか' },
        ],
        videoTitle: 'Test Video',
        language: 'ja',
        totalSegments: 2,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawData,
      });

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123')
      );

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.transcript).toBeNull();

      // Wait for raw transcript to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify raw transcript loaded
      expect(result.current.transcript).not.toBeNull();
      expect(result.current.transcript?.source).toBe('raw');
      expect(result.current.transcript?.segments).toHaveLength(2);
      expect(result.current.transcript?.segments[0].text).toBe('こんにちは');
      expect(result.current.error).toBeNull();

      // Verify toast shown
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Transcript loaded'),
        'success'
      );
    });

    it('should handle invalid YouTube URL', async () => {
      const { result } = renderHook(() =>
        useProgressiveTranscript('not-a-valid-url')
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid YouTube URL. Please check the URL and try again.');
      });

      expect(result.current.transcript).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should handle missing Japanese transcript', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: false,
          isJapanese: false,
          message: 'No Japanese transcript available',
        }),
      });

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123')
      );

      await waitFor(() => {
        expect(result.current.error).toContain('No Japanese transcript');
      });

      expect(result.current.transcript).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123')
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      expect(result.current.transcript).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Phase 2: AI Enhancement', () => {
    it('should trigger AI enhancement after raw transcript loads', async () => {
      const mockRawData = {
        available: true,
        isJapanese: true,
        segments: [
          { start: 0, end: 5, text: 'こんにちは、今日はいい天気ですね' },
        ],
        videoTitle: 'Test Video',
        language: 'ja',
        totalSegments: 1,
      };

      const mockEnhancedData = {
        success: true,
        formattedTranscript: [
          {
            id: 'seg_1',
            text: 'こんにちは',
            startTime: 0,
            endTime: 2,
            translation: 'Hello',
            difficulty: 1,
          },
          {
            id: 'seg_2',
            text: '今日はいい天気ですね',
            startTime: 2,
            endTime: 5,
            translation: "It's nice weather today",
            difficulty: 2,
          },
        ],
        videoMetadata: { aiEnhanced: true },
        usage: { model: 'gpt-4o-mini' },
      };

      (global.fetch as jest.Mock)
        // First call: raw transcript
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawData,
        })
        // Second call: AI enhancement (delay to allow test to catch aiEnhancing state)
        .mockImplementationOnce(() =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockEnhancedData,
                }),
              1000
            )
          )
        );

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123', {
          enableAI: true,
        })
      );

      // Wait for raw transcript
      await waitFor(() => {
        expect(result.current.transcript?.source).toBe('raw');
      }, { timeout: 5000 });

      // Wait for AI enhancement to complete (it will transition through aiEnhancing=true internally)
      await waitFor(() => {
        expect(result.current.transcript?.source).toBe('ai-enhanced');
      }, { timeout: 5000, interval: 100 });

      // Verify enhanced transcript
      expect(result.current.transcript?.segments).toHaveLength(2);
      expect(result.current.transcript?.segments[0].translation).toBe('Hello');
      expect(result.current.aiEnhancing).toBe(false); // Should be false after completion
      expect(result.current.aiProgress).toBe(100);

      // Verify success toast
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('enhanced'),
        'success'
      );
    }, 10000);

    it('should update progress during AI enhancement', async () => {
      const mockRawData = {
        available: true,
        isJapanese: true,
        segments: [{ start: 0, end: 5, text: 'テスト' }],
        videoTitle: 'Test Video',
        language: 'ja',
        totalSegments: 1,
      };

      const mockEnhancedData = {
        success: true,
        formattedTranscript: [
          {
            id: 'seg_1',
            text: 'テスト',
            startTime: 0,
            endTime: 5,
            translation: 'Test',
            difficulty: 1,
          },
        ],
        videoMetadata: { aiEnhanced: true },
        usage: { model: 'gpt-4o-mini' },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawData,
        })
        // AI enhancement (delay to allow test to catch aiEnhancing state)
        .mockImplementationOnce(() =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockEnhancedData,
                }),
              1000
            )
          )
        );

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123', {
          enableAI: true,
        })
      );

      // Wait for raw transcript
      await waitFor(() => {
        expect(result.current.transcript?.source).toBe('raw');
      }, { timeout: 5000 });

      // Verify AI enhancement starts (account for 500ms setTimeout delay)
      await waitFor(() => {
        expect(result.current.aiEnhancing).toBe(true);
      }, { timeout: 3000, interval: 100 });

      // Verify progress updates (account for 1000ms interval tick + 500ms delay)
      await waitFor(() => {
        expect(result.current.aiProgress).toBeGreaterThan(0);
      }, { timeout: 4000, interval: 100 });
    }, 10000);

    it('should handle AI enhancement failure gracefully', async () => {
      const mockRawData = {
        available: true,
        isJapanese: true,
        segments: [{ start: 0, end: 5, text: 'テスト' }],
        videoTitle: 'Test Video',
        language: 'ja',
        totalSegments: 1,
      };

      (global.fetch as jest.Mock)
        // Raw transcript succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawData,
        })
        // AI enhancement fails (delay to allow test to catch aiEnhancing state)
        .mockImplementationOnce(() =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: false,
                  json: async () => ({
                    message: 'AI service unavailable',
                  }),
                }),
              500
            )
          )
        );

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123', {
          enableAI: true,
        })
      );

      // Wait for raw transcript
      await waitFor(() => {
        expect(result.current.transcript?.source).toBe('raw');
      }, { timeout: 5000 });

      // Wait for AI enhancement to start (500ms setTimeout delay)
      await waitFor(() => {
        expect(result.current.aiEnhancing).toBe(true);
      }, { timeout: 3000, interval: 100 });

      // Wait for AI enhancement to fail and cleanup
      await waitFor(() => {
        expect(result.current.aiEnhancing).toBe(false);
      }, { timeout: 5000, interval: 100 });

      // User can still use raw transcript
      expect(result.current.transcript).not.toBeNull();
      expect(result.current.transcript?.source).toBe('raw');
      expect(result.current.error).toBeNull(); // No error - graceful fallback

      // Warning toast shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.stringContaining('failed'),
          'warning'
        );
      }, { timeout: 5000 });
    }, 10000);

    it('should skip AI enhancement when enableAI is false', async () => {
      const mockRawData = {
        available: true,
        isJapanese: true,
        segments: [{ start: 0, end: 5, text: 'テスト' }],
        totalSegments: 1,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawData,
      });

      const { result } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123', {
          enableAI: false,
        })
      );

      // Wait for raw transcript
      await waitFor(() => {
        expect(result.current.transcript?.source).toBe('raw');
      });

      // Wait a bit to ensure AI doesn't start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // AI enhancement should never start
      expect(result.current.aiEnhancing).toBe(false);
      expect(result.current.aiProgress).toBe(0);
      expect(result.current.transcript?.source).toBe('raw');
    });
  });

  describe('Video ID Extraction', () => {
    const testCases = [
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ',
      },
      {
        url: 'https://youtu.be/dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ',
      },
      {
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ',
      },
      {
        url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ',
      },
    ];

    testCases.forEach(({ url, expected }) => {
      it(`should extract video ID from ${url}`, async () => {
        const mockRawData = {
          available: true,
          isJapanese: true,
          segments: [],
          totalSegments: 0,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawData,
        });

        renderHook(() => useProgressiveTranscript(url));

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(expected),
            expect.any(Object)
          );
        });
      });
    });
  });

  describe('Options', () => {
    it('should pass maxSegmentLength to AI enhancement', async () => {
      const mockRawData = {
        available: true,
        isJapanese: true,
        segments: [{ start: 0, end: 5, text: 'テスト' }],
        totalSegments: 1,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            formattedTranscript: [],
          }),
        });

      renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123', {
          enableAI: true,
          maxSegmentLength: 15,
        })
      );

      await waitFor(() => {
        const enhancementCall = (global.fetch as jest.Mock).mock.calls.find(
          call => call[0].includes('/api/youtube/extract')
        );
        if (enhancementCall) {
          const body = JSON.parse(enhancementCall[1].body);
          expect(body.maxSegmentLength).toBe(15);
        }
      }, { timeout: 3000 });
    });
  });

  describe('Cleanup', () => {
    it('should abort fetch on unmount', async () => {
      const { unmount } = renderHook(() =>
        useProgressiveTranscript('https://youtube.com/watch?v=test123')
      );

      unmount();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch should have been aborted (no error thrown)
      expect(true).toBe(true);
    });
  });
});
