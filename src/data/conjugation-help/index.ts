/**
 * Conjugation Help System - Main Export
 *
 * This module provides all the help content and utilities for the
 * smart bubble help system.
 */

export {
  // Types
  type HelpContent,
  type HelpExample,
  type HelpTriggers,

  // Content
  HELP_CONTENT,

  // Helper functions
  getHelpById,
  getHelpByCategory,
  getHelpByWordType,
  getHelpByFormType,
  getHelpByErrorPattern,
  searchHelp
} from './help-content';
