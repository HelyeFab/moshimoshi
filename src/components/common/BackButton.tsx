'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface BackButtonProps {
  href?: string
  label?: string
  onClick?: () => void
  variant?: 'default' | 'minimal'
}

export default function BackButton({
  href,
  label = 'Back',
  onClick,
  variant = 'default'
}: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  const baseClasses = "group inline-flex items-center gap-2 transition-all duration-200"

  const variantClasses = {
    default: "px-4 py-2 bg-soft-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-700 hover:shadow-md",
    minimal: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
  }

  const content = (
    <>
      {/* Arrow Icon */}
      <svg
        className="w-5 h-5 transition-transform group-hover:-translate-x-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>

      {/* Desktop: Show full label, Mobile: Show only "Back" or icon */}
      <span className="hidden sm:inline font-medium">
        {label}
      </span>
      <span className="sm:hidden font-medium">
        {label.includes('Back') ? 'Back' : label.split(' ')[0]}
      </span>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClasses} ${variantClasses[variant]}`}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {content}
    </button>
  )
}