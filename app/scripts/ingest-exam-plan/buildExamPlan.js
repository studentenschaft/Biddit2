/**
 * Shapes a ParsedPlan into the artifact published at `public/exams/<semester>.json`.
 * Pure: no fs, no clock, no process.
 */

import { ROOT_SEPARATOR } from "./parseExamPlanText.js";
import { toZurichIso } from "./zurichTime.js";

export const SCHEMA_VERSION = 2;

const TERM_LABEL_RE = /\b(Winter|Sommer|Summer)\s+(\d{4})\b/;

/**
 * The PDF names the exam period, not the semester it closes: "Winter YYYY" is
 * sat at the end of HS(YYYY−1), "Sommer/Summer YYYY" at the end of FS(YYYY).
 */
function semesterFromTermLabel(termLabel) {
  const match = termLabel.match(TERM_LABEL_RE);
  if (!match) {
    throw new Error(
      `Cannot derive the semester from the plan's title "${termLabel}": expected "Winter YYYY" or "Sommer/Summer YYYY"`,
    );
  }
  const [, season, year] = match;
  return season === "Winter"
    ? `HS${String(year - 1).slice(-2)}`
    : `FS${year.slice(-2)}`;
}

const byKey = (key) => (a, b) =>
  key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;

const writtenSortKey = (exam) =>
  `${exam.date} ${exam.slot} ${exam.rootNumbers[0]} ${exam.termType}`;
const oralSortKey = (exam) => `${exam.dateStart} ${exam.rootNumbers[0]}`;

function toWrittenExam(entry, shadedRoots) {
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
  // The plan marks a BYOD exam by shading its cell, or a few in the title.
  const shaded = entry.rootNumbers.some((root) =>
    shadedRoots[entry.page]?.[entry.termType]?.includes(root),
  );
  if (entry.byod || shaded) exam.byod = true;
  return exam;
}

const toOralExam = (entry) => ({
  id: `ORAL-${entry.dateStart}-${entry.rootNumbers.join(ROOT_SEPARATOR)}`,
  dateStart: entry.dateStart,
  dateEnd: entry.dateEnd,
  section: entry.section,
  rootNumbers: entry.rootNumbers,
  title: entry.title,
});

/** `shadedRoots` is what parseByodShading read off the same PDF. */
export function buildExamPlan(parsed, shadedRoots) {
  return {
    schemaVersion: SCHEMA_VERSION,
    semester: semesterFromTermLabel(parsed.termLabel),
    sourceTermLabel: parsed.termLabel,
    examPeriod: parsed.examPeriod,
    oralExamPeriod: parsed.oralExamPeriod,
    source: { publishedAt: parsed.publishedAt },
    written: [...parsed.written]
      .sort(byKey(writtenSortKey))
      .map((entry) => toWrittenExam(entry, shadedRoots)),
    oral: [...parsed.oral].sort(byKey(oralSortKey)).map(toOralExam),
    oralNotes: parsed.oralNotes,
  };
}
