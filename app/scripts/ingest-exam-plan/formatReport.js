/**
 * Plain-text ingestion report. Reading it against the PDF is a step of the
 * runbook, so the stats block is always printed, errors and warnings first.
 * Pure: no fs, no clock, no process.
 */

/** Findings are grouped by code so a repeated check reads as one entry. */
function section(title, findings) {
  if (findings.length === 0) return `${title}: none`;
  const byCode = new Map();
  for (const finding of findings) {
    if (!byCode.has(finding.code)) byCode.set(finding.code, []);
    byCode.get(finding.code).push(finding);
  }
  const groups = [...byCode.values()].map((group) => {
    const [{ code, message }] = group;
    const times = group.length > 1 ? ` ×${group.length}` : "";
    const contexts = group
      .filter((finding) => finding.context)
      .map((finding) => `      ${finding.context}`);
    return [`  [${code}]${times} ${message}`, ...contexts].join("\n");
  });
  return [`${title} (${findings.length}):`, ...groups].join("\n");
}

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
    `  source        ${plan.source.file} (published ${plan.source.publishedAt})`,
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
      `  coverage                    ${catalogDiff.coveragePercent}% of ${catalogDiff.centralCourseCount} central courses have an exam`,
      `  central courses without exam ${catalogDiff.centralCoursesWithoutExam.length}`,
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
