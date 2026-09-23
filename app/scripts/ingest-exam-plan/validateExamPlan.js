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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Text that only ever occurs in page furniture or in another entry, never in
 * an exam title. The entry-shaped alternatives are the net for a row the
 * ENTRY_RE could not fully see (e.g. a root prefix wider than it expects):
 * such a row is swallowed into the previous entry's title, invisible to the
 * count and residue checks, and must fail loudly here instead.
 */
const TITLE_BLEED_RE =
  /Prüfungsbeginn|Prüfungswoche|Kompetenzcenter|digitale Prüfungen|Seite \d+ von|(?:AJ|BA|MA):\s*(?:OT|AT)|\|\s*\d+,\d{3}/;

/** Everything a written table row may leave behind once its exams are removed. */
const RESIDUE_ALLOWED_RE = new RegExp(
  `^(?:\\d{2}\\.\\d{2}\\.\\d{4}|(?:${WEEKDAYS_SOURCE})\\s*\\/?|Datum.*|Date .*|Kompetenzcenter Planung und Prüfungen.*)$`,
);

const AT_PENDING_RE = /wird in der KW\s*\d+ publiziert/;

const isRealDate = (date) =>
  ISO_DATE_RE.test(date) &&
  new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

const countBy = (items, key) =>
  items.reduce((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

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
  if (!isRealDate(exam.date)) {
    fail("E_DATE_INVALID", "Exam date is not a calendar date", where);
  } else if (
    exam.date < plan.examPeriod.start ||
    exam.date > plan.examPeriod.end
  ) {
    fail("E_DATE_OUT_OF_PERIOD", "Exam date lies outside the exam period", where);
  }

  if (!exam.title) fail("E_TITLE_EMPTY", "Exam title is empty", where);
  if (TITLE_BLEED_RE.test(exam.title)) {
    fail("E_TITLE_BLEED", "Page furniture bled into the exam title", `${where}: ${exam.title}`);
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

  for (const exam of plan.oral) {
    if (!isRealDate(exam.date)) {
      fail("E_DATE_INVALID", "Oral exam date is not a calendar date", exam.id);
    } else if (
      plan.oralExamPeriod &&
      (exam.date < plan.oralExamPeriod.start || exam.date > plan.oralExamPeriod.end)
    ) {
      fail("E_DATE_OUT_OF_PERIOD", "Oral exam lies outside the oral exam period", exam.id);
    }
    if (!exam.title) fail("E_TITLE_EMPTY", "Oral exam title is empty", exam.id);
  }

  if (AT_PENDING_RE.test(rawText)) {
    warn(
      "W_AT_INCOMPLETE",
      "The PDF announces the full alternative-date (AT) plan for a later calendar week — re-ingest then",
    );
  }

  return { errors, warnings, stats: buildStats(plan) };
}
