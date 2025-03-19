// mergeWishlistedCourses.js //

/**
 * Merges wishlisted courses into the existing scorecards data.
 * 
 * @param {Object} scorecards 
 * @param {Array} studyPlan 
 * @param {Object} cisIdToSemesterNameMap 
 * @param {Function} handleError 
 * @param {String} authToken 
 * @param {String} currentSemester 
 * @param {Object} categoryTypeMap 
 * @returns {Object} The updated scorecards with wishlisted courses added.
 */

import { getLightCourseDetails } from "../helpers/api";
import { 
  isSemesterInPast,
  removeSpacesFromSemesterName 
} from "../helpers/studyOverviewHelpers";


export async function mergeWishlistedCourses(
  scorecards,
  studyPlan,
  cisIdToSemesterNameMap,
  handleError,
  authToken,
  currentSemester,
  categoryTypeMap
) {

  if (!studyPlan) {
    console.warn("Study plan is null or undefined");
    return scorecards;
  }
  if (!scorecards || typeof scorecards !== "object") {
    console.warn("Invalid scorecards structure");
    return scorecards;
  }

  const updatedScorecards = JSON.parse(JSON.stringify(scorecards));

  const cleanedCurrentSemester = removeSpacesFromSemesterName(currentSemester);
  const lightCourseCache = {};

  for (const [programName, semesterMap] of Object.entries(updatedScorecards)) {
    if (!semesterMap || typeof semesterMap !== "object") {
      console.warn("Invalid semester map structure");
      continue;
    }

    for (const plan of studyPlan) {
      const semesterCisId = plan.id;
      const semesterLabel = cisIdToSemesterNameMap[semesterCisId] || "Unassigned";

      // Skip processing if semester is in the past
      if (isSemesterInPast(
        removeSpacesFromSemesterName(semesterLabel),
        removeSpacesFromSemesterName(cleanedCurrentSemester)
      )) {
        continue;
      }

      try {
        // Ensure we have fetched and cached the data
        if (!lightCourseCache[semesterCisId]) {
          const semesterCourseData = await getLightCourseDetails(
            semesterCisId,
            authToken
          );
          lightCourseCache[semesterCisId] = flattenSemesterCourses(semesterCourseData);
        }

        const courseDict = lightCourseCache[semesterCisId];
        if (!courseDict) continue;

        // 5. Get or create the array for that semester
        if (!semesterMap[semesterLabel]) {
          semesterMap[semesterLabel] = [];
        }
        const existingCourses = semesterMap[semesterLabel];

        // Build a set of existing IDs for fast membership test
        const existingIds = new Set(existingCourses.map(c => c.id));

        // 6. Process each wishlisted course
        for (const courseId of plan.courses || []) {
          // Skip if already exists (enrolled or previously merged)
          if (existingIds.has(courseId)) {
            continue;
          }

          // Lookup in the flattened dictionary
          const normalizedCourse = courseDict[courseId];
          if (!normalizedCourse) {
            continue; // Not found, skip
          }
          
          // Look up type from categoryTypeMap using classification
          const courseType = categoryTypeMap[normalizedCourse.classification] || 'unknown';

          const wishlistItem = {
            name: normalizedCourse.shortName || courseId,
            credits: normalizedCourse.credits
              ? parseFloat(normalizedCourse.credits) / 100
              : 0,
            type: `${normalizedCourse.classification}-wishlist` || "Unknown-wishlist",
            big_type: courseType,
            id: courseId,
            calendarEntry: normalizedCourse.calendarEntry || [],
          };

          // Add it to the semester array
          existingCourses.push(wishlistItem);
          existingIds.add(courseId); // Keep the set in sync
        }
      } catch (error) {
        console.error(`Error processing semester ${semesterLabel}:`, error);
        handleError(error);
      }
    }
  }

  return updatedScorecards;
}


/**
 * Helper: Flatten top-level courses & nested subcourses into a single dictionary.
 * Keys = courseId, Values = "normalized" course object.
 */
function flattenSemesterCourses(semesterCourseData = []) {
  const courseDict = {};

  for (const course of semesterCourseData) {
    // Main course
    courseDict[course.id] = { ...course };

    // Subcourses
    if (Array.isArray(course.courses)) {
      for (const sub of course.courses) {
        courseDict[sub.id] = {
          ...course,
          ...sub,
          credits: course.credits // preserve top-level credits if sub is missing
        };
      }
    }
  }

  return courseDict;
}