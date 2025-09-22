/**
 * Tests for Gradual Release Scheduler
 */

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}))

import { ReleaseScheduler } from '../release-scheduler'
import { PinnedItem } from '../types'

describe('ReleaseScheduler', () => {
  let scheduler: ReleaseScheduler
  let mockItems: PinnedItem[]
  
  beforeEach(() => {
    scheduler = new ReleaseScheduler()
    
    // Create mock pinned items
    mockItems = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      userId: 'user-1',
      contentId: `content-${i}`,
      contentType: 'kanji',
      pinnedAt: new Date(),
      priority: 'normal',
      tags: [],
      setIds: [],
      isActive: false,
      reviewCount: 0,
      version: 1
    }))
  })
  
  describe('scheduleGradualRelease', () => {
    it('should create schedule with correct batch sizes', () => {
      const result = scheduler.scheduleGradualRelease(mockItems, {
        dailyLimit: 3,
        startDate: new Date('2024-01-01')
      })
      
      expect(result.totalItems).toBe(10)
      expect(result.totalBatches).toBe(4) // 3, 3, 3, 1
      expect(result.itemsPerBatch).toEqual([3, 3, 3, 1])
      expect(result.schedule).toHaveLength(10)
    })
    
    it('should distribute items evenly when requested', () => {
      const result = scheduler.scheduleGradualRelease(mockItems, {
        dailyLimit: 3,
        startDate: new Date('2024-01-01'),
        distributeEvenly: true
      })
      
      // With 10 items and daily limit of 3, should get 4 batches
      // Evenly distributed: 3, 3, 2, 2 (or similar)
      expect(result.totalBatches).toBe(4)
      const totalInBatches = result.itemsPerBatch.reduce((sum, count) => sum + count, 0)
      expect(totalInBatches).toBe(10)
    })
    
    it('should skip weekends when configured', () => {
      // Start on Friday Jan 5, 2024
      const startDate = new Date('2024-01-05')
      
      const result = scheduler.scheduleGradualRelease(mockItems.slice(0, 6), {
        dailyLimit: 2,
        startDate,
        skipWeekends: true
      })
      
      // Should have 3 batches of 2 items
      expect(result.totalBatches).toBe(3)
      
      // Check dates skip weekends
      const dates = result.schedule.map(s => s.releaseDate)
      const friday = new Date('2024-01-05')
      const monday = new Date('2024-01-08')
      const tuesday = new Date('2024-01-09')
      
      expect(dates[0]).toEqual(friday) // Batch 1 - Friday
      expect(dates[2]).toEqual(monday) // Batch 2 - Monday (skip Sat/Sun)
      expect(dates[4]).toEqual(tuesday) // Batch 3 - Tuesday
    })
    
    it('should handle specific release days', () => {
      const result = scheduler.scheduleGradualRelease(mockItems.slice(0, 4), {
        dailyLimit: 2,
        startDate: new Date('2024-01-01'), // Monday
        releaseDays: [1, 3, 5] // Monday, Wednesday, Friday
      })
      
      const dates = result.schedule.map(s => s.releaseDate)
      
      // First batch: Monday Jan 1
      expect(dates[0].getDay()).toBe(1)
      
      // Second batch: Wednesday Jan 3
      expect(dates[2].getDay()).toBe(3)
    })
    
    it('should handle empty items array', () => {
      const result = scheduler.scheduleGradualRelease([], {
        dailyLimit: 5
      })
      
      expect(result.totalItems).toBe(0)
      expect(result.totalBatches).toBe(0)
      expect(result.schedule).toHaveLength(0)
    })
  })
  
  describe('calculateReleaseDate', () => {
    it('should calculate correct release date for item index', () => {
      const startDate = new Date('2024-01-01')
      
      // Item 0 (batch 0)
      const date0 = scheduler.calculateReleaseDate(0, 5, startDate)
      expect(date0).toEqual(new Date('2024-01-01'))
      
      // Item 5 (batch 1)
      const date5 = scheduler.calculateReleaseDate(5, 5, startDate)
      expect(date5).toEqual(new Date('2024-01-02'))
      
      // Item 10 (batch 2)
      const date10 = scheduler.calculateReleaseDate(10, 5, startDate)
      expect(date10).toEqual(new Date('2024-01-03'))
    })
    
    it('should skip weekends when calculating dates', () => {
      const startDate = new Date('2024-01-05') // Friday
      
      // Item 5 (batch 1) should be Monday
      const date5 = scheduler.calculateReleaseDate(5, 5, startDate, true)
      expect(date5.getDay()).toBe(1) // Monday
    })
  })
  
  describe('getItemsForDate', () => {
    it('should return items scheduled for specific date', () => {
      const schedule = [
        {
          itemId: 'item-1',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'item-2',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'item-3',
          releaseDate: new Date('2024-01-02'),
          batchNumber: 1,
          released: false
        }
      ]
      
      const itemsForJan1 = scheduler.getItemsForDate(
        schedule,
        new Date('2024-01-01')
      )
      
      expect(itemsForJan1).toHaveLength(2)
      expect(itemsForJan1.map(i => i.itemId)).toContain('item-1')
      expect(itemsForJan1.map(i => i.itemId)).toContain('item-2')
    })
    
    it('should exclude released items by default', () => {
      const schedule = [
        {
          itemId: 'item-1',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: true
        },
        {
          itemId: 'item-2',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: false
        }
      ]
      
      const items = scheduler.getItemsForDate(
        schedule,
        new Date('2024-01-01')
      )
      
      expect(items).toHaveLength(1)
      expect(items[0].itemId).toBe('item-2')
    })
    
    it('should include released items when requested', () => {
      const schedule = [
        {
          itemId: 'item-1',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: true
        }
      ]
      
      const items = scheduler.getItemsForDate(
        schedule,
        new Date('2024-01-01'),
        true
      )
      
      expect(items).toHaveLength(1)
    })
  })
  
  describe('getItemsForToday', () => {
    it('should return only today\'s items', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const schedule = [
        {
          itemId: 'yesterday-item',
          releaseDate: yesterday,
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'today-item',
          releaseDate: today,
          batchNumber: 1,
          released: false
        },
        {
          itemId: 'tomorrow-item',
          releaseDate: tomorrow,
          batchNumber: 2,
          released: false
        }
      ]
      
      const todayItems = scheduler.getItemsForToday(schedule)
      
      expect(todayItems).toHaveLength(1)
      expect(todayItems[0].itemId).toBe('today-item')
    })
  })
  
  describe('markAsReleased', () => {
    it('should mark specified items as released', () => {
      const schedule = [
        {
          itemId: 'item-1',
          releaseDate: new Date(),
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'item-2',
          releaseDate: new Date(),
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'item-3',
          releaseDate: new Date(),
          batchNumber: 0,
          released: false
        }
      ]
      
      scheduler.markAsReleased(schedule, ['item-1', 'item-3'])
      
      expect(schedule[0].released).toBe(true)
      expect(schedule[1].released).toBe(false)
      expect(schedule[2].released).toBe(true)
    })
  })
  
  describe('getScheduleStatistics', () => {
    it('should calculate correct statistics', () => {
      const now = new Date()
      now.setHours(12, 0, 0, 0)
      
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const schedule = [
        {
          itemId: 'released-item',
          releaseDate: yesterday,
          batchNumber: 0,
          released: true
        },
        {
          itemId: 'overdue-item',
          releaseDate: yesterday,
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'today-item',
          releaseDate: today,
          batchNumber: 1,
          released: false
        },
        {
          itemId: 'upcoming-item',
          releaseDate: tomorrow,
          batchNumber: 2,
          released: false
        }
      ]
      
      const stats = scheduler.getScheduleStatistics(schedule)
      
      expect(stats.total).toBe(4)
      expect(stats.released).toBe(1)
      expect(stats.pending).toBe(3)
      expect(stats.overdue).toBe(1)
      expect(stats.todayCount).toBe(1)
      expect(stats.upcoming).toBe(1)
    })
  })
  
  describe('reschedule', () => {
    it('should reschedule unreleased items', () => {
      const schedule = [
        {
          itemId: 'released-item',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: true
        },
        {
          itemId: 'unreleased-1',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'unreleased-2',
          releaseDate: new Date('2024-01-02'),
          batchNumber: 1,
          released: false
        }
      ]
      
      const newStartDate = new Date('2024-02-01')
      const rescheduled = scheduler.reschedule(schedule, newStartDate, {
        dailyLimit: 1
      })
      
      // Released item should keep original date
      expect(rescheduled[0].releaseDate).toEqual(new Date('2024-01-01'))
      
      // Unreleased items should have new dates
      const unreleased = rescheduled.filter(s => !s.released)
      expect(unreleased[0].releaseDate).toEqual(new Date('2024-02-01'))
      expect(unreleased[1].releaseDate).toEqual(new Date('2024-02-02'))
    })
  })
  
  describe('optimizeSchedule', () => {
    it('should consolidate gaps in schedule', () => {
      const schedule = [
        {
          itemId: 'item-1',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: false
        },
        {
          itemId: 'item-2',
          releaseDate: new Date('2024-01-01'),
          batchNumber: 0,
          released: true
        },
        {
          itemId: 'item-3',
          releaseDate: new Date('2024-01-02'),
          batchNumber: 1,
          released: false
        },
        {
          itemId: 'item-4',
          releaseDate: new Date('2024-01-03'),
          batchNumber: 2,
          released: true
        }
      ]
      
      const optimized = scheduler.optimizeSchedule(schedule, 2)
      
      // Unreleased items should be grouped first
      expect(optimized[0].released).toBe(false)
      expect(optimized[1].released).toBe(false)
      
      // Released items should be at the end
      expect(optimized[2].released).toBe(true)
      expect(optimized[3].released).toBe(true)
      
      // Batch numbers should be reassigned for unreleased items
      expect(optimized[0].batchNumber).toBe(0)
      expect(optimized[1].batchNumber).toBe(0) // Same batch (daily limit = 2)
    })
  })
})