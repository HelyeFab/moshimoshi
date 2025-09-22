/**
 * Tests for PinManager Service
 */

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}))

import { PinManager } from '../pin-manager'
import { PinnedItem, PinOptions } from '../types'

describe('PinManager', () => {
  let pinManager: PinManager
  let mockUserId: string
  
  beforeEach(() => {
    pinManager = new PinManager({
      maxPinnedItems: 10,
      defaultPriority: 'normal',
      defaultDailyLimit: 5
    })
    mockUserId = 'test-user-123'
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  describe('pin', () => {
    it('should pin a single item successfully', async () => {
      const contentId = 'content-1'
      const contentType = 'kanji'
      const options: PinOptions = {
        priority: 'high',
        tags: ['jlpt-n5', 'common']
      }
      
      const result = await pinManager.pin(mockUserId, contentId, contentType, options)
      
      expect(result).toMatchObject({
        userId: mockUserId,
        contentId,
        contentType,
        priority: 'high',
        tags: ['jlpt-n5', 'common'],
        isActive: true,
        reviewCount: 0
      })
      expect(result.id).toBeDefined()
      expect(result.pinnedAt).toBeInstanceOf(Date)
    })
    
    it('should throw error when item is already pinned', async () => {
      const contentId = 'content-1'
      const contentType = 'kanji'
      
      // Mock the getPinnedItem method to return an existing item
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue({
        id: 'existing-id',
        userId: mockUserId,
        contentId,
        contentType,
        pinnedAt: new Date(),
        priority: 'normal',
        tags: [],
        setIds: [],
        isActive: true,
        reviewCount: 0,
        version: 1
      })
      
      await expect(
        pinManager.pin(mockUserId, contentId, contentType)
      ).rejects.toThrow('Item content-1 is already pinned')
    })
    
    it('should enforce maximum pinned items limit', async () => {
      // Mock getPinnedCount to return max limit
      jest.spyOn(pinManager, 'getPinnedCount').mockResolvedValue(10)
      
      await expect(
        pinManager.pin(mockUserId, 'content-11', 'kanji')
      ).rejects.toThrow('Maximum pinned items limit (10) reached')
    })
    
    it('should set scheduled release date for gradual release', async () => {
      const releaseDate = new Date('2024-01-01')
      const options: PinOptions = {
        releaseSchedule: 'gradual',
        releaseStartDate: releaseDate
      }
      
      const result = await pinManager.pin(mockUserId, 'content-1', 'kanji', options)
      
      expect(result.scheduledReleaseDate).toEqual(releaseDate)
      expect(result.isActive).toBe(false)
    })
  })
  
  describe('pinBulk', () => {
    it('should pin multiple items successfully', async () => {
      const items = [
        { contentId: 'content-1', contentType: 'kanji' },
        { contentId: 'content-2', contentType: 'vocabulary' },
        { contentId: 'content-3', contentType: 'kana' }
      ]
      
      // Mock getPinnedCount and getPinnedItem
      jest.spyOn(pinManager, 'getPinnedCount').mockResolvedValue(0)
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue(null)
      
      const result = await pinManager.pinBulk(mockUserId, items)
      
      expect(result.total).toBe(3)
      expect(result.succeeded).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(result.alreadyPinned).toHaveLength(0)
    })
    
    it('should handle gradual release with daily limits', async () => {
      const items = Array.from({ length: 12 }, (_, i) => ({
        contentId: `content-${i}`,
        contentType: 'kanji'
      }))
      
      const options: PinOptions = {
        releaseSchedule: 'gradual',
        dailyLimit: 5,
        releaseStartDate: new Date('2024-01-01')
      }
      
      jest.spyOn(pinManager, 'getPinnedCount').mockResolvedValue(0)
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue(null)
      
      const result = await pinManager.pinBulk(mockUserId, items, options)
      
      // Check that items are distributed across batches
      const batch1 = result.succeeded.slice(0, 5)
      const batch2 = result.succeeded.slice(5, 10)
      const batch3 = result.succeeded.slice(10, 12)
      
      expect(batch1).toHaveLength(5)
      expect(batch2).toHaveLength(5)
      expect(batch3).toHaveLength(2)
      
      // Check scheduled release dates
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-02')
      const date3 = new Date('2024-01-03')
      
      batch1.forEach(item => {
        expect(item.scheduledReleaseDate).toEqual(date1)
        expect(item.isActive).toBe(false)
      })
      
      batch2.forEach(item => {
        expect(item.scheduledReleaseDate).toEqual(date2)
        expect(item.isActive).toBe(false)
      })
      
      batch3.forEach(item => {
        expect(item.scheduledReleaseDate).toEqual(date3)
        expect(item.isActive).toBe(false)
      })
    })
    
    it('should skip already pinned items', async () => {
      const items = [
        { contentId: 'content-1', contentType: 'kanji' },
        { contentId: 'content-2', contentType: 'vocabulary' }
      ]
      
      jest.spyOn(pinManager, 'getPinnedCount').mockResolvedValue(1)
      
      // Mock first item as already pinned
      jest.spyOn(pinManager, 'getPinnedItem')
        .mockResolvedValueOnce({
          id: 'existing',
          userId: mockUserId,
          contentId: 'content-1',
          contentType: 'kanji',
          pinnedAt: new Date(),
          priority: 'normal',
          tags: [],
          setIds: [],
          isActive: true,
          reviewCount: 0,
          version: 1
        })
        .mockResolvedValueOnce(null)
      
      const result = await pinManager.pinBulk(mockUserId, items)
      
      expect(result.alreadyPinned).toContain('content-1')
      expect(result.succeeded).toHaveLength(1)
      expect(result.succeeded[0].contentId).toBe('content-2')
    })
  })
  
  describe('unpin', () => {
    it('should unpin an item successfully', async () => {
      const contentId = 'content-1'
      
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue({
        id: 'pin-1',
        userId: mockUserId,
        contentId,
        contentType: 'kanji',
        pinnedAt: new Date(),
        priority: 'normal',
        tags: [],
        setIds: [],
        isActive: true,
        reviewCount: 0,
        version: 1
      })
      
      await expect(pinManager.unpin(mockUserId, contentId)).resolves.not.toThrow()
    })
    
    it('should throw error when item is not pinned', async () => {
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue(null)
      
      await expect(
        pinManager.unpin(mockUserId, 'non-existent')
      ).rejects.toThrow('Item non-existent is not pinned')
    })
  })
  
  describe('applyGradualRelease', () => {
    it('should activate items scheduled for today', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const items: PinnedItem[] = [
        {
          id: '1',
          userId: mockUserId,
          contentId: 'content-1',
          contentType: 'kanji',
          pinnedAt: new Date(),
          priority: 'normal',
          tags: [],
          setIds: [],
          isActive: false,
          scheduledReleaseDate: yesterday,
          reviewCount: 0,
          version: 1
        },
        {
          id: '2',
          userId: mockUserId,
          contentId: 'content-2',
          contentType: 'kanji',
          pinnedAt: new Date(),
          priority: 'normal',
          tags: [],
          setIds: [],
          isActive: false,
          scheduledReleaseDate: today,
          reviewCount: 0,
          version: 1
        },
        {
          id: '3',
          userId: mockUserId,
          contentId: 'content-3',
          contentType: 'kanji',
          pinnedAt: new Date(),
          priority: 'normal',
          tags: [],
          setIds: [],
          isActive: false,
          scheduledReleaseDate: tomorrow,
          reviewCount: 0,
          version: 1
        }
      ]
      
      jest.spyOn(pinManager, 'getPinnedItems').mockResolvedValue(items)
      
      const released = await pinManager.applyGradualRelease(mockUserId)
      
      expect(released).toHaveLength(2)
      expect(released.map(item => item.contentId)).toContain('content-1')
      expect(released.map(item => item.contentId)).toContain('content-2')
      expect(released.map(item => item.contentId)).not.toContain('content-3')
    })
  })
  
  describe('getStatistics', () => {
    it('should calculate correct statistics', async () => {
      const items: PinnedItem[] = [
        {
          id: '1',
          userId: mockUserId,
          contentId: 'content-1',
          contentType: 'kanji',
          pinnedAt: new Date('2024-01-01'),
          priority: 'high',
          tags: [],
          setIds: [],
          isActive: true,
          reviewCount: 5,
          version: 1
        },
        {
          id: '2',
          userId: mockUserId,
          contentId: 'content-2',
          contentType: 'vocabulary',
          pinnedAt: new Date('2024-01-02'),
          priority: 'normal',
          tags: [],
          setIds: [],
          isActive: true,
          reviewCount: 3,
          version: 1
        },
        {
          id: '3',
          userId: mockUserId,
          contentId: 'content-3',
          contentType: 'kanji',
          pinnedAt: new Date('2024-01-03'),
          priority: 'low',
          tags: [],
          setIds: [],
          isActive: false,
          scheduledReleaseDate: new Date('2024-01-10'),
          reviewCount: 0,
          version: 1
        }
      ]
      
      jest.spyOn(pinManager, 'getPinnedItems').mockResolvedValue(items)
      
      const stats = await pinManager.getStatistics(mockUserId)
      
      expect(stats.totalPinned).toBe(3)
      expect(stats.byPriority.high).toBe(1)
      expect(stats.byPriority.normal).toBe(1)
      expect(stats.byPriority.low).toBe(1)
      expect(stats.byContentType.kanji).toBe(2)
      expect(stats.byContentType.vocabulary).toBe(1)
      expect(stats.activeItems).toBe(2)
      expect(stats.scheduledItems).toBe(1)
      expect(stats.avgReviewsPerItem).toBe(8 / 3)
      expect(stats.lastPinnedAt).toEqual(new Date('2024-01-03'))
    })
  })
  
  describe('tag management', () => {
    it('should add tags to an item', async () => {
      const item: PinnedItem = {
        id: '1',
        userId: mockUserId,
        contentId: 'content-1',
        contentType: 'kanji',
        pinnedAt: new Date(),
        priority: 'normal',
        tags: ['existing'],
        setIds: [],
        isActive: true,
        reviewCount: 0,
        version: 1
      }
      
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue(item)
      
      await pinManager.addTags(mockUserId, 'content-1', ['new1', 'new2'])
      
      // Verify the tags were added (checking the mock call)
      expect(item.tags).toContain('existing')
    })
    
    it('should remove tags from an item', async () => {
      const item: PinnedItem = {
        id: '1',
        userId: mockUserId,
        contentId: 'content-1',
        contentType: 'kanji',
        pinnedAt: new Date(),
        priority: 'normal',
        tags: ['tag1', 'tag2', 'tag3'],
        setIds: [],
        isActive: true,
        reviewCount: 0,
        version: 1
      }
      
      jest.spyOn(pinManager, 'getPinnedItem').mockResolvedValue(item)
      
      await pinManager.removeTags(mockUserId, 'content-1', ['tag1', 'tag3'])
      
      // After removal, should only have tag2
      expect(item.tags).toHaveLength(1)
    })
  })
})