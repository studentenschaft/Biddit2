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
 * Reuses the existing fetch endpoint, store (`updateAvailableCourses`) and
 * staleness guard (`needsRefresh`) — no new fetch/cache/store logic.
 */

import { useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useRecoilValue } from "recoil";
import { termListState } from "../recoil/termListState";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { REFERENCE_FALLBACK_MIN_COURSES } from "./useCourseInfoData";

const COURSE_SHEETS_URL = (cisId) =>
  `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisId}`;

const requestHeaders = (authToken) => ({
  "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
  "X-RequestedLanguage": "EN",
  "API-Version": "1",
  Authorization: `Bearer ${authToken}`,
});

const normalizeKey = (key) => (key ? key.replace(/\s+/g, "") : "");

/**
 * Lazily load course catalogs for all semesters shown in the curriculum map.
 *
 * @param {string} authToken - Auth token for the EventApi.
 * @param {string[]} semesterKeys - Semester keys the map renders (e.g. ["HS25"]).
 */
export function useCurriculumMapCourseLoader(authToken, semesterKeys) {
  const termListObject = useRecoilValue(termListState);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const { updateAvailableCourses } = useUnifiedCourseData();

  // Semesters already attempted this session — avoids refetch loops since each
  // successful load mutates unifiedCourseData and re-runs the effect.
  const attemptedRef = useRef(new Set());

  // Stable, order-independent signature so the effect only re-runs when the set
  // of semesters actually changes (not on every render's new array identity).
  const keysSignature = useMemo(() => {
    const unique = Array.from(
      new Set((semesterKeys || []).map(normalizeKey).filter(Boolean)),
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
        (t) => normalizeKey(t.shortName) === key,
      );
      if (!term?.cisId) return; // no catalog reachable → leave credits unknown

      // Mark before awaiting so concurrent effect runs don't double-fetch.
      attemptedRef.current.add(key);

      const fetchTerm = (cisId) =>
        axios.get(COURSE_SHEETS_URL(cisId), {
          headers: requestHeaders(authToken),
        });
      const hasReference =
        term.referenceCisId && term.referenceCisId !== term.cisId;

      try {
        const response = await fetchTerm(term.cisId);
        let courses = response.data;
        let usingReferenceData = false;

        // Sparse or unpublished term: preview the same-season reference year
        // (mirrors useCourseInfoData so the map and course list stay in sync).
        if ((courses?.length || 0) < REFERENCE_FALLBACK_MIN_COURSES && hasReference) {
          try {
            courses = (await fetchTerm(term.referenceCisId)).data;
            usingReferenceData = true;
          } catch {
            // keep the (sparse) primary data
          }
        }

        updateAvailableCourses(term.shortName, courses || [], {
          usingReferenceData,
          referenceSemester: term.referenceSemester,
        });
      } catch (error) {
        // Primary catalog errored (e.g. EventApi 500s for the term): preview the
        // reference year if we have one before giving up.
        if (hasReference) {
          try {
            const refData = (await fetchTerm(term.referenceCisId)).data;
            updateAvailableCourses(term.shortName, refData || [], {
              usingReferenceData: true,
              referenceSemester: term.referenceSemester,
            });
            return;
          } catch {
            // fall through to the silent warning below
          }
        }
        // Non-fatal and silent: a background catalog that won't load (e.g. the
        // EventApi 500s for an old term) just leaves the card with its stored
        // credits, or "?" when none. The key stays marked — no retry loop — and
        // we don't surface a user-facing error toast for a background enrich.
        if (import.meta.env.DEV) {
          console.warn(
            `[curriculumMapLoader] Could not load catalog for ${key}:`,
            error?.message,
          );
        }
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
