/**
 * similarCoursesApi
 *
 * Single source of truth for the similar-courses vector DB (query + upsert),
 * shared by SmartSearch and SimilarCourses so the two never drift apart.
 *
 * The upsert here owns the borrowed-data guardrail: it MUST refuse to write
 * courses that don't belong to the selected term (future projections or
 * current-but-sparse previews). Writing borrowed courses under the selected
 * term's key is exactly the bug that polluted "HS26" with HS25 courses.
 * See REFERENCE_SEMESTER.md.
 */

import { apiClient } from "./axiosClient";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

const SIMILAR_COURSES_BASE = "https://api.shsg.ch/similar-courses";

/**
 * Query similar courses from the vector DB.
 *
 * Throws on network error so callers can keep their own control flow
 * (e.g. the 404 → upsert → retry orchestration).
 *
 * @param {Object} args
 * @param {string} args.authToken
 * @param {string} args.courseDescription - text to embed and match against
 * @param {string|null} [args.category]
 * @param {string} args.program
 * @param {string} args.semester - the semester the displayed courses belong to
 * @param {number} [args.numberOfResults=10]
 * @returns {Promise<import("axios").AxiosResponse>}
 */
export function querySimilarCourses({
  authToken,
  courseDescription,
  category = null,
  program,
  semester,
  numberOfResults = 10,
}) {
  return apiClient.get(`${SIMILAR_COURSES_BASE}/query`, authToken, {
    params: {
      courseDescription,
      numberOfResults,
      category,
      program,
      semester,
    },
  });
}

/**
 * Upsert a term's courses into the vector DB, with the borrowed-data guardrail.
 *
 * GUARDRAIL: when `isReferenceData` is true the displayed courses are borrowed
 * from `referenceSemester` (a future projection or a previous-year preview) and
 * are skipped — only a term's OWN published catalog is ever written, under its
 * OWN `selectedSemester` key. Errors are reported via errorHandlingService and
 * swallowed (an upsert failure should never break the search UX).
 *
 * @param {Object} args
 * @param {string} args.authToken
 * @param {Array<{courseNumber: string, courseContent: string, classification: string}>} args.courses
 * @param {string} args.program
 * @param {string} args.selectedSemester - the term the user has selected
 * @param {string|null} [args.referenceSemester] - source term when borrowed (for logging)
 * @param {boolean} args.isReferenceData - true ⇒ displayed courses are borrowed
 * @param {string} [args.source="similar-courses"] - caller label for logs
 * @returns {Promise<{upserted: boolean, reason?: string, semester?: string}>}
 */
export async function upsertSimilarCourses({
  authToken,
  courses,
  program,
  selectedSemester,
  referenceSemester = null,
  isReferenceData,
  source = "similar-courses",
}) {
  if (!authToken) {
    console.warn(`[${source}] Upsert skipped: missing auth token`);
    return { upserted: false, reason: "no-auth" };
  }

  // GUARDRAIL: never upsert borrowed courses under the selected term's key.
  if (isReferenceData) {
    console.warn(
      `[${source}] Upsert skipped: ${selectedSemester} is showing borrowed/preview data` +
        (referenceSemester ? ` from ${referenceSemester}` : "") +
        `. Borrowed courses are never written to the vector DB.`
    );
    return { upserted: false, reason: "borrowed-data" };
  }

  // Not reference data ⇒ these are the term's own published courses; write them
  // under the selected term's own key.
  const semester = selectedSemester;
  if (!semester) {
    console.warn(`[${source}] Upsert skipped: no semester resolved`);
    return { upserted: false, reason: "no-semester" };
  }

  try {
    await apiClient.post(
      `${SIMILAR_COURSES_BASE}/upsert`,
      {
        courses: (courses || []).map((course) => ({
          courseNumber: course.courseNumber,
          semester,
          courseDescription: course.courseContent,
          category: course.classification,
          program,
        })),
      },
      authToken
    );
    return { upserted: true, semester };
  } catch (error) {
    console.error(`[${source}] Error upserting courses:`, error);
    errorHandlingService.handleError(error);
    return { upserted: false, reason: "error", error };
  }
}
