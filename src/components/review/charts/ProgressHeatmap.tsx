'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/utils/cn';

interface HeatmapData {
  date: string;
  count: number;
}

interface ProgressHeatmapProps {
  data: HeatmapData[];
  year?: number;
  colorScheme?: 'green' | 'blue' | 'purple' | 'orange';
  showTooltip?: boolean;
  onDayClick?: (date: string, count: number) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getColorIntensity(count: number, maxCount: number, scheme: string): string {
  if (count === 0) return 'bg-gray-100 dark:bg-dark-700';
  
  const intensity = Math.ceil((count / maxCount) * 4);
  
  const colors = {
    green: [
      'bg-green-200 dark:bg-green-900/40',
      'bg-green-300 dark:bg-green-800/60',
      'bg-green-400 dark:bg-green-700/80',
      'bg-green-500 dark:bg-green-600',
    ],
    blue: [
      'bg-blue-200 dark:bg-blue-900/40',
      'bg-blue-300 dark:bg-blue-800/60',
      'bg-blue-400 dark:bg-blue-700/80',
      'bg-blue-500 dark:bg-blue-600',
    ],
    purple: [
      'bg-purple-200 dark:bg-purple-900/40',
      'bg-purple-300 dark:bg-purple-800/60',
      'bg-purple-400 dark:bg-purple-700/80',
      'bg-purple-500 dark:bg-purple-600',
    ],
    orange: [
      'bg-orange-200 dark:bg-orange-900/40',
      'bg-orange-300 dark:bg-orange-800/60',
      'bg-orange-400 dark:bg-orange-700/80',
      'bg-orange-500 dark:bg-orange-600',
    ],
  };
  
  return colors[scheme as keyof typeof colors][Math.min(intensity - 1, 3)];
}

export function ProgressHeatmap({ 
  data, 
  year = new Date().getFullYear(),
  colorScheme = 'green',
  showTooltip = true,
  onDayClick 
}: ProgressHeatmapProps) {
  const { t } = useTranslation();
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState(year);
  
  // Process data into a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(item => {
      map.set(item.date, item.count);
    });
    return map;
  }, [data]);
  
  const maxCount = useMemo(() => {
    return Math.max(...data.map(d => d.count), 1);
  }, [data]);
  
  // Generate calendar grid for the selected year
  const calendarGrid = useMemo(() => {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);
    const startDay = startDate.getDay();
    
    const weeks: (HeatmapData | null)[][] = [];
    let currentWeek: (HeatmapData | null)[] = new Array(startDay).fill(null);
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const count = dataMap.get(dateStr) || 0;
      
      currentWeek.push({ date: dateStr, count });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Add remaining days
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  }, [selectedYear, dataMap]);
  
  // Calculate statistics
  const stats = useMemo(() => {
    const yearData = data.filter(d => d.date.startsWith(selectedYear.toString()));
    const totalDays = yearData.length;
    const activeDays = yearData.filter(d => d.count > 0).length;
    const totalReviews = yearData.reduce((sum, d) => sum + d.count, 0);
    const longestStreak = calculateLongestStreak(yearData);
    
    return {
      totalDays,
      activeDays,
      totalReviews,
      averagePerDay: totalDays > 0 ? Math.round(totalReviews / totalDays) : 0,
      longestStreak,
    };
  }, [data, selectedYear]);
  
  function calculateLongestStreak(yearData: HeatmapData[]): number {
    let maxStreak = 0;
    let currentStreak = 0;
    
    yearData.forEach((day, index) => {
      if (day.count > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });
    
    return maxStreak;
  }
  
  const exportData = () => {
    const csvContent = [
      ['Date', 'Reviews'].join(','),
      ...data.map(d => [d.date, d.count].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-heatmap-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-6 border border-gray-200 dark:border-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('review.dashboard.progress.heatmap.title')}
          </h2>
        </div>
        
        {/* Year Navigation */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-medium text-gray-900 dark:text-gray-100 min-w-[60px] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          
          <button
            onClick={exportData}
            className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Export data"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex mb-1 ml-7">
            {MONTHS.map((month, i) => (
              <div
                key={month}
                className="text-xs text-gray-600 dark:text-gray-400"
                style={{ width: `${100 / 12}%`, minWidth: '48px' }}
              >
                {month}
              </div>
            ))}
          </div>
          
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col mr-1">
              {DAYS.map((day, i) => (
                <div
                  key={i}
                  className="text-xs text-gray-600 dark:text-gray-400 h-3 flex items-center justify-center"
                  style={{ marginTop: i === 0 ? '0' : '1px' }}
                >
                  {i % 2 === 1 && day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="flex gap-[2px]">
              {calendarGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <div key={dayIndex} className="w-3 h-3" />;
                    }
                    
                    return (
                      <button
                        key={dayIndex}
                        className={cn(
                          'w-3 h-3 rounded-sm transition-all duration-200 hover:ring-2 hover:ring-primary-500 hover:ring-offset-1',
                          getColorIntensity(day.count, maxCount, colorScheme),
                          'relative group'
                        )}
                        onClick={() => onDayClick?.(day.date, day.count)}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('review.dashboard.progress.heatmap.legend.less')}
          </span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-dark-700" />
            {[1, 2, 3, 4].map(level => (
              <div
                key={level}
                className={cn(
                  'w-3 h-3 rounded-sm',
                  getColorIntensity(level * (maxCount / 4), maxCount, colorScheme)
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('review.dashboard.progress.heatmap.legend.more')}
          </span>
        </div>
        
        {/* Stats */}
        <div className="flex space-x-4 text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-gray-100">{stats.totalReviews}</span> total
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-gray-100">{stats.longestStreak}</span> day streak
          </span>
        </div>
      </div>
      
      {/* Tooltip */}
      {showTooltip && hoveredDay && (
        <div className="fixed z-50 pointer-events-none" style={{
          left: `${(window.event as MouseEvent)?.clientX || 0}px`,
          top: `${((window.event as MouseEvent)?.clientY || 0) - 50}px`,
        }}>
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg">
            {t('review.dashboard.progress.heatmap.tooltip', { 
              count: hoveredDay.count,
              date: new Date(hoveredDay.date).toLocaleDateString()
            })}
          </div>
        </div>
      )}
    </div>
  );
}