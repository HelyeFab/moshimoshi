"use strict";
/**
 * Usage Tracker for AI Service
 * Tracks token usage, costs, and provides analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageTracker = void 0;
class UsageTracker {
    constructor() {
        this.usage = [];
        this.maxEntries = 10000; // Keep last 10k entries
    }
    /**
     * Track a usage entry
     */
    async track(entry) {
        this.usage.push(entry);
        // Trim if exceeding max entries
        if (this.usage.length > this.maxEntries) {
            this.usage = this.usage.slice(-this.maxEntries);
        }
        console.log(`📊 Tracked usage: ${entry.task} | Model: ${entry.model} | Cost: $${entry.usage.estimatedCost.toFixed(4)}`);
    }
    /**
     * Get usage statistics
     */
    async getStats(userId, timeRange) {
        let filteredUsage = this.usage;
        // Filter by time range
        if (timeRange) {
            filteredUsage = filteredUsage.filter(entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end);
        }
        // Filter by user
        if (userId) {
            filteredUsage = filteredUsage.filter(entry => entry.userId === userId);
        }
        const stats = {
            totalCost: 0,
            totalTokens: 0,
            totalRequests: filteredUsage.length,
            byTask: {},
            byModel: {},
            byUser: {},
            timeRange
        };
        // Calculate statistics
        for (const entry of filteredUsage) {
            // Total stats
            stats.totalCost += entry.usage.estimatedCost;
            stats.totalTokens += entry.usage.totalTokens;
            // By task
            if (!stats.byTask[entry.task]) {
                stats.byTask[entry.task] = { count: 0, cost: 0, tokens: 0 };
            }
            stats.byTask[entry.task].count++;
            stats.byTask[entry.task].cost += entry.usage.estimatedCost;
            stats.byTask[entry.task].tokens += entry.usage.totalTokens;
            // By model
            if (!stats.byModel[entry.model]) {
                stats.byModel[entry.model] = { count: 0, cost: 0, tokens: 0 };
            }
            stats.byModel[entry.model].count++;
            stats.byModel[entry.model].cost += entry.usage.estimatedCost;
            stats.byModel[entry.model].tokens += entry.usage.totalTokens;
            // By user (if tracking users)
            if (entry.userId && stats.byUser) {
                if (!stats.byUser[entry.userId]) {
                    stats.byUser[entry.userId] = { count: 0, cost: 0, tokens: 0 };
                }
                stats.byUser[entry.userId].count++;
                stats.byUser[entry.userId].cost += entry.usage.estimatedCost;
                stats.byUser[entry.userId].tokens += entry.usage.totalTokens;
            }
        }
        return stats;
    }
    /**
     * Get hourly usage pattern
     */
    getHourlyPattern() {
        const pattern = {};
        // Initialize all hours
        for (let hour = 0; hour < 24; hour++) {
            pattern[hour] = { count: 0, cost: 0 };
        }
        // Aggregate by hour
        for (const entry of this.usage) {
            const hour = entry.timestamp.getHours();
            pattern[hour].count++;
            pattern[hour].cost += entry.usage.estimatedCost;
        }
        return pattern;
    }
    /**
     * Get daily usage for the last N days
     */
    getDailyUsage(days = 30) {
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const dailyUsage = new Map();
        // Filter and aggregate
        for (const entry of this.usage) {
            if (entry.timestamp >= startDate) {
                const dateKey = entry.timestamp.toISOString().split('T')[0];
                if (!dailyUsage.has(dateKey)) {
                    dailyUsage.set(dateKey, { count: 0, cost: 0, tokens: 0 });
                }
                const day = dailyUsage.get(dateKey);
                day.count++;
                day.cost += entry.usage.estimatedCost;
                day.tokens += entry.usage.totalTokens;
            }
        }
        // Convert to array and sort
        return Array.from(dailyUsage.entries())
            .map(([date, data]) => (Object.assign({ date }, data)))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    /**
     * Get cost projections
     */
    getProjections(periodDays = 30) {
        const recentUsage = this.getDailyUsage(periodDays);
        if (recentUsage.length === 0) {
            return {
                dailyAverage: 0,
                weeklyProjection: 0,
                monthlyProjection: 0,
                yearlyProjection: 0
            };
        }
        const totalCost = recentUsage.reduce((sum, day) => sum + day.cost, 0);
        const dailyAverage = totalCost / recentUsage.length;
        return {
            dailyAverage,
            weeklyProjection: dailyAverage * 7,
            monthlyProjection: dailyAverage * 30,
            yearlyProjection: dailyAverage * 365
        };
    }
    /**
     * Get top users by cost
     */
    getTopUsers(limit = 10) {
        const userStats = new Map();
        for (const entry of this.usage) {
            if (entry.userId) {
                if (!userStats.has(entry.userId)) {
                    userStats.set(entry.userId, { totalCost: 0, totalRequests: 0 });
                }
                const stats = userStats.get(entry.userId);
                stats.totalCost += entry.usage.estimatedCost;
                stats.totalRequests++;
            }
        }
        return Array.from(userStats.entries())
            .map(([userId, stats]) => ({
            userId,
            totalCost: stats.totalCost,
            totalRequests: stats.totalRequests,
            averageCost: stats.totalCost / stats.totalRequests
        }))
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, limit);
    }
    /**
     * Get most expensive tasks
     */
    getMostExpensiveTasks(limit = 10) {
        const taskStats = new Map();
        for (const entry of this.usage) {
            if (!taskStats.has(entry.task)) {
                taskStats.set(entry.task, { totalCost: 0, count: 0 });
            }
            const stats = taskStats.get(entry.task);
            stats.totalCost += entry.usage.estimatedCost;
            stats.count++;
        }
        return Array.from(taskStats.entries())
            .map(([task, stats]) => ({
            task,
            totalCost: stats.totalCost,
            averageCost: stats.totalCost / stats.count,
            count: stats.count
        }))
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, limit);
    }
    /**
     * Export usage data
     */
    export() {
        return [...this.usage];
    }
    /**
     * Import usage data
     */
    import(entries) {
        this.usage = [...this.usage, ...entries].slice(-this.maxEntries);
        console.log(`📥 Imported ${entries.length} usage entries`);
    }
    /**
     * Clear usage data
     */
    clear() {
        this.usage = [];
        console.log('🗑️ Cleared usage tracking data');
    }
    /**
     * Get alerts for unusual usage
     */
    getAlerts() {
        const alerts = [];
        // Check for cost spikes
        const dailyUsage = this.getDailyUsage(7);
        if (dailyUsage.length >= 2) {
            const yesterday = dailyUsage[dailyUsage.length - 1];
            const dayBefore = dailyUsage[dailyUsage.length - 2];
            if (yesterday && dayBefore && yesterday.cost > dayBefore.cost * 2) {
                alerts.push({
                    type: 'cost_spike',
                    message: `Daily cost increased by ${((yesterday.cost / dayBefore.cost - 1) * 100).toFixed(0)}%`,
                    severity: 'medium',
                    data: { yesterday, dayBefore }
                });
            }
        }
        // Check for high costs
        const projections = this.getProjections();
        if (projections.monthlyProjection > 100) {
            alerts.push({
                type: 'cost_spike',
                message: `Monthly projection ($${projections.monthlyProjection.toFixed(2)}) exceeds $100`,
                severity: 'high',
                data: projections
            });
        }
        return alerts;
    }
}
exports.UsageTracker = UsageTracker;
//# sourceMappingURL=UsageTracker.js.map