/**
 * useCurriculumMapCourseLoader.js
 *
 * Ensures the curriculum map has course catalog data for every semester it
 * displays — not just the semester the user is actively browsing.
 *
 * Why: the map derives a course's ECTS by looking it up in
 * `unifiedCourseData.semesters[semKey].available`. That array is only populated
 * for browsed semesters, so courses placed on a past semester (e.g. HS25) had no
 * catalog to resolve against and fell back to a placeholder credit value. This
 * hook lazily loads the catalog for those semesters so real credits resolve.
 *
 * Reuses the shared catalog loader (`loadCatalogForTerm`) and store
 * (`updateAvailableCourses`) — no new fetch/cache/store logic.
 */

import { useEffect, useMemo, useRef } from "react";
import { useRecoilValue } from "recoil";
import { termListState } from "../recoil/termListState";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseDataWriters } from "./useUnifiedCourseDataWriters";
import { loadCatalogForTerm } from "./catalogLoader";
import { normalizeSemesterKey } from "../../domain/semester";

/**
 * Lazily load course catalogs for all semesters shown in the curriculum map.
 *
 * @param {string} authToken - Auth token for the EventApi.
 * @param {string[]} semesterKeys - Semester keys the map renders (e.g. ["HS25"]).
 */
export function useCurriculumMapCourseLoader(authToken, semesterKeys) {
  const termListObject = useRecoilValue(termListState);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const { updateAvailableCourses } = useUnifiedCourseDataWriters();

  // Semesters already attempted this session — avoids refetch loops since each
  // successful load mutates unifiedCourseData and re-runs the effect.
  const attemptedRef = useRef(new Set());

  // Stable, order-independent signature so the effect only re-runs when the set
  // of semesters actually changes (not on every render's new array identity).
  const keysSignature = useMemo(() => {
    const unique = Array.from(
      new Set((semesterKeys || []).map(normalizeSemesterKey).filter(Boolean)),
    );
    unique.sort();
    return unique.join("|");
  }, [semesterKeys]);

  useEffect(() => {
    if (!authToken || !termListObject?.length || !keysSignature) return;

    keysSignature.split("|").forEach(async (key) => {
      if (attemptedRef.current.has(key)) return;

      const semesterData = unifiedCourseData?.semesters?.[key];
      if (semesterData?.available?.length > 0) return; // already resolvable

      const term = termListObject.find(
        (t) => normalizeSemesterKey(t.shortName) === key,
      );
      if (!term?.cisId) return; // no catalog reachable → leave credits unknown

      // Mark before awaiting so concurrent effect runs don't double-fetch.
      attemptedRef.current.add(key);

      const result = await loadCatalogForTerm({ term, authToken });
      if (result.source !== "none") {
        updateAvailableCourses(term.shortName, result.courses, {
          usingReferenceData: result.usingReferenceData,
          referenceSemester: result.referenceSemester,
        });
        return;
      }

      // Non-fatal and silent: a background catalog that won't load (e.g. the
      // EventApi 500s for an old term) just leaves the card with its stored
      // credits, or "?" when none. The key stays marked — no retry loop — and
      // we don't surface a user-facing error toast for a background enrich.
      if (import.meta.env.DEV) {
        console.warn(
          `[curriculumMapLoader] Could not load catalog for ${key}:`,
          result.error?.message,
        );
      }
    });
  }, [
    authToken,
    termListObject,
    keysSignature,
    unifiedCourseData,
    updateAvailableCourses,
  ]);
}

export default useCurriculumMapCourseLoader;
