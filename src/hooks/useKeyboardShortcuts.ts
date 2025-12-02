/**
 * useKeyboardShortcuts Hook
 *
 * Provides configurable keyboard shortcut management with:
 * - Modifier key support (Ctrl, Shift, Alt, Meta)
 * - Input field exclusion (don't trigger in forms)
 * - Event delegation for performance
 * - Help text generation for UI
 * - Backward compatible simple API
 */

import { useEffect, useCallback, useRef } from 'react'

// Simple API (backward compatible)
type KeyboardShortcuts = Record<string, () => void>

// Advanced API
export interface KeyBinding {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  description: string
  handler: (event: KeyboardEvent) => void
  preventDefault?: boolean
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  ignoreInputFields?: boolean
  bindings: KeyBinding[]
}

export interface ShortcutHelp {
  keys: string
  description: string
}

/**
 * Simple overload (backward compatible)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcuts,
  enabled?: boolean
): {
  isEnabled: boolean
}

/**
 * Advanced overload with KeyBinding array
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): {
  getShortcutsHelp: () => ShortcutHelp[]
}

/**
 * Implementation - unified hook that handles both simple and advanced APIs
 */
export function useKeyboardShortcuts(
  shortcutsOrOptions: KeyboardShortcuts | UseKeyboardShortcutsOptions,
  enabledParam = true
): { isEnabled?: boolean; getShortcutsHelp?: () => ShortcutHelp[] } {
  // Detect which API is being used (computed once, stable across renders)
  const isAdvancedAPI = 'bindings' in shortcutsOrOptions

  // Extract options for advanced API
  const advancedOptions = isAdvancedAPI ? (shortcutsOrOptions as UseKeyboardShortcutsOptions) : null
  const simpleShortcuts = !isAdvancedAPI ? (shortcutsOrOptions as KeyboardShortcuts) : null

  const enabled = isAdvancedAPI ? (advancedOptions?.enabled ?? true) : enabledParam
  const ignoreInputFields = advancedOptions?.ignoreInputFields ?? true
  const bindings = advancedOptions?.bindings ?? []

  const bindingsRef = useRef(bindings)
  const shortcutsRef = useRef(simpleShortcuts)

  // Update refs when values change
  useEffect(() => {
    bindingsRef.current = bindings
  }, [bindings])

  useEffect(() => {
    shortcutsRef.current = simpleShortcuts
  }, [simpleShortcuts])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      const target = event.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      const isEditable = target.isContentEditable

      // Handle advanced API
      if (isAdvancedAPI) {
        if (ignoreInputFields) {
          if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable) {
            return
          }
        }

        const binding = bindingsRef.current.find(b => {
          const keyMatches = b.key.toLowerCase() === event.key.toLowerCase()
          const ctrlMatches = b.ctrlKey === undefined ? !event.ctrlKey : b.ctrlKey === event.ctrlKey
          const shiftMatches =
            b.shiftKey === undefined ? !event.shiftKey : b.shiftKey === event.shiftKey
          const altMatches = b.altKey === undefined ? !event.altKey : b.altKey === event.altKey
          const metaMatches = b.metaKey === undefined ? !event.metaKey : b.metaKey === event.metaKey
          return keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches
        })

        if (binding) {
          if (binding.preventDefault !== false) {
            event.preventDefault()
            event.stopPropagation()
          }
          binding.handler(event)
        }
      } else {
        // Handle simple API
        if (tagName === 'input' || tagName === 'textarea' || isEditable) {
          if (event.key !== 'Escape' && event.key !== 'Enter') {
            return
          }
        }

        const modifiers: string[] = []
        if (event.ctrlKey) modifiers.push('Ctrl')
        if (event.altKey) modifiers.push('Alt')
        if (event.shiftKey) modifiers.push('Shift')
        if (event.metaKey) modifiers.push('Meta')

        const combination = modifiers.length > 0 ? `${modifiers.join('+')}+${event.key}` : event.key

        const shortcuts = shortcutsRef.current
        if (shortcuts && shortcuts[combination]) {
          event.preventDefault()
          shortcuts[combination]()
        }
      }
    },
    [enabled, ignoreInputFields, isAdvancedAPI]
  )

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])

  const getShortcutsHelp = useCallback((): ShortcutHelp[] => {
    return bindingsRef.current.map(b => ({
      keys: [
        b.ctrlKey && 'Ctrl',
        b.shiftKey && 'Shift',
        b.altKey && 'Alt',
        b.metaKey && 'Cmd',
        formatKeyName(b.key),
      ]
        .filter(Boolean)
        .join(' + '),
      description: b.description,
    }))
  }, [])

  // Return appropriate shape based on API
  if (isAdvancedAPI) {
    return { getShortcutsHelp }
  } else {
    return { isEnabled: enabled }
  }
}

/**
 * Format key name for display in UI.
 */
function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Enter: 'Enter',
    Escape: 'Esc',
  }

  return keyMap[key] || key.toUpperCase()
}
