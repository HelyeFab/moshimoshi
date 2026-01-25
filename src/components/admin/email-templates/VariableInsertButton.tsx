'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TemplateVariable } from '@/lib/email/templates/types'
import { SYSTEM_VARIABLES } from '@/lib/email/templates/types'
import { formatVariable } from '@/lib/email/templates/variables'

interface VariableInsertButtonProps {
  customVariables: TemplateVariable[]
  onInsert: (variableText: string) => void
  disabled?: boolean
}

export function VariableInsertButton({
  customVariables,
  onInsert,
  disabled = false,
}: VariableInsertButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInsert = (variableName: string) => {
    onInsert(formatVariable(variableName))
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-1 px-3 py-2 rounded transition-colors text-sm font-medium
          ${isOpen
            ? 'bg-primary-500 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title="Insert Variable"
      >
        <span className="font-mono">{'{{}}'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-auto">
          {/* System Variables */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">
              System Variables
            </p>
            {SYSTEM_VARIABLES.map((variable) => (
              <button
                key={variable.name}
                onClick={() => handleInsert(variable.name)}
                className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                    {`{{${variable.name}}}`}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {variable.label}
                </p>
              </button>
            ))}
          </div>

          {/* Custom Variables */}
          {customVariables.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">
                Custom Variables
              </p>
              {customVariables.map((variable) => (
                <button
                  key={variable.name}
                  onClick={() => handleInsert(variable.name)}
                  className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-green-600 dark:text-green-400">
                      {`{{${variable.name}}}`}
                    </span>
                    {variable.required && (
                      <span className="text-xs text-red-500">Required</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {variable.label}
                  </p>
                </button>
              ))}
            </div>
          )}

          {customVariables.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>No custom variables defined</p>
              <p className="text-xs mt-1">Add custom variables in the Variables Manager section</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
