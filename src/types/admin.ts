/**
 * Admin Types
 * Type definitions for administrative functionality
 */

/**
 * Admin actions that can be logged for audit trail
 */
export enum AdminAction {
  // User management
  VIEW_USER = 'VIEW_USER',
  MODIFY_USER = 'MODIFY_USER',
  DELETE_USER = 'DELETE_USER',

  // Override management
  SET_OVERRIDE = 'SET_OVERRIDE',
  REMOVE_OVERRIDE = 'REMOVE_OVERRIDE',
  VIEW_OVERRIDES = 'VIEW_OVERRIDES',

  // Content management
  GENERATE_CONTENT = 'GENERATE_CONTENT',
  GENERATE_AUDIO = 'GENERATE_AUDIO',
  GENERATE_IMAGE = 'GENERATE_IMAGE',
  GENERATE_STORY = 'GENERATE_STORY',
  GENERATE_MOODBOARD = 'GENERATE_MOODBOARD',

  // News management
  TRIGGER_SCRAPING = 'TRIGGER_SCRAPING',

  // Log viewing
  VIEW_LOGS = 'VIEW_LOGS',
  GENERATE_REPORT = 'GENERATE_REPORT',

  // Evaluation
  EVALUATE_ENTITLEMENT = 'EVALUATE_ENTITLEMENT'
}

/**
 * Admin user interface
 */
export interface AdminUser {
  uid: string;
  email: string;
  isAdmin: boolean;
  permissions?: AdminPermission[];
}

/**
 * Admin permissions (for future expansion)
 */
export enum AdminPermission {
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_OVERRIDES = 'MANAGE_OVERRIDES',
  GENERATE_CONTENT = 'GENERATE_CONTENT',
  VIEW_LOGS = 'VIEW_LOGS',
  MANAGE_NEWS = 'MANAGE_NEWS'
}