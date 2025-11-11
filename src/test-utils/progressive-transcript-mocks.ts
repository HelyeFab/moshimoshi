/**
 * Test Utilities and Mocks for Progressive Transcript Testing
 */

import { TranscriptSegment, TranscriptState } from '@/hooks/useProgressiveTranscript';
import type { TranscriptLine } from '@/types/youtubeShadowing';

/**
 * Mock raw transcript data from Python API
 */
export const mockRawTranscriptResponse = {
  available: true,
  isJapanese: true,
  language: 'ja',
  totalSegments: 5,
  totalDuration: 25,
  videoTitle: 'Test Japanese Video',
  segments: [
    { start: 0, end: 5, text: 'こんにちは、今日はいい天気ですね' },
    { start: 5, end: 10, text: '元気ですか' },
    { start: 10, end: 15, text: '今日は何をしますか' },
    { start: 15, end: 20, text: 'ありがとうございます' },
    { start: 20, end: 25, text: 'さようなら' },
  ],
};

/**
 * Mock AI-enhanced transcript response
 */
export const mockAIEnhancedResponse = {
  success: true,
  formattedTranscript: [
    {
      id: 'seg_1',
      text: 'こんにちは',
      startTime: 0,
      endTime: 2,
      translation: 'Hello',
      difficulty: 1,
      keyVocabulary: ['こんにちは'],
      textWithFurigana: 'こんにちは',
    },
    {
      id: 'seg_2',
      text: '今日はいい天気ですね',
      startTime: 2,
      endTime: 5,
      translation: "It's nice weather today",
      difficulty: 2,
      keyVocabulary: ['今日', '天気'],
      textWithFurigana: '<ruby>今日<rt>きょう</rt></ruby>はいい<ruby>天気<rt>てんき</rt></ruby>ですね',
    },
    {
      id: 'seg_3',
      text: '元気ですか',
      startTime: 5,
      endTime: 10,
      translation: 'How are you?',
      difficulty: 1,
      keyVocabulary: ['元気'],
      textWithFurigana: '<ruby>元気<rt>げんき</rt></ruby>ですか',
    },
    {
      id: 'seg_4',
      text: '今日は何をしますか',
      startTime: 10,
      endTime: 15,
      translation: 'What will you do today?',
      difficulty: 2,
      keyVocabulary: ['今日', '何'],
      textWithFurigana: '<ruby>今日<rt>きょう</rt></ruby>は<ruby>何<rt>なに</rt></ruby>をしますか',
    },
    {
      id: 'seg_5',
      text: 'ありがとうございます',
      startTime: 15,
      endTime: 20,
      translation: 'Thank you very much',
      difficulty: 1,
      keyVocabulary: ['ありがとうございます'],
      textWithFurigana: 'ありがとうございます',
    },
    {
      id: 'seg_6',
      text: 'さようなら',
      startTime: 20,
      endTime: 25,
      translation: 'Goodbye',
      difficulty: 1,
      keyVocabulary: ['さようなら'],
      textWithFurigana: 'さようなら',
    },
  ],
  videoMetadata: {
    aiEnhanced: true,
    enhancedAt: new Date().toISOString(),
  },
  usage: {
    model: 'gpt-4o-mini',
    mode: 'enhance-only',
  },
};

/**
 * Create mock TranscriptState for testing
 */
export function createMockTranscript(source: 'raw' | 'ai-enhanced' = 'raw'): TranscriptState {
  const baseSegments: TranscriptLine[] = mockRawTranscriptResponse.segments.map((seg, i) => ({
    id: `seg-${i}`,
    text: seg.text,
    startTime: seg.start,
    endTime: seg.end,
  }));

  if (source === 'raw') {
    return {
      segments: baseSegments,
      videoTitle: mockRawTranscriptResponse.videoTitle,
      metadata: {
        language: 'ja',
        isJapanese: true,
        totalSegments: baseSegments.length,
      },
      source: 'raw',
    };
  }

  return {
    segments: mockAIEnhancedResponse.formattedTranscript as TranscriptLine[],
    videoTitle: mockRawTranscriptResponse.videoTitle,
    metadata: {
      language: 'ja',
      isJapanese: true,
      totalSegments: mockAIEnhancedResponse.formattedTranscript.length,
      aiEnhanced: true,
    },
    source: 'ai-enhanced',
  };
}

/**
 * Mock fetch for testing progressive transcript loading
 */
export function mockProgressiveFetch() {
  const originalFetch = global.fetch;
  const calls: any[] = [];

  global.fetch = jest.fn((url: string, options?: any) => {
    calls.push({ url, options });

    // Raw transcript endpoint
    if (url.includes('/api/youtube/transcript-python/')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockRawTranscriptResponse,
      } as Response);
    }

    // AI enhancement endpoint
    if (url.includes('/api/youtube/extract') && options?.body) {
      const body = JSON.parse(options.body);
      if (body.enhanceOnly) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAIEnhancedResponse,
        } as Response);
      }
    }

    return originalFetch(url, options);
  });

  return {
    calls,
    restore: () => {
      global.fetch = originalFetch;
    },
  };
}

/**
 * Wait for AI enhancement to complete
 */
export async function waitForAIEnhancement(
  callback: () => TranscriptState | null,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const transcript = callback();
    if (transcript?.source === 'ai-enhanced') {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('AI enhancement did not complete within timeout');
}

/**
 * Mock transcript segments for testing
 */
export const mockTranscriptSegments: TranscriptLine[] = [
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
];

/**
 * Mock YouTube video IDs for testing
 */
export const mockVideoIds = {
  valid: 'dQw4w9WgXcQ',
  noJapanese: 'jNQXAC9IVRw',
  invalid: 'invalid',
};

/**
 * Mock YouTube URLs for testing
 */
export const mockYouTubeUrls = {
  standard: `https://www.youtube.com/watch?v=${mockVideoIds.valid}`,
  short: `https://youtu.be/${mockVideoIds.valid}`,
  embed: `https://www.youtube.com/embed/${mockVideoIds.valid}`,
  shorts: `https://www.youtube.com/shorts/${mockVideoIds.valid}`,
  noJapanese: `https://www.youtube.com/watch?v=${mockVideoIds.noJapanese}`,
};

/**
 * Helper to simulate AI progress updates
 */
export function simulateAIProgress(
  onProgress: (progress: number) => void,
  duration = 5000
): () => void {
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 10 + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
    }
    onProgress(Math.min(100, progress));
  }, 500);

  return () => clearInterval(interval);
}

/**
 * Mock scroll behavior for auto-scroll testing
 */
export function mockScrollBehavior() {
  const originalScrollTo = window.scrollTo;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  const scrollCalls: any[] = [];

  window.scrollTo = jest.fn((options: any) => {
    scrollCalls.push({ type: 'window.scrollTo', options });
  });

  Element.prototype.scrollIntoView = jest.fn(function(this: Element, options: any) {
    scrollCalls.push({ type: 'scrollIntoView', element: this, options });
  });

  return {
    scrollCalls,
    restore: () => {
      window.scrollTo = originalScrollTo;
      Element.prototype.scrollIntoView = originalScrollIntoView;
    },
  };
}
