/* eslint-disable import/order */
/**
 * Formatting utilities for Calendar Card Pro
 *
 * Handles formatting of dates, times, and locations for display.
 */

import * as Types from '../config/types';
import * as Localize from '../translations/localize';

//-----------------------------------------------------------------------------
// HIGH-LEVEL PUBLIC APIs
//-----------------------------------------------------------------------------

/**
 * Format an event's time string based on its start and end times
 *
 * Generates a human-readable time string for calendar events
 * handling all-day events, multi-day events, and regular events
 *
 * @param event - The calendar event to format
 * @param config - Card configuration options
 * @param language - Language code for translations
 * @returns Formatted time string
 */
export function formatEventTime(
  event: Types.CalendarEventData,
  config: Types.Config,
  language: string = 'en',
): string {
  const isAllDayEvent = !event.start.dateTime;

  let startDate;
  let endDate;

  if (isAllDayEvent) {
    // Parse all-day dates using the specialized function to handle timezone issues
    startDate = parseAllDayDate(event.start.date || '');
    endDate = parseAllDayDate(event.end.date || '');
  } else {
    // Regular events with time use standard parsing
    startDate = new Date(event.start.dateTime || '');
    endDate = new Date(event.end.dateTime || '');
  }

  const translations = Localize.getTranslations(language);

  if (isAllDayEvent) {
    const adjustedEndDate = new Date(endDate);
    // For all-day events, the end date is exclusive in iCal format
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);

    // Check if it's a multi-day event
    if (startDate.toDateString() !== adjustedEndDate.toDateString()) {
      return formatMultiDayAllDayTime(adjustedEndDate, language, translations);
    }

    // Single day all-day event
    return translations.allDay;
  }

  // Handle multi-day events with start/end times
  if (startDate.toDateString() !== endDate.toDateString()) {
    return formatMultiDayTime(startDate, endDate, language, translations, config.time_24h);
  }

  // Single day event with start/end times
  return formatSingleDayTime(startDate, endDate, config.show_end_time, config.time_24h);
}

/**
 * Format location string, optionally removing country code
 *
 * @param location - Location string to format
 * @param removeCountry - Whether to remove country code from location
 * @returns Formatted location string
 */
export function formatLocation(location: string, removeCountry = true): string {
  if (!location || !removeCountry) return location || '';

  const locationText = location.trim();

  // Get country names (this would be better from a proper static source)
  // For now using a simplified approach
  const countryNames = new Set([
    'Germany',
    'Deutschland',
    'United States',
    'USA',
    'United States of America',
    'United Kingdom',
    'Great Britain',
    'France',
    'Italy',
    'Italia',
    'Spain',
    'España',
    'Netherlands',
    'Nederland',
    'Austria',
    'Österreich',
    'Switzerland',
    'Schweiz',
  ]);

  // Handle comma-separated format (e.g., "City, Country")
  const parts = locationText.split(',').map((part) => part.trim());
  if (parts.length > 0 && countryNames.has(parts[parts.length - 1])) {
    parts.pop();
    return parts.join(', ');
  }

  // Handle space-separated format (e.g., "City Country")
  const words = locationText.split(/\s+/);
  if (words.length > 0 && countryNames.has(words[words.length - 1])) {
    words.pop();
    return words.join(' ');
  }

  return locationText;
}

//-----------------------------------------------------------------------------
// CORE FORMATTING UTILITY
//-----------------------------------------------------------------------------

/**
 * Parse all-day event date string to local date object
 *
 * Creates a date object at local midnight for the specified date
 * which preserves the intended day regardless of timezone
 *
 * @param dateString - ISO format date string (YYYY-MM-DD)
 * @returns Date object at local midnight on the specified date
 */
export function parseAllDayDate(dateString: string): Date {
  // Extract year, month, day from date string
  const [year, month, day] = dateString.split('-').map(Number);

  // Create date at local midnight (months are 0-indexed in JS)
  return new Date(year, month - 1, day);
}

/**
 * Generate a date key string in YYYY-MM-DD format from a Date object
 * Uses local date components instead of UTC
 *
 * @param date - Date object to format
 * @returns Date key string in YYYY-MM-DD format
 */
export function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Format time according to 12/24 hour setting
 *
 * @param date Date object to format
 * @param use24h Whether to use 24-hour format
 * @returns Formatted time string
 */
export function formatTime(date: Date, use24h = true): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();

  if (!use24h) {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculate ISO week number for a date
 * Week 1 is the week with the first Thursday of the year
 *
 * @param date Date to calculate week number for
 * @returns ISO week number (1-53)
 */
export function getISOWeekNumber(date: Date): number {
  // Create a copy of the date
  const d = new Date(date);

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));

  // Get first day of year
  const yearStart = new Date(d.getFullYear(), 0, 1);

  // Calculate full weeks to nearest Thursday
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return weekNumber;
}

/**
 * Calculate simple week number (1st January = week 1)
 *
 * @param date Date to calculate week number for
 * @param firstDayOfWeek First day of week (0 = Sunday, 1 = Monday)
 * @returns Simple week number (1-53)
 */
export function getSimpleWeekNumber(date: Date, firstDayOfWeek: number = 0): number {
  // Create a copy of the date
  const d = new Date(date);

  // Get the first day of the year
  const startOfYear = new Date(d.getFullYear(), 0, 1);

  // Calculate days since start of the year
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));

  // Calculate offset based on first day of the year and configured first day of week
  // This adjustment aligns the week boundaries with the configured first day of week
  const dayOfWeekOffset = (startOfYear.getDay() - firstDayOfWeek + 7) % 7;

  // Calculate week number (adding 1 because we want weeks to start from 1)
  const weekNumber = Math.ceil((days + dayOfWeekOffset + 1) / 7);

  return weekNumber;
}

/**
 * Get first day of week based on config and locale
 *
 * @param firstDayConfig Configuration setting for first day of week
 * @param locale Current locale
 * @returns Day number (0 = Sunday, 1 = Monday)
 */
export function getFirstDayOfWeek(
  firstDayConfig: 'sunday' | 'monday' | 'system',
  locale: string = 'en',
): number {
  // Explicit setting takes precedence
  if (firstDayConfig === 'sunday') return 0;
  if (firstDayConfig === 'monday') return 1;

  // For system setting, try to detect from locale
  try {
    // Northern American locales typically use Sunday as first day
    if (/^en-(US|CA)|es-US/.test(locale)) {
      return 0; // Sunday
    }

    // Most other locales use Monday
    return 1;
  } catch {
    // Default to Monday on error
    return 1;
  }
}

/**
 * Get week number based on config settings
 *
 * @param date Date to get week number for
 * @param method Week numbering method (iso or simple)
 * @param firstDayOfWeek First day of week (0 = Sunday, 1 = Monday)
 * @returns Calculated week number
 */
export function getWeekNumber(
  date: Date,
  method: 'iso' | 'simple' | null,
  firstDayOfWeek: number,
): number | null {
  if (!method) return null;

  if (method === 'iso') {
    // ISO week numbers are defined by ISO 8601 standard and always use Monday as first day
    // for calculation purposes, but we still display separator on the configured first day
    return getISOWeekNumber(date);
  }

  if (method === 'simple') {
    // Simple week numbers should respect the configured first day of week
    return getSimpleWeekNumber(date, firstDayOfWeek);
  }

  return null;
}

//-----------------------------------------------------------------------------
// SPECIALIZED EVENT FORMATTING HELPERS
//-----------------------------------------------------------------------------

/**
 * Format single day event time with start/end times
 *
 * @param startDate Start date of the event
 * @param endDate End date of the event
 * @param showEndTime Whether to show end time
 * @param time24h Whether to use 24-hour format
 * @returns Formatted time string
 */
function formatSingleDayTime(
  startDate: Date,
  endDate: Date,
  showEndTime: boolean,
  time24h: boolean,
): string {
  return showEndTime
    ? `${formatTime(startDate, time24h)} - ${formatTime(endDate, time24h)}`
    : formatTime(startDate, time24h);
}

/**
 * Format multi-day event time with start/end times
 *
 * @param startDate Start date of the event
 * @param endDate End date of the event
 * @param language Language code for translations
 * @param translations Translations object
 * @param time24h Whether to use 24-hour format
 * @returns Formatted time string
 */
function formatMultiDayTime(
  startDate: Date,
  endDate: Date,
  language: string,
  translations: Types.Translations,
  time24h: boolean,
): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Format the end time part based on when the event ends
  let endPart: string;

  if (endDate.toDateString() === today.toDateString()) {
    // Event ends today
    endPart = `${translations.endsToday} ${translations.at} ${formatTime(endDate, time24h)}`;
  } else if (endDate.toDateString() === tomorrow.toDateString()) {
    // Event ends tomorrow
    endPart = `${translations.endsTomorrow} ${translations.at} ${formatTime(endDate, time24h)}`;
  } else {
    // Event ends beyond tomorrow
    const endDay = endDate.getDate();
    const endMonthName = translations.months[endDate.getMonth()];
    const endWeekday = translations.fullDaysOfWeek[endDate.getDay()];
    const endTimeStr = formatTime(endDate, time24h);
    const formatStyle = Localize.getDateFormatStyle(language);

    // Format based on language style
    switch (formatStyle) {
      case 'day-dot-month':
        endPart = `${endWeekday}, ${endDay}. ${endMonthName} ${translations.at} ${endTimeStr}`;
        break;
      case 'month-day':
        endPart = `${endWeekday}, ${endMonthName} ${endDay} ${translations.at} ${endTimeStr}`;
        break;
      case 'day-month':
      default:
        endPart = `${endWeekday}, ${endDay} ${endMonthName} ${translations.at} ${endTimeStr}`;
        break;
    }
  }

  // Check if today is on or before the start date
  // If so, include the start time in the output
  if (today.getTime() <= startDate.getTime()) {
    const startTimeStr = formatTime(startDate, time24h);
    return `${startTimeStr} ${translations.multiDay} ${endPart}`;
  }

  // If today is after the start date but before the end date
  // Only show the end part (omit the start time)
  return `${translations.multiDay} ${endPart}`;
}

/**
 * Format multi-day all-day event time
 *
 * @param endDate End date of the event
 * @param language Language code for translations
 * @param translations Translations object
 * @returns Formatted time string
 */
function formatMultiDayAllDayTime(
  endDate: Date,
  language: string,
  translations: Types.Translations,
): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // On the end date, show "ends today"
  if (endDate.toDateString() === today.toDateString()) {
    return `${translations.allDay}, ${translations.endsToday}`;
  }

  // NEW: Day before end date shows "ends tomorrow"
  if (endDate.toDateString() === tomorrow.toDateString()) {
    return `${translations.allDay}, ${translations.endsTomorrow}`;
  }

  const endDay = endDate.getDate();
  const endMonthName = translations.months[endDate.getMonth()];
  const formatStyle = Localize.getDateFormatStyle(language);

  // Different date formats based on language style
  switch (formatStyle) {
    case 'day-dot-month':
      return `${translations.allDay}, ${translations.multiDay} ${endDay}. ${endMonthName}`;
    case 'month-day':
      return `${translations.allDay}, ${translations.multiDay} ${endMonthName} ${endDay}`;
    case 'day-month':
    default:
      return `${translations.allDay}, ${translations.multiDay} ${endDay} ${endMonthName}`;
  }
}
