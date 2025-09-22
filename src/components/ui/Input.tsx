import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'ghost';
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  icon,
  rightIcon,
  variant = 'default',
  inputSize = 'md',
  className = '',
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  const variantClasses = {
    default: `
      bg-white dark:bg-dark-900 
      border border-gray-300 dark:border-dark-600
      focus:border-primary-500 dark:focus:border-primary-400
    `,
    filled: `
      bg-gray-100 dark:bg-dark-800
      border border-transparent
      focus:bg-white dark:focus:bg-dark-900
      focus:border-primary-500 dark:focus:border-primary-400
    `,
    ghost: `
      bg-transparent
      border-b border-gray-300 dark:border-dark-600
      rounded-none
      focus:border-primary-500 dark:focus:border-primary-400
    `
  };

  const inputClass = `
    ${sizeClasses[inputSize]}
    ${variantClasses[variant]}
    ${icon ? 'pl-10' : ''}
    ${rightIcon ? 'pr-10' : ''}
    ${error ? 'border-red-500 dark:border-red-400' : ''}
    w-full rounded-lg
    text-gray-900 dark:text-dark-100
    placeholder-gray-500 dark:placeholder-dark-400
    focus:outline-none focus:ring-2 focus:ring-primary-500/20
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    ${className}
  `;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-dark-400">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          className={inputClass}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-dark-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-600 dark:text-dark-400">
          {hint}
        </p>
      )}
      
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Textarea component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: 'default' | 'filled' | 'ghost';
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  variant = 'default',
  inputSize = 'md',
  className = '',
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  const variantClasses = {
    default: `
      bg-white dark:bg-dark-900 
      border border-gray-300 dark:border-dark-600
      focus:border-primary-500 dark:focus:border-primary-400
    `,
    filled: `
      bg-gray-100 dark:bg-dark-800
      border border-transparent
      focus:bg-white dark:focus:bg-dark-900
      focus:border-primary-500 dark:focus:border-primary-400
    `,
    ghost: `
      bg-transparent
      border-b border-gray-300 dark:border-dark-600
      rounded-none
      focus:border-primary-500 dark:focus:border-primary-400
    `
  };

  const textareaClass = `
    ${sizeClasses[inputSize]}
    ${variantClasses[variant]}
    ${error ? 'border-red-500 dark:border-red-400' : ''}
    w-full rounded-lg
    text-gray-900 dark:text-dark-100
    placeholder-gray-500 dark:placeholder-dark-400
    focus:outline-none focus:ring-2 focus:ring-primary-500/20
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
    resize-y min-h-[100px]
    ${className}
  `;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
          {label}
        </label>
      )}
      
      <textarea
        ref={ref}
        className={textareaClass}
        {...props}
      />
      
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-600 dark:text-dark-400">
          {hint}
        </p>
      )}
      
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// Checkbox component (complementing SettingToggle)
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  error,
  hint,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          ref={ref}
          type="checkbox"
          className={`
            w-4 h-4 rounded
            text-primary-600 
            bg-white dark:bg-dark-900
            border-gray-300 dark:border-dark-600
            focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
      </div>
      
      {label && (
        <div className="ml-3">
          <label className="text-sm font-medium text-gray-700 dark:text-dark-300">
            {label}
          </label>
          {hint && (
            <p className="text-xs text-gray-600 dark:text-dark-400 mt-0.5">
              {hint}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

// Radio component
interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({
  label,
  error,
  hint,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          ref={ref}
          type="radio"
          className={`
            w-4 h-4
            text-primary-600 
            bg-white dark:bg-dark-900
            border-gray-300 dark:border-dark-600
            focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
      </div>
      
      {label && (
        <div className="ml-3">
          <label className="text-sm font-medium text-gray-700 dark:text-dark-300">
            {label}
          </label>
          {hint && (
            <p className="text-xs text-gray-600 dark:text-dark-400 mt-0.5">
              {hint}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

Radio.displayName = 'Radio';