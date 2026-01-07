/**
 * Content Moderation Processor
 * Uses existing Ollama infrastructure to moderate Q&A content
 *
 * Checks for:
 * - Hate speech, racism, discrimination
 * - Spam and promotional content
 * - Personal attacks and harassment
 * - Off-topic content (not related to Japanese learning)
 * - Inappropriate language
 *
 * Reuses: OllamaClient (Modal-hosted Qwen 2.5 32B)
 */

import { BaseProcessor } from './BaseProcessor'
import { OllamaClient } from '../clients/OllamaClient'
import type { ProcessorContext } from '../types'

export interface ContentModerationRequest {
  content: string
  type: 'question' | 'answer'
  title?: string // For questions
  metadata?: {
    userId?: string
    previousViolations?: number
  }
}

export interface ContentModerationResult {
  approved: boolean
  confidence: number // 0-1 scale
  reason?: string
  categories?: {
    hateSpeech?: boolean
    spam?: boolean
    offTopic?: boolean
    personalAttack?: boolean
    inappropriate?: boolean
  }
  flaggedTerms?: string[]
  severity?: 'low' | 'medium' | 'high' // Violation severity
}

export class ContentModerationProcessor extends BaseProcessor<
  ContentModerationRequest,
  ContentModerationResult
> {
  protected taskType = 'content_moderation' as const
  private ollamaClient: OllamaClient

  constructor(context: ProcessorContext) {
    super(context)

    // Reuse existing Ollama setup
    const modalApiKey = process.env.MODAL_API_KEY || ''
    const ollamaBaseUrl =
      process.env.OLLAMA_BASE_URL ||
      'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run'

    this.ollamaClient = new OllamaClient({
      baseUrl: ollamaBaseUrl,
      apiKey: modalApiKey,
      model: 'qwen2.5:32b',
      timeout: 30000,
      maxRetries: 2,
    })
  }

  /**
   * Main moderation logic
   */
  async process(
    request: ContentModerationRequest,
    config?: any
  ): Promise<{ data: ContentModerationResult; usage: any }> {
    const { content, type, title, metadata } = request

    // Build context-aware moderation prompt
    const systemPrompt = this.buildModerationPrompt(type)
    const userPrompt = this.buildUserPrompt(content, title)

    try {
      // Call Ollama (same as story generation uses)
      const response = await this.ollamaClient.chatCompletions({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.3, // Low temperature for consistent moderation
          num_predict: 500,
        },
      })

      // Parse JSON response
      const result = this.parseModerationResponse(response.content)

      // Log moderation decision for audit
      this.logModerationDecision(request, result, metadata)

      return {
        data: result,
        usage: response.usage || {},
      }
    } catch (error) {
      console.error('Content moderation failed:', error)

      // Fallback: Reject on error (safe default)
      return {
        data: {
          approved: false,
          confidence: 0,
          reason: 'Moderation service unavailable. Please try again later.',
          severity: 'high',
        },
        usage: {},
      }
    }
  }

  /**
   * Required: Validate the request before processing
   */
  public validateRequest(request: ContentModerationRequest): void {
    if (!request.content || request.content.trim().length === 0) {
      throw new Error('Content cannot be empty')
    }
    if (!request.type || !['question', 'answer'].includes(request.type)) {
      throw new Error('Type must be either "question" or "answer"')
    }
  }

  /**
   * Required: Get system prompt
   */
  public getSystemPrompt(request: ContentModerationRequest): string {
    return this.buildModerationPrompt(request.type)
  }

  /**
   * Required: Get user prompt
   */
  public getUserPrompt(request: ContentModerationRequest): string {
    return this.buildUserPrompt(request.content, request.title)
  }

  /**
   * Required: Parse LLM response
   */
  public parseResponse(rawResponse: string): ContentModerationResult {
    return this.parseModerationResponse(rawResponse)
  }

  /**
   * Build system prompt for moderation
   */
  private buildModerationPrompt(type: 'question' | 'answer'): string {
    return `You are a content moderator for a Japanese learning community Q&A platform.

Your role: Evaluate ${type}s for policy violations while being fair and supportive of learners.

**Approve** content that:
- Asks genuine questions about Japanese language/culture
- Provides helpful answers (even if not perfect)
- Uses respectful language
- Stays on-topic for Japanese learning

**Reject** content that contains:
1. **Hate Speech**: Racism, sexism, homophobia, religious intolerance, discrimination
2. **Spam**: Promotional content, advertisements, repetitive posts, links to external products
3. **Personal Attacks**: Harassment, insults, bullying, doxxing
4. **Inappropriate Content**: Sexual content, violence, illegal activities, self-harm
5. **Off-Topic**: No relation to Japanese language/culture learning

**Important Guidelines**:
- Beginners may have imperfect grammar - this is OK
- Allow questions about sensitive cultural topics if asked respectfully
- Typos and informal language are acceptable
- Allow frustrated expressions like "this is hard!" - learning frustration is normal
- When in doubt, approve (favor over-approval vs over-censorship)

Return ONLY valid JSON in this exact format:
{
  "approved": boolean,
  "confidence": number (0.0 to 1.0),
  "reason": "brief explanation if rejected, null if approved",
  "categories": {
    "hateSpeech": boolean,
    "spam": boolean,
    "offTopic": boolean,
    "personalAttack": boolean,
    "inappropriate": boolean
  },
  "flaggedTerms": ["array of problematic words/phrases if any"],
  "severity": "low" | "medium" | "high" (only if rejected)
}

Examples:

Question: "How do I say 'thank you' in Japanese?"
Response: {"approved": true, "confidence": 1.0, "reason": null, "categories": {...all false}, "flaggedTerms": [], "severity": null}

Question: "Buy cheap Rolex watches at my-spam-site.com"
Response: {"approved": false, "confidence": 0.95, "reason": "Spam/promotional content", "categories": {"spam": true, ...}, "flaggedTerms": ["buy", "cheap", "my-spam-site.com"], "severity": "high"}

Answer: "You're an idiot for not knowing this basic grammar."
Response: {"approved": false, "confidence": 0.9, "reason": "Personal attack/disrespectful language", "categories": {"personalAttack": true, ...}, "flaggedTerms": ["idiot"], "severity": "medium"}

Be fair, supportive of learners, and protective of community safety.`
  }

  /**
   * Build user prompt with content to moderate
   */
  private buildUserPrompt(content: string, title?: string): string {
    if (title) {
      return `Moderate this question:

Title: "${title}"

Content:
${content}

Provide moderation decision as JSON.`
    }

    return `Moderate this answer:

${content}

Provide moderation decision as JSON.`
  }

  /**
   * Parse Ollama response into structured result
   */
  private parseModerationResponse(rawResponse: string): ContentModerationResult {
    try {
      // Extract JSON from response (Ollama might add extra text)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      // Validate required fields
      if (typeof parsed.approved !== 'boolean') {
        throw new Error('Missing or invalid "approved" field')
      }

      return {
        approved: parsed.approved,
        confidence: parsed.confidence || 0.5,
        reason: parsed.reason || undefined,
        categories: parsed.categories || {},
        flaggedTerms: parsed.flaggedTerms || [],
        severity: parsed.severity || undefined,
      }
    } catch (error) {
      console.error('Failed to parse moderation response:', error, rawResponse)

      // Fallback: reject if we can't parse (safe default)
      return {
        approved: false,
        confidence: 0,
        reason: 'Moderation analysis failed. Please rephrase your content.',
        severity: 'high',
      }
    }
  }

  /**
   * Log moderation decision for audit trail
   */
  private logModerationDecision(
    request: ContentModerationRequest,
    result: ContentModerationResult,
    metadata?: ContentModerationRequest['metadata']
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: request.type,
      approved: result.approved,
      confidence: result.confidence,
      reason: result.reason,
      severity: result.severity,
      userId: metadata?.userId,
      contentPreview: request.content.substring(0, 100),
    }

    // Log to console (Firebase Functions will capture this)
    console.log('[Content Moderation]', JSON.stringify(logEntry))

    // TODO: Optionally store in Firestore for admin dashboard
    // db.collection('moderation_logs').add(logEntry)
  }

  /**
   * Batch moderate multiple pieces of content
   * Useful for moderating questions + answers together
   */
  async batchModerate(
    requests: ContentModerationRequest[]
  ): Promise<ContentModerationResult[]> {
    const results = await Promise.all(requests.map(req => this.process(req)))
    return results.map(r => r.data)
  }

  /**
   * Quick spam check (faster, less accurate)
   * Use this for initial filtering before full moderation
   */
  isLikelySpam(content: string): boolean {
    const spamIndicators = [
      /https?:\/\/[^\s]+/gi, // Multiple URLs
      /buy\s+(now|cheap|discount|sale)/i,
      /click\s+here/i,
      /limited\s+time/i,
      /earn\s+money/i,
      /work\s+from\s+home/i,
      /viagra|cialis|pharmacy/i,
      /(\.com|\.net|\.org){2,}/i, // Multiple domains
    ]

    const urlCount = (content.match(/https?:\/\//g) || []).length
    if (urlCount > 2) return true

    return spamIndicators.some(regex => regex.test(content))
  }

  /**
   * Check if content likely needs human review
   * For borderline cases
   */
  needsHumanReview(result: ContentModerationResult): boolean {
    // Low confidence decisions should be reviewed
    if (result.confidence < 0.7) return true

    // Medium severity rejections should be reviewed
    if (!result.approved && result.severity === 'medium') return true

    return false
  }
}
