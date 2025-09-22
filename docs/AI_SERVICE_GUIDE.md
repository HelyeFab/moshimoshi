# Unified AI Service Implementation Guide

## Overview
The new unified AI service provides a single, content-agnostic interface for all AI-powered features in Moshimoshi. It replaces multiple scattered endpoints with one flexible, extensible system.

## Architecture

```
/src/lib/ai/
├── types.ts                    # All TypeScript interfaces
├── AIService.ts                # Main orchestrator
├── processors/                 # Task-specific processors
│   ├── BaseProcessor.ts       # Abstract base class
│   ├── ReviewQuestionProcessor.ts
│   ├── GrammarExplainerProcessor.ts
│   ├── TranscriptProcessor.ts (TODO)
│   └── ArticleProcessor.ts (TODO)
├── cache/
│   └── CacheManager.ts        # Response caching
├── utils/
│   └── UsageTracker.ts        # Cost & usage tracking
└── prompts/                   # Prompt templates (TODO)

/src/app/api/ai/process/       # Unified API endpoint
```

## Key Features

### 1. Single Entry Point
All AI requests go through `/api/ai/process` with task-based routing.

### 2. Smart Model Selection
Automatically selects the optimal model based on task complexity:
- **GPT-3.5-turbo**: Simple tasks (flashcards, vocabulary extraction)
- **GPT-4o-mini**: Most tasks (default - best balance of cost/quality)
- **GPT-4o**: Complex analysis and improvements

### 3. Built-in Caching
- Automatic response caching (1 hour default)
- Cache key based on task + content + config
- Admin endpoint to clear cache

### 4. Usage Tracking
- Token counting and cost estimation
- Per-user, per-task, per-model analytics
- Cost projections and alerts

### 5. Batch Processing
Process multiple requests efficiently in a single call (admin only).

## Usage Examples

### Client-Side Usage

```typescript
// Simple review question generation
const response = await fetch('/api/ai/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    task: 'generate_review_questions',
    content: {
      content: {
        kanji: ['学', '校', '生'],
        vocabulary: [
          { word: '学校', reading: 'がっこう', meaning: 'school' }
        ]
      },
      questionCount: 10,
      questionTypes: ['multiple_choice', 'fill_blank']
    },
    config: {
      jlptLevel: 'N5',
      difficulty: 'medium'
    }
  })
});

const result = await response.json();
// result.data contains array of ReviewQuestion objects
```

### Grammar Explanation

```typescript
const response = await fetch('/api/ai/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    task: 'explain_grammar',
    content: {
      content: 'これは本です',
      focusPoints: ['です usage', 'これ vs それ']
    },
    config: {
      jlptLevel: 'N5',
      style: 'casual',
      includeExamples: true
    }
  })
});
```

### Transcript Processing (When Implemented)

```typescript
const response = await fetch('/api/ai/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    task: 'clean_transcript',
    content: {
      content: {
        transcript: [...], // Array of transcript segments
        videoTitle: 'Japanese Lesson'
      },
      splitForShadowing: true,
      maxSegmentLength: 20,
      addFurigana: true
    },
    config: {
      jlptLevel: 'N4'
    }
  })
});
```

### Article Processing (When Implemented)

```typescript
const response = await fetch('/api/ai/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    task: 'process_article',
    content: {
      content: {
        html: '<article>...</article>',
        url: 'https://example.com/article'
      },
      simplifyTo: 'N3',
      extractVocabulary: true,
      generateQuiz: true
    }
  })
});
```

## API Endpoints

### POST /api/ai/process
Main processing endpoint for all AI tasks.

**Request Body:**
```typescript
{
  task: AITaskType,           // Required: Task to perform
  content: any,               // Required: Task-specific content
  config?: {                  // Optional: Task configuration
    jlptLevel?: JLPTLevel,
    difficulty?: 'easy' | 'medium' | 'hard',
    style?: 'formal' | 'casual',
    // ... other task-specific options
  },
  metadata?: {                // Optional: Request metadata
    sessionId?: string,
    priority?: 'low' | 'normal' | 'high'
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  data?: any,                 // Task-specific response data
  error?: string,
  usage?: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    estimatedCost: number
  },
  cached?: boolean,
  processingTime?: number,
  metadata?: {
    modelUsed: AIModel,
    totalCost: number
  }
}
```

### GET /api/ai/process
Health check endpoint.

### PUT /api/ai/process
Batch processing (admin only, max 50 requests).

### PATCH /api/ai/process
Get usage statistics.

### DELETE /api/ai/process
Clear cache (admin only).

## Adding New Task Types

### 1. Define Types
Add to `/src/lib/ai/types.ts`:

```typescript
// Add task type
export type AITaskType =
  | 'existing_tasks...'
  | 'your_new_task';

// Add request/response interfaces
export interface YourTaskRequest {
  content: {
    // Your content structure
  };
  // Task-specific options
}

export interface YourTaskResponse {
  // Response structure
}
```

### 2. Create Processor
Create `/src/lib/ai/processors/YourProcessor.ts`:

```typescript
import { BaseProcessor } from './BaseProcessor';

export class YourProcessor extends BaseProcessor<YourTaskRequest, YourTaskResponse> {
  async process(request: YourTaskRequest, config?: TaskConfig) {
    this.validateRequest(request);

    const systemPrompt = this.getSystemPrompt(config);
    const userPrompt = this.getUserPrompt(request, config);

    const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
    const result = this.parseResponse(content);

    return { data: result, usage };
  }

  validateRequest(request: YourTaskRequest): void {
    // Validation logic
  }

  getSystemPrompt(config?: TaskConfig): string {
    return `Your system prompt...`;
  }

  getUserPrompt(request: YourTaskRequest, config?: TaskConfig): string {
    return `Process this: ${request.content}`;
  }

  parseResponse(response: string): YourTaskResponse {
    return this.parseJSON(response);
  }
}
```

### 3. Register in AIService
Update `/src/lib/ai/AIService.ts`:

```typescript
private async routeToProcessor(request: AIRequest, context: ProcessorContext) {
  switch (request.task) {
    // ... existing cases

    case 'your_new_task':
      const processor = new YourProcessor(context);
      return await processor.process(request.content, request.config);
  }
}
```

## Cost Management

### Model Pricing (per 1K tokens)
- **GPT-3.5-turbo**: $0.0005 input, $0.0015 output
- **GPT-4o-mini**: $0.00015 input, $0.0006 output
- **GPT-4o**: $0.0025 input, $0.01 output

### Cost Optimization Tips
1. Use caching for repeated requests
2. Batch similar requests together
3. Use appropriate model for task complexity
4. Set reasonable max token limits
5. Monitor usage with the statistics endpoint

## Monitoring & Debugging

### View Usage Statistics
```bash
curl -X PATCH http://localhost:3000/api/ai/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Clear Cache
```bash
curl -X DELETE http://localhost:3000/api/ai/process \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Health Check
```bash
curl http://localhost:3000/api/ai/process
```

## Migration from Old Endpoints

### Old: `/api/admin/generate-story-from-moodboard`
→ New: Use task `generate_story` with moodboard content

### Old: `/api/admin/generate-kanji-moodboard`
→ New: Use task `generate_moodboard`

### Old: YouTube transcript formatting
→ New: Use task `clean_transcript` or `fix_transcript`

## Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...

# Optional (for extended features)
REDIS_URL=redis://...         # For distributed caching
FIREBASE_ADMIN_SDK=...        # For auth and logging
```

## Security Considerations

1. **Authentication Required**: All endpoints require Bearer token
2. **Admin Tasks**: Some tasks restricted to admin users
3. **Rate Limiting**: Built-in via token usage tracking
4. **Input Validation**: All inputs validated before processing
5. **Cost Controls**: Monitor usage and set alerts

## Performance

- **Response Caching**: 1-hour default, configurable per request
- **Batch Processing**: Up to 50 requests in parallel
- **Token Limits**: 4000 default, configurable
- **Timeout**: 30 seconds default, max 60 seconds

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Set `OPENAI_API_KEY` in environment variables

2. **"Rate limit exceeded"**
   - Wait before retrying
   - Consider upgrading OpenAI plan

3. **"Cache not working"**
   - Check cache key generation
   - Verify cache duration settings

4. **High costs**
   - Review model selection
   - Enable caching
   - Monitor usage statistics

## Future Enhancements

- [ ] Streaming responses for long-form content
- [ ] WebSocket support for real-time processing
- [ ] Fine-tuned models for specific tasks
- [ ] Multi-language support beyond Japanese
- [ ] A/B testing framework for prompts
- [ ] Automatic prompt optimization
- [ ] Redis-based distributed caching
- [ ] GraphQL interface option

## Support

For issues or questions, check:
1. This documentation
2. Type definitions in `/src/lib/ai/types.ts`
3. Processor implementations in `/src/lib/ai/processors/`
4. API logs for debugging

---

Last Updated: 2025-01-22
Version: 1.0.0