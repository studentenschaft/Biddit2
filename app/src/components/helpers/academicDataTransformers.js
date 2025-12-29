/**
 * academicDataTransformers.js
 *
 * Pure utility functions for transforming academic data.
 * Extracted from unifiedAcademicDataSelector.js for reusability and testability.
 * These functions are called during data fetching to transform once, not on every read.
 */

import { transformScorecard } from './transformScorecard';

/**
 * Find the main program using intelligent fallback strategy
 * Priority: explicitly marked > Master > Bachelor > first available
 * @param {Object} programs - Object with programId keys and program data values
 * @returns {string|null} - The main program ID or null if no programs
 */
export const findMainProgram = (programs) => {
  if (!programs || Object.keys(programs).length === 0) {
    return null;
  }

  const programEntries = Object.entries(programs);

  // Strategy 1: Look for explicitly marked main program
  const explicitMain = programEntries.find(([, data]) => data.isMainStudy);
  if (explicitMain) {
    return explicitMain[0];
  }

  // Strategy 2: Prefer Master programs
  const masterProgram = programEntries.find(([programId]) =>
    programId.toLowerCase().includes('master')
  );
  if (masterProgram) {
    return masterProgram[0];
  }

  // Strategy 3: Then Bachelor programs
  const bachelorProgram = programEntries.find(([programId]) =>
    programId.toLowerCase().includes('bachelor')
  );
  if (bachelorProgram) {
    return bachelorProgram[0];
  }

  // Strategy 4: First available program
  return programEntries[0]?.[0] || null;
};

/**
 * Extract completed courses from hierarchical scorecard structure
 * @param {Array} items - Hierarchical items from rawScorecard
 * @param {number} level - Current nesting level (for tracking)
 * @returns {Array} - Flat array of completed courses with metadata
 */
export const extractCompletedCourses = (items, level = 0) => {
  const completedCourses = [];

  (items || []).forEach(item => {
    if (item.items && Array.isArray(item.items)) {
      completedCourses.push(...extractCompletedCourses(item.items, level + 1));
    } else if (!item.isTitle && item.gradeText && item.gradeText !== "") {
      completedCourses.push({
        ...item,
        level,
        source: 'completed',
        isCompleted: true
      });
    }
  });

  return completedCourses;
};

/**
 * Build transcript view from raw scorecard data
 * Preserves hierarchical structure for official transcript display
 * @param {Object} rawScorecard - Raw scorecard from university API
 * @returns {Object} - Transcript view with programInfo, hierarchical structure, and course lists
 */
export const buildTranscriptView = (rawScorecard) => {
  if (!rawScorecard) {
    return {
      programInfo: {},
      hierarchicalStructure: [],
      completedCourses: [],
      plannedCourses: []
    };
  }

  const completedCourses = extractCompletedCourses(rawScorecard.items);

  return {
    programInfo: {
      creditsDE: rawScorecard.creditsDe,
      creditsEN: rawScorecard.creditsEn,
      creditsFulfilledDE: rawScorecard.creditsFulfilledDe,
      creditsFulfilledEN: rawScorecard.creditsFulfilledEn,
      isProcessing: rawScorecard.isProcessing,
      minCreditsDE: rawScorecard.minCreditsDe,
      minCreditsEN: rawScorecard.minCreditsEn
    },
    hierarchicalStructure: rawScorecard.items || [],
    completedCourses,
    plannedCourses: [] // Populated later when merging with wishlist
  };
};

/**
 * Calculate program statistics from courses
 * @param {Array} enrolledCourses - Completed/enrolled courses
 * @param {Array} selectedCourses - Planned/wishlist courses
 * @param {Object} rawScorecard - Raw scorecard for credit requirements
 * @returns {Object} - Program statistics
 */
export const calculateProgramStats = (enrolledCourses, selectedCourses, rawScorecard = {}) => {
  const creditsEarned = enrolledCourses.reduce((sum, course) => {
    const credits = parseFloat(course.credits || course.ects || 0);
    return sum + (isNaN(credits) ? 0 : credits);
  }, 0);

  const creditsRequired = parseFloat(rawScorecard.creditsDe || 0) +
                         parseFloat(rawScorecard.creditsEn || 0);

  const completionPercentage = creditsRequired > 0
    ? Math.round((creditsEarned / creditsRequired) * 100)
    : 0;

  return {
    creditsEarned,
    creditsRequired,
    coursesCompleted: enrolledCourses.length,
    coursesPlanned: selectedCourses.length,
    completionPercentage
  };
};

/**
 * Enrich a course ID with full course data from available courses
 * Uses multiple fallback strategies to find course data
 * @param {string} courseId - Course identifier to enrich
 * @param {Array} availableCourses - Available courses to search
 * @param {Object} semesterData - Semester data with enrolled IDs
 * @returns {Object} - Enriched course object
 */
export const enrichCourseFromAvailable = (courseId, availableCourses, semesterData = {}) => {
  const enrolledIds = semesterData.enrolledIds || [];

  // Try to find full course data
  const fullCourse = availableCourses.find(course =>
    course.courseNumber === courseId ||
    course.id === courseId ||
    course.courses?.[0]?.courseNumber === courseId
  );

  if (fullCourse) {
    return {
      id: courseId,
      courseId: courseId,
      name: fullCourse.shortName || fullCourse.name || courseId,
      credits: fullCourse.credits != null ? parseFloat(fullCourse.credits) / 100 : 3,
      type: fullCourse.classification || 'elective',
      classification: fullCourse.classification,
      avgRating: fullCourse.avgRating,
      source: 'planned',
      status: 'planned',
      isCompleted: false,
      isPlanned: true,
      isEnriched: true,
      isAssigned: enrolledIds.includes(courseId)
    };
  }

  // Fallback when course not found
  return {
    id: courseId,
    courseId: courseId,
    name: courseId,
    credits: 3,
    type: 'elective',
    source: 'planned',
    status: 'planned',
    isCompleted: false,
    isPlanned: true,
    isEnriched: false,
    isAssigned: enrolledIds.includes(courseId)
  };
};

/**
 * Get available courses for a semester with fallback logic
 * @param {string} semesterKey - Target semester
 * @param {Object} semesters - All semesters data from unifiedCourseDataState
 * @returns {Array} - Available courses (may be from reference semester)
 */
export const getAvailableCoursesWithFallback = (semesterKey, semesters) => {
  let availableCourses = semesters?.[semesterKey]?.available || [];

  if (availableCourses.length > 0) {
    return availableCourses;
  }

  const semesterData = semesters?.[semesterKey];

  // For projected/future semesters, try their reference semester
  if (semesterData?.isProjected && semesterData.referenceSemester) {
    const referenceSemesterData = semesters[semesterData.referenceSemester];
    if (referenceSemesterData?.available?.length > 0) {
      return referenceSemesterData.available;
    }
  }

  // Try current semester as fallback
  const currentSemesterKey = Object.keys(semesters || {}).find(key =>
    semesters[key].isCurrent
  );
  if (currentSemesterKey && currentSemesterKey !== semesterKey) {
    const currentSemesterData = semesters[currentSemesterKey];
    if (currentSemesterData?.available?.length > 0) {
      return currentSemesterData.available;
    }
  }

  return [];
};

/**
 * Build study overview view for a single semester
 * @param {string} semesterKey - Semester identifier
 * @param {Array} enrolledCourses - Completed courses from transcript
 * @param {Array} selectedCourseIds - IDs of selected/wishlist courses
 * @param {Array} availableCourses - Available courses for enrichment
 * @param {Array} enrolledIdsFromUnified - Enrolled IDs from unified state
 * @returns {Object} - Semester study overview data
 */
export const buildSemesterStudyOverview = (
  semesterKey,
  enrolledCourses,
  selectedCourseIds,
  availableCourses,
  enrolledIdsFromUnified = []
) => {
  // Enrich selected courses
  const selectedCourses = selectedCourseIds.map(courseId =>
    enrichCourseFromAvailable(courseId, availableCourses, { enrolledIds: enrolledIdsFromUnified })
  );

  // Filter out courses already in enrolled
  const filteredSelectedCourses = selectedCourses.filter(course =>
    !enrolledCourses.some(enrolled =>
      enrolled.courseId === course.courseId ||
      enrolled.id === course.id ||
      enrolled.courseId === course.id
    )
  );

  return {
    enrolledCourses: enrolledCourses.map(course => ({
      ...course,
      source: 'completed',
      status: 'completed',
      isCompleted: true,
      isPlanned: false
    })),
    selectedCourses: filteredSelectedCourses.map(course => ({
      ...course,
      source: 'planned',
      status: 'planned',
      isCompleted: false,
      isPlanned: true
    })),
    semesterStats: {
      creditsEarned: enrolledCourses.reduce((sum, course) => {
        const credits = parseFloat(course.credits || course.ects || 0);
        return sum + (isNaN(credits) ? 0 : credits);
      }, 0),
      coursesCompleted: enrolledCourses.length,
      coursesPlanned: filteredSelectedCourses.length,
      hasActivity: enrolledCourses.length > 0 || filteredSelectedCourses.length > 0
    }
  };
};

/**
 * Build complete study overview view for a program
 * Transforms scorecard + unified course data into semester-based planning view
 * @param {Object} rawScorecard - Raw scorecard from university API
 * @param {Object} unifiedCourseData - Unified course data state
 * @param {string} programId - Program identifier
 * @param {boolean} isMainProgram - Whether this is the main program
 * @returns {Object} - Study overview keyed by semester
 */
export const buildStudyOverviewView = (rawScorecard, unifiedCourseData, programId, isMainProgram) => {
  const transformedScorecard = transformScorecard(rawScorecard);
  const studyOverviewView = {};

  // Collect all semesters from both sources
  const allSemesters = new Set([
    ...Object.keys(transformedScorecard || {}),
    ...Object.keys(unifiedCourseData?.semesters || {})
  ]);

  allSemesters.forEach(semesterKey => {
    const enrolledCourses = transformedScorecard?.[semesterKey] || [];
    const enrolledIdsFromUnified = unifiedCourseData?.semesters?.[semesterKey]?.enrolledIds || [];

    // Only include selected courses for main program
    const selectedIdsFromUnified = isMainProgram
      ? (unifiedCourseData?.semesters?.[semesterKey]?.selectedIds || [])
      : [];

    // Union enrolled and selected IDs
    const selectedCourseIds = Array.from(
      new Set([...selectedIdsFromUnified, ...enrolledIdsFromUnified])
    );

    const availableCourses = getAvailableCoursesWithFallback(
      semesterKey,
      unifiedCourseData?.semesters
    );

    studyOverviewView[semesterKey] = buildSemesterStudyOverview(
      semesterKey,
      enrolledCourses,
      selectedCourseIds,
      availableCourses,
      enrolledIdsFromUnified
    );
  });

  return studyOverviewView;
};

/**
 * Transform raw scorecard data into unified academic data structure
 * This is the main entry point called during data fetching
 * @param {Object} rawScorecards - Raw scorecards keyed by program ID
 * @param {Object} unifiedCourseData - Unified course data state
 * @returns {Object} - Transformed data ready for unifiedAcademicDataState
 */
export const transformScorecardToUnifiedFormat = (rawScorecards, unifiedCourseData) => {
  if (!rawScorecards || Object.keys(rawScorecards).length === 0) {
    return {
      programs: {},
      currentProgram: null
    };
  }

  const mainProgramId = findMainProgram(rawScorecards);
  const programs = {};
  let overallStats = {
    totalCreditsEarned: 0,
    totalCreditsRequired: 0,
    totalCoursesCompleted: 0,
    totalCoursesPlanned: 0,
    completionPercentage: 0
  };

  Object.entries(rawScorecards).forEach(([programId, rawData]) => {
    const isMainProgram = programId === mainProgramId;
    const transcriptView = buildTranscriptView(rawData);
    const studyOverviewView = buildStudyOverviewView(
      rawData,
      unifiedCourseData,
      programId,
      isMainProgram
    );

    // Calculate program stats
    const programStats = calculateProgramStats(
      transcriptView.completedCourses,
      Object.values(studyOverviewView).flatMap(s => s.selectedCourses || []),
      rawData
    );

    programs[programId] = {
      transcript: {
        rawScorecard: rawData,
        processedTranscript: transcriptView,
        mergedTranscript: null, // Set later when wishlist is merged
        lastFetched: Date.now()
      },
      studyPlan: {
        semesterMap: studyOverviewView,
        progress: {
          totalCreditsRequired: programStats.creditsRequired,
          totalCreditsCompleted: programStats.creditsEarned,
          totalCreditsPlanned: 0, // Calculated from wishlist
          completionPercentage: programStats.completionPercentage,
          estimatedCompletion: null
        },
        lastUpdated: Date.now()
      },
      metadata: {
        programId,
        isMainStudy: rawData.isMainStudy || isMainProgram,
        programType: programId.toLowerCase().includes('master') ? 'master' :
                     programId.toLowerCase().includes('bachelor') ? 'bachelor' : 'other',
        requirementsFulfilled: {
          creditsDE: rawData.creditsFulfilledDe === true,
          creditsEN: rawData.creditsFulfilledEn === true,
          overall: rawData.creditsFulfilledDe === true && rawData.creditsFulfilledEn === true
        }
      }
    };

    // Accumulate overall stats
    overallStats.totalCreditsEarned += programStats.creditsEarned;
    overallStats.totalCreditsRequired += programStats.creditsRequired;
    overallStats.totalCoursesCompleted += programStats.coursesCompleted;
    overallStats.totalCoursesPlanned += programStats.coursesPlanned;
  });

  overallStats.completionPercentage = overallStats.totalCreditsRequired > 0
    ? Math.round((overallStats.totalCreditsEarned / overallStats.totalCreditsRequired) * 100)
    : 0;

  return {
    programs,
    currentProgram: mainProgramId,
    overallProgress: overallStats
  };
};
