/**
 * Email Campaign Types Tests
 * Validates TypeScript type definitions
 */

import { describe, it, expect } from '@jest/globals'
import type {
  EmailCampaign,
  CampaignTemplate,
  CampaignSegment,
  CampaignStatus,
  SendCampaignRequest,
  CampaignProgress,
  CampaignRecipient,
} from '@/lib/email/campaigns/types'

describe('Email Campaign Types', () => {
  describe('CampaignTemplate', () => {
    it('should accept valid template values', () => {
      const validTemplates: CampaignTemplate[] = [
        'waitlist',
        'welcome',
        'password_reset',
        'custom',
      ]

      validTemplates.forEach((template) => {
        expect(template).toBeDefined()
      })
    })
  })

  describe('CampaignSegment', () => {
    it('should accept valid segment values', () => {
      const validSegments: CampaignSegment[] = [
        'all',
        'free',
        'premium_monthly',
        'premium_yearly',
      ]

      validSegments.forEach((segment) => {
        expect(segment).toBeDefined()
      })
    })
  })

  describe('CampaignStatus', () => {
    it('should accept valid status values', () => {
      const validStatuses: CampaignStatus[] = ['draft', 'sending', 'sent', 'failed']

      validStatuses.forEach((status) => {
        expect(status).toBeDefined()
      })
    })
  })

  describe('SendCampaignRequest', () => {
    it('should have all required fields', () => {
      const request: SendCampaignRequest = {
        name: 'Test Campaign',
        template: 'waitlist',
        subject: 'Test Subject',
        segment: {
          type: 'all',
          respectMarketingPrefs: true,
          emailVerifiedOnly: false,
        },
      }

      expect(request.name).toBe('Test Campaign')
      expect(request.template).toBe('waitlist')
      expect(request.subject).toBe('Test Subject')
      expect(request.segment.type).toBe('all')
      expect(request.segment.respectMarketingPrefs).toBe(true)
      expect(request.segment.emailVerifiedOnly).toBe(false)
    })
  })

  describe('CampaignRecipient', () => {
    it('should have uid and email fields', () => {
      const recipient: CampaignRecipient = {
        uid: 'user123',
        email: 'user@example.com',
      }

      expect(recipient.uid).toBe('user123')
      expect(recipient.email).toBe('user@example.com')
    })
  })

  describe('CampaignProgress', () => {
    it('should track campaign progress', () => {
      const progress: CampaignProgress = {
        campaignId: 'campaign123',
        status: 'sending',
        progress: {
          total: 100,
          sent: 50,
          failed: 2,
          skipped: 8,
        },
      }

      expect(progress.campaignId).toBe('campaign123')
      expect(progress.status).toBe('sending')
      expect(progress.progress.total).toBe(100)
      expect(progress.progress.sent).toBe(50)
      expect(progress.progress.failed).toBe(2)
      expect(progress.progress.skipped).toBe(8)
    })
  })
})
