'use client';

import React, { memo, useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';

/**
 * Hook to detect mobile viewport
 */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

/**
 * User Engagement Chart - Shows new vs returning users over time
 * Mobile-first: Simplified labels on mobile, full labels on desktop
 */
interface UserEngagementData {
  date: string;
  newUsers: number;
  returningUsers: number;
  totalActive: number;
}

interface UserEngagementChartProps {
  data: UserEngagementData[];
  height?: number;
}

export const UserEngagementChart = memo(function UserEngagementChart({
  data,
  height,
}: UserEngagementChartProps) {
  const isMobile = useIsMobile();

  // Format date - shorter on mobile
  const formattedData = data.map(d => ({
    ...d,
    displayDate: isMobile
      ? new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })
      : new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  }));

  // Responsive height: smaller on mobile
  const chartHeight = height ?? (isMobile ? 220 : 300);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <AreaChart
        data={formattedData}
        margin={isMobile
          ? { top: 5, right: 10, left: -20, bottom: 0 }
          : { top: 10, right: 30, left: 0, bottom: 0 }
        }
      >
        <defs>
          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorReturning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 }}
          tickLine={{ stroke: '#4B5563' }}
          axisLine={{ stroke: '#4B5563' }}
          interval={isMobile ? 1 : 0}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 }}
          tickLine={{ stroke: '#4B5563' }}
          axisLine={{ stroke: '#4B5563' }}
          allowDecimals={false}
          width={isMobile ? 30 : 40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#F9FAFB',
            fontSize: isMobile ? '12px' : '14px',
          }}
          labelStyle={{ color: '#F9FAFB', fontWeight: 'bold' }}
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px', fontSize: isMobile ? '11px' : '14px' }}
          iconType="circle"
          iconSize={isMobile ? 8 : 10}
        />
        <Area
          type="monotone"
          dataKey="newUsers"
          name={isMobile ? 'New' : 'New Users'}
          stroke="#10B981"
          fill="url(#colorNew)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="returningUsers"
          name={isMobile ? 'Returning' : 'Returning Users'}
          stroke="#6366F1"
          fill="url(#colorReturning)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

/**
 * Traffic Bar Chart - Shows page views and unique visitors
 * Mobile-first: Horizontal bars on mobile, vertical on desktop
 */
interface TrafficData {
  name: string;
  pageViews: number;
  uniqueVisitors: number;
}

interface TrafficBarChartProps {
  data: TrafficData[];
  height?: number;
}

export const TrafficBarChart = memo(function TrafficBarChart({
  data,
  height,
}: TrafficBarChartProps) {
  const isMobile = useIsMobile();

  // Show all data - calculate dynamic height based on data length
  const chartData = data;
  const minHeight = isMobile ? 250 : 300;
  // For horizontal bars on mobile, need more height for more items
  const dynamicHeight = isMobile ? Math.max(minHeight, data.length * 50) : Math.max(minHeight, data.length * 40);
  const chartHeight = height ?? dynamicHeight;

  // Mobile: Horizontal bars for better label readability
  if (isMobile) {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            type="number"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            tickLine={{ stroke: '#4B5563' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            tickLine={{ stroke: '#4B5563' }}
            width={70}
            tickFormatter={(value: string) => value.length > 12 ? value.slice(0, 12) + '...' : value}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} iconSize={8} />
          <Bar dataKey="pageViews" name="Views" fill="#F59E0B" radius={[0, 4, 4, 0]} />
          <Bar dataKey="uniqueVisitors" name="Unique" fill="#3B82F6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Desktop: Vertical bars
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickLine={{ stroke: '#4B5563' }}
          axisLine={{ stroke: '#4B5563' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          tickLine={{ stroke: '#4B5563' }}
          axisLine={{ stroke: '#4B5563' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#F9FAFB',
          }}
          labelStyle={{ color: '#F9FAFB', fontWeight: 'bold' }}
        />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Bar dataKey="pageViews" name="Page Views" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        <Bar dataKey="uniqueVisitors" name="Unique Visitors" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

/**
 * Simple Stat Card - Mobile-first design
 * Compact on mobile, more spacious on desktop
 */
interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
  trend?: { value: number; isPositive: boolean };
  color?: 'green' | 'blue' | 'purple' | 'orange' | 'red';
  compact?: boolean; // Force compact mode for grids
}

const colorClasses = {
  green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
  orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  red: 'from-red-500/20 to-red-500/5 border-red-500/30',
};

const textColorClasses = {
  green: 'text-emerald-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
};

export const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  compact = false,
}: StatCardProps) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl
      ${compact ? 'p-3' : 'p-3 sm:p-4'}
      bg-gradient-to-br ${colorClasses[color]}
      border backdrop-blur-sm
    `}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`${compact ? 'text-xs' : 'text-xs sm:text-sm'} text-gray-400 mb-0.5 sm:mb-1 truncate`}>
            {title}
          </p>
          <p className={`${compact ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold ${textColorClasses[color]} flex items-center`}>
            {icon && <span className="mr-1 sm:mr-2 text-base sm:text-xl">{icon}</span>}
            <span className="truncate">{value}</span>
          </p>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{subtitle}</p>
          )}
        </div>
        {trend && (
          <div className={`text-xs sm:text-sm font-medium shrink-0 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Quota Usage Chart - For Firebase quota monitoring
 * Mobile-first with compact layout on small screens
 */
interface QuotaData {
  name: string;
  used: number;
  limit: number;
  percentage: number;
}

interface QuotaChartProps {
  data: QuotaData[];
  height?: number;
}

export const QuotaChart = memo(function QuotaChart({
  data,
  height,
}: QuotaChartProps) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 160 : 200);

  // Transform data for stacked bar chart showing used vs remaining
  const chartData = data.map(d => ({
    name: d.name,
    used: d.used,
    remaining: Math.max(0, d.limit - d.used),
    percentage: d.percentage,
  }));

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={isMobile
          ? { top: 5, right: 10, left: 45, bottom: 0 }
          : { top: 10, right: 30, left: 60, bottom: 0 }
        }
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          type="number"
          tick={{ fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString()}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 }}
          width={isMobile ? 45 : 60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#F9FAFB',
            fontSize: isMobile ? '12px' : '14px',
          }}
          formatter={(value: number, name: string) => [
            value.toLocaleString(),
            name === 'used' ? 'Used' : 'Remaining',
          ]}
        />
        <Bar dataKey="used" name="Used" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} />
        <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#22C55E" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

/**
 * Mini sparkline chart for inline metrics
 */
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export const Sparkline = memo(function Sparkline({
  data,
  color = '#3B82F6',
  height = 40,
}: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
