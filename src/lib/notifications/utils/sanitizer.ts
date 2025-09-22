/**
 * Sanitizer Utility
 * Provides XSS protection for notification content
 */

/**
 * HTML entities that need escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
}

/**
 * Dangerous HTML tags to remove
 */
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'link',
  'style',
  'meta',
  'base'
]

/**
 * Dangerous attributes to remove
 */
const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onfocus',
  'onblur',
  'onchange',
  'onsubmit',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'javascript:',
  'data:text/html'
]

/**
 * Safe HTML tags for notifications
 */
const SAFE_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'span',
  'div',
  'p'
]

/**
 * NotificationSanitizer class
 */
export class NotificationSanitizer {
  /**
   * Escape HTML entities to prevent XSS
   */
  static escapeHtml(text: string): string {
    if (!text || typeof text !== 'string') {
      return ''
    }

    return text.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char)
  }

  /**
   * Sanitize user input for notification title
   */
  static sanitizeTitle(title: string): string {
    if (!title || typeof title !== 'string') {
      return ''
    }

    // Remove all HTML tags
    let sanitized = title.replace(/<[^>]*>/g, '')

    // Escape HTML entities
    sanitized = this.escapeHtml(sanitized)

    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 97) + '...'
    }

    return sanitized.trim()
  }

  /**
   * Sanitize user input for notification body
   */
  static sanitizeBody(body: string): string {
    if (!body || typeof body !== 'string') {
      return ''
    }

    // Remove dangerous tags
    let sanitized = this.removeDangerousTags(body)

    // Remove dangerous attributes
    sanitized = this.removeDangerousAttributes(sanitized)

    // Escape remaining HTML entities
    sanitized = this.escapeHtml(sanitized)

    // Limit length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...'
    }

    return sanitized.trim()
  }

  /**
   * Sanitize URL for action links
   */
  static sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null
    }

    // Remove whitespace
    url = url.trim()

    // Check for dangerous protocols
    const dangerousProtocols = [
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'about:',
      'chrome:',
      'chrome-extension:'
    ]

    const lowerUrl = url.toLowerCase()
    if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
      console.warn('Dangerous URL protocol detected:', url)
      return null
    }

    // Ensure relative URLs start with /
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      url = '/' + url
    }

    // Validate URL format
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url)

        // Only allow HTTP(S) protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return null
        }

        // Check for localhost/private IPs (security consideration)
        if (this.isPrivateUrl(parsed.hostname)) {
          console.warn('Private/localhost URL detected:', url)
          return null
        }

        return parsed.toString()
      } else {
        // Relative URL - ensure it's safe
        return this.sanitizePath(url)
      }
    } catch (error) {
      console.error('Invalid URL:', url, error)
      return null
    }
  }

  /**
   * Sanitize path for relative URLs
   */
  private static sanitizePath(path: string): string {
    // Remove any query parameters with dangerous content
    const [pathname, search] = path.split('?')

    // Clean pathname
    let cleanPath = pathname
      .split('/')
      .filter(segment => segment !== '.' && segment !== '..')
      .join('/')

    // Ensure path starts with /
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath
    }

    // Clean query parameters if present
    if (search) {
      const params = new URLSearchParams(search)
      const cleanParams = new URLSearchParams()

      params.forEach((value, key) => {
        // Sanitize both key and value
        const cleanKey = this.escapeHtml(key)
        const cleanValue = this.escapeHtml(value)

        if (cleanKey && cleanValue) {
          cleanParams.set(cleanKey, cleanValue)
        }
      })

      const cleanSearch = cleanParams.toString()
      if (cleanSearch) {
        cleanPath += '?' + cleanSearch
      }
    }

    return cleanPath
  }

  /**
   * Check if URL points to private/localhost
   */
  private static isPrivateUrl(hostname: string): boolean {
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^::1$/,
      /^fe80:/i
    ]

    return privatePatterns.some(pattern => pattern.test(hostname))
  }

  /**
   * Remove dangerous HTML tags
   */
  private static removeDangerousTags(html: string): string {
    DANGEROUS_TAGS.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi')
      html = html.replace(regex, '')

      // Also remove self-closing tags
      const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi')
      html = html.replace(selfClosingRegex, '')
    })

    return html
  }

  /**
   * Remove dangerous attributes
   */
  private static removeDangerousAttributes(html: string): string {
    DANGEROUS_ATTRIBUTES.forEach(attr => {
      // Remove attribute="value" patterns
      const regex = new RegExp(`\\s*${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
      html = html.replace(regex, '')

      // Remove attribute=value patterns (without quotes)
      const noQuoteRegex = new RegExp(`\\s*${attr}\\s*=\\s*[^\\s>]+`, 'gi')
      html = html.replace(noQuoteRegex, '')

      // Remove standalone attributes
      if (attr.includes('on')) {
        const standaloneRegex = new RegExp(`\\s*${attr}\\s*(?=[>\\s])`, 'gi')
        html = html.replace(standaloneRegex, '')
      }
    })

    return html
  }

  /**
   * Sanitize notification data object
   */
  static sanitizeData(data: any): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return {}
    }

    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      // Sanitize key
      const cleanKey = this.escapeHtml(key)

      // Sanitize value based on type
      if (typeof value === 'string') {
        sanitized[cleanKey] = this.escapeHtml(value)
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[cleanKey] = value
      } else if (Array.isArray(value)) {
        sanitized[cleanKey] = value.map(item =>
          typeof item === 'string' ? this.escapeHtml(item) : item
        )
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[cleanKey] = this.sanitizeData(value)
      }
    }

    return sanitized
  }

  /**
   * Sanitize complete notification object
   */
  static sanitizeNotification(notification: {
    title?: string
    body?: string
    icon?: string
    badge?: string
    image?: string
    data?: any
    actionUrl?: string
    actions?: Array<{ action: string; title: string; icon?: string }>
  }): any {
    const sanitized: any = {}

    if (notification.title) {
      sanitized.title = this.sanitizeTitle(notification.title)
    }

    if (notification.body) {
      sanitized.body = this.sanitizeBody(notification.body)
    }

    if (notification.icon) {
      sanitized.icon = this.sanitizeUrl(notification.icon) || '/icons/icon-192x192.svg'
    }

    if (notification.badge) {
      sanitized.badge = this.sanitizeUrl(notification.badge) || '/icons/icon-72x72.svg'
    }

    if (notification.image) {
      sanitized.image = this.sanitizeUrl(notification.image) || undefined
    }

    if (notification.data) {
      sanitized.data = this.sanitizeData(notification.data)
    }

    if (notification.actionUrl) {
      sanitized.actionUrl = this.sanitizeUrl(notification.actionUrl)
    }

    if (notification.actions && Array.isArray(notification.actions)) {
      sanitized.actions = notification.actions.map(action => ({
        action: this.escapeHtml(action.action),
        title: this.sanitizeTitle(action.title),
        icon: action.icon ? this.sanitizeUrl(action.icon) : undefined
      }))
    }

    return sanitized
  }

  /**
   * Validate and sanitize notification content
   */
  static validate(content: any): { valid: boolean; sanitized?: any; errors?: string[] } {
    const errors: string[] = []

    // Check required fields
    if (!content.title && !content.body) {
      errors.push('Notification must have either title or body')
    }

    // Check title length
    if (content.title && content.title.length > 100) {
      errors.push('Title is too long (max 100 characters)')
    }

    // Check body length
    if (content.body && content.body.length > 500) {
      errors.push('Body is too long (max 500 characters)')
    }

    // Check actions
    if (content.actions && Array.isArray(content.actions)) {
      if (content.actions.length > 3) {
        errors.push('Too many actions (max 3)')
      }

      content.actions.forEach((action, index) => {
        if (!action.action || !action.title) {
          errors.push(`Action ${index + 1} is missing required fields`)
        }
      })
    }

    if (errors.length > 0) {
      return { valid: false, errors }
    }

    // Sanitize and return
    const sanitized = this.sanitizeNotification(content)
    return { valid: true, sanitized }
  }
}

// Export convenience functions
export const {
  escapeHtml,
  sanitizeTitle,
  sanitizeBody,
  sanitizeUrl,
  sanitizeData,
  sanitizeNotification,
  validate
} = NotificationSanitizer