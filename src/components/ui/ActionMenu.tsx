'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreVertical } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
  hidden?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  size?: 'sm' | 'md' | 'lg'
  position?: 'left' | 'right'
  layout?: 'horizontal' | 'stacked'
  buttonClassName?: string
}

/**
 * ActionMenu - A dropdown menu for actions with a three-dot trigger
 * Perfect for hiding less frequently used actions to save space
 */
export default function ActionMenu({
  items,
  size = 'md',
  position = 'right',
  layout = 'horizontal',
  buttonClassName = ''
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Filter out hidden items
  const visibleItems = items.filter(item => !item.hidden)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleItemClick = (onClick: () => void) => {
    onClick()
    setIsOpen(false)
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2'
  }

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`
          ${buttonSizeClasses[size]}
          rounded-md
          text-gray-500 dark:text-gray-400
          hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors
          ${buttonClassName}
        `}
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreVertical className={sizeClasses[size]} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`absolute ${position === 'left' ? 'left-0' : 'right-0'} top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg py-1`}
            role="menu"
          >
            {visibleItems.map((item, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  handleItemClick(item.onClick)
                }}
                className={`
                  w-full px-3 py-2 text-sm text-left
                  transition-colors
                  ${layout === 'stacked'
                    ? 'flex flex-col items-start gap-1 py-3'
                    : 'flex items-center gap-2'
                  }
                  ${item.variant === 'danger'
                    ? 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }
                `}
                role="menuitem"
              >
                {item.icon && (
                  <span className={`flex-shrink-0 ${layout === 'stacked' ? '[&>svg]:w-4 [&>svg]:h-4' : ''}`}>
                    {item.icon}
                  </span>
                )}
                <span className={layout === 'stacked' ? 'text-xs' : ''}>{item.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
