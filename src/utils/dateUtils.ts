/**
 * Format a date string to a readable format
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date for display with time
 */
export const formatDateTime = (timestamp: number): string => {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get date range for last N days
 * Returns dates in YYYY-MM-DD format (local time, not UTC)
 */
export const getDateRange = (days: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  // Use local time, not UTC (avoid toISOString timezone shifts)
  const endYear = end.getFullYear();
  const endMonth = String(end.getMonth() + 1).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');

  const startYear = start.getFullYear();
  const startMonth = String(start.getMonth() + 1).padStart(2, '0');
  const startDay = String(start.getDate()).padStart(2, '0');

  return {
    start: `${startYear}-${startMonth}-${startDay}`,
    end: `${endYear}-${endMonth}-${endDay}`,
  };
};

/**
 * Get date range for current month
 * Returns dates in YYYY-MM-DD format (local time, not UTC)
 * Start: 1st of current month, End: today's date
 */
export const getCurrentMonthRange = (): { start: string; end: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const startDay = '01';

  return {
    start: `${year}-${month}-${startDay}`,
    end: `${year}-${month}-${day}`,
  };
};

/**
 * Calculate number of days between two dates
 */
export const daysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};
