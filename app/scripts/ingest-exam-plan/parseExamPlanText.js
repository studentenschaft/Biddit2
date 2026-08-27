/**
 * Turns the `pdftotext -layout` rendering of an HSG exam plan into a structured
 * ParsedPlan. Pure: no fs, no clock, no process.
 *
 * The layout is a two-column table (09:15 left, 15:15 right) whose column
 * boundary moves from page to page, so the boundary is read off each page's own
 * header line instead of being assumed.
 */

export const PAGE_KIND = {
  written: "written",
  oral: "oral",
  unknown: "unknown",
};

export const MORNING_SLOT = "09:15";
export const AFTERNOON_SLOT = "15:15";

/** One written exam: level, term type, language, duration, cross-listed roots. */
export const ENTRY_RE =
  /(AJ|BA|MA):\s*(OT|AT)\s+(DE|EN)\s+(\d{2,3})'\s+((?:\d,\d{3})(?:\s*\|\s*\d,\d{3})*)\s+/g;

const PAGE_BREAK = "\f";
const BANNER_RE =
  /(?:Schriftliche|Mündliche) Prüfungen \/ (?:Written|Oral) examinations/;
const WRITTEN_BANNER_RE = /Schriftliche Prüfungen \/ Written examinations/;
const ORAL_BANNER_RE = /Mündliche Prüfungen \/ Oral examinations/;

const HEADER_RE =
  /Prüfungsplan\s+(.+?)\s*\/\s*Examination Schedule\s+.*?\((\d{2})\.(\d{2})\.\s*-\s*(\d{2})\.(\d{2})\.(\d{4})\)/;
const ORAL_PERIOD_RE =
  /Mündliche Prüfungen \/ Oral examinations:\s*(\d{2})\.(\d{2})\.\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/;
const FOOTER_RE =
  /^Kompetenzcenter Planung und Prüfungen\s+(\d{2})\.(\d{2})\.(\d{4})\s+Seite\s+\d+\s+von\s+\d+/gm;

export const TABLE_HEADER_PREFIX = "Datum";
export const LEADING_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})/;
const SLOT_LABEL_RE = /Prüfungsbeginn/g;
const AFTERNOON_TIME_LABEL = "15.15";
const ORAL_EXAM_RE = /^((?:\d,\d{3})(?:\s*\|\s*\d,\d{3})*)\s+(\S.*)$/;
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
 * Splits into classified pages. Form feeds are the normal case; the banner
 * fallback keeps the parser working if a future extraction loses them. Pages
 * without a banner carry no exam rows and are dropped — the validator's entry
 * count catches it loudly if that ever stops being true.
 */
export function splitPages(rawText) {
  const chunks = rawText.includes(PAGE_BREAK)
    ? rawText.split(PAGE_BREAK)
    : rawText.split(new RegExp(`(?=${BANNER_RE.source})`));
  return chunks
    .map((text, index) => ({ number: index + 1, text, kind: pageKind(text) }))
    .filter((page) => page.kind !== PAGE_KIND.unknown);
}

/**
 * Column at which the 15:15 block starts. Guessing here would silently shift
 * exams by six hours, so a page without a derivable boundary is fatal.
 */
export function findAfternoonColumn(pageText) {
  const headerLine = pageText
    .split("\n")
    .find((line) => line.startsWith(TABLE_HEADER_PREFIX));
  const slotLabelColumns = headerLine
    ? [...headerLine.matchAll(SLOT_LABEL_RE)].map((match) => match.index)
    : [];
  if (slotLabelColumns.length >= 2) return slotLabelColumns[1];

  const timeLabelColumn = headerLine
    ? headerLine.indexOf(AFTERNOON_TIME_LABEL)
    : -1;
  if (timeLabelColumn >= 0) return timeLabelColumn;

  throw new Error(
    `Cannot locate the ${AFTERNOON_SLOT} column: no table header with two "Prüfungsbeginn" labels`,
  );
}

const toIsoDate = ([, day, month, year]) => `${year}-${month}-${day}`;

const splitRoots = (roots) =>
  roots.split(ROOT_SEPARATOR).map((root) => root.trim());

function stripGutter(line) {
  const withoutDash = line.trimStart().replace(/^-\s*/, "");
  return withoutDash.replace(WEEKDAY_GUTTER_RE, "").trim();
}

function parseWrittenPage(page, warnings) {
  const boundary = findAfternoonColumn(page.text);
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
    if (dateMatch) currentDate = toIsoDate(dateMatch);

    const matches = [...line.matchAll(ENTRY_RE)];
    matches.forEach((match, position) => {
      entryColumns.push(match.index);
      if (!currentDate) {
        warnings.push(
          warning(
            "W_ENTRY_WITHOUT_DATE",
            "Exam row appears before any date row and was dropped",
            `page ${page.number} line ${index + 1}: ${line.trim()}`,
          ),
        );
        return;
      }
      const [full, level, termType, language, duration, roots] = match;
      const titleEnd =
        position + 1 < matches.length ? matches[position + 1].index : line.length;
      const title = line.slice(match.index + full.length, titleEnd).trim();
      exams.push({
        date: currentDate,
        slot: match.index >= boundary ? AFTERNOON_SLOT : MORNING_SLOT,
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

  const morningEnd = Math.max(
    ...entryColumns.filter((column) => column < boundary),
  );
  const afternoonStart = Math.min(
    ...entryColumns.filter((column) => column >= boundary),
  );
  if (afternoonStart - morningEnd < MIN_COLUMN_CLUSTER_GAP) {
    warnings.push(
      warning(
        "W_COLUMN_CLUSTER_TIGHT",
        "The two slot columns nearly touch — verify the 09:15/15:15 split by hand",
        `page ${page.number}: boundary ${boundary}, morning ends at ${morningEnd}, afternoon starts at ${afternoonStart}`,
      ),
    );
  }
  return exams;
}

function parseOralPage(page) {
  const oral = [];
  const oralNotes = [];
  let currentDate = null;
  let currentSection = null;

  for (const line of page.text.split("\n")) {
    if (matchFooters(line).length > 0) continue;
    const dateMatch = line.match(LEADING_DATE_RE);
    if (dateMatch) currentDate = toIsoDate(dateMatch);
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

function parseHeader(rawText) {
  const match = rawText.match(HEADER_RE);
  if (!match) {
    throw new Error(
      "Cannot read the plan header: no \"Prüfungsplan … / Examination Schedule … (dd.mm. - dd.mm.yyyy)\" line",
    );
  }
  const [, termLabel, startDay, startMonth, endDay, endMonth, year] = match;
  return {
    termLabel,
    examPeriod: {
      start: `${year}-${startMonth}-${startDay}`,
      end: `${year}-${endMonth}-${endDay}`,
    },
  };
}

function parseOralPeriod(rawText) {
  const match = rawText.match(ORAL_PERIOD_RE);
  if (!match) return null;
  const [, startDay, startMonth, endDay, endMonth, year] = match;
  return {
    start: `${year}-${startMonth}-${startDay}`,
    end: `${year}-${endMonth}-${endDay}`,
  };
}

function parseFooters(rawText, warnings) {
  const dates = [
    ...new Set(matchFooters(rawText).map((match) => toIsoDate(match))),
  ];
  if (dates.length > 1) {
    warnings.push(
      warning(
        "W_PUBLISHED_AT_MIXED",
        "Pages carry different revision dates — the plan may mix revisions",
        dates.join(", "),
      ),
    );
  }
  return dates[0] ?? null;
}

export function parseExamPlanText(rawText) {
  const warnings = [];
  const pages = splitPages(rawText);
  const written = pages
    .filter((page) => page.kind === PAGE_KIND.written)
    .flatMap((page) => parseWrittenPage(page, warnings));
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
