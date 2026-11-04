import { useCallback } from "react";
import { useSetRecoilState } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "../recoil/unifiedCourseDataAtom";
import { processCatalogSubEventECTS } from "./smartExerciseGroupHandler";
import { getCourseIdentifier } from "./courseUtils";
import { previousYearSameSeason } from "../../domain/semester";
import { log } from "./log";

/**
 * Default semester structure with all required fields
 * This ensures consistency across the entire application
 * SIMPLIFIED: enrolledIds and selectedIds store only course IDs/numbers
 */
export const DEFAULT_SEMESTER_STRUCTURE = {
  enrolledIds: [], // Course IDs/numbers for enrolled courses
  available: [], // Full course objects for available courses
  selectedIds: [], // Course IDs/numbers for selected courses
  studyPlan: [], // Study plan courses for this semester
  lastFetched: null,
  isFutureSemester: false,
  referenceSemester: null,
  // True when `available` holds a previous-year same-season catalog standing in
  // for a term that isn't published yet (or whose own catalog errored). These
  // courses do NOT belong to this semester — they belong to `referenceSemester`.
  // See REFERENCE_SEMESTER.md. Critical for routing similar-courses queries and
  // for refusing to upsert borrowed courses under the wrong semester key.
  usingReferenceData: false,
  cisId: null,
  isCurrent: false,
  isProjected: false,
};

/**
 * Helper function to create a new semester with proper defaults
 */
const createSemesterStructure = (metadata = {}) => ({
  ...DEFAULT_SEMESTER_STRUCTURE,
  // Only take known metadata keys; ignore unexpected keys silently
  // Support both isFutureSemester and legacy isFuture flag
  isFutureSemester: !!(metadata.isFutureSemester || metadata.isFuture),
  referenceSemester: metadata.referenceSemester || null,
  cisId: metadata.cisId || null,
  isCurrent: !!metadata.isCurrent,
  isProjected: !!metadata.isProjected,
});

// Set of metadata keys we guard from accidental overwrites
const SEMESTER_METADATA_KEYS = new Set([
  "isFutureSemester",
  "referenceSemester",
  "cisId",
  "isCurrent",
  "isProjected",
]);

// Utility: shallow merge only provided keys (undefined => skip). Arrays/objects replaced intentionally.
function mergeSemester(existing, patch) {
  if (!patch) return existing;
  const next = { ...existing };
  Object.keys(patch).forEach((k) => {
    const val = patch[k];
    if (val === undefined) return; // skip unspecified values
    next[k] = val;
  });
  return next;
}

/**
 * Setter-only access to the unified course data atom.
 *
 * Subscribes to nothing, so the host does not re-render when the atom changes,
 * and every writer keeps its identity across renders. Use this in hooks that
 * only write course data; use useUnifiedCourseData when you also need to read.
 */
export function useUnifiedCourseDataWriters() {
  const setCourseData = useSetRecoilState(unifiedCourseDataState);
  const setInitializedSemesters = useSetRecoilState(initializedSemestersState);

  /**
   * Initialize a semester with empty data structure
   */
  const initializeSemester = useCallback((semesterShortName, metadata = {}) => {
    setCourseData((prev) => {
      const exists = prev.semesters?.[semesterShortName];
      if (exists) {
        // Merge metadata only for keys that are currently unset/falsey – never clobber existing truthy values
        const metadataPatch = {};
        SEMESTER_METADATA_KEYS.forEach((k) => {
          if (
            metadata[k] !== undefined &&
            (exists[k] === undefined || exists[k] === null)
          ) {
            metadataPatch[k] = metadata[k];
          }
        });
        if (Object.keys(metadataPatch).length === 0) return prev; // nothing new
        return {
          ...prev,
          semesters: {
            ...prev.semesters,
            [semesterShortName]: mergeSemester(exists, metadataPatch),
          },
        };
      }
      const newSemester = createSemesterStructure(metadata);
      const updated = {
        ...prev,
        semesters: {
          ...(prev.semesters || {}),
          [semesterShortName]: newSemester,
        },
      };
      log.debug(`✅ Initialized semester ${semesterShortName}`, newSemester);
      return updated;
    });
    setInitializedSemesters((s) => new Set([...s, semesterShortName]));
  }, [setCourseData, setInitializedSemesters]);

  // Core helper to patch a semester atomically without overwriting unrelated fields.
  const patchSemester = useCallback((semesterShortName, patch, options = {}) => {
    const { allowMetadataOverwrite = false, touchLastFetched = false } =
      options;
    setCourseData((prev) => {
      const existing = prev.semesters?.[semesterShortName];
      if (!existing) {
        // Auto-initialize with empty metadata then apply patch
        const base = createSemesterStructure({});
        const sanitizedPatch = { ...patch };
        if (!allowMetadataOverwrite) {
          // Remove metadata keys from patch to avoid accidental set during auto-init unless explicitly allowed
          Object.keys(sanitizedPatch).forEach((k) => {
            if (SEMESTER_METADATA_KEYS.has(k)) delete sanitizedPatch[k];
          });
        }
        const merged = mergeSemester(base, sanitizedPatch);
        if (touchLastFetched) merged.lastFetched = new Date().toISOString();
        // Every auto-init returns here; falling through would merge into
        // `undefined` and drop `base`.
        return {
          ...prev,
          semesters: {
            ...(prev.semesters || {}),
            [semesterShortName]: merged,
          },
        };
      }

      // Guard metadata unless explicitly allowed
      const effectivePatch = { ...patch };
      if (!allowMetadataOverwrite) {
        Object.keys(effectivePatch).forEach((k) => {
          if (SEMESTER_METADATA_KEYS.has(k)) delete effectivePatch[k];
        });
      }

      const merged = mergeSemester(existing, effectivePatch);
      if (touchLastFetched) merged.lastFetched = new Date().toISOString();
      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: merged,
        },
      };
    });
  }, [setCourseData]);

  const updateSemesterMetadata = useCallback((semesterShortName, metadataPatch) => {
    patchSemester(semesterShortName, metadataPatch, {
      allowMetadataOverwrite: true,
    });
  }, [patchSemester]);

  /**
   * Update enrolled course IDs for a semester
   * Now stores only course IDs/numbers instead of full course objects
   */
  const updateEnrolledCourses = useCallback((semesterShortName, courses) => {
    const enrolledIds = (courses || [])
      .map((course) => getCourseIdentifier(course))
      .filter(Boolean);
    patchSemester(
      semesterShortName,
      { enrolledIds },
      { touchLastFetched: true }
    );
    log.debug(
      `✅ Updated enrolled course IDs for ${semesterShortName}: ${enrolledIds.length} courses`,
      enrolledIds.slice(0, 5)
    );
  }, [patchSemester]);

  /**
   * Update available courses for a semester
   * Flattens nested courses from the courses array to make exercise groups selectable
   */
  const updateAvailableCourses = useCallback((semesterShortName, courses, meta = {}) => {
    const flattenedCourses = [];
    
    (courses || []).forEach(parentCourse => {
      if (parentCourse.courses && Array.isArray(parentCourse.courses)) {
        parentCourse.courses.forEach(nestedCourse => {
          const flattenedCourse = {
            ...parentCourse,
            ...nestedCourse,
            courseNumber: nestedCourse.courseNumber || parentCourse.courseNumber,
            shortName: nestedCourse.shortName || parentCourse.shortName,
            id: nestedCourse.id || parentCourse.id,
            lecturers: nestedCourse.lecturers || parentCourse.lecturers,
            courses: undefined
          };
          
          // Filter calendar entries to only include events for this specific course
          if (parentCourse.calendarEntry && Array.isArray(parentCourse.calendarEntry)) {
            const courseNumber = nestedCourse.courseNumber || parentCourse.courseNumber;
            flattenedCourse.calendarEntry = parentCourse.calendarEntry.filter(
              entry => entry.courseNumber === courseNumber
            );
          }
          
          flattenedCourses.push(flattenedCourse);
        });
      } else {
        flattenedCourses.push(parentCourse);
      }
    });

    // Needs the whole flattened catalog to see whether a sub-numbered event has
    // a main event, so it runs after the loop rather than per course inside it.
    const coursesWithResolvedCredits =
      processCatalogSubEventECTS(flattenedCourses);

    patchSemester(
      semesterShortName,
      {
        available: coursesWithResolvedCredits,
        // True when these courses are a previous-year preview standing in for a
        // term that isn't published yet (or whose catalog errored). Drives the
        // existing "preview" disclaimer for the current term AND tells the
        // similar-courses query/upsert that these courses belong to
        // `referenceSemester`, not to `semesterShortName`. See REFERENCE_SEMESTER.md.
        usingReferenceData: !!meta.usingReferenceData,
      },
      { touchLastFetched: true }
    );

    // Keep the preview flag and its source semester in lockstep. `referenceSemester`
    // is normally seeded at init time by useEventListDataManager, but init ordering
    // can leave a current sparse term with referenceSemester=null. Downstream
    // consumers must NEVER rely on the usingReferenceData flag alone — they need a
    // valid source semester to attribute borrowed courses to. So whenever we load
    // a preview we actively resolve and store referenceSemester, preferring the
    // caller's value but falling back to the deterministic same-season previous-year
    // rule so it is ALWAYS populated for current sparse terms. See REFERENCE_SEMESTER.md.
    // (referenceSemester is a guarded metadata key, so it must go through
    // updateSemesterMetadata, not the plain patch above.)
    if (meta.usingReferenceData) {
      const resolvedReference =
        meta.referenceSemester || previousYearSameSeason(semesterShortName);
      if (resolvedReference) {
        updateSemesterMetadata(semesterShortName, {
          referenceSemester: resolvedReference,
        });
      } else {
        console.warn(
          `⚠️ [updateAvailableCourses] ${semesterShortName} is showing preview data but no referenceSemester could be resolved; similar-courses routing may be incorrect.`
        );
      }
    }

    log.debug(
      `✅ Updated available courses for ${semesterShortName}: ${flattenedCourses.length} courses (flattened from ${(courses || []).length} parent courses)${meta.usingReferenceData ? ` [preview from ${meta.referenceSemester || "reference"}]` : ""}`
    );
  }, [patchSemester, updateSemesterMetadata]);

  /**
   * Update selected course IDs for a semester
   * Now stores only course IDs/numbers instead of full course objects
   */
  const updateSelectedCourses = useCallback((semesterShortName, courseIds) => {
    const selectedIds = Array.isArray(courseIds)
      ? courseIds.filter(Boolean)
      : [];
    patchSemester(semesterShortName, { selectedIds });
    log.debug(
      `✅ Updated selected course IDs for ${semesterShortName}: ${selectedIds.length} courses`,
      selectedIds.slice(0, 5)
    );
  }, [patchSemester]);

  /**
   * Add a course ID to selected courses for a semester
   */
  const addSelectedCourse = useCallback((semesterShortName, course) => {
    setCourseData((prev) => {
      const semester = prev.semesters?.[semesterShortName];
      if (!semester) return prev; // Should be initialized beforehand
      const courseId = getCourseIdentifier(course);
      if (!courseId) {
        console.warn("No valid course ID for", course);
        return prev;
      }
      if (semester.selectedIds.includes(courseId)) return prev; // no change
      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: {
            ...semester,
            selectedIds: [...semester.selectedIds, courseId],
          },
        },
      };
    });
  }, [setCourseData]);

  /**
   * Remove a course ID from selected courses for a semester
   */
  const removeSelectedCourse = useCallback((semesterShortName, courseId) => {
    if (!courseId) return;
    setCourseData((prev) => {
      const semester = prev.semesters?.[semesterShortName];
      if (!semester) return prev;
      if (!semester.selectedIds.includes(courseId)) return prev;
      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: {
            ...semester,
            selectedIds: semester.selectedIds.filter((id) => id !== courseId),
          },
        },
      };
    });
  }, [setCourseData]);

  /**
   * Update study plan courses for a semester
   */
  const updateStudyPlan = useCallback((semesterShortName, studyPlanCourses) => {
    patchSemester(
      semesterShortName,
      { studyPlan: studyPlanCourses || [] },
      { touchLastFetched: true }
    );
    log.debug(`✅ Updated study plan for ${semesterShortName}`);
  }, [patchSemester]);

  /**
   * Store the SHSG course ratings. They apply to every semester, so they live
   * once at the top level and leave the semester objects untouched.
   */
  const updateCourseRatings = useCallback((ratings) => {
    let ratingsMap = {};
    if (Array.isArray(ratings)) {
      ratings.forEach((r) => {
        if (r._id && r.avgRating) ratingsMap[r._id] = r.avgRating;
      });
    } else if (ratings && typeof ratings === "object") {
      ratingsMap = ratings;
    }
    setCourseData((prev) => ({ ...prev, ratings: ratingsMap }));
  }, [setCourseData]);

  /**
   * Update the selected course info (for CourseInfo display)
   */
  const updateSelectedCourseInfo = useCallback((courseInfo) => {
    setCourseData((prev) => ({ ...prev, selectedCourseInfo: courseInfo }));
    log.debug(
      `🎯 Updated selected course info:`,
      courseInfo?.shortName || "cleared"
    );
  }, [setCourseData]);

  /**
   * Clear the selected course info
   */
  const clearSelectedCourseInfo = useCallback(() => {
    updateSelectedCourseInfo(null);
  }, [updateSelectedCourseInfo]);

  return {
    initializeSemester,
    patchSemester,
    updateSemesterMetadata,
    updateEnrolledCourses,
    updateAvailableCourses,
    updateSelectedCourses,
    addSelectedCourse,
    removeSelectedCourse,
    updateStudyPlan,
    updateCourseRatings,
    updateSelectedCourseInfo,
    clearSelectedCourseInfo,
  };
}
