export interface CalendarDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

const DOB_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a strict YYYY-MM-DD calendar date string without timezone conversion so
 * dates never shift by +/- 1 day across UTC offsets.
 */
export function parseCalendarDate(value: string): CalendarDateParts | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = DOB_REGEX.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Construct in local calendar space strictly to verify real day-in-month (e.g. reject Feb 30)
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function getTodayCalendarParts(now: Date = new Date()): CalendarDateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function validateDateOfBirth(
  value: string,
  referenceDate: Date = new Date()
): { valid: boolean; error?: string; normalized: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: true, normalized: '' }; // DOB is optional
  }

  const parsed = parseCalendarDate(trimmed);
  if (!parsed) {
    return {
      valid: false,
      error: 'Enter a valid calendar date in YYYY-MM-DD format.',
      normalized: trimmed,
    };
  }

  const today = getTodayCalendarParts(referenceDate);
  const isFuture =
    parsed.year > today.year ||
    (parsed.year === today.year && parsed.month > today.month) ||
    (parsed.year === today.year && parsed.month === today.month && parsed.day > today.day);

  if (isFuture) {
    return {
      valid: false,
      error: 'Date of birth cannot be in the future.',
      normalized: trimmed,
    };
  }

  if (today.year - parsed.year > 130) {
    return {
      valid: false,
      error: 'Please enter a realistic birth year.',
      normalized: trimmed,
    };
  }

  return {
    valid: true,
    normalized: `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`,
  };
}

/**
 * Calculates age in whole years directly from YYYY-MM-DD calendar components.
 */
export function calculateAgeFromDob(
  dob: string,
  referenceDate: Date = new Date()
): number | null {
  const parsed = parseCalendarDate(dob);
  if (!parsed) return null;

  const today = getTodayCalendarParts(referenceDate);
  let age = today.year - parsed.year;
  const beforeBirthday =
    today.month < parsed.month || (today.month === parsed.month && today.day < parsed.day);
  if (beforeBirthday) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatCalendarDate(dob: string): string {
  const parsed = parseCalendarDate(dob);
  if (!parsed) return '';
  return `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

export function getInitials(name: string, fallback = 'NS'): string {
  const cleaned = name.trim();
  if (!cleaned) return fallback;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase() || fallback;
}
