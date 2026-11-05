/**
 * Semester keys ("HS25", "FS26") and the HSG academic calendar.
 *
 * Calendar rule: FS runs February to July, HS runs August to January, so
 * January belongs to the HS of the previous calendar year.
 */

// 0-based months (Date#getMonth) that fall in the spring semester: Feb..Jul.
export const FS_MONTHS = [1, 2, 3, 4, 5, 6];

const SEMESTER_PATTERN = /(HS|FS)\s*(\d{2})(?!\d)/;
const CENTURY_PIVOT = 50;

const formatKey = (season, fullYear) =>
  `${season}${String(fullYear % 100).padStart(2, "0")}`;

/** "HS 25", "HS25 - Placeholder" -> "HS25"; "" when no key can be found. */
export const normalizeSemesterKey = (input) => {
  if (typeof input !== "string") return "";
  const match = input.match(SEMESTER_PATTERN);
  return match ? `${match[1]}${match[2]}` : "";
};

/** @returns {{ season: "HS"|"FS", year: number, fullYear: number } | null} */
export const parseSemesterKey = (key) => {
  const normalized = normalizeSemesterKey(key);
  if (!normalized) return null;
  const season = normalized.slice(0, 2);
  const year = parseInt(normalized.slice(2), 10);
  const fullYear = year < CENTURY_PIVOT ? 2000 + year : 1900 + year;
  return { season, year, fullYear };
};

/** Chronological order; FS precedes HS within a year; unparseable keys last. */
export const compareSemesterKeys = (a, b) => {
  const parsedA = parseSemesterKey(a);
  const parsedB = parseSemesterKey(b);
  if (!parsedA || !parsedB) return (parsedA ? 0 : 1) - (parsedB ? 0 : 1);
  if (parsedA.fullYear !== parsedB.fullYear) {
    return parsedA.fullYear - parsedB.fullYear;
  }
  if (parsedA.season === parsedB.season) return 0;
  return parsedA.season === "FS" ? -1 : 1;
};

export const sortSemesterKeys = (keys) => [...keys].sort(compareSemesterKeys);

/** "FS25" -> "HS25", "HS25" -> "FS26"; "" for an unparseable key. */
export const nextSemesterKey = (key) => {
  const parsed = parseSemesterKey(key);
  if (!parsed) return "";
  return parsed.season === "FS"
    ? formatKey("HS", parsed.fullYear)
    : formatKey("FS", parsed.fullYear + 1);
};

/** "HS26" -> "HS25"; null for an unparseable key. */
export const previousYearSameSeason = (key) => {
  const parsed = parseSemesterKey(key);
  return parsed ? formatKey(parsed.season, parsed.fullYear - 1) : null;
};

export const currentSemesterKey = (date = new Date()) => {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (FS_MONTHS.includes(month)) return formatKey("FS", year);
  return formatKey("HS", month < FS_MONTHS[0] ? year - 1 : year);
};

/** @returns {"completed"|"current"|"future"} */
export const semesterStatus = (key, date = new Date()) => {
  const comparison = compareSemesterKeys(key, currentSemesterKey(date));
  if (comparison === 0) return "current";
  return comparison > 0 ? "future" : "completed";
};
