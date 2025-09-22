'use client';

import React from 'react';
import { useToast } from './ToastContext';
import ToastItem from './ToastItem';

export default function ToastContainer() {
  const { toasts, position } = useToast();

  const getPositionClasses = () => {
    const base = 'fixed z-50 pointer-events-none flex flex-col gap-2 p-4';
    
    switch (position) {
      case 'top':
        return `${base} top-0 left-1/2 -translate-x-1/2 items-center`;
      case 'bottom':
        return `${base} bottom-0 left-1/2 -translate-x-1/2 items-center`;
      case 'top-left':
        return `${base} top-0 left-0 items-start`;
      case 'top-right':
        return `${base} top-0 right-0 items-end`;
      case 'bottom-left':
        return `${base} bottom-0 left-0 items-start`;
      case 'bottom-right':
        return `${base} bottom-0 right-0 items-end`;
      default:
        return `${base} bottom-0 left-1/2 -translate-x-1/2 items-center`;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className={getPositionClasses()}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}