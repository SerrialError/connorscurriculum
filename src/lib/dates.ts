// Dates as "YYYY-MM-DD" strings, the format the data files use. Shared by build-time pages and
// browser scripts (the site is built once and read for weeks, so pages re-check dates in the
// browser).

/** A date as "YYYY-MM-DD" in the reader's time zone. */
export const isoDate = (d: Date): string =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');

/**
 * A class test is over once its date has passed. The day of the test still counts as upcoming,
 * and a test with no date yet ("Date TBA") is upcoming.
 */
export const isPast = (date: string | undefined, today: string): boolean => !!date && date < today;
