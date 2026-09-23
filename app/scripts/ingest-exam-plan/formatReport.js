/**
 * Plain-text ingestion report. Reading it against the PDF is a step of the
 * runbook, so the stats block is always printed, errors and warnings first.
 * Pure: no fs, no clock, no process.
 */

const finding = ({ code, message, context }) =>
  `  [${code}] ${message}${context ? ` — ${context}` : ""}`;

const section = (title, findings) =>
  findings.length === 0
    ? `${title}: none`
    : [`${title} (${findings.length}):`, ...findings.map(finding)].join("\n");

const counts = (byBucket) =>
  Object.entries(byBucket)
    .map(([bucket, count]) => `${bucket}=${count}`)
    .join("  ");

/** A sparse catalog snapshot can produce hundreds of advisory rows. */
const MAX_LISTED_DIFF_ENTRIES = 20;

const listed = (entries, describe) => {
  const shown = entries.slice(0, MAX_LISTED_DIFF_ENTRIES).map(describe);
  const hidden = entries.length - shown.length;
  return hidden > 0 ? [...shown, `      … and ${hidden} more`] : shown;
};

export function formatReport({ plan, errors, warnings, stats, catalogDiff }) {
  const lines = [
    `Exam plan ${plan.semester} — ${plan.sourceTermLabel}`,
    `  published     ${plan.source.publishedAt}`,
    `  exam period   ${plan.examPeriod.start} … ${plan.examPeriod.end}`,
    `  oral period   ${plan.oralExamPeriod ? `${plan.oralExamPeriod.start} … ${plan.oralExamPeriod.end}` : "not stated"}`,
    "",
    "Stats:",
    `  written exams ${stats.writtenCount} on ${stats.dateCount} dates`,
    `  oral exams    ${stats.oralCount} (+ ${stats.oralNoteCount} notes)`,
    `  by slot       ${counts(stats.bySlot)}`,
    `  by term type  ${counts(stats.byTermType)}`,
    `  by duration   ${counts(stats.byDurationMin)}`,
    `  BYOD marked   ${stats.byodCount}`,
    "",
    section("Errors", errors),
    "",
    section("Warnings", warnings),
  ];

  if (catalogDiff) {
    lines.push(
      "",
      "Catalog cross-check (advisory):",
      `  central courses without exam ${catalogDiff.centralCoursesWithoutExam.length}/${catalogDiff.centralCourseCount}`,
      ...listed(
        catalogDiff.centralCoursesWithoutExam,
        (course) => `      ${course.root} ${course.shortName}`,
      ),
      `  exams without a course       ${catalogDiff.examsWithoutCourse.length}`,
      ...listed(
        catalogDiff.examsWithoutCourse,
        (exam) => `      ${exam.root} ${exam.title}`,
      ),
    );
  }

  return lines.join("\n");
}
