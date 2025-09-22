'use client'

/**
 * Content Protection Utility
 * Implements basic content protection measures that DO NOT affect SEO
 * These only affect user interaction, not search engine crawlers
 */

export class ContentProtection {
  private static instance: ContentProtection;
  private enabled: boolean = false;
  private listenersAdded: boolean = false;

  private constructor() {}

  static getInstance(): ContentProtection {
    if (!ContentProtection.instance) {
      ContentProtection.instance = new ContentProtection();
    }
    return ContentProtection.instance;
  }

  /**
   * Enable all content protection measures
   * Safe for SEO - only affects user interaction
   */
  enable(): void {
    if (this.enabled || typeof window === 'undefined') return;
    
    // 1. Disable right-click context menu
    this.disableContextMenu();
    
    // 2. Disable text selection (via CSS class)
    this.disableTextSelection();
    
    // 3. Disable copy/paste events
    this.disableCopyPaste();
    
    // 4. Disable printing (via CSS)
    this.disablePrinting();
    
    // 5. Disable drag and drop of images
    this.disableImageDrag();
    
    // 6. Add keyboard shortcut protection
    this.disableKeyboardShortcuts();
    
    this.enabled = true;
    this.listenersAdded = true;
    console.log('Content protection enabled');
  }

  /**
   * Disable for specific elements (like input fields)
   */
  enableForElement(selector: string): void {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.classList.add('protected-content');
    });
  }

  /**
   * Allow interaction for specific elements
   */
  excludeElement(selector: string): void {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.classList.add('unprotected-content');
    });
  }

  private disableContextMenu(): void {
    // Prevent duplicate listeners
    if (this.listenersAdded) return;
    
    // Disable right-click globally
    document.addEventListener('contextmenu', (e) => {
      // Allow right-click on input fields and textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.classList.contains('unprotected-content')
      ) {
        return;
      }
      e.preventDefault();
      return false;
    });
  }

  private disableTextSelection(): void {
    // Check if styles already exist
    if (document.getElementById('content-protection-styles')) {
      document.body.classList.add('content-protection-enabled');
      return;
    }
    
    // Add CSS class to body
    document.body.classList.add('content-protection-enabled');
    
    // Add styles dynamically
    const style = document.createElement('style');
    style.id = 'content-protection-styles';
    style.textContent = `
      /* Disable text selection globally */
      .content-protection-enabled {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      /* Allow selection in input fields and textareas */
      .content-protection-enabled input,
      .content-protection-enabled textarea,
      .content-protection-enabled .unprotected-content {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      
      /* Disable highlighting */
      .content-protection-enabled ::selection {
        background-color: transparent;
      }
      
      .content-protection-enabled ::-moz-selection {
        background-color: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  private disableCopyPaste(): void {
    // Prevent duplicate listeners
    if (this.listenersAdded) return;
    
    // Disable copy
    document.addEventListener('copy', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.classList.contains('unprotected-content')
      ) {
        return;
      }
      e.clipboardData?.setData('text/plain', 'Content copying is disabled');
      e.preventDefault();
      return false;
    });

    // Disable cut
    document.addEventListener('cut', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.classList.contains('unprotected-content')
      ) {
        return;
      }
      e.preventDefault();
      return false;
    });

    // Disable paste (except in input fields)
    document.addEventListener('paste', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.classList.contains('unprotected-content')
      ) {
        return;
      }
      e.preventDefault();
      return false;
    });
  }

  private disablePrinting(): void {
    // Check if print styles already exist
    if (document.getElementById('content-protection-print-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'content-protection-print-styles';
    style.textContent = `
      /* Disable printing */
      @media print {
        body {
          display: none !important;
        }
        
        /* Show a message when trying to print */
        body::after {
          content: "Printing is disabled for this content. Please use the app to study.";
          display: block !important;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 24px;
          color: #000;
          background: #fff;
          padding: 20px;
          border: 2px solid #000;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private disableImageDrag(): void {
    // Prevent duplicate listeners
    if (this.listenersAdded) return;
    
    // Disable dragging of images
    document.addEventListener('dragstart', (e) => {
      if ((e.target as HTMLElement).tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    });

    // Check if image styles already exist
    if (document.getElementById('content-protection-image-styles')) {
      return;
    }
    
    // Add CSS for images
    const style = document.createElement('style');
    style.id = 'content-protection-image-styles';
    style.textContent = `
      /* Disable image dragging */
      img {
        -webkit-user-drag: none !important;
        -khtml-user-drag: none !important;
        -moz-user-drag: none !important;
        -o-user-drag: none !important;
        user-drag: none !important;
        pointer-events: none;
      }
      
      /* Allow pointer events for interactive images */
      img.interactive {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  }

  private disableKeyboardShortcuts(): void {
    // Prevent duplicate listeners
    if (this.listenersAdded) return;
    
    document.addEventListener('keydown', (e) => {
      // Allow in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.classList.contains('unprotected-content')
      ) {
        return;
      }

      // Disable common shortcuts
      if (
        // Ctrl+A (Select All)
        (e.ctrlKey && e.key === 'a') ||
        (e.metaKey && e.key === 'a') ||
        // Ctrl+C (Copy)
        (e.ctrlKey && e.key === 'c') ||
        (e.metaKey && e.key === 'c') ||
        // Ctrl+X (Cut)
        (e.ctrlKey && e.key === 'x') ||
        (e.metaKey && e.key === 'x') ||
        // Ctrl+S (Save)
        (e.ctrlKey && e.key === 's') ||
        (e.metaKey && e.key === 's') ||
        // Ctrl+P (Print)
        (e.ctrlKey && e.key === 'p') ||
        (e.metaKey && e.key === 'p') ||
        // F12 (Developer Tools)
        e.key === 'F12' ||
        // Ctrl+Shift+I (Developer Tools)
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        // Ctrl+Shift+J (Console)
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        // Ctrl+Shift+C (Inspect Element)
        (e.ctrlKey && e.shiftKey && e.key === 'C')
      ) {
        e.preventDefault();
        return false;
      }
    });
  }

  /**
   * Disable protection (useful for development)
   */
  disable(): void {
    if (!this.enabled) return;
    
    // Remove protection class
    document.body.classList.remove('content-protection-enabled');
    
    // Note: Event listeners can't be easily removed without references
    // So we'd need to refactor if disable functionality is important
    
    this.enabled = false;
    console.log('Content protection disabled');
  }

  /**
   * Check if protection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const contentProtection = ContentProtection.getInstance();