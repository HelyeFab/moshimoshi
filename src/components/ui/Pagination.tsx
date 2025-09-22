import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  maxVisible = 5,
  size = 'md',
  className = ''
}: PaginationProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      const halfVisible = Math.floor((maxVisible - 2) / 2);
      let start = Math.max(2, currentPage - halfVisible);
      let end = Math.min(totalPages - 1, currentPage + halfVisible);
      
      // Adjust if we're near the beginning
      if (currentPage <= halfVisible + 1) {
        end = maxVisible - 1;
      }
      
      // Adjust if we're near the end
      if (currentPage >= totalPages - halfVisible) {
        start = totalPages - maxVisible + 2;
      }
      
      // Add ellipsis if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  const handlePageClick = (page: number) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const buttonClass = `
    ${sizeClasses[size]}
    rounded-lg font-medium transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const pageButtonClass = (page: number) => `
    ${buttonClass}
    ${page === currentPage
      ? 'bg-primary-500 text-white dark:bg-primary-600'
      : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600'
    }
  `;

  return (
    <nav className={`flex items-center gap-1 ${className}`} aria-label="Pagination">
      {showFirstLast && (
        <button
          onClick={() => handlePageClick(1)}
          disabled={currentPage === 1}
          className={`${buttonClass} bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600`}
          aria-label="First page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      <button
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${buttonClass} bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600`}
        aria-label="Previous page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-500 dark:text-dark-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageClick(page as number)}
              className={pageButtonClass(page as number)}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          )
        ))}
      </div>

      <button
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${buttonClass} bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600`}
        aria-label="Next page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      
      {showFirstLast && (
        <button
          onClick={() => handlePageClick(totalPages)}
          disabled={currentPage === totalPages}
          className={`${buttonClass} bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600`}
          aria-label="Last page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </nav>
  );
}

// Simple pagination info component
interface PaginationInfoProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  className?: string;
}

export function PaginationInfo({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  className = ''
}: PaginationInfoProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`text-sm text-gray-600 dark:text-dark-400 ${className}`}>
      Showing {startItem} to {endItem} of {totalItems} results
    </div>
  );
}