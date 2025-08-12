import { useRecoilState } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "../recoil/unifiedCourseDataAtom";

/**
 * Default semester structure with all required fields
 * This ensures consistency across the entire application
 * SIMPLIFIED: enrolledIds and selectedIds store only course IDs/numbers
 */
const DEFAULT_SEMESTER_STRUCTURE = {
  enrolledIds: [], // Course IDs/numbers for enrolled courses
  available: [], // Full course objects for available courses
  selectedIds: [], // Course IDs/numbers for selected courses
  filtered: [], // Filtered courses with selected/enrolled flags attached
  studyPlan: [], // Study plan courses for this semester
  ratings: {},
  lastFetched: null,
  isFutureSemester: false,
  referenceSemester: null,
  cisId: null,
  isCurrent: false,
  isProjected: false,
};

/**
 * Helper function to create detailed summary logs for unified course data
 */
const logUnifiedCourseDataSummary = (
  semesterShortName,
  operationType,
  data
) => {
  const semesterData = data.semesters[semesterShortName];
  if (!semesterData) return;

  console.group(
    `📊 [UNIFIED COURSE DATA] ${operationType} - ${semesterShortName}`
  );

  // Semester metadata
  console.log(`🏫 Semester Metadata:`, {
    cisId: semesterData.cisId,
    isCurrent: semesterData.isCurrent,
    isProjected: semesterData.isProjected,
    isFutureSemester: semesterData.isFutureSemester,
    referenceSemester: semesterData.referenceSemester,
    lastFetched: semesterData.lastFetched,
  });

  // Course counts
  console.log(`📚 Course Counts:`, {
    enrolledIds: semesterData.enrolledIds?.length || 0,
    available: semesterData.available?.length || 0,
    selectedIds: semesterData.selectedIds?.length || 0,
    filtered: semesterData.filtered?.length || 0,
    studyPlan: semesterData.studyPlan?.length || 0,
    ratings: Object.keys(semesterData.ratings || {}).length,
  });

  // Detailed course data (limited to prevent console spam)
  if (semesterData.enrolledIds?.length > 0) {
    console.log(
      `✅ Enrolled Course IDs (${semesterData.enrolledIds.length}):`,
      semesterData.enrolledIds.slice(0, 5)
    );
  }

  if (semesterData.selectedIds?.length > 0) {
    console.log(
      `⭐ Selected Course IDs (${semesterData.selectedIds.length}):`,
      semesterData.selectedIds.slice(0, 5)
    );
  }

  if (semesterData.available?.length > 0) {
    console.log(
      `🔍 Available Courses (${semesterData.available.length}):`,
      `First 3: ${semesterData.available
        .slice(0, 3)
        .map((c) => c.courseNumber || c.id)
        .join(", ")}`
    );
  }

  console.groupEnd();
};

/**
 * Helper function to log overall unified data state
 */
const logUnifiedDataOverview = (data) => {
  console.group(`🌍 [UNIFIED COURSE DATA] Global Overview`);

  console.log(`🎯 Global State:`, {
    selectedSemester: data.selectedSemester,
    latestValidTerm: data.latestValidTerm,
    totalSemesters: Object.keys(data.semesters || {}).length,
  });

  console.log(
    `📅 All Semesters:`,
    Object.keys(data.semesters || {}).map((semester) => ({
      semester,
      enrolledIds: data.semesters[semester]?.enrolledIds?.length || 0,
      available: data.semesters[semester]?.available?.length || 0,
      selectedIds: data.semesters[semester]?.selectedIds?.length || 0,
      isCurrent: data.semesters[semester]?.isCurrent || false,
      isProjected: data.semesters[semester]?.isProjected || false,
      isFutureSemester: data.semesters[semester]?.isFutureSemester || false,
    }))
  );

  console.groupEnd();
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

// Centralized logging for referenceSemester mutations
function logReferenceSemesterChange(semesterShortName, prevValue, nextValue) {
  const fromVal = prevValue == null ? "<unset>" : prevValue;
  const toVal = nextValue == null ? "<null>" : nextValue;
  if (fromVal === toVal) return;
}

// Debug flag (can be toggled later or wired to env)
const ENABLE_REFERENCE_SEM_INVARIANTS = true;

function computeExpectedReference(shortName) {
  if (!shortName || shortName.length < 4) return null;
  const season = shortName.slice(0, 2); // FS / HS
  const yearPart = shortName.slice(2);
  const yearNum = parseInt(yearPart, 10);
  if (isNaN(yearNum)) return null;
  const prevYear = yearNum - 1;
  return `${season}${prevYear.toString().padStart(2, "0")}`;
}

function validateReferenceInvariant(semesterShortName, semesterData) {
  if (!ENABLE_REFERENCE_SEM_INVARIANTS) return;
  if (!semesterData) return;
  if (!(semesterData.isFutureSemester || semesterData.isProjected)) return; // only validate future/projected
  const expected = computeExpectedReference(semesterShortName);
  if (!expected) return;
}

/**
 * Custom hook for managing unified course data
 * This replaces multiple hooks like useUpdateEnrolledCourses, useUpdateCourseInfo, etc.
 *
 * SIMPLIFIED VERSION: Removes legacy atom dependencies and focuses only on unified data
 */
export function useUnifiedCourseData() {
  const [courseData, setCourseData] = useRecoilState(unifiedCourseDataState);
  const [initializedSemesters, setInitializedSemesters] = useRecoilState(
    initializedSemestersState
  );

  /**
   * Initialize a semester with empty data structure
   */
  const initializeSemester = (semesterShortName, metadata = {}) => {
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
        if (metadataPatch.referenceSemester !== undefined) {
          logReferenceSemesterChange(
            semesterShortName,
            exists.referenceSemester,
            metadataPatch.referenceSemester,
            "INIT-MERGE"
          );
        }
        return {
          ...prev,
          semesters: {
            ...prev.semesters,
            [semesterShortName]: mergeSemester(exists, metadataPatch),
          },
        };
      }
      const newSemester = createSemesterStructure(metadata);
      if (newSemester.referenceSemester) {
        logReferenceSemesterChange(
          semesterShortName,
          null,
          newSemester.referenceSemester,
          "INIT"
        );
      }
      const updated = {
        ...prev,
        semesters: {
          ...(prev.semesters || {}),
          [semesterShortName]: newSemester,
        },
      };
      console.log(`✅ Initialized semester ${semesterShortName}`, newSemester);
      logUnifiedCourseDataSummary(semesterShortName, "INITIALIZE", updated);
      validateReferenceInvariant(semesterShortName, newSemester);
      return updated;
    });
    setInitializedSemesters((s) => new Set([...s, semesterShortName]));
  };

  // Core helper to patch a semester atomically without overwriting unrelated fields.
  const patchSemester = (semesterShortName, patch, options = {}) => {
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
        if (sanitizedPatch.referenceSemester !== undefined) {
          // This would only happen if allowMetadataOverwrite true; otherwise removed
          logReferenceSemesterChange(
            semesterShortName,
            null,
            sanitizedPatch.referenceSemester,
            "PATCH-AUTO-INIT"
          );
        } else if (
          patch.referenceSemester !== undefined &&
          !allowMetadataOverwrite
        )
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

      if (effectivePatch.referenceSemester !== undefined) {
        logReferenceSemesterChange(
          semesterShortName,
          existing.referenceSemester,
          effectivePatch.referenceSemester,
          "PATCH"
        );
      }
      const merged = mergeSemester(existing, effectivePatch);
      if (touchLastFetched) merged.lastFetched = new Date().toISOString();
      // Validate invariant after patch
      validateReferenceInvariant(semesterShortName, merged);
      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: merged,
        },
      };
    });
  };

  const updateSemesterMetadata = (semesterShortName, metadataPatch) => {
    patchSemester(semesterShortName, metadataPatch, {
      allowMetadataOverwrite: true,
    });
  };

  /**
   * Update enrolled course IDs for a semester
   * Now stores only course IDs/numbers instead of full course objects
   */
  const updateEnrolledCourses = (semesterShortName, courses) => {
    const enrolledIds = (courses || [])
      .map(
        (course) =>
          course.courses?.[0]?.courseNumber ||
          course.eventCourseNumber ||
          course.courseNumber ||
          course.id ||
          course.number ||
          course._id
      )
      .filter(Boolean);
    patchSemester(
      semesterShortName,
      { enrolledIds },
      { touchLastFetched: true }
    );
    console.log(
      `✅ Updated enrolled course IDs for ${semesterShortName}: ${enrolledIds.length} courses`,
      enrolledIds.slice(0, 5)
    );
  };

  /**
   * Update available courses for a semester
   */
  const updateAvailableCourses = (semesterShortName, courses) => {
    patchSemester(
      semesterShortName,
      { available: courses || [] },
      { touchLastFetched: true }
    );
    console.log(
      `✅ Updated available courses for ${semesterShortName}: ${
        (courses || []).length
      }`
    );
  };

  /**
   * Update selected course IDs for a semester
   * Now stores only course IDs/numbers instead of full course objects
   */
  const updateSelectedCourses = (semesterShortName, courseIds) => {
    const selectedIds = Array.isArray(courseIds)
      ? courseIds.filter(Boolean)
      : [];
    patchSemester(semesterShortName, { selectedIds });
    console.log(
      `✅ Updated selected course IDs for ${semesterShortName}: ${selectedIds.length} courses`,
      selectedIds.slice(0, 5)
    );
  };

  /**
   * Add a course ID to selected courses for a semester
   */
  const addSelectedCourse = (semesterShortName, course) => {
    setCourseData((prev) => {
      const semester = prev.semesters?.[semesterShortName];
      if (!semester) return prev; // Should be initialized beforehand
      const courseId =
        course.courses?.[0]?.courseNumber ||
        course.courseNumber ||
        course.id ||
        course.number ||
        course._id;
      if (!courseId) {
        console.warn("No valid course ID for", course);
        return prev;
      }
      if (semester.selectedIds.includes(courseId)) return prev; // no change
      const newSelectedIds = [...semester.selectedIds, courseId];
      const updatedFiltered = (semester.filtered || []).map((c) => {
        const id = c.courses?.[0]?.courseNumber || c.courseNumber || c.id;
        return id === courseId ? { ...c, selected: true } : c;
      });
      updatedFiltered.sort((a, b) => {
        if (a.enrolled && !b.enrolled) return -1;
        if (!a.enrolled && b.enrolled) return 1;
        if (!a.enrolled && !b.enrolled) {
          if (a.selected && !b.selected) return -1;
          if (!a.selected && b.selected) return 1;
        }
        return 0;
      });
      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: {
            ...semester,
            selectedIds: newSelectedIds,
            filtered: updatedFiltered,
          },
        },
      };
    });
  };

  /**
   * Remove a course ID from selected courses for a semester
   */
  const removeSelectedCourse = (semesterShortName, courseId) => {
    if (!courseId) return;
    setCourseData((prev) => {
      const semester = prev.semesters?.[semesterShortName];
      if (!semester) return prev;
      if (!semester.selectedIds.includes(courseId)) return prev;
      const newSelectedIds = semester.selectedIds.filter(
        (id) => id !== courseId
      );
      const updatedFiltered = (semester.filtered || []).map((c) => {
        const id = c.courses?.[0]?.courseNumber || c.courseNumber || c.id;
        return id === courseId ? { ...c, selected: false } : c;
      });
      updatedFiltered.sort((a, b) => {
        if (a.enrolled && !b.enrolled) return -1;
        if (!a.enrolled && b.enrolled) return 1;
        if (!a.enrolled && !b.enrolled) {
          if (a.selected && !b.selected) return -1;
          if (!a.selected && b.selected) return 1;
        }
        return 0;
      });
      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: {
            ...semester,
            selectedIds: newSelectedIds,
            filtered: updatedFiltered,
          },
        },
      };
    });
  };

  /**
   * Update study plan courses for a semester
   */
  const updateStudyPlan = (semesterShortName, studyPlanCourses) => {
    patchSemester(
      semesterShortName,
      { studyPlan: studyPlanCourses || [] },
      { touchLastFetched: true }
    );
    console.log(`✅ Updated study plan for ${semesterShortName}`);
  };

  /**
   * Update course ratings for a semester
   */
  const updateCourseRatings = (semesterShortName, ratings) => {
    let ratingsMap = {};
    if (Array.isArray(ratings)) {
      ratings.forEach((r) => {
        if (r._id && r.avgRating) ratingsMap[r._id] = r.avgRating;
      });
    } else if (ratings && typeof ratings === "object") {
      ratingsMap = ratings;
    }
    patchSemester(semesterShortName, { ratings: ratingsMap });
  };

  /**
   * Update course ratings for ALL semesters at once
   * Since ratings are global data that applies to all semesters
   */
  const updateCourseRatingsForAllSemesters = (ratings) => {
    let ratingsMap = {};
    if (Array.isArray(ratings)) {
      ratings.forEach((r) => {
        if (r._id && r.avgRating) ratingsMap[r._id] = r.avgRating;
      });
    } else if (ratings && typeof ratings === "object") {
      ratingsMap = ratings;
    }
    setCourseData((prev) => {
      const semesters = { ...(prev.semesters || {}) };
      Object.keys(semesters).forEach((s) => {
        semesters[s] = { ...semesters[s], ratings: ratingsMap };
      });
      return { ...prev, semesters };
    });
  };

  /**
   * Update filtered courses for a semester based on filter criteria
   * This applies the same filtering logic as filteredCoursesSelector but stores results in unified state
   */
  const updateFilteredCourses = (semesterShortName, filterOptions = {}) => {
    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      return; // can't filter without data
    }

    setCourseData((prev) => {
      const semesterData = prev.semesters?.[semesterShortName];
      if (!semesterData) return prev;

      // Get available courses to filter
      const coursesToFilter = semesterData.available || [];

      if (coursesToFilter.length === 0) {
        console.log(
          `⚠️ No available courses to filter for ${semesterShortName}`
        );
        return prev; // no change
      }

      console.log(
        `🔍 Filtering ${coursesToFilter.length} available courses for ${semesterShortName} with options:`,
        filterOptions
      );

      // Get ratings map BEFORE filtering so ratings are available during filter criteria
      const ratingsMap = semesterData.ratings || {};
      const enrolledIds = semesterData.enrolledIds || [];
      const selectedIds = semesterData.selectedIds || [];

      console.log(
        `🔍 [FILTERING] Using enrolled IDs (${enrolledIds.length}):`,
        enrolledIds.slice(0, 5),
        `and selected IDs (${selectedIds.length}):`,
        selectedIds.slice(0, 5)
      );

      // Attach ratings to courses BEFORE filtering
      const coursesWithRatings = coursesToFilter.map((course) => {
        // Try different ways to match ratings to courses
        let rating = null;

        // Method 1: Direct course ID match
        if (ratingsMap[course.id]) {
          rating = ratingsMap[course.id];
        }
        // Method 2: Course number match (direct property)
        else if (course.courseNumber && ratingsMap[course.courseNumber]) {
          rating = ratingsMap[course.courseNumber];
        }
        // Method 3: Course number match (nested in courses array)
        else if (
          course.courses?.[0]?.courseNumber &&
          ratingsMap[course.courses[0].courseNumber]
        ) {
          rating = ratingsMap[course.courses[0].courseNumber];
        }
        // Method 4: Try course shortName
        else if (ratingsMap[course.shortName]) {
          rating = ratingsMap[course.shortName];
        }
        // Method 5: Try alternative properties that might exist
        else {
          // Check what other properties might match
          const possibleKeys = [
            course._id,
            course.number,
            course.title,
            course.name,
          ];
          for (const key of possibleKeys) {
            if (key && ratingsMap[key]) {
              rating = ratingsMap[key];
              break;
            }
          }
        }

        return {
          ...course,
          avgRating: rating || course.avgRating, // Preserve existing rating if found
        };
      });

      // Apply filter criteria to courses WITH ratings
      const filtered = coursesWithRatings.filter((course) => {
        return applyFilterCriteria(course, filterOptions);
      });

      // Add enrollment and selection status to filtered courses
      const finalCourses = filtered.map((course) => {
        // Check if this course is enrolled using enrolledIds
        const courseNumber =
          course.courses?.[0]?.courseNumber || course.courseNumber || course.id;
        const isEnrolled = courseNumber && enrolledIds.includes(courseNumber);

        // Check if this course is selected using selectedIds
        const isSelected = courseNumber && selectedIds.includes(courseNumber);

        return {
          ...course,
          enrolled: isEnrolled, // Mark if course is enrolled
          selected: isSelected, // Mark if course is selected
        };
      });

      // Sort courses: enrolled first, then selected, then everything else
      const sortedFinalCourses = finalCourses.sort((a, b) => {
        // Priority 1: Enrolled courses first
        if (a.enrolled && !b.enrolled) return -1;
        if (!a.enrolled && b.enrolled) return 1;

        // Priority 2: Among non-enrolled, selected courses come first
        if (!a.enrolled && !b.enrolled) {
          if (a.selected && !b.selected) return -1;
          if (!a.selected && b.selected) return 1;
        }

        // If same status, maintain original order
        return 0;
      });

      const newData = {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: {
            ...semesterData,
            filtered: sortedFinalCourses,
          },
        },
      };

      console.log(
        `✅ Updated filtered courses for ${semesterShortName}: ${sortedFinalCourses.length} courses`
      );

      // Summary of selected courses
      const selectedCount = sortedFinalCourses.filter((c) => c.selected).length;
      const enrolledCount = sortedFinalCourses.filter((c) => c.enrolled).length;
      console.log(
        `📊 [SUMMARY] Selected: ${selectedCount}, Enrolled: ${enrolledCount}, Total: ${sortedFinalCourses.length}`
      );

      return newData;
    });
  };

  /**
   * Helper function to apply filter criteria (same as in filteredCoursesSelector)
   */
  const applyFilterCriteria = (course, selectionOptions) => {
    const classifications = selectionOptions.classifications || [];
    const ects = selectionOptions.ects || [];
    const ratings = selectionOptions.ratings || [];
    const courseLanguage = selectionOptions.courseLanguage || [];
    const lecturer = selectionOptions.lecturer || [];
    const searchTerm = selectionOptions.searchTerm || "";

    if (
      classifications.length > 0 &&
      !classifications.includes(course.classification)
    ) {
      return false;
    }

    if (ects.length > 0 && !ects.includes(course.credits)) {
      return false;
    }

    if (
      lecturer.length > 0 &&
      course.courses &&
      course.courses[0] &&
      course.courses[0].lecturers &&
      !course.courses[0].lecturers.some((lect) =>
        lecturer.includes(lect.displayName)
      )
    ) {
      return false;
    }

    if (ratings.length > 0) {
      const courseRating = course.avgRating;
      const minRequiredRating = Math.max(...ratings);

      // Only filter out courses if they have a rating and it's below the threshold
      // Courses without ratings will be included (they won't be filtered out)
      if (
        courseRating !== null &&
        courseRating !== undefined &&
        courseRating < minRequiredRating
      ) {
        return false;
      }
    }

    if (
      courseLanguage.length > 0 &&
      !courseLanguage.includes(course.courseLanguage?.code)
    ) {
      return false;
    }

    if (
      searchTerm.length > 0 &&
      !course.shortName.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    return true;
  };

  /**
   * Update filtered courses for ALL semesters at once
   * Useful when filter criteria changes globally
   * Now handles study plan data directly instead of using legacy selectedCourseIds atom
   */
  const updateFilteredCoursesForAllSemesters = (filterOptions = {}) => {
    setCourseData((prev) => {
      const semesters = { ...(prev.semesters || {}) };
      Object.keys(semesters).forEach((semesterShortName) => {
        const semesterData = semesters[semesterShortName];
        const coursesToFilter = semesterData.available || [];
        if (!coursesToFilter.length) {
          semesters[semesterShortName] = { ...semesterData, filtered: [] };
          return;
        }
        const ratingsMap = semesterData.ratings || {};
        const enrolledIds = semesterData.enrolledIds || [];
        const selectedIds = semesterData.selectedIds || [];
        const filtered = coursesToFilter.filter((course) =>
          applyFilterCriteria(course, filterOptions)
        );
        const coursesWithStatus = filtered.map((course) => {
          let rating = null;
          if (ratingsMap[course.id]) rating = ratingsMap[course.id];
          else if (course.courseNumber && ratingsMap[course.courseNumber])
            rating = ratingsMap[course.courseNumber];
          else if (
            course.courses?.[0]?.courseNumber &&
            ratingsMap[course.courses[0].courseNumber]
          )
            rating = ratingsMap[course.courses[0].courseNumber];
          else if (ratingsMap[course.shortName])
            rating = ratingsMap[course.shortName];
          const courseNumber =
            course.courses?.[0]?.courseNumber ||
            course.courseNumber ||
            course.id;
          const isEnrolled = courseNumber && enrolledIds.includes(courseNumber);
          const isSelected = courseNumber && selectedIds.includes(courseNumber);
          return {
            ...course,
            avgRating: rating || course.avgRating,
            enrolled: isEnrolled,
            selected: isSelected,
          };
        });
        coursesWithStatus.sort((a, b) => {
          if (a.enrolled && !b.enrolled) return -1;
          if (!a.enrolled && b.enrolled) return 1;
          if (!a.enrolled && !b.enrolled) {
            if (a.selected && !b.selected) return -1;
            if (!a.selected && b.selected) return 1;
          }
          return 0;
        });
        semesters[semesterShortName] = {
          ...semesterData,
          filtered: coursesWithStatus,
        };
      });
      return { ...prev, semesters };
    });
  };

  /**
   * Get data for a specific semester
   */
  const getSemesterData = (semesterShortName) => {
    return (
      (courseData.semesters && courseData.semesters[semesterShortName]) ||
      DEFAULT_SEMESTER_STRUCTURE
    );
  };

  /**
   * Check if a semester needs data refresh (based on lastFetched time)
   */
  const needsRefresh = (semesterShortName, maxAgeMinutes = 30) => {
    const semesterData = getSemesterData(semesterShortName);
    if (!semesterData.lastFetched) return true;

    const lastFetched = new Date(semesterData.lastFetched);
    const now = new Date();
    const ageMinutes = (now - lastFetched) / (1000 * 60);

    return ageMinutes > maxAgeMinutes;
  };

  /**
   * Log a detailed summary of the current unified course data state
   */
  const logUnifiedDataState = () => {
    logUnifiedDataOverview(courseData);
  };

  /**
   * Update the selected course info (for CourseInfo display)
   */
  const updateSelectedCourseInfo = (courseInfo) => {
    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
        selectedCourseInfo: prev.selectedCourseInfo,
      };

      const newData = {
        ...cleanPrev,
        selectedCourseInfo: courseInfo,
      };

      console.log(
        `🎯 Updated selected course info:`,
        courseInfo?.shortName || "cleared"
      );
      return newData;
    });
  };

  /**
   * Clear the selected course info
   */
  const clearSelectedCourseInfo = () => {
    updateSelectedCourseInfo(null);
  };

  return {
    courseData,
    initializedSemesters,
    initializeSemester,
    initializeSemesterData: initializeSemester, // Alias for consistency
    updateEnrolledCourses,
    updateEnrolledCoursesForSemester: updateEnrolledCourses, // Alias for consistency
    updateAvailableCourses,
    updateAvailableCoursesForSemester: updateAvailableCourses, // Alias for consistency
    updateSelectedCourses,
    updateSelectedCoursesForSemester: updateSelectedCourses, // Alias for consistency
    addSelectedCourse,
    removeSelectedCourse,
    updateStudyPlan, // New function for study plan data
    updateCourseRatings,
    updateCourseRatingsForSemester: updateCourseRatings, // Alias for consistency
    updateCourseRatingsForAllSemesters, // New function for global ratings
    updateFilteredCourses, // New function for filtered courses
    updateFilteredCoursesForSemester: updateFilteredCourses, // Alias for consistency
    updateFilteredCoursesForAllSemesters, // New function for global filtered courses
    updateSelectedCourseInfo, // New function for selected course info
    clearSelectedCourseInfo, // New function to clear selected course info
    getSemesterData,
    needsRefresh,
    logUnifiedDataState, // Debug function to log current state
    updateSemesterMetadata, // Explicit metadata patcher
  };
}
