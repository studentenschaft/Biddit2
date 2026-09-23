/**
 * Gates the write: a plan with any error is never published. Every check is a
 * re-derivation from the raw extraction or from the built artifact, so a parser
 * bug shows up as a loud error instead of a silently missing exam.
 * Pure: no fs, no clock, no process.
 */

import {
  ENTRY_RE,
  PAGE_KIND,
  TABLE_HEADER_PREFIX,
  WEEKDAYS_SOURCE,
  splitPages,
} from "./parseExamPlanText.js";

/**
 * Text that only ever occurs in page furniture or in another entry, never in
 * an exam title. The entry-shaped alternatives are the net for a row the
 * ENTRY_RE could not fully see (e.g. a root prefix wider than it expects):
 * such a row is swallowed into the previous entry's title, invisible to the
 * count and residue checks, and must fail loudly here instead. A run of spaces
 * is the gap between the two columns: no real title holds even two in a row,
 * so it catches a right-hand title or an unknown level ("DS:") the same way.
 */
const TITLE_BLEED_RE =
  /Prüfungsbeginn|Prüfungswoche|Kompetenzcenter|digitale Prüfungen|Seite \d+ von|(?:AJ|BA|MA):\s*(?:OT|AT)|\|\s*\d+,\d{3}| {3,}/;

/** Everything a written table row may leave behind once its exams are removed. */
const RESIDUE_ALLOWED_RE = new RegExp(
  `^(?:\\d{2}\\.\\d{2}\\.\\d{4}|(?:${WEEKDAYS_SOURCE})\\s*\\/?|Datum.*|Date .*|Kompetenzcenter Planung und Prüfungen.*)$`,
);

const AT_PENDING_RE = /wird in der KW\s*\d+ publiziert/;

// HS26 durations run from 60' to 180'; beyond this band a figure is a
// misprint or a misread, not an exam.
const MIN_DURATION_MIN = 30;
const MAX_DURATION_MIN = 240;

/** A course root, also misprinted with a dot ("7.436"). */
const COURSE_NUMBER_RE = /\b\d{1,2}[.,]\d{3}\b/;

const countBy = (items, key) =>
  items.reduce((counts, item) => {
    const bucket = key(item);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    return counts;
  }, {});

function buildStats(plan) {
  return {
    writtenCount: plan.written.length,
    oralCount: plan.oral.length,
    oralNoteCount: plan.oralNotes.length,
    dateCount: new Set(plan.written.map((exam) => exam.date)).size,
    byodCount: plan.written.filter((exam) => exam.byod).length,
    bySlot: countBy(plan.written, (exam) => exam.slot),
    byTermType: countBy(plan.written, (exam) => exam.termType),
    byDurationMin: countBy(plan.written, (exam) => exam.durationMin),
  };
}

/**
 * A title always runs from its entry match to the next match (or the end of the
 * line), so the exams of a row cover it contiguously from the first match on.
 * Whatever sits to the left of that first match is the row's gutter and must be
 * recognisable — anything else is a row shape this parser does not understand.
 */
function checkUnconsumedLines(rawText, fail) {
  for (const page of splitPages(rawText)) {
    if (page.kind !== PAGE_KIND.written) continue;
    const lines = page.text.split("\n");
    // The parser has already refused a written page without a table header.
    const bodyStart = lines.findIndex((line) =>
      line.startsWith(TABLE_HEADER_PREFIX),
    );
    for (let index = bodyStart; index < lines.length; index += 1) {
      const line = lines[index];
      const firstEntry = [...line.matchAll(ENTRY_RE)][0];
      const residue = line.slice(0, firstEntry?.index ?? line.length).trim();
      if (residue && !RESIDUE_ALLOWED_RE.test(residue)) {
        fail(
          "E_UNCONSUMED_LINE",
          "Table row is neither an exam nor a recognised date/weekday/header row",
          `page ${page.number} line ${index + 1}: ${residue}`,
        );
      }
    }
  }
}

function checkWrittenExam(exam, plan, fail) {
  const where = exam.id;
  // The parser has already refused any date that is not on the calendar.
  if (exam.date < plan.examPeriod.start || exam.date > plan.examPeriod.end) {
    fail("E_DATE_OUT_OF_PERIOD", "Exam date lies outside the exam period", where);
  }

  if (
    exam.durationMin < MIN_DURATION_MIN ||
    exam.durationMin > MAX_DURATION_MIN
  ) {
    fail(
      "E_DURATION_OUT_OF_RANGE",
      `Exam duration lies outside ${MIN_DURATION_MIN}–${MAX_DURATION_MIN} minutes`,
      `${where}: ${exam.durationMin}'`,
    );
  }

  if (!exam.title) fail("E_TITLE_EMPTY", "Exam title is empty", where);
  if (TITLE_BLEED_RE.test(exam.title)) {
    fail("E_TITLE_BLEED", "Page furniture bled into the exam title", `${where}: ${exam.title}`);
  }
}

/** Oral exams and notes carry the date range of their block on the oral page. */
function checkOralRange({ dateStart, dateEnd }, period, where, fail) {
  if (!(period.start <= dateStart && dateStart <= dateEnd && dateEnd <= period.end)) {
    fail(
      "E_DATE_OUT_OF_PERIOD",
      "Oral date range runs backwards or leaves the oral exam period",
      `${where}: ${dateStart} … ${dateEnd}`,
    );
  }
}

function checkDuplicates(exams, fail) {
  // The id carries term type, date, slot and roots: a two-part exam
  // legitimately puts the same root on two dates, but the same id twice is a
  // parser artefact.
  const ids = new Set();
  for (const exam of exams) {
    if (ids.has(exam.id)) {
      fail("E_DUPLICATE_EXAM", "Two exams share an id", exam.id);
    }
    ids.add(exam.id);
  }
}

export function validateExamPlan(plan, rawText) {
  const errors = [];
  const warnings = [];
  const fail = (code, message, context) => errors.push({ code, message, context });
  const warn = (code, message, context) => warnings.push({ code, message, context });

  const rawEntryCount = [...rawText.matchAll(ENTRY_RE)].length;
  if (plan.written.length !== rawEntryCount) {
    fail(
      "E_COUNT_MISMATCH",
      "Written exams in the plan do not match the exam rows in the extraction",
      `${plan.written.length} kept, ${rawEntryCount} in the text`,
    );
  }
  checkUnconsumedLines(rawText, fail);

  for (const exam of plan.written) checkWrittenExam(exam, plan, fail);
  checkDuplicates([...plan.written, ...plan.oral], fail);

  // An oral row implies an oral page, whose period the parser insists on.
  for (const exam of plan.oral) {
    checkOralRange(exam, plan.oralExamPeriod, exam.id, fail);
    if (!exam.title) fail("E_TITLE_EMPTY", "Oral exam title is empty", exam.id);
  }
  // Nothing counts oral rows, so a row the parser did not recognise as an exam
  // would otherwise sit among the notes unnoticed.
  for (const note of plan.oralNotes) {
    checkOralRange(note, plan.oralExamPeriod, note.text, fail);
    if (COURSE_NUMBER_RE.test(note.text)) {
      fail(
        "E_ORAL_EXAM_IN_NOTE",
        "An oral note names a course number — its exam row was not recognised",
        `${note.dateStart}: ${note.text}`,
      );
    }
  }

  if (AT_PENDING_RE.test(rawText)) {
    warn(
      "W_AT_INCOMPLETE",
      "The PDF announces the full alternative-date (AT) plan for a later calendar week — see the runbook's re-ingest step",
    );
  }

  return { errors, warnings, stats: buildStats(plan) };
}
