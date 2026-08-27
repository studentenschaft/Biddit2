/**
 * Shapes a ParsedPlan into the artifact published at `public/exams/<semester>.json`.
 * Pure: no fs, no clock, no process.
 */

import { ROOT_SEPARATOR } from "./parseExamPlanText.js";
import { toZurichIso } from "./zurichTime.js";

export const SCHEMA_VERSION = 1;

const byKey = (key) => (a, b) => {
  const left = key(a);
  const right = key(b);
  if (left < right) return -1;
  return left > right ? 1 : 0;
};

const writtenSortKey = (exam) =>
  `${exam.date} ${exam.slot} ${exam.rootNumbers[0]} ${exam.termType}`;
const oralSortKey = (exam) => `${exam.date} ${exam.rootNumbers[0]}`;

function toWrittenExam(entry) {
  const exam = {
    id: `${entry.termType}-${entry.date}-${entry.slot.replace(":", "")}-${entry.rootNumbers.join(ROOT_SEPARATOR)}`,
    date: entry.date,
    slot: entry.slot,
    startIso: toZurichIso(entry.date, entry.slot),
    durationMin: entry.durationMin,
    level: entry.level,
    termType: entry.termType,
    language: entry.language,
    rootNumbers: entry.rootNumbers,
    title: entry.title,
  };
  // Absent means "not marked BYOD in the extraction", not "no laptop" — the
  // shading glyph the PDF uses does not survive pdftotext.
  if (entry.byod) exam.byod = true;
  return exam;
}

const toOralExam = (entry) => ({
  id: `ORAL-${entry.date}-${entry.rootNumbers.join(ROOT_SEPARATOR)}`,
  date: entry.date,
  startIso: null,
  timesPublishedLater: true,
  section: entry.section,
  rootNumbers: entry.rootNumbers,
  title: entry.title,
});

export function buildExamPlan(parsed, { semester, sourceFile }) {
  if (!semester) {
    throw new Error(
      "The semester key is never inferred from the PDF. Winter YYYY = HS(YYYY-1), Summer YYYY = FS(YYYY) — pass it explicitly with --semester",
    );
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    semester,
    sourceTermLabel: parsed.termLabel,
    examPeriod: parsed.examPeriod,
    oralExamPeriod: parsed.oralExamPeriod,
    source: { file: sourceFile, publishedAt: parsed.publishedAt },
    written: [...parsed.written].sort(byKey(writtenSortKey)).map(toWrittenExam),
    oral: [...parsed.oral].sort(byKey(oralSortKey)).map(toOralExam),
    oralNotes: parsed.oralNotes,
  };
}
