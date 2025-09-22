import React, { useState, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children: React.ReactNode;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  children,
  variant = 'default',
  className = ''
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const handleTabClick = (tabId: string) => {
    if (tabs.find(t => t.id === tabId)?.disabled) return;
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const getTabStyles = () => {
    const base = 'flex items-center gap-2 px-4 py-2 font-medium transition-all';
    
    switch (variant) {
      case 'pills':
        return {
          container: 'flex gap-2 p-1 bg-gray-100 dark:bg-dark-800 rounded-lg',
          tab: `${base} rounded-md text-sm`,
          active: 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm',
          inactive: 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100'
        };
      case 'underline':
        return {
          container: 'flex border-b border-gray-200 dark:border-dark-700',
          tab: `${base} relative pb-3 text-sm`,
          active: 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 -mb-px',
          inactive: 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100'
        };
      default:
        return {
          container: 'flex gap-1 border-b border-gray-200 dark:border-dark-700',
          tab: `${base} rounded-t-lg text-sm`,
          active: 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 -mb-px',
          inactive: 'text-gray-600 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300'
        };
    }
  };

  const styles = getTabStyles();

  return (
    <div className={className}>
      <div className={styles.container} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => handleTabClick(tab.id)}
            className={`
              ${styles.tab}
              ${activeTab === tab.id ? styles.active : styles.inactive}
              ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="mt-4">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && (child as React.ReactElement<any>).props?.id === activeTab) {
            return (
              <div
                role="tabpanel"
                id={`tabpanel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
              >
                {child}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

interface TabPanelProps {
  id: string;
  children: React.ReactNode;
}

export function TabPanel({ children }: TabPanelProps) {
  return <>{children}</>;
}