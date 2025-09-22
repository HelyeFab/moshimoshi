'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileJson,
  FileText,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Activity,
  Play,
  Pause,
  Hash
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

interface SessionHistoryItem {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
  itemsReviewed: number;
  itemsTotal: number;
  accuracy: number;
  mode: 'recognition' | 'recall' | 'listening';
  status: 'completed' | 'abandoned' | 'timeout';
  averageResponseTime: number; // in ms
  hintsUsed: number;
  points: number;
  streak: number;
  abandonReason?: string;
  performance: {
    trend: 'improving' | 'stable' | 'declining';
    vsAverage: number; // percentage difference from average
  };
}

interface SessionFilters {
  dateRange: { start: Date | null; end: Date | null };
  mode: 'all' | 'recognition' | 'recall' | 'listening';
  status: 'all' | 'completed' | 'abandoned' | 'timeout';
  search: string;
}

const fetchSessionHistory = async (page: number, filters: SessionFilters): Promise<{
  sessions: SessionHistoryItem[];
  totalPages: number;
  totalSessions: number;
}> => {
  const params = new URLSearchParams({
    page: page.toString(),
    mode: filters.mode,
    status: filters.status,
    search: filters.search,
  });
  
  if (filters.dateRange.start) {
    params.append('startDate', filters.dateRange.start.toISOString());
  }
  if (filters.dateRange.end) {
    params.append('endDate', filters.dateRange.end.toISOString());
  }

  const response = await fetch(`/api/review/sessions/history?${params}`);
  if (!response.ok) throw new Error('Failed to fetch session history');
  return response.json();
};

export default function SessionHistory() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SessionFilters>({
    dateRange: { start: null, end: null },
    mode: 'all',
    status: 'all',
    search: ''
  });

  // Mock data for demonstration
  const mockData = useMemo(() => ({
    sessions: Array.from({ length: 10 }, (_, i) => ({
      id: `session-${i + 1}`,
      date: new Date(Date.now() - i * 86400000).toISOString(),
      startTime: new Date(Date.now() - i * 86400000 - 3600000).toISOString(),
      endTime: i % 3 === 0 ? undefined : new Date(Date.now() - i * 86400000).toISOString(),
      duration: Math.floor(Math.random() * 3600) + 600,
      itemsReviewed: Math.floor(Math.random() * 50) + 10,
      itemsTotal: Math.floor(Math.random() * 60) + 20,
      accuracy: Math.random() * 40 + 60,
      mode: ['recognition', 'recall', 'listening'][Math.floor(Math.random() * 3)] as any,
      status: i % 3 === 0 ? 'abandoned' : i % 5 === 0 ? 'timeout' : 'completed',
      averageResponseTime: Math.random() * 3000 + 1000,
      hintsUsed: Math.floor(Math.random() * 10),
      points: Math.floor(Math.random() * 500) + 100,
      streak: Math.floor(Math.random() * 20),
      abandonReason: i % 3 === 0 ? 'User closed browser' : undefined,
      performance: {
        trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as any,
        vsAverage: Math.random() * 40 - 20
      }
    })),
    totalPages: 5,
    totalSessions: 50
  }), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessionHistory', currentPage, filters],
    queryFn: () => fetchSessionHistory(currentPage, filters),
  });

  const sessions = data?.sessions || mockData.sessions;
  const totalPages = data?.totalPages || mockData.totalPages;
  const totalSessions = data?.totalSessions || mockData.totalSessions;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'abandoned':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'timeout':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'abandoned':
        return <AlertCircle className="w-4 h-4" />;
      case 'timeout':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'recognition':
        return <Eye className="w-4 h-4" />;
      case 'recall':
        return <Hash className="w-4 h-4" />;
      case 'listening':
        return <Play className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const exportData = useCallback((exportFormat: 'csv' | 'json') => {
    if (exportFormat === 'csv') {
      const headers = ['Date', 'Duration', 'Items', 'Accuracy', 'Mode', 'Status', 'Points'];
      const rows = sessions.map(s => [
        format(parseISO(s.date), 'yyyy-MM-dd HH:mm'),
        formatDuration(s.duration),
        `${s.itemsReviewed}/${s.itemsTotal}`,
        `${s.accuracy.toFixed(1)}%`,
        s.mode,
        s.status,
        s.points.toString()
      ]);
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    } else {
      const json = JSON.stringify(sessions, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-history-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    }
  }, [sessions]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Session History</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {totalSessions} total sessions
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          
          <div className="relative">
            <button
              className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Export options"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hidden group-hover:block">
              <button
                onClick={() => exportData('csv')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Export as CSV
              </button>
              <button
                onClick={() => exportData('json')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FileJson className="w-4 h-4" />
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value ? new Date(e.target.value) : null }
                    }))}
                  />
                  <span className="self-center text-gray-500">to</span>
                  <input
                    type="date"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value ? new Date(e.target.value) : null }
                    }))}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mode
                </label>
                <select
                  value={filters.mode}
                  onChange={(e) => setFilters(prev => ({ ...prev, mode: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="all">All Modes</option>
                  <option value="recognition">Recognition</option>
                  <option value="recall">Recall</option>
                  <option value="listening">Listening</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="timeout">Timeout</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setFilters({
                  dateRange: { start: null, end: null },
                  mode: 'all',
                  status: 'all',
                  search: ''
                })}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Accuracy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((session, index) => (
                <motion.tr
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer"
                  onClick={() => setSelectedSession(session.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(parseISO(session.date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(session.startTime), 'HH:mm')}
                      </p>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatDuration(session.duration)}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {session.itemsReviewed}/{session.itemsTotal}
                    </div>
                    <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full"
                        style={{ width: `${(session.itemsReviewed / session.itemsTotal) * 100}%` }}
                      />
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Target className={`w-3 h-3 ${
                        session.accuracy >= 80 ? 'text-green-500' :
                        session.accuracy >= 60 ? 'text-yellow-500' :
                        'text-red-500'
                      }`} />
                      <span className={`text-sm font-medium ${
                        session.accuracy >= 80 ? 'text-green-600' :
                        session.accuracy >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {session.accuracy.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {getModeIcon(session.mode)}
                      <span className="text-sm text-gray-900 dark:text-white capitalize">
                        {session.mode}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {getStatusIcon(session.status)}
                      {session.status}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {session.performance.trend === 'improving' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : session.performance.trend === 'declining' ? (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      ) : (
                        <Activity className="w-4 h-4 text-gray-500" />
                      )}
                      <span className={`text-sm ${
                        session.performance.vsAverage > 0 ? 'text-green-600' :
                        session.performance.vsAverage < 0 ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {session.performance.vsAverage > 0 ? '+' : ''}{session.performance.vsAverage.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSession(session.id);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <span className="text-sm text-gray-500">
            Showing {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, totalSessions)} of {totalSessions}
          </span>
        </div>
      </div>
    </div>
  );
}