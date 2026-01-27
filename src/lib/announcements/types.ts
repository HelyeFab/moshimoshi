/**
 * Feature Announcement System Types
 *
 * Used for displaying new feature announcements to users on app load.
 */

export type AnnouncementStatus = 'draft' | 'published' | 'archived'

/**
 * Announcement document stored in Firestore 'announcements' collection
 */
export interface Announcement {
  id: string
  title: string
  /** HTML content from rich text editor */
  content: string
  /** @deprecated Plain text description for backward compatibility */
  description?: string
  imageUrl: string
  featureId: string
  status: AnnouncementStatus
  publishedAt: string | null
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

/**
 * Dismissal record stored in Firestore 'announcement_dismissals' collection
 * Document ID format: {visitorId}_{announcementId}
 */
export interface AnnouncementDismissal {
  visitorId: string
  visitorType: 'user' | 'guest'
  visitorValue: string
  announcementId: string
  dismissedAt: string
}

/**
 * API response for active announcement endpoint
 */
export interface ActiveAnnouncementResponse {
  success: boolean
  announcement: Announcement | null
}

/**
 * API request for dismiss endpoint
 */
export interface DismissAnnouncementRequest {
  announcementId: string
  visitorId?: string
}
