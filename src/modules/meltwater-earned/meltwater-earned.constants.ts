/** Meltwater day-granularity histograms are limited to 30 days on most packages. */
export const MELTWATER_DAY_WINDOW_DAYS = 30;

/** Daily cron runs at this hour in IST. */
export const MELTWATER_EARNED_CRON_HOUR_IST = 6;

export const EMPTY_SENTIMENT = {
  positive: 0,
  neutral: 0,
  negative: 0,
  unknown: 0
} as const;
