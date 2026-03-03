/**
 * Email Template Variable Utilities
 *
 * Functions for variable substitution, extraction, and validation
 * in email templates.
 */

import type { TemplateVariable } from './types'
import { getSystemVariableNames } from './types'

/**
 * Replace {{variableName}} placeholders with actual values
 *
 * @param content - The template content with {{variable}} placeholders
 * @param variables - Key-value pairs of variable names and their values
 * @returns Content with all variables substituted
 */
export function substituteVariables(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match
  })
}

/**
 * Extract all variable names from template content
 *
 * @param content - The template content to scan
 * @returns Array of unique variable names found in content
 */
export function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{(\w+)\}\}/g)
  const variables = new Set<string>()

  for (const match of matches) {
    variables.add(match[1])
  }

  return Array.from(variables)
}

/**
 * Validate that all required variables are defined
 *
 * @param content - The template content to validate
 * @param definedVariables - Array of defined custom variables
 * @returns Validation result with missing/undefined variables
 */
export function validateVariables(
  content: string,
  definedVariables: TemplateVariable[]
): {
  valid: boolean
  missingVariables: string[]
  undefinedVariables: string[]
} {
  const usedVariables = extractVariables(content)
  const systemVarNames = getSystemVariableNames()
  const customVarNames = definedVariables.map((v) => v.name)
  const allDefinedNames = [...systemVarNames, ...customVarNames]

  // Find variables used in template but not defined anywhere
  const undefinedVariables = usedVariables.filter(
    (v) => !allDefinedNames.includes(v)
  )

  // Find required custom variables not used in template
  const requiredVarNames = definedVariables
    .filter((v) => v.required)
    .map((v) => v.name)
  const missingVariables = requiredVarNames.filter(
    (v) => !usedVariables.includes(v)
  )

  return {
    valid: undefinedVariables.length === 0,
    missingVariables,
    undefinedVariables,
  }
}

/**
 * Generate plain text version from HTML content
 *
 * Strips HTML tags and normalizes whitespace to create
 * a readable plain text version of the email.
 *
 * @param html - HTML content to convert
 * @returns Plain text version
 */
export function generatePlainText(html: string): string {
  let text = html

  // Replace common block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/tr>/gi, '\n')

  // Handle lists
  text = text.replace(/<li[^>]*>/gi, '  - ')
  text = text.replace(/<ol[^>]*>/gi, '\n')
  text = text.replace(/<ul[^>]*>/gi, '\n')

  // Handle links - keep the text and URL
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = decodeHtmlEntities(text)

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ')           // Multiple spaces/tabs to single space
  text = text.replace(/\n[ \t]+/g, '\n')        // Remove leading whitespace on lines
  text = text.replace(/[ \t]+\n/g, '\n')        // Remove trailing whitespace on lines
  text = text.replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines

  return text.trim()
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
    '&mdash;': '\u2014',
    '&ndash;': '\u2013',
    '&hellip;': '\u2026',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
  }

  let result = text
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char)
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10))
  )
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  )

  return result
}

/**
 * Build variable context for template rendering
 * Combines system variables with custom variables and user overrides
 *
 * @param userEmail - User's email address
 * @param customVariables - Custom variable definitions from template
 * @param overrides - Variable value overrides (from campaign or preview)
 * @returns Complete variable context for rendering
 */
export function buildVariableContext(
  userEmail: string,
  customVariables: TemplateVariable[],
  overrides: Record<string, string> = {}
): Record<string, string> {
  // Start with system variables
  const context: Record<string, string> = {
    email: userEmail,
    name: userEmail.split('@')[0], // Extract name from email
    unsubscribeUrl: '', // Will be set by campaign sender
    preferencesUrl: 'https://moshimoshi.app/settings/notifications',
    currentYear: new Date().getFullYear().toString(),
  }

  // Add custom variable defaults
  for (const variable of customVariables) {
    if (variable.defaultValue && !(variable.name in context)) {
      context[variable.name] = variable.defaultValue
    }
  }

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    context[key] = value
  }

  return context
}

/**
 * Preview variable context with sample data
 * Used for template previews in the admin editor
 *
 * @param customVariables - Custom variable definitions from template
 * @param sampleOverrides - Sample values for preview
 * @returns Preview variable context
 */
export function buildPreviewContext(
  customVariables: TemplateVariable[],
  sampleOverrides: Record<string, string> = {}
): Record<string, string> {
  const context: Record<string, string> = {
    email: 'preview@example.com',
    name: 'Preview User',
    unsubscribeUrl: 'https://moshimoshi.app/unsubscribe?token=preview-token',
    preferencesUrl: 'https://moshimoshi.app/settings/notifications',
    currentYear: new Date().getFullYear().toString(),
  }

  // Add custom variable defaults
  for (const variable of customVariables) {
    if (!(variable.name in context)) {
      context[variable.name] = variable.defaultValue || `[${variable.label}]`
    }
  }

  // Apply sample overrides
  for (const [key, value] of Object.entries(sampleOverrides)) {
    context[key] = value
  }

  return context
}

/**
 * Format variable for insertion into editor
 *
 * @param variableName - The variable name
 * @returns Formatted variable string {{variableName}}
 */
export function formatVariable(variableName: string): string {
  return `{{${variableName}}}`
}

/**
 * Check if a string contains any template variables
 *
 * @param content - Content to check
 * @returns True if content contains {{variable}} patterns
 */
export function hasVariables(content: string): boolean {
  return /\{\{\w+\}\}/.test(content)
}
