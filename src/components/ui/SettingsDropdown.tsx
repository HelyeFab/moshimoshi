'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Settings, ChevronDown, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export interface SettingsSection {
  id: string
  title: string
  items: SettingsItem[]
}

export interface SettingsItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  type?: 'button' | 'toggle' | 'select'
  value?: boolean | string
  options?: { value: string; label: string }[]
  description?: string
}

interface SettingsDropdownProps {
  sections: SettingsSection[]
  buttonLabel?: string
  buttonIcon?: React.ReactNode
  buttonClassName?: string
  dropdownClassName?: string
  position?: 'left' | 'right'
  showDividers?: boolean
  onClose?: () => void
}

export default function SettingsDropdown({
  sections,
  buttonLabel,
  buttonIcon = <Settings className="w-4 h-4" />,
  buttonClassName = '',
  dropdownClassName = '',
  position = 'right',
  showDividers = true,
  onClose
}: SettingsDropdownProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        onClose?.()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        onClose?.()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (isOpen) {
      onClose?.()
    }
  }

  const handleItemClick = (item: SettingsItem) => {
    if (!item.disabled) {
      item.onClick()
      if (item.type !== 'toggle') {
        setIsOpen(false)
        onClose?.()
      }
    }
  }

  const baseButtonClasses = 'px-4 py-2 rounded-lg bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center gap-2'

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={buttonClassName || baseButtonClasses}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {buttonIcon}
        {buttonLabel && <span>{buttonLabel}</span>}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute ${position === 'left' ? 'left-0' : 'right-0'} mt-2 w-56 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 z-50 ${dropdownClassName}`}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Mobile close button */}
          <div className="md:hidden flex justify-end p-2 border-b border-gray-200 dark:border-dark-700">
            <button
              onClick={() => {
                setIsOpen(false)
                onClose?.()
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {sections.map((section, sectionIndex) => (
            <div
              key={section.id}
              className={`${showDividers && sectionIndex < sections.length - 1 ? 'border-b border-gray-200 dark:border-dark-700' : ''} p-2`}
            >
              {section.title && (
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1 uppercase tracking-wider">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className={`w-full text-left px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex items-center justify-between ${
                    item.active
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300'
                  } ${
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                    <div className="flex-1">
                      <div className="text-sm">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggle or value display */}
                  {item.type === 'toggle' && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        item.value
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {item.value ? t('common.on') : t('common.off')}
                    </span>
                  )}

                  {item.type === 'select' && item.value && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.value}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Preset configurations for common use cases
export function FilterSettingsDropdown({
  filters,
  activeFilter,
  onFilterChange,
  buttonLabel = 'Filter',
  ...props
}: {
  filters: { value: string; label: string; icon?: React.ReactNode }[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  buttonLabel?: string
} & Omit<SettingsDropdownProps, 'sections'>) {
  const { t } = useI18n()

  const sections: SettingsSection[] = [
    {
      id: 'filters',
      title: t('common.filter'),
      items: filters.map(filter => ({
        id: filter.value,
        label: filter.label,
        icon: filter.icon,
        active: activeFilter === filter.value,
        onClick: () => onFilterChange(filter.value)
      }))
    }
  ]

  return <SettingsDropdown sections={sections} buttonLabel={buttonLabel} {...props} />
}

export function DisplaySettingsDropdown({
  settings,
  onSettingChange,
  buttonLabel = 'Display',
  ...props
}: {
  settings: {
    id: string
    label: string
    value: boolean
    icon?: React.ReactNode
    description?: string
  }[]
  onSettingChange: (id: string, value: boolean) => void
  buttonLabel?: string
} & Omit<SettingsDropdownProps, 'sections'>) {
  const { t } = useI18n()

  const sections: SettingsSection[] = [
    {
      id: 'display',
      title: t('common.display'),
      items: settings.map(setting => ({
        id: setting.id,
        label: setting.label,
        icon: setting.icon,
        description: setting.description,
        type: 'toggle' as const,
        value: setting.value,
        onClick: () => onSettingChange(setting.id, !setting.value)
      }))
    }
  ]

  return <SettingsDropdown sections={sections} buttonLabel={buttonLabel} {...props} />
}

export function ActionSettingsDropdown({
  actions,
  buttonLabel = 'Actions',
  ...props
}: {
  actions: {
    id: string
    label: string
    icon?: React.ReactNode
    onClick: () => void
    disabled?: boolean
    description?: string
  }[]
  buttonLabel?: string
} & Omit<SettingsDropdownProps, 'sections'>) {
  const { t } = useI18n()

  const sections: SettingsSection[] = [
    {
      id: 'actions',
      title: t('common.actions'),
      items: actions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        description: action.description,
        disabled: action.disabled,
        onClick: action.onClick
      }))
    }
  ]

  return <SettingsDropdown sections={sections} buttonLabel={buttonLabel} {...props} />
}