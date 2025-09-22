'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  variant?: 'default' | 'primary' | 'success'
  indeterminate?: boolean
  className?: string
  error?: string
}

export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'medium',
  variant = 'default',
  indeterminate = false,
  className = '',
  error
}: CheckboxProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  }

  const labelSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  }

  const variantClasses = {
    default: 'text-primary-600 dark:text-primary-500',
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-green-600 dark:text-green-500'
  }

  return (
    <div className={`flex items-start ${className}`}>
      <label className="flex items-start cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => !disabled && onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only"
          />
          
          <div
            className={`
              ${sizeClasses[size]}
              border-2 rounded
              transition-all duration-200
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${checked || indeterminate
                ? `${variantClasses[variant]} bg-current border-current`
                : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500'
              }
              ${error ? 'border-red-500 dark:border-red-400' : ''}
            `}
          >
            <AnimatePresence mode="wait">
              {(checked || indeterminate) && (
                <motion.svg
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full h-full text-white p-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {indeterminate ? (
                    <rect x="4" y="9" width="12" height="2" />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  )}
                </motion.svg>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {(label || description) && (
          <div className="ml-3">
            {label && (
              <span className={`
                ${labelSizeClasses[size]}
                font-medium text-gray-900 dark:text-gray-100
                ${disabled ? 'opacity-50' : ''}
              `}>
                {label}
              </span>
            )}
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        )}
      </label>
      
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400 mt-1 ml-8">
          {error}
        </p>
      )}
    </div>
  )
}