/**
 * Which semesters belong to the study programme the student is in now?
 * Saved courses are keyed by semester alone, so this window is the only thing
 * keeping a Bachelor-era wishlist entry out of a Master's categories.
 */

import {
  compareSemesters,
  getNextSemesterKey,
} from "../recoil/curriculumPlanAtom";

/** Semester keys as the app stores them: "HS25", "FS26". */
const SEMESTER_KEY_PATTERN = /^(HS|FS)\d{2}$/;

/**
 * Normalise a semester name to the app's key form ("HS 25" -> "HS25").
 * @returns {string|null} - null when it is not a semester.
 */
export const normalizeEraSemesterKey = (semester) => {
  if (typeof semester !== "string") return null;
  const key = semester.replace(/\s+/g, "").toUpperCase();
  return SEMESTER_KEY_PATTERN.test(key) ? key : null;
};

/** Every semester key mentioned by a programme's scorecard items, at any depth. */
const collectDatedSemesters = (program) => {
  const rootItems = program?.transcript?.rawScorecard?.items || program?.items;
  const keys = [];

  const walk = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const key = normalizeEraSemesterKey(item?.semester);
      if (key) keys.push(key);
      walk(item?.items);
    });
  };

  walk(rootItems);
  return keys;
};

const earliest = (keys) =>
  keys.length === 0
    ? null
    : keys.reduce((min, key) => (compareSemesters(key, min) < 0 ? key : min));

const latest = (keys) =>
  keys.length === 0
    ? null
    : keys.reduce((max, key) => (compareSemesters(key, max) > 0 ? key : max));

/**
 * The first semester of the current programme: the earliest semester on its own
 * scorecard, else the one after another programme's last (a Bachelor ending FS26
 * puts the Master's era at HS26), else null meaning "unknown - scope nothing".
 * @returns {string|null}
 */
export const deriveProgramStartSemester = (mainProgram, otherPrograms = []) => {
  if (!mainProgram) return null;

  const ownStart = earliest(collectDatedSemesters(mainProgram));
  if (ownStart) return ownStart;

  const previousEnd = latest(otherPrograms.flatMap(collectDatedSemesters));
  return previousEnd ? getNextSemesterKey(previousEnd) : null;
};

/**
 * Era start for callers holding the whole programmes map - the one-line hook-in.
 * @returns {string|null}
 */
export const deriveMainProgramEraStart = (programs, mainProgramId) => {
  if (!programs || !mainProgramId || !programs[mainProgramId]) return null;

  const otherPrograms = Object.entries(programs)
    .filter(([programId]) => programId !== mainProgramId)
    .map(([, programData]) => programData);

  return deriveProgramStartSemester(programs[mainProgramId], otherPrograms);
};

/**
 * Is a semester inside the current programme's era? Unknown keys and an unknown
 * era are inclusive: never hide data the user saved.
 */
export const isSemesterInProgramEra = (semesterKey, startSemester) => {
  const start = normalizeEraSemesterKey(startSemester);
  if (!start) return true;

  const key = normalizeEraSemesterKey(semesterKey);
  if (!key) return true;

  return compareSemesters(key, start) >= 0;
};
