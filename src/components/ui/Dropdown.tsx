'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface DropdownOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'default' | 'primary' | 'secondary'
  disabled?: boolean
  error?: string
  className?: string
  position?: 'bottom' | 'top'
  showSearch?: boolean
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  size = 'medium',
  variant = 'default',
  disabled = false,
  error,
  className = '',
  position = 'bottom',
  showSearch = false
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, showSearch])

  // Filter options based on search
  const filteredOptions = showSearch && searchTerm
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  const selectedOption = options.find(opt => opt.value === value)

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-5 py-2.5 text-lg'
  }

  const variantClasses = {
    default: `
      bg-white dark:bg-dark-800 
      border-gray-300 dark:border-dark-600 
      hover:border-primary-400 dark:hover:border-primary-500
      text-gray-900 dark:text-gray-100
    `,
    primary: `
      bg-primary-50 dark:bg-primary-900/20
      border-primary-300 dark:border-primary-700
      hover:border-primary-400 dark:hover:border-primary-600
      text-primary-900 dark:text-primary-100
    `,
    secondary: `
      bg-gray-50 dark:bg-dark-700
      border-gray-200 dark:border-dark-600
      hover:border-gray-300 dark:hover:border-dark-500
      text-gray-900 dark:text-gray-100
    `
  }

  const handleSelect = (option: DropdownOption) => {
    onChange(option.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          border rounded-lg
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${error ? 'border-red-500 dark:border-red-400' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon && (
            <span className="flex-shrink-0">{selectedOption.icon}</span>
          )}
          <span className={!selectedOption ? 'text-gray-500 dark:text-gray-400' : ''}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {error && (
        <p className="mt-1 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? -10 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? -10 : 10 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute z-50 w-full mt-2
              ${position === 'top' ? 'bottom-full mb-2' : 'top-full'}
              bg-white dark:bg-dark-800
              border border-gray-200 dark:border-dark-600
              rounded-lg shadow-lg
              overflow-hidden
              max-h-64 overflow-y-auto
            `}
          >
            {/* Search Input */}
            {showSearch && (
              <div className="p-2 border-b border-gray-200 dark:border-dark-700">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-3 py-1.5 text-sm
                    bg-gray-50 dark:bg-dark-700
                    border border-gray-200 dark:border-dark-600
                    rounded-md
                    focus:outline-none focus:ring-2 focus:ring-primary-500
                    placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            )}

            {/* Options List */}
            <div className="py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option)}
                    className={`
                      w-full px-4 py-2 text-left
                      hover:bg-primary-50 dark:hover:bg-primary-900/20
                      transition-colors duration-150
                      ${option.value === value 
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100' 
                        : 'text-gray-900 dark:text-gray-100'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {option.icon && (
                        <span className="flex-shrink-0">{option.icon}</span>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {option.value === value && (
                        <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}