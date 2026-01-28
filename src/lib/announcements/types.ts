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

/**
 * View record stored in Firestore 'announcement_views' collection
 * Document ID format: {visitorValue}_{announcementId}
 */
export interface AnnouncementView {
  visitorId: string
  visitorType: 'user' | 'guest'
  visitorValue: string
  announcementId: string
  viewedAt: string
}

/**
 * API request for track view endpoint
 */
export interface TrackViewRequest {
  announcementId: string
  visitorId?: string
}

/**
 * Analytics data for an announcement
 */
export interface AnnouncementAnalytics {
  announcementId: string
  totalViews: number
  uniqueViewers: number
  totalDismissals: number
  dismissalRate: number // percentage: (dismissals / views) * 100
  viewsByType: {
    authenticated: number
    guest: number
  }
  dismissalsByType: {
    authenticated: number
    guest: number
  }
}

/**
 * API response for announcement analytics endpoint
 */
export interface AnnouncementAnalyticsResponse {
  success: boolean
  analytics: AnnouncementAnalytics | null
  error?: {
    code: string
    message: string
  }
}
