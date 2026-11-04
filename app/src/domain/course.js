/**
 * Course identity. Catalog, enrolment and study-plan payloads name the same
 * course through different fields; these helpers settle on one key.
 */
// Explicit extension: the exam-plan CLI loads this module under plain Node ESM.
import { toEcts } from "./credits.js";

const ROOT_KEY_PATTERN = /^(\d+),(\d+),/;

/**
 * Priority: courses[0].courseNumber, eventCourseNumber (enrolment API),
 * courseNumber, id, number, _id.
 * @returns {string|null}
 */
export const courseKey = (course) =>
  course?.courses?.[0]?.courseNumber ||
  course?.eventCourseNumber ||
  course?.courseNumber ||
  course?.id ||
  course?.number ||
  course?._id ||
  null;

/**
 * Two-segment root key: "3,135,1.00" and "3,135,2.04" both yield "3,135", so
 * an exercise group shares its lecture's key (the key the exam plan prints).
 * @returns {string|null}
 */
export const courseRootKey = (course) => {
  const raw = courseKey(course) || course?.courseId;
  if (typeof raw !== "string") return null;
  const match = raw.match(ROOT_KEY_PATTERN);
  return match ? `${match[1]},${match[2]}` : null;
};

const identifiers = (course) =>
  [courseKey(course), course?.courseNumber, course?.id, course?.courseId].filter(
    Boolean,
  );

/** True when both objects name the same course under any of their identifiers. */
export const sameCourse = (a, b) => {
  const idsOfB = new Set(identifiers(b));
  return identifiers(a).some((id) => idsOfB.has(id));
};

/**
 * Additive: keeps every raw field (including `credits`) and adds the derived
 * `key`, `ects` and `rootKey`. Applied once at ingestion.
 */
export const normalizeCourse = (raw) => ({
  ...raw,
  key: courseKey(raw),
  ects: toEcts(raw.credits),
  rootKey: courseRootKey(raw),
});
