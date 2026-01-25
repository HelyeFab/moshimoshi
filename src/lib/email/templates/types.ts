/**
 * Email Template Types
 *
 * Defines TypeScript interfaces for the email template system.
 * Templates are stored in Firestore collection: `email_templates`
 */

import { Timestamp } from 'firebase-admin/firestore'

export type TemplateCategory = 'marketing' | 'transactional' | 'notification' | 'custom'
export type TemplateStatus = 'draft' | 'active' | 'archived'
export type VariableType = 'string' | 'url' | 'date' | 'number'

/**
 * Template Variable Definition
 */
export interface TemplateVariable {
  name: string                      // "userName"
  label: string                     // "User Name"
  type: VariableType
  defaultValue?: string             // Sample value for preview
  required: boolean
}

/**
 * Email Template Document (Firestore)
 */
export interface EmailTemplate {
  id: string
  name: string                      // "Welcome Series - Day 1"
  slug: string                      // "welcome-day-1" (unique)
  description?: string
  subject: string                   // Default subject line
  htmlContent: string               // Rich HTML from Tiptap
  textContent: string               // Plain text fallback
  variables: TemplateVariable[]     // Custom variables
  category: TemplateCategory
  status: TemplateStatus
  createdBy: string
  createdAt: Timestamp
  updatedBy: string
  updatedAt: Timestamp
}

/**
 * Client-side template representation (with serialized dates)
 */
export interface EmailTemplateClient {
  id: string
  name: string
  slug: string
  description?: string
  subject: string
  htmlContent: string
  textContent: string
  variables: TemplateVariable[]
  category: TemplateCategory
  status: TemplateStatus
  createdBy: string
  createdAt: string | null
  updatedBy: string
  updatedAt: string | null
}

/**
 * Request body for creating a new template
 */
export interface CreateTemplateRequest {
  name: string
  slug: string
  description?: string
  subject: string
  htmlContent: string
  textContent: string
  variables?: TemplateVariable[]
  category: TemplateCategory
  status?: TemplateStatus
}

/**
 * Request body for updating a template
 */
export interface UpdateTemplateRequest {
  name?: string
  slug?: string
  description?: string
  subject?: string
  htmlContent?: string
  textContent?: string
  variables?: TemplateVariable[]
  category?: TemplateCategory
  status?: TemplateStatus
}

/**
 * Request body for previewing a template
 */
export interface PreviewTemplateRequest {
  variables?: Record<string, string>
}

/**
 * Response from template preview
 */
export interface PreviewTemplateResponse {
  html: string
  text: string
  subject: string
}

/**
 * System Variables (always available in templates)
 */
export const SYSTEM_VARIABLES: TemplateVariable[] = [
  {
    name: 'email',
    label: 'Recipient Email',
    type: 'string',
    defaultValue: 'user@example.com',
    required: false,
  },
  {
    name: 'name',
    label: 'Recipient Name',
    type: 'string',
    defaultValue: 'John',
    required: false,
  },
  {
    name: 'unsubscribeUrl',
    label: 'Unsubscribe Link',
    type: 'url',
    defaultValue: 'https://moshimoshi.app/unsubscribe?token=xxx',
    required: false,
  },
  {
    name: 'preferencesUrl',
    label: 'Preferences Page',
    type: 'url',
    defaultValue: 'https://moshimoshi.app/settings/notifications',
    required: false,
  },
  {
    name: 'currentYear',
    label: 'Current Year',
    type: 'string',
    defaultValue: new Date().getFullYear().toString(),
    required: false,
  },
]

/**
 * Get all system variable names
 */
export function getSystemVariableNames(): string[] {
  return SYSTEM_VARIABLES.map((v) => v.name)
}

/**
 * Get default values for system variables
 */
export function getSystemVariableDefaults(): Record<string, string> {
  return SYSTEM_VARIABLES.reduce(
    (acc, v) => {
      acc[v.name] = v.defaultValue || ''
      return acc
    },
    {} as Record<string, string>
  )
}
