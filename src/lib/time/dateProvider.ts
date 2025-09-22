/**
 * Date Provider for Review Engine and Achievement System
 *
 * This module provides a centralized way to get the current date/time
 * that can be overridden by the virtual clock for testing.
 */

import { virtualClock } from './virtualClock';

/**
 * Get the current timestamp in milliseconds
 * Uses virtual clock if enabled, otherwise real time
 */
export function now(): number {
  return virtualClock.now();
}

/**
 * Get the current Date object
 * Uses virtual clock if enabled, otherwise real time
 */
export function nowDate(): Date {
  return virtualClock.nowDate();
}

/**
 * Create a Date object at the specified offset from now
 * @param offsetMs Offset in milliseconds (positive for future, negative for past)
 */
export function dateFromNow(offsetMs: number): Date {
  return new Date(now() + offsetMs);
}

/**
 * Create a Date object at the specified number of days from now
 * @param days Number of days (positive for future, negative for past)
 */
export function daysFromNow(days: number): Date {
  return dateFromNow(days * 24 * 60 * 60 * 1000);
}

/**
 * Create a Date object at the specified number of hours from now
 * @param hours Number of hours (positive for future, negative for past)
 */
export function hoursFromNow(hours: number): Date {
  return dateFromNow(hours * 60 * 60 * 1000);
}

/**
 * Create a Date object at the specified number of minutes from now
 * @param minutes Number of minutes (positive for future, negative for past)
 */
export function minutesFromNow(minutes: number): Date {
  return dateFromNow(minutes * 60 * 1000);
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > now();
}

/**
 * Get the difference between two dates in days
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/**
 * Get the difference from now to a date in days
 */
export function daysUntil(date: Date): number {
  const diff = date.getTime() - now();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, nowDate());
}

/**
 * Get the start of today (midnight)
 */
export function startOfToday(): Date {
  const today = nowDate();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get the end of today (23:59:59.999)
 */
export function endOfToday(): Date {
  const today = nowDate();
  today.setHours(23, 59, 59, 999);
  return today;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  const days = Math.floor(Math.abs(ms) / (24 * 60 * 60 * 1000));
  const hours = Math.floor(Math.abs(ms) % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
  const minutes = Math.floor(Math.abs(ms) % (60 * 60 * 1000) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  const result = parts.join(' ') || '0m';
  return ms < 0 ? `-${result}` : result;
}