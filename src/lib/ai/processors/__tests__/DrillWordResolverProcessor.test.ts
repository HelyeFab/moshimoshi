/**
 * Tests for DrillWordResolverProcessor and DrillWordResolverProcessorHybrid
 *
 * Validates:
 * - Request validation (empty, too long, invalid)
 * - OpenAI path returns validated result
 * - Hybrid fallback path works (mocked)
 * - Invalid AI responses are rejected
 */

import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

// Set env var so BaseProcessor initializes the OpenAI client
const originalEnv = process.env.OPEN_AI_API_KEY;
process.env.OPEN_AI_API_KEY = 'test-key';

// Mock OpenAI before imports
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    _mockCreate: mockCreate,
  };
});

// Mock provider config
jest.mock('../../config/providers', () => ({
  getProviderConfig: jest.fn().mockReturnValue({
    primary: 'openai',
    fallback: 'openai',
    enabled: { openai: true, ollama: false },
    routing: {},
  }),
  getOllamaConfig: jest.fn().mockReturnValue({
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'qwen2.5:32b',
    timeout: 30000,
    maxRetries: 2,
  }),
  selectProvider: jest.fn().mockReturnValue('openai'),
  providerHealth: {
    markUnhealthy: jest.fn(),
    markHealthy: jest.fn(),
    isHealthy: jest.fn().mockReturnValue(true),
  },
}));

// Mock OllamaClient
jest.mock('../../clients/OllamaClient', () => ({
  OllamaClient: jest.fn().mockImplementation(() => ({
    generate: jest.fn(),
  })),
}));

import { DrillWordResolverProcessor } from '../DrillWordResolverProcessor';
import { DrillWordResolverProcessorHybrid } from '../DrillWordResolverProcessorHybrid';
import type { ProcessorContext } from '../../types';
import { selectProvider, getProviderConfig, providerHealth } from '../../config/providers';
import { OllamaClient } from '../../clients/OllamaClient';

// Access the mock
const openaiModule = jest.requireMock('openai') as any;
const mockCreate = openaiModule._mockCreate;

const mockContext: ProcessorContext = {
  model: 'gpt-4o-mini',
  config: {
    temperature: 0.3,
    maxTokens: 500,
  },
};

const validAIResponse = {
  surface: '食べて',
  lemma: '食べる',
  reading: 'たべる',
  meaning: 'to eat',
  partOfSpeech: 'verb',
  conjugationType: 'Ichidan',
  confidence: 'high',
  alternatives: null,
  notes: null,
};

function makeOpenAICompletion(data: any) {
  return {
    id: 'test-request-id',
    choices: [{
      message: {
        content: JSON.stringify(data),
      },
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

// ============================================
// DrillWordResolverProcessor Tests
// ============================================

describe('DrillWordResolverProcessor', () => {
  let processor: DrillWordResolverProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new DrillWordResolverProcessor(mockContext);
  });

  describe('validateRequest', () => {
    it('accepts a valid word', () => {
      expect(() => processor.validateRequest({ word: '食べる' })).not.toThrow();
    });

    it('accepts a word with context', () => {
      expect(() =>
        processor.validateRequest({ word: '行く', context: 'travel' })
      ).not.toThrow();
    });

    it('rejects empty string', () => {
      expect(() => processor.validateRequest({ word: '' })).toThrow();
    });

    it('rejects whitespace-only string', () => {
      expect(() => processor.validateRequest({ word: '   ' })).toThrow();
    });

    it('rejects missing word', () => {
      expect(() => processor.validateRequest({} as any)).toThrow();
    });

    it('rejects non-string word', () => {
      expect(() => processor.validateRequest({ word: 123 } as any)).toThrow();
    });

    it('rejects word over 100 characters', () => {
      expect(() => processor.validateRequest({ word: 'あ'.repeat(101) })).toThrow();
    });

    it('accepts word at exactly 100 characters', () => {
      expect(() => processor.validateRequest({ word: 'あ'.repeat(100) })).not.toThrow();
    });
  });

  describe('process', () => {
    it('returns validated result from OpenAI', async () => {
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(validAIResponse));

      const result = await processor.process({ word: '食べる' });

      expect(result.data.lemma).toBe('食べる');
      expect(result.data.conjugationType).toBe('Ichidan');
      expect(result.data.confidence).toBe('high');
      expect(result.data.partOfSpeech).toBe('verb');
      expect(result.usage).toBeDefined();
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('returns result without conjugationType for nouns', async () => {
      const nounResponse = {
        surface: '猫',
        lemma: '猫',
        reading: 'ねこ',
        meaning: 'cat',
        partOfSpeech: 'noun',
        conjugationType: null,
        confidence: 'high',
        alternatives: null,
        notes: null,
      };
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(nounResponse));

      const result = await processor.process({ word: '猫' });

      expect(result.data.conjugationType).toBeNull();
      expect(result.data.partOfSpeech).toBe('noun');
    });

    it('rejects invalid AI response (missing reading)', async () => {
      const invalidResponse = {
        surface: '食べる',
        lemma: '食べる',
        // missing reading
        meaning: null,
        partOfSpeech: 'verb',
        conjugationType: 'Ichidan',
        confidence: 'high',
        alternatives: null,
        notes: null,
      };
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(invalidResponse));

      await expect(processor.process({ word: '食べる' })).rejects.toThrow();
    });

    it('rejects invalid AI response (bad conjugationType enum)', async () => {
      const invalidResponse = {
        ...validAIResponse,
        conjugationType: 'ru-verb', // Not in enum
      };
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(invalidResponse));

      await expect(processor.process({ word: '食べる' })).rejects.toThrow();
    });

    it('rejects semantically inconsistent response (noun + Godan)', async () => {
      const inconsistentResponse = {
        ...validAIResponse,
        partOfSpeech: 'noun',
        conjugationType: 'Godan', // noun cannot have conjugationType
      };
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(inconsistentResponse));

      await expect(processor.process({ word: '学校' })).rejects.toThrow();
    });

    it('rejects semantically inconsistent response (verb + null)', async () => {
      const inconsistentResponse = {
        ...validAIResponse,
        partOfSpeech: 'verb',
        conjugationType: null, // verb must have conjugationType
      };
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(inconsistentResponse));

      await expect(processor.process({ word: '食べる' })).rejects.toThrow();
    });
  });

  describe('parseResponse', () => {
    it('parses valid JSON string', () => {
      const result = processor.parseResponse(JSON.stringify(validAIResponse));
      expect(result.lemma).toBe('食べる');
    });

    it('throws on invalid JSON', () => {
      expect(() => processor.parseResponse('not json')).toThrow();
    });

    it('throws on valid JSON but invalid schema', () => {
      expect(() => processor.parseResponse(JSON.stringify({ bad: 'data' }))).toThrow();
    });
  });

  describe('prompt generation', () => {
    it('getSystemPrompt returns instructions without conjugation forms', () => {
      const prompt = processor.getSystemPrompt();
      expect(prompt).toContain('Do NOT generate conjugation forms');
      expect(prompt).toContain('conjugationType');
    });

    it('getUserPrompt includes the word', () => {
      const prompt = processor.getUserPrompt({ word: '走る' });
      expect(prompt).toContain('走る');
    });

    it('getUserPrompt includes context when provided', () => {
      const prompt = processor.getUserPrompt({ word: '走る', context: 'marathon' });
      expect(prompt).toContain('marathon');
    });
  });
});

// ============================================
// DrillWordResolverProcessorHybrid Tests
// ============================================

describe('DrillWordResolverProcessorHybrid', () => {
  let processor: DrillWordResolverProcessorHybrid;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: OpenAI mode
    (getProviderConfig as jest.MockedFunction<typeof getProviderConfig>).mockReturnValue({
      primary: 'openai',
      fallback: 'openai',
      enabled: { openai: true, ollama: false },
      routing: {},
    });
    (selectProvider as jest.MockedFunction<typeof selectProvider>).mockReturnValue('openai');
    processor = new DrillWordResolverProcessorHybrid(mockContext);
  });

  describe('OpenAI path', () => {
    it('uses OpenAI when selected', async () => {
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(validAIResponse));

      const result = await processor.process({ word: '食べる' });
      expect(result.data.lemma).toBe('食べる');
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('Ollama path', () => {
    let mockOllamaGenerate: jest.MockedFunction<any>;

    beforeEach(() => {
      // Enable Ollama
      (getProviderConfig as jest.MockedFunction<typeof getProviderConfig>).mockReturnValue({
        primary: 'ollama',
        fallback: 'openai',
        enabled: { openai: true, ollama: true },
        routing: { resolve_drill_word: 'ollama' },
      });
      (selectProvider as jest.MockedFunction<typeof selectProvider>).mockReturnValue('ollama');

      // Mock OllamaClient.estimateTokens as static method
      (OllamaClient as any).estimateTokens = jest.fn().mockReturnValue(50);

      // Create processor after enabling Ollama
      processor = new DrillWordResolverProcessorHybrid(mockContext);

      // Get the mock generate function from the created instance
      mockOllamaGenerate = (processor as any).ollamaClient.generate;
    });

    it('uses Ollama when selected', async () => {
      mockOllamaGenerate.mockResolvedValueOnce({
        response: JSON.stringify(validAIResponse),
        model: 'qwen2.5:32b',
        total_duration: 5e9,
      });

      const result = await processor.process({ word: '食べる' });

      expect(result.data.lemma).toBe('食べる');
      expect(result.metadata.provider).toBe('ollama');
      expect(result.usage.estimatedCost).toBe(0);
      expect(mockOllamaGenerate).toHaveBeenCalled();
    });

    it('rejects invalid Ollama response', async () => {
      mockOllamaGenerate.mockResolvedValueOnce({
        response: JSON.stringify({ bad: 'data' }),
        model: 'qwen2.5:32b',
      });

      // Should fail validation then fall back to OpenAI
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(validAIResponse));

      const result = await processor.process({ word: '食べる' });
      // Falls back to OpenAI successfully
      expect(result.data.lemma).toBe('食べる');
    });
  });

  describe('fallback path', () => {
    let mockOllamaGenerate: jest.MockedFunction<any>;

    beforeEach(() => {
      (getProviderConfig as jest.MockedFunction<typeof getProviderConfig>).mockReturnValue({
        primary: 'ollama',
        fallback: 'openai',
        enabled: { openai: true, ollama: true },
        routing: { resolve_drill_word: 'ollama' },
      });
      (selectProvider as jest.MockedFunction<typeof selectProvider>).mockReturnValue('ollama');
      (OllamaClient as any).estimateTokens = jest.fn().mockReturnValue(50);

      processor = new DrillWordResolverProcessorHybrid(mockContext);
      mockOllamaGenerate = (processor as any).ollamaClient.generate;
    });

    it('falls back to OpenAI when Ollama fails', async () => {
      mockOllamaGenerate.mockRejectedValueOnce(new Error('Ollama timeout'));
      mockCreate.mockResolvedValueOnce(makeOpenAICompletion(validAIResponse));

      const result = await processor.process({ word: '食べる' });

      expect(result.data.lemma).toBe('食べる');
      expect(providerHealth.markUnhealthy).toHaveBeenCalledWith('ollama');
    });

    it('throws when both providers fail', async () => {
      mockOllamaGenerate.mockRejectedValueOnce(new Error('Ollama down'));
      mockCreate.mockRejectedValueOnce(new Error('OpenAI down'));

      await expect(processor.process({ word: '食べる' })).rejects.toThrow();
    });
  });
});

// Restore env
afterAll(() => {
  if (originalEnv === undefined) {
    delete process.env.OPEN_AI_API_KEY;
  } else {
    process.env.OPEN_AI_API_KEY = originalEnv;
  }
});
