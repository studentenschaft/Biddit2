/**
 * Turns the `pdftotext -layout` rendering of an HSG exam plan into a structured
 * ParsedPlan. Pure: no fs, no clock, no process.
 *
 * The layout is a two-column table, one column per written start time. The
 * columns move from page to page and a guessed time would be silently wrong, so
 * both the times and the column boundary are read off each page's own header
 * line.
 */

export const PAGE_KIND = {
  written: "written",
  oral: "oral",
  unknown: "unknown",
};

/**
 * One written exam: level, term type, language, duration, cross-listed roots.
 * Root prefixes run past one digit (the catalog has "11,702,1.00"), so the
 * pattern must not assume `d,ddd` — a root it cannot see is dropped silently,
 * because the count check uses this same regex.
 */
export const ENTRY_RE =
  /(AJ|BA|MA):\s*(OT|AT)\s+(DE|EN)\s+(\d{2,3})'\s+((?:\d{1,2},\d{3})(?:\s*\|\s*\d{1,2},\d{3})*)\s+/g;

const PAGE_BREAK = "\f";
const WRITTEN_BANNER_RE = /Schriftliche Prüfungen \/ Written examinations/;
const ORAL_BANNER_RE = /Mündliche Prüfungen \/ Oral examinations/;

const HEADER_RE =
  /Prüfungsplan\s+(.+?)\s*\/\s*Examination Schedule\s+.*?\((\d{2})\.(\d{2})\.\s*-\s*(\d{2})\.(\d{2})\.(\d{4})\)/;
const ORAL_PERIOD_RE =
  /Mündliche Prüfungen \/ Oral examinations:\s*(\d{2})\.(\d{2})\.\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/;
const FOOTER_RE =
  /^Kompetenzcenter Planung und Prüfungen\s+(\d{2})\.(\d{2})\.(\d{4})\s+Seite\s+\d+\s+von\s+\d+/gm;

export const TABLE_HEADER_PREFIX = "Datum";
const LEADING_DATE_RE = /^\s*(\d{2})\.(\d{2})\.(\d{4})/;
const SLOT_LABEL_RE =
  /Prüfungsbeginn \(schriftl\.\):\s*(\d{1,2})\.(\d{2})\s*Uhr/g;
const COURSE_ROOT_RE = /\b\d{1,2},\d{3}\b/;
const ORAL_EXAM_RE = /^((?:\d{1,2},\d{3})(?:\s*\|\s*\d{1,2},\d{3})*)\s+(\S.*)$/;
const BYOD_MARKER_RE = /\(BYOD\)/;
export const ROOT_SEPARATOR = "|";
export const WEEKDAYS_SOURCE =
  "Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";
const WEEKDAY_GUTTER_RE = new RegExp(`^(?:${WEEKDAYS_SOURCE})\\s*\\/?\\s*`);

// An entry prefix ("BA: OT DE 120' 3,802 | 4,802 ") is roughly 40 columns wide,
// so two genuinely separate slot columns can never come closer than that.
const MIN_COLUMN_CLUSTER_GAP = 40;

const warning = (code, message, context) => ({ code, message, context });
const matchFooters = (text) => [...text.matchAll(FOOTER_RE)];

function pageKind(text) {
  if (WRITTEN_BANNER_RE.test(text)) return PAGE_KIND.written;
  if (ORAL_BANNER_RE.test(text)) return PAGE_KIND.oral;
  return PAGE_KIND.unknown;
}

/**
 * Splits on the form feeds `pdftotext -layout` emits between pages. Pages
 * without a banner carry no exam rows and are dropped. One that lists a course
 * would take its exams with it — the validator's entry count would notice
 * written rows, but nothing counts oral ones — so it is fatal instead.
 */
export function splitPages(rawText) {
  const pages = rawText
    .split(PAGE_BREAK)
    .map((text, index) => ({ number: index + 1, text, kind: pageKind(text) }));
  for (const page of pages) {
    const root =
      page.kind === PAGE_KIND.unknown && page.text.match(COURSE_ROOT_RE);
    if (root) {
      throw new Error(
        `Page has no written or oral banner but lists course ${root[0]} — page ${page.number}`,
      );
    }
  }
  return pages.filter((page) => page.kind !== PAGE_KIND.unknown);
}

/**
 * The two start times of a written page and the column that separates their
 * entries. Guessing here would silently shift exams by hours, so anything but
 * two ascending labels is fatal.
 */
export function readSlots(page) {
  const headerLine = page.text
    .split("\n")
    .find((line) => line.startsWith(TABLE_HEADER_PREFIX));
  const labels = [...(headerLine ?? "").matchAll(SLOT_LABEL_RE)].map(
    (match) => ({
      time: `${match[1].padStart(2, "0")}:${match[2]}`,
      column: match.index,
    }),
  );
  const times = labels.map((label) => label.time);
  if (labels.length !== 2 || times[0] >= times[1]) {
    throw new Error(
      `Cannot read the start times — page ${page.number}: expected two ascending "Prüfungsbeginn (schriftl.): hh.mm Uhr" labels in the table header, found ${times.join(", ") || "none"}`,
    );
  }
  // Right-hand entries start at exactly their label's column, so the boundary
  // sits halfway between the labels rather than on the second one.
  return { times, boundary: (labels[0].column + labels[1].column) / 2 };
}

/**
 * Every date the plan prints goes through here. Date.UTC rolls 31.02. over
 * into March, so the round trip exposes it; left alone, a month 13 would only
 * surface later as a bare "Invalid time value" from the offset lookup.
 */
function calendarDate(day, month, year, where) {
  const date = `${year}-${month}-${day}`;
  if (!new Date(Date.UTC(year, month - 1, day)).toISOString().startsWith(date)) {
    throw new Error(`Not a calendar date — ${where}: ${day}.${month}.${year}`);
  }
  return date;
}

const splitRoots = (roots) =>
  roots.split(ROOT_SEPARATOR).map((root) => root.trim());

function stripGutter(line) {
  const withoutDash = line.trimStart().replace(/^-\s*/, "");
  return withoutDash.replace(WEEKDAY_GUTTER_RE, "").trim();
}

function parseWrittenPage(page) {
  const { times, boundary } = readSlots(page);
  const lines = page.text.split("\n");
  const bodyStart = lines.findIndex((line) =>
    line.startsWith(TABLE_HEADER_PREFIX),
  );
  const exams = [];
  const entryColumns = [];
  let currentDate = null;

  for (let index = bodyStart; index < lines.length; index += 1) {
    const line = lines[index];
    const dateMatch = line.match(LEADING_DATE_RE);
    // A date row usually carries its first exams too, so it is never skipped.
    const where = `page ${page.number} line ${index + 1}`;
    if (dateMatch) currentDate = calendarDate(...dateMatch.slice(1), where);

    const matches = [...line.matchAll(ENTRY_RE)];
    matches.forEach((match, position) => {
      if (!currentDate) {
        throw new Error(
          `Exam row appears before any date row — ${where}: ${line.trim()}`,
        );
      }
      entryColumns.push(match.index);
      const [full, level, termType, language, duration, roots] = match;
      const titleEnd =
        position + 1 < matches.length ? matches[position + 1].index : line.length;
      const title = line.slice(match.index + full.length, titleEnd).trim();
      exams.push({
        date: currentDate,
        slot: match.index >= boundary ? times[1] : times[0],
        durationMin: Number(duration),
        level,
        termType,
        language,
        rootNumbers: splitRoots(roots),
        title,
        byod: BYOD_MARKER_RE.test(title),
      });
    });
  }

  const leftColumns = entryColumns.filter((column) => column < boundary);
  const rightColumns = entryColumns.filter((column) => column >= boundary);
  const leftEnd = Math.max(...leftColumns);
  const rightStart = Math.min(...rightColumns);
  if (
    entryColumns.length > 0 &&
    (leftColumns.length === 0 || rightColumns.length === 0)
  ) {
    // A boundary that sweeps every entry into one column balances every count
    // and shifts each exam by hours. Every published page so far uses both
    // start times, so an empty column means the header no longer fits the rows.
    throw new Error(
      `Every exam landed in one start-time column — page ${page.number}: ${leftColumns.length} left and ${rightColumns.length} right of column ${boundary}`,
    );
  }
  if (rightStart - leftEnd < MIN_COLUMN_CLUSTER_GAP) {
    throw new Error(
      `The two start-time columns nearly touch — page ${page.number}: left entries end at column ${leftEnd}, right entries start at ${rightStart}`,
    );
  }
  return exams;
}

function parseOralPage(page) {
  const oral = [];
  const oralNotes = [];
  let currentDate = null;
  let currentSection = null;

  for (const [index, line] of page.text.split("\n").entries()) {
    if (matchFooters(line).length > 0) continue;
    const dateMatch = line.match(LEADING_DATE_RE);
    if (dateMatch) {
      const where = `page ${page.number} line ${index + 1}`;
      currentDate = calendarDate(...dateMatch.slice(1), where);
    }
    const text = dateMatch
      ? line.slice(dateMatch[0].length).trim()
      : stripGutter(line);
    if (!currentDate || !text) continue;

    const examMatch = text.match(ORAL_EXAM_RE);
    if (examMatch) {
      const [, roots, title] = examMatch;
      oral.push({
        date: currentDate,
        section: currentSection,
        rootNumbers: splitRoots(roots),
        title,
      });
    } else if (dateMatch) {
      // The section label rides on the date row and applies until the next one.
      currentSection = text;
    } else {
      oralNotes.push({ date: currentDate, section: currentSection, text });
    }
  }
  return { oral, oralNotes };
}

const toPeriod = ([startDay, startMonth, endDay, endMonth, year], where) => ({
  start: calendarDate(startDay, startMonth, year, where),
  end: calendarDate(endDay, endMonth, year, where),
});

function parseHeader(rawText) {
  const match = rawText.match(HEADER_RE);
  if (!match) {
    throw new Error(
      "Cannot read the plan header: no \"Prüfungsplan … / Examination Schedule … (dd.mm. - dd.mm.yyyy)\" line",
    );
  }
  const [, termLabel, ...period] = match;
  return { termLabel, examPeriod: toPeriod(period, "plan header") };
}

function parseOralPeriod(rawText) {
  if (!ORAL_BANNER_RE.test(rawText)) return null;
  const match = rawText.match(ORAL_PERIOD_RE);
  if (!match) {
    throw new Error(
      "Cannot read the oral exam period: the oral page banner has no \"dd.mm. - dd.mm.yyyy\" range",
    );
  }
  return toPeriod(match.slice(1), "oral page banner");
}

function parseFooters(rawText, warnings) {
  const dates = [
    ...new Set(
      matchFooters(rawText).map((match) =>
        calendarDate(...match.slice(1), "page footer"),
      ),
    ),
  ];
  if (dates.length === 0) {
    throw new Error(
      "Cannot read the revision date: no \"Kompetenzcenter Planung und Prüfungen dd.mm.yyyy Seite n von m\" footer",
    );
  }
  if (dates.length > 1) {
    warnings.push(
      warning(
        "W_PUBLISHED_AT_MIXED",
        "Pages carry different revision dates — the plan may mix revisions",
        dates.join(", "),
      ),
    );
  }
  return dates[0];
}

export function parseExamPlanText(rawText) {
  const warnings = [];
  const pages = splitPages(rawText);
  const written = pages
    .filter((page) => page.kind === PAGE_KIND.written)
    .flatMap((page) => parseWrittenPage(page));
  const oralPages = pages
    .filter((page) => page.kind === PAGE_KIND.oral)
    .map((page) => parseOralPage(page));

  return {
    ...parseHeader(rawText),
    oralExamPeriod: parseOralPeriod(rawText),
    publishedAt: parseFooters(rawText, warnings),
    written,
    oral: oralPages.flatMap((page) => page.oral),
    oralNotes: oralPages.flatMap((page) => page.oralNotes),
    warnings,
  };
}
