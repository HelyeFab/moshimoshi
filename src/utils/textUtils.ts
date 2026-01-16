/**
 * Text utility functions for formatting and display
 */

/**
 * Truncate long text intelligently at natural break points
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 80)
 * @param ellipsis - String to append when truncated (default: '...')
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(
  text: string,
  maxLength: number = 80,
  ellipsis: string = '...'
): string {
  if (!text || text.length <= maxLength) {
    return text
  }

  // Try to find natural break points in order of preference
  const breakPoints = [
    { char: ';', offset: 0 }, // Semicolon (often separates definitions)
    { char: ',', offset: 0 }, // Comma
    { char: '.', offset: 1 }, // Period (include the period)
    { char: '、', offset: 0 }, // Japanese comma
    { char: '。', offset: 1 }, // Japanese period
    { char: ' ', offset: 0 }, // Space
    { char: '/', offset: 0 }, // Slash (common in definitions)
    { char: '(', offset: -1 }, // Before parenthesis
  ]

  let bestBreakPoint = -1

  // Find the best break point before maxLength
  for (const { char, offset } of breakPoints) {
    const lastIndex = text.lastIndexOf(char, maxLength)
    if (lastIndex !== -1 && lastIndex > bestBreakPoint) {
      bestBreakPoint = lastIndex + offset
    }
  }

  // If no good break point found, try to at least break at a space
  if (bestBreakPoint === -1) {
    const lastSpace = text.lastIndexOf(' ', maxLength)
    bestBreakPoint = lastSpace !== -1 ? lastSpace : maxLength
  }

  return text.substring(0, bestBreakPoint).trim() + ellipsis
}

/**
 * Extract the first/primary definition from a complex definition string
 * Many dictionary entries have format like: "primary def; secondary def; tertiary def"
 * @param definition - The full definition string
 * @returns The first definition segment
 */
export function getFirstDefinition(definition: string): string {
  if (!definition) return ''

  // Common separators in order of precedence
  const separators = [';', ',', '/']

  for (const separator of separators) {
    let index = -1
    let parenDepth = 0

    // Find separator that's not inside parentheses
    for (let i = 0; i < definition.length; i++) {
      if (definition[i] === '(') {
        parenDepth++
      } else if (definition[i] === ')') {
        parenDepth--
      } else if (definition[i] === separator && parenDepth === 0) {
        index = i
        break
      }
    }

    if (index !== -1 && index > 0) {
      return definition.substring(0, index).trim()
    }
  }

  return definition.trim()
}

/**
 * Clean up definition text by removing common dictionary notation
 * @param definition - Raw definition text
 * @returns Cleaned definition
 */
export function cleanDefinition(definition: string): string {
  if (!definition) return ''

  let cleaned = definition

  // Remove common dictionary annotations
  cleaned = cleaned.replace(/\([^)]*\)/g, '') // Remove parenthetical notes
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '') // Remove bracketed notes
  cleaned = cleaned.replace(/\s+/g, ' ') // Normalize whitespace
  cleaned = cleaned.replace(/^\s*to\s+/i, '') // Remove leading "to" for verbs

  return cleaned.trim()
}

/**
 * Format definition for drill display
 * Combines truncation and cleaning for optimal display
 * @param definition - Raw definition
 * @param maxLength - Maximum display length
 * @returns Formatted definition ready for display
 */
export function formatDrillDefinition(definition: string, maxLength: number = 80): string {
  // First, get the primary definition if multiple exist
  let formatted = getFirstDefinition(definition)

  // Then truncate if still too long
  formatted = truncateText(formatted, maxLength)

  return formatted
}

/**
 * Check if text needs truncation
 * @param text - Text to check
 * @param maxLength - Maximum length threshold
 * @returns true if text exceeds maxLength
 */
export function needsTruncation(text: string, maxLength: number = 80): boolean {
  return Boolean(text && text.length > maxLength)
}
