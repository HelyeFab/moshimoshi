import React, { useState } from 'react';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string | string[];
  className?: string;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultOpen = [],
  className = ''
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(() => {
    if (Array.isArray(defaultOpen)) return defaultOpen;
    return defaultOpen ? [defaultOpen] : [];
  });

  const toggleItem = (itemId: string) => {
    if (allowMultiple) {
      setOpenItems(prev =>
        prev.includes(itemId)
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    } else {
      setOpenItems(prev =>
        prev.includes(itemId) ? [] : [itemId]
      );
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <AccordionItemComponent
          key={item.id}
          item={item}
          isOpen={openItems.includes(item.id)}
          onToggle={() => toggleItem(item.id)}
        />
      ))}
    </div>
  );
}

interface AccordionItemComponentProps {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItemComponent({ item, isOpen, onToggle }: AccordionItemComponentProps) {
  return (
    <div className="border border-gray-200 dark:border-dark-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${item.id}`}
      >
        <div className="flex items-center gap-3">
          {item.icon}
          <span className="font-medium text-gray-900 dark:text-dark-100">
            {item.title}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-dark-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div
        id={`accordion-content-${item.id}`}
        className={`
          overflow-hidden transition-all duration-200
          ${isOpen ? 'max-h-96' : 'max-h-0'}
        `}
      >
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-850 border-t border-gray-200 dark:border-dark-700">
          <div className="text-gray-600 dark:text-dark-400">
            {item.content}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Collapse component for single expandable sections
interface CollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Collapse({ isOpen, children, className = '' }: CollapseProps) {
  return (
    <div
      className={`
        overflow-hidden transition-all duration-300
        ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}