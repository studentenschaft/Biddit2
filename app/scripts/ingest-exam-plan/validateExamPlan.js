/**
 * Gates the write: a plan with any error is never published. Every check is a
 * re-derivation from the raw extraction or from the built artifact, so a parser
 * bug shows up as a loud error instead of a silently missing exam.
 * Pure: no fs, no clock, no process.
 */

import {
  ENTRY_RE,
  PAGE_KIND,
  ROOT_SEPARATOR,
  TABLE_HEADER_PREFIX,
  WEEKDAYS_SOURCE,
  splitPages,
} from "./parseExamPlanText.js";
import { toZurichIso } from "./zurichTime.js";

const SEMESTER_RE = /^(?:HS|FS)\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Words that only ever occur in the page furniture, never in an exam title. */
const TITLE_BLEED_RE =
  /Prüfungsbeginn|Prüfungswoche|Kompetenzcenter|digitale Prüfungen|Seite \d+ von/;

/** Everything a written table row may leave behind once its exams are removed. */
const RESIDUE_ALLOWED_RE = new RegExp(
  `^(?:\\d{2}\\.\\d{2}\\.\\d{4}|(?:${WEEKDAYS_SOURCE})\\s*\\/?|Datum.*|Date .*|Kompetenzcenter Planung und Prüfungen.*)$`,
);

const AT_PENDING_RE = /wird in der KW\s*\d+ publiziert/;

const isRealDate = (date) =>
  ISO_DATE_RE.test(date) &&
  new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

const countBy = (items, key) => {
  const counts = {};
  for (const item of items) {
    const bucket = key(item);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
};

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
    // -1 (no table header at all) falls back to scanning the whole page, which
    // then reports the unrecognised furniture instead of crashing.
    const bodyStart = Math.max(
      lines.findIndex((line) => line.startsWith(TABLE_HEADER_PREFIX)),
      0,
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

function checkPeriod(period, name, fail) {
  if (!period) return;
  for (const bound of ["start", "end"]) {
    if (!isRealDate(period[bound])) {
      fail("E_DATE_INVALID", `${name}.${bound} is not a calendar date`, period[bound]);
    }
  }
  if (period.start > period.end) {
    fail("E_PERIOD_ORDER", `${name} ends before it starts`, `${period.start} … ${period.end}`);
  }
}

function checkWrittenExam(exam, plan, fail, warn) {
  const where = exam.id;
  if (!isRealDate(exam.date)) {
    fail("E_DATE_INVALID", "Exam date is not a calendar date", where);
  } else if (
    exam.date < plan.examPeriod.start ||
    exam.date > plan.examPeriod.end
  ) {
    fail("E_DATE_OUT_OF_PERIOD", "Exam date lies outside the exam period", where);
  }

  if (exam.startIso !== toZurichIso(exam.date, exam.slot)) {
    fail("E_ISO_MISMATCH", "startIso does not match date + slot in Europe/Zurich", where);
  }

  const suffixes = new Set(exam.rootNumbers.map((root) => root.slice(2)));
  if (suffixes.size > 1) {
    warn(
      "W_ROOT_SHAPE",
      "Cross-listed roots do not share a suffix — expected in the plan, listed for review",
      `${where}: ${exam.rootNumbers.join(` ${ROOT_SEPARATOR} `)}`,
    );
  }

  if (!exam.title) fail("E_TITLE_EMPTY", "Exam title is empty", where);
  if (TITLE_BLEED_RE.test(exam.title)) {
    fail("E_TITLE_BLEED", "Page furniture bled into the exam title", `${where}: ${exam.title}`);
  }
}

function checkDuplicates(exams, fail) {
  // A duplicate id is always also a duplicate exam key, so one check suffices.
  const examKeys = new Set();
  for (const exam of exams) {
    const examKey = `${exam.termType ?? "ORAL"} ${exam.rootNumbers.join(ROOT_SEPARATOR)}`;
    if (examKeys.has(examKey)) {
      fail("E_DUPLICATE_EXAM", "Two exams share a term type and root numbers", examKey);
    }
    examKeys.add(examKey);
  }
}

export function validateExamPlan(plan, rawText) {
  const errors = [];
  const warnings = [];
  const fail = (code, message, context) => errors.push({ code, message, context });
  const warn = (code, message, context) => warnings.push({ code, message, context });

  if (!SEMESTER_RE.test(plan.semester ?? "")) {
    fail("E_SEMESTER_FORMAT", "Semester key must look like HS26 or FS27", plan.semester);
  }
  checkPeriod(plan.examPeriod, "examPeriod", fail);
  checkPeriod(plan.oralExamPeriod, "oralExamPeriod", fail);

  const rawEntryCount = [...rawText.matchAll(ENTRY_RE)].length;
  if (plan.written.length !== rawEntryCount) {
    fail(
      "E_COUNT_MISMATCH",
      "Written exams in the plan do not match the exam rows in the extraction",
      `${plan.written.length} kept, ${rawEntryCount} in the text`,
    );
  }
  checkUnconsumedLines(rawText, fail);

  for (const exam of plan.written) checkWrittenExam(exam, plan, fail, warn);
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

  warn(
    "W_BYOD_GLYPH_LOST",
    "The BYOD shading glyph does not survive pdftotext, so `byod` is a lower bound",
    `${plan.written.filter((exam) => exam.byod).length} exams marked via a literal "(BYOD)" in the title`,
  );
  if (AT_PENDING_RE.test(rawText)) {
    warn(
      "W_AT_INCOMPLETE",
      "The PDF announces the full alternative-date (AT) plan for a later calendar week — re-ingest then",
    );
  }
  const oralWithoutTimes = plan.oral.filter((exam) => exam.startIso === null).length;
  if (oralWithoutTimes > 0) {
    warn(
      "W_ORAL_NO_TIMES",
      "Oral exams carry no start time; individual slots are published in Compass later",
      `${oralWithoutTimes} of ${plan.oral.length}`,
    );
  }

  return { errors, warnings, stats: buildStats(plan) };
}
