/**
 * BookSummaryProcessor - Generates condensed book summaries in Japanese
 * Standalone processor (no base class)
 */

import { OllamaClient } from '../clients/OllamaClient'
import { getProviderConfig, selectProvider, providerHealth } from '../config/providers'
import { JLPTLevel } from '@/types/ai-story'
import OpenAI from 'openai'

interface BookSummaryRequest {
  bookName: string
  author?: string
  jlptLevel: JLPTLevel
  additionalContext?: string
}

interface BookSummaryResult {
  title: string
  titleJa: string
  summary: string
  content: string
  translation: string  // English translation of the content
  wordCount: number
  readingTime: number
  category?: string
  author?: string
}

interface ProcessorContext {
  model: string
  userId?: string
  config: {
    timeout?: number
    maxRetries?: number
    temperature?: number
  }
}

interface ProcessorResult {
  data: BookSummaryResult
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
  }
  metadata?: any
}

export class BookSummaryProcessorHybrid {
  private ollamaClient: OllamaClient | null = null
  private providerConfig = getProviderConfig()
  private openai: OpenAI | null = null

  constructor() {
    // Don't initialize clients in constructor - lazy load them when needed
    // This prevents issues with environment variables not being available at build time
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
      })
    }
    return this.openai
  }

  private getOllamaClient(): OllamaClient | null {
    if (!this.ollamaClient && this.providerConfig.enabled.ollama) {
      try {
        this.ollamaClient = new OllamaClient({
          baseUrl: process.env.OLLAMA_BASE_URL || '',
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          timeout: parseInt(process.env.OLLAMA_TIMEOUT || '600000'), // 10 minutes for book generation
          maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '1'), // Only 1 retry to avoid wasting time
          apiKey: process.env.MODAL_API_KEY || '',
        })
      } catch (error) {
        console.error('Failed to initialize Ollama client:', error)
        this.ollamaClient = null
      }
    }
    return this.ollamaClient
  }

  async process(request: BookSummaryRequest, context: ProcessorContext): Promise<ProcessorResult> {
    const provider = selectProvider('generate_book_summary', this.providerConfig)

    console.log(`🤖 Using ${provider} for book summary generation: ${request.bookName}`)

    try {
      if (provider === 'ollama' && this.getOllamaClient() && providerHealth.isHealthy('ollama')) {
        return await this.processWithOllama(request, context)
      } else {
        return await this.processWithOpenAI(request, context)
      }
    } catch (error) {
      console.error(`❌ ${provider} failed for book summary:`, error)

      if (provider === 'ollama') {
        providerHealth.markUnhealthy('ollama')
        console.warn(`⚠️  Falling back to OpenAI for book summary`)
        return await this.processWithOpenAI(request, context)
      }

      throw error
    }
  }

  private async processWithOpenAI(
    request: BookSummaryRequest,
    context: ProcessorContext
  ): Promise<ProcessorResult> {
    const { bookName, author, jlptLevel, additionalContext } = request
    const authorInfo = author ? ` by ${author}` : ''

    const prompt = this.buildPrompt(bookName, authorInfo, jlptLevel, additionalContext)

    const openai = this.getOpenAI()
    const response = await openai.chat.completions.create({
      model: context.model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert Japanese storyteller who creates engaging narrative versions of books for Japanese learners. You ALWAYS write at least 1000 characters of narrative story content in Japanese. You NEVER write summaries or lists - only full narrative stories with proper flow, dialogue, and character development. When the author is not provided, you research and include the correct author name in your response.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: context.config.temperature || 0.7,
      max_tokens: 4096, // Increased for longer book content
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const result = this.parseResponse(content)

    return {
      data: result,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        estimatedCost: (response.usage?.total_tokens || 0) * 0.00000015 || 0,
      },
      metadata: {
        provider: 'openai',
        model: context.model,
      },
    }
  }

  private async processWithOllama(
    request: BookSummaryRequest,
    context: ProcessorContext
  ): Promise<ProcessorResult> {
    const ollamaClient = this.getOllamaClient()
    if (!ollamaClient) {
      throw new Error('Ollama client not initialized')
    }

    const { bookName, author, jlptLevel, additionalContext } = request
    const authorInfo = author ? ` by ${author}` : ''

    const prompt = this.buildPrompt(bookName, authorInfo, jlptLevel, additionalContext)

    const startTime = Date.now()
    const response = await ollamaClient.generate({
      prompt,
      format: 'json',
      options: {
        temperature: context.config.temperature || 0.7,
        num_predict: 6144, // Reduced for shorter books (1000-1500 chars target)
      },
    })

    const processingTime = Date.now() - startTime
    const result = this.parseResponse(response.response)

    providerHealth.markHealthy('ollama')

    return {
      data: result,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
        estimatedCost: 0,
      },
      metadata: {
        provider: 'ollama',
        model: ollamaClient['config'].model,
        processingTime,
      },
    }
  }

  private buildPrompt(
    bookName: string,
    authorInfo: string,
    jlptLevel: JLPTLevel,
    additionalContext?: string
  ): string {
    const levelGuide = this.getJLPTLevelGuide(jlptLevel)

    return `You are a Japanese language expert creating condensed NARRATIVE book versions for Japanese learners.

**Task:** Create a NARRATIVE condensed version of "${bookName}"${authorInfo} in Japanese, suitable for ${jlptLevel} level learners.

**CRITICAL: This must be a STORY, not a summary!**
- Write it like a SHORT NOVEL or SHORT STORY in narrative form
- Use past tense narrative (〜ました、〜でした) throughout
- Show the story unfolding through scenes and dialogue
- Include character thoughts and emotions
- Make it engaging and immersive like reading an actual book

**JLPT ${jlptLevel} Guidelines:**
${levelGuide}

${additionalContext ? `**Additional Context:** ${additionalContext}\n\n` : ''}

**Requirements:**
1. **LENGTH: Minimum 1000 characters, target 1200-1500 characters** (IMPORTANT - aim for at least 1000 characters!)
2. Write in NARRATIVE STORY form, not as a list or summary
3. Use past tense throughout (〜ました、〜でした) to tell the story
4. Divide into 4-6 clear paragraphs with proper paragraph breaks
5. Start with an engaging opening scene
6. Include key plot points and character development
7. End with a satisfying conclusion
8. Use dialogue when appropriate (「」quotation marks)
9. Show emotions and character thoughts
10. Use vocabulary and grammar appropriate for ${jlptLevel} level

**EXAMPLE FORMAT (DO NOT COPY, just follow this STYLE):**
昔々、小さな村に一人の少年が住んでいました。少年の名前は太郎といいました。太郎は毎日、村の外れにある森に行って、鳥たちと遊ぶのが大好きでした。

ある日のこと、太郎は森の奥で不思議な光を見つけました。「なんだろう？」と思いながら、光の方へ近づいていきました。そこには、今まで見たことがないような美しい花が咲いていました。

[Continue the narrative for 1000-1500 characters total...]

**Output Format (JSON):**
{
  "title": "English title for the condensed version",
  "titleJa": "日本語のタイトル (Japanese title - make it engaging!)",
  "summary": "Brief 2-3 sentence summary IN JAPANESE of what this condensed version covers",
  "content": "Full narrative Japanese text (MINIMUM 1000 characters, target 1200-1500 characters) written in story form with proper paragraphs",
  "translation": "Full natural English translation of the content above (preserve story flow, emotion, and paragraph structure)",
  "category": "Genre category (fiction/non-fiction/self-help/etc.)",
  "author": "Original book author name${authorInfo ? ' (use: ' + authorInfo.replace(' by ', '') + ')' : ' (research and provide the actual author name)'}"
}

**REMEMBER:**
- Aim for at least 1000 characters in the content field!
- Write it as a STORY, not a summary!
- Use narrative past tense throughout!
- Include paragraphs and proper flow!

Generate the condensed book narrative now.`
  }

  private getJLPTLevelGuide(level: JLPTLevel): string {
    const guides = {
      N5: `- Use basic vocabulary (about 800 words)
- Simple sentence structures (です/ます forms)
- Present and past tense
- Basic particles (は、が、を、に、で、と)
- Hiragana and basic kanji only`,

      N4: `- Vocabulary: about 1,500 words
- More complex sentences with conjunctions (が、けど、から、ので)
- Dictionary form verbs
- て-form and た-form
- Common kanji (about 300 characters)`,

      N3: `- Vocabulary: about 3,000 words
- Intermediate grammar (conditional, potential, passive)
- More kanji compounds
- Casual and formal speech levels
- Abstract concepts can be introduced`,

      N2: `- Vocabulary: about 6,000 words
- Advanced grammar patterns
- Complex sentence structures
- Nuanced expressions
- More sophisticated kanji usage`,

      N1: `- Advanced vocabulary (10,000+ words)
- Complex grammar and expressions
- Idiomatic language
- Literary and formal styles
- Full range of kanji`,
    }

    return guides[level] || guides.N5
  }

  private parseResponse(content: string): BookSummaryResult {
    try {
      const parsed = JSON.parse(content)

      const wordCount = parsed.content?.length || 0

      // Validate minimum length (lowered to 500 for shorter books)
      if (wordCount < 500) {
        console.error(`❌ Content too short: ${wordCount} characters (minimum: 500)`)
        throw new Error(
          `Generated content is too short (${wordCount} characters). Minimum required: 500 characters. Please try again.`
        )
      }

      // Japanese reading: ~200 characters per minute (slower than English due to kanji complexity)
      const readingTime = Math.ceil(wordCount / 200)

      console.log(
        `✅ Book content validated: ${wordCount} characters, ~${readingTime} min read time`
      )

      return {
        title: parsed.title || 'Untitled',
        titleJa: parsed.titleJa || '無題',
        summary: parsed.summary || '',
        content: parsed.content || '',
        translation: parsed.translation || '',  // Will validate/fallback in generate route
        wordCount,
        readingTime,
        category: parsed.category,
        author: parsed.author, // AI-provided author if not specified
      }
    } catch (error) {
      console.error('Failed to parse book summary response:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to parse AI response for book summary'
      )
    }
  }
}

// Export singleton instance
export const bookSummaryProcessor = new BookSummaryProcessorHybrid()
